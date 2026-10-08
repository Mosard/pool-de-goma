import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import { CommentForm } from "../comment-form";
import { TransitionActions } from "../transition-actions";
import { getAvailableTransitions } from "@/lib/workflow";
import { parseFieldsSchema } from "@/lib/form-schema";
import { PERMISSIONS } from "@/lib/rbac-data";
import { FicheEditor } from "@/components/fiches/fiche-editor";
import { PdfButtons } from "@/components/pdf-buttons";
import { REPORT_SCOPE_INCLUDE, canReadScope, reportScope, reportTrack } from "@/lib/fiches/report-scope";
import { IPP_STAGE_LABELS, TRACK_ACTIONS, availableTrackActions, canWorkOnReport } from "@/lib/cells/rules";
import { activeCells, ippHistory, loadCellActor } from "@/lib/cells/server";
import { IppTrackPanel } from "../ipp-track-panel";
import { resolveFicheDef } from "@/lib/fiches/defs/index";
import { ficheData, workflowStatusById } from "@/lib/fiches/server";
import { loadActor, synthesesIncludingReport } from "@/lib/synthese/server";
import { SYNTHESIS_STATUS_LABELS } from "@/lib/synthese/rules";

export default async function RapportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      ...REPORT_SCOPE_INCLUDE,
      inspection: {
        include: {
          school: { include: { pool: true } },
          inspector: true,
          forms: { include: { formTemplate: { include: { category: true } } } },
        },
      },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!report) notFound();

  const user = session.user;
  const scope = reportScope(report);
  const statuses = await workflowStatusById();
  // Règle centrale de lecture (POOL, secrétariat, cellule, IPP : signé seulement), droits relus en base.
  const actor = await loadCellActor(user.id);
  const track = reportTrack(report);
  if (!canReadScope(actor, scope, track)) notFound();

  const canComment = canWorkOnReport(actor, scope, track);
  const trackActions = track
    ? availableTrackActions(actor, track).map((a) => ({
        key: a,
        label: TRACK_ACTIONS[a].label,
        needsCell: a === "assign" || a === "reassign",
        commentRequired: TRACK_ACTIONS[a].commentRequired,
      }))
    : [];
  const [cells, ippEvents] = await Promise.all([
    trackActions.some((a) => a.needsCell) ? activeCells(actor.organizationId) : Promise.resolve([]),
    track ? ippHistory(report.id) : Promise.resolve([]),
  ]);
  const trackCell = report.ippTrack?.cellId ? await prisma.cell.findUnique({ where: { id: report.ippTrack.cellId }, select: { code: true, name: true } }) : null;

  const allTransitions = await getAvailableTransitions(report.id, user.permissions, scope.poolId, scope.organizationId);
  // « Resoumettre » appartient à l'auteur, depuis sa fiche.
  const transitions = allTransitions.filter((t) => t.allowedPermissionKey !== PERMISSIONS.INSPECTIONS_CONDUCT || scope.authorId === user.id);

  const form = report.form;
  const def = form ? resolveFicheDef(form.formTemplate) : null;
  const hasReservedPart = Boolean(def?.sections.some((s) => s.blocks.some((b) => (b.kind === "field" || b.kind === "signature") && b.notForAuthor)));
  const editorMode = hasReservedPart && canComment && scope.authorId !== user.id ? "reserved" : "view";
  const legacyForms = form ? (def ? [] : [form]) : (report.inspection?.forms ?? []);
  // Synthèses lisibles par ce compte qui reprennent ce rapport (remonter de la source vers la synthèse).
  const syntheses = await synthesesIncludingReport(await loadActor(user.id), report.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope.title}
        description={[`Inspecteur : ${scope.authorName}`, scope.number].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="blue">{report.status.label}</Badge>
            <PdfButtons reportId={report.id} filename={`${scope.code ?? "rapport"}-${(scope.number ?? report.id).replaceAll("/", "-")}.pdf`} />
          </div>
        }
      />

      <Card>
        {form ? (
          <p className="text-sm text-gray-700">
            Fiche {form.formTemplate.code} (version {form.formTemplate.version})
            {form.inspectionId && (
              <>
                {" · "}
                <Link href={`/inspections/${form.inspectionId}`} className="font-medium text-blue-600 hover:underline">
                  Visite de l&apos;école
                </Link>
              </>
            )}
          </p>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Résumé</h3>
            <p className="text-sm text-gray-700">{report.summary}</p>
            {report.recommendations && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-900">Recommandations</h3>
                <p className="text-sm text-gray-700">{report.recommendations}</p>
              </>
            )}
          </>
        )}
        {transitions.length > 0 && <TransitionActions reportId={report.id} transitions={transitions} />}
      </Card>

      {form && def && (
        <FicheEditor formId={form.id} userId={user.id} def={def} initial={ficheData(form)} serverUpdatedAt={form.updatedAt.toISOString()} mode={editorMode} />
      )}

      {legacyForms.map((f) => {
        const fields = parseFieldsSchema(f.formTemplate.fieldsSchema);
        const data = f.data as Record<string, string>;
        return (
          <Card key={f.id}>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">{f.formTemplate.title}</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.name}>
                  <dt className="text-gray-500">{field.label}</dt>
                  <dd className="font-medium text-gray-900">{data[field.name] || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
        );
      })}

      {report.ippTrack && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Circuit de l&apos;IPP</h3>
            <Badge
              color={
                report.ippTrack.stage === "SIGNE" ? "green" : report.ippTrack.stage === "AU_SECRETARIAT" || report.ippTrack.stage === "VALIDE" ? "orange" : "blue"
              }
            >
              {IPP_STAGE_LABELS[report.ippTrack.stage]}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {trackCell ? (
              <>
                Cellule : <strong className="text-gray-900">{trackCell.code}</strong> — {trackCell.name}
              </>
            ) : report.ippTrack.legacy ? (
              "Rapport antérieur au circuit des cellules : cellule indéterminable, à orienter par le secrétariat."
            ) : (
              "Au secrétariat de l'IPP, en attente d'envoi à une cellule."
            )}
          </p>
          {ippEvents.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-gray-600">
              {ippEvents.map((e) => (
                <li key={e.id}>
                  {new Date(e.createdAt).toLocaleString("fr-FR")} — {e.actor.name} — {IPP_STAGE_LABELS[e.toStage]}
                  {e.fromCell ? ` (de ${e.fromCell.code} vers ${e.cell?.code ?? "?"})` : e.cell ? ` (${e.cell.code})` : ""}
                  {e.comment && <span className="text-gray-400"> — {e.comment}</span>}
                </li>
              ))}
            </ul>
          )}
          <IppTrackPanel reportId={report.id} actions={trackActions} cells={cells.map((c) => ({ id: c.id, code: c.code, name: c.name }))} />
        </Card>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Historique du circuit</h3>
        {report.statusHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune transition enregistrée.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-600">
            {report.statusHistory.map((h) => (
              <li key={h.id}>
                {h.changedBy.name} — {statuses.get(h.toStatusId)?.label} — {new Date(h.createdAt).toLocaleString("fr-FR")}
                {h.comment && <span className="text-gray-400"> — {h.comment}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {syntheses.length > 0 && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Synthèses qui reprennent ce rapport</h3>
          <ul className="space-y-2 text-sm">
            {syntheses.map((s) => (
              <li key={s.id}>
                <Link href={`/syntheses/${s.id}`} className="font-medium text-blue-600 hover:underline">
                  {s.title}
                </Link>
                <span className="text-gray-500">
                  {" "}
                  — {s.reference ?? "non soumise"} · {SYNTHESIS_STATUS_LABELS[s.status]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Observations</h3>
        <div className="mb-4 space-y-3">
          {report.comments.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune observation pour le moment.</p>
          ) : (
            report.comments.map((c) => (
              <div key={c.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{c.author.name}</p>
                <p className="text-gray-600">{c.content}</p>
              </div>
            ))
          )}
        </div>
        {canComment && <CommentForm reportId={report.id} />}
      </Card>
    </div>
  );
}
