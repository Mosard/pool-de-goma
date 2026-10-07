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
import { hasPermission } from "@/lib/permissions";
import { FicheEditor } from "@/components/fiches/fiche-editor";
import { PdfButtons } from "@/components/pdf-buttons";
import { REPORT_SCOPE_INCLUDE, canReadScope, reportScope } from "@/lib/fiches/report-scope";
import { resolveFicheDef } from "@/lib/fiches/defs/index";
import { ficheData, workflowStatusById } from "@/lib/fiches/server";

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
  if (!canReadScope(user, scope)) notFound();

  const target = { poolId: scope.poolId, organizationId: scope.organizationId };
  const canComment =
    hasPermission(user.permissions, PERMISSIONS.REPORTS_REVIEW_POOL, target) ||
    hasPermission(user.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE, target) ||
    hasPermission(user.permissions, PERMISSIONS.REPORTS_VALIDATE, target);

  const allTransitions = await getAvailableTransitions(report.id, user.permissions, scope.poolId, scope.organizationId);
  // « Resoumettre » appartient à l'auteur, depuis sa fiche.
  const transitions = allTransitions.filter((t) => t.allowedPermissionKey !== PERMISSIONS.INSPECTIONS_CONDUCT || scope.authorId === user.id);

  const form = report.form;
  const def = form ? resolveFicheDef(form.formTemplate) : null;
  const hasReservedPart = Boolean(def?.sections.some((s) => s.blocks.some((b) => (b.kind === "field" || b.kind === "signature") && b.notForAuthor)));
  const editorMode = hasReservedPart && canComment && scope.authorId !== user.id ? "reserved" : "view";
  const legacyForms = form ? (def ? [] : [form]) : (report.inspection?.forms ?? []);

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
