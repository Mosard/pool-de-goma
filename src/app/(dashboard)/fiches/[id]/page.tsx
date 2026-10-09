import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { FicheEditor } from "@/components/fiches/fiche-editor";
import { FicheForm } from "@/app/(dashboard)/inspections/fiche-form";
import { deleteDraftFicheAction, saveLegacyFicheAction, submitFicheAction } from "@/app/(dashboard)/fiches/actions";
import { canReadScope } from "@/lib/fiches/report-scope";
import { trackInfo } from "@/lib/cells/server";
import { FORM_INCLUDE, ficheData, formAuthorId, formDef, formPool, instanceLabel, isFormEditable, workflowStatusById } from "@/lib/fiches/server";
import { WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";

export default async function FichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const form = await prisma.form.findUnique({ where: { id }, include: FORM_INCLUDE });
  if (!form) notFound();
  const pool = formPool(form);
  const authorId = formAuthorId(form);
  // Règle centrale : la branche IPP du rapport (s'il existe) borne la lecture (cellule, IPP : signé seulement).
  const track = trackInfo(form.report?.ippTrack, form.report?.synthesisSources);
  if (!canReadScope(user, { poolId: pool?.id ?? null, organizationId: pool?.organizationId ?? null, authorId }, track)) notFound();

  const isAuthor = authorId === user.id;
  // Les exploitants travaillent sur le rapport, pas sur la saisie.
  if (!isAuthor && form.report) redirect(`/rapports/${form.report.id}`);

  const def = formDef(form);
  const editable = isAuthor && isFormEditable(form);
  const report = form.report;
  const statuses = await workflowStatusById();
  const statusOf = (id: string) => statuses.get(id);
  const correction = report?.status.key === WORKFLOW_STATUS_KEYS.A_CORRIGER
    ? [...report.statusHistory].reverse().find((h) => statusOf(h.toStatusId)?.key === WORKFLOW_STATUS_KEYS.A_CORRIGER)
    : null;
  const back = form.inspectionId ? `/inspections/${form.inspectionId}` : "/fiches";
  const label = instanceLabel(def, ficheData(form));

  async function submitLegacy() {
    "use server";
    await submitFicheAction(id, null);
  }

  return (
    <div className="space-y-6">
      <Link href={back} className="text-xs font-medium text-blue-600 hover:underline">
        ← {form.inspection ? form.inspection.school.name : "Fiches de période"}
      </Link>
      <PageHeader
        title={form.formTemplate.title}
        description={[label, form.inspection?.school.name ?? pool?.name, form.number].filter(Boolean).join(" · ")}
        actions={report ? <Badge color={report.status.key === "A_CORRIGER" ? "red" : report.status.key === "VALIDE" ? "green" : "blue"}>{report.status.label}</Badge> : <Badge color="gray">Brouillon</Badge>}
      />

      {correction && (
        <Alert variant="error">
          <strong>Correction demandée</strong> par {correction.changedBy.name}
          {correction.comment ? ` : « ${correction.comment} »` : "."} Corrigez la fiche puis soumettez-la de nouveau.
        </Alert>
      )}

      {report && (report.comments.length > 0 || report.statusHistory.length > 0) && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Suivi du rapport</h3>
          <ul className="space-y-1 text-xs text-gray-600">
            {report.statusHistory.map((h) => (
              <li key={h.id}>
                {new Date(h.createdAt).toLocaleString("fr-FR")} — {statusOf(h.toStatusId)?.label} ({h.changedBy.name})
                {h.comment && <span className="text-gray-400"> — {h.comment}</span>}
              </li>
            ))}
          </ul>
          {report.comments.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-gray-400">Observations des exploitants</p>
              {report.comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                  <p className="font-medium text-gray-900">{c.author.name}</p>
                  <p className="text-gray-600">{c.content}</p>
                </div>
              ))}
            </div>
          )}
          <Link href={`/rapports/${report.id}`} className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline">
            Ouvrir le rapport
          </Link>
        </Card>
      )}

      {def ? (
        <FicheEditor formId={form.id} userId={user.id} def={def} initial={ficheData(form)} serverUpdatedAt={form.updatedAt.toISOString()} mode={editable ? "edit" : "view"} />
      ) : (
        <>
          <FicheForm
            action={saveLegacyFicheAction.bind(null, form.id)}
            template={{ id: form.formTemplate.id, title: form.formTemplate.title, fieldsSchema: form.formTemplate.fieldsSchema, category: { label: "Fiche simulée (provisoire)" } }}
            existingData={(form.data as Record<string, string>) ?? undefined}
            completed={form.completed}
            readOnly={!editable}
          />
          {editable && form.completed && (
            <form action={submitLegacy}>
              <Button type="submit">Soumettre la fiche</Button>
            </form>
          )}
        </>
      )}

      {editable && !report && !form.number && (
        <form action={deleteDraftFicheAction.bind(null, form.id)}>
          <Button type="submit" variant="danger">
            Supprimer ce brouillon
          </Button>
        </form>
      )}
    </div>
  );
}
