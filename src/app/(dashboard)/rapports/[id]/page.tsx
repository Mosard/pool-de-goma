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
      status: true,
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
  const poolId = report.inspection.school.poolId;
  const organizationId = report.inspection.school.pool.organizationId;
  const canComment =
    hasPermission(user.permissions, PERMISSIONS.REPORTS_REVIEW_POOL, { poolId, organizationId }) ||
    hasPermission(user.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE, { poolId, organizationId }) ||
    hasPermission(user.permissions, PERMISSIONS.REPORTS_VALIDATE, { poolId, organizationId });

  const transitions = await getAvailableTransitions(report.id, user.permissions, poolId, organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.inspection.school.name}
        description={`Inspecteur : ${report.inspection.inspector.name}`}
        actions={<Badge color="blue">{report.status.label}</Badge>}
      />

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Résumé</h3>
        <p className="text-sm text-gray-700">{report.summary}</p>
        {report.recommendations && (
          <>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-900">Recommandations</h3>
            <p className="text-sm text-gray-700">{report.recommendations}</p>
          </>
        )}
        {transitions.length > 0 && <TransitionActions reportId={report.id} transitions={transitions} />}
      </Card>

      {report.inspection.forms.map((form) => {
        const fields = parseFieldsSchema(form.formTemplate.fieldsSchema);
        const data = form.data as Record<string, string>;
        return (
          <Card key={form.id}>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">{form.formTemplate.title}</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.name}>
                  <dt className="text-gray-500">{f.label}</dt>
                  <dd className="font-medium text-gray-900">{data[f.name] || "—"}</dd>
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
                {h.changedBy.name} — {new Date(h.createdAt).toLocaleString("fr-FR")}
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
