import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, Button } from "@/components/ui";
import { FICHE_DEFINITIONS, type FicheType } from "@/lib/fiches";
import { CommentForm } from "../comment-form";
import { validateReportAction } from "../actions";

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
      inspection: {
        include: {
          school: true,
          inspector: true,
          forms: true,
        },
      },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!report) notFound();

  const canValidate = session.user.role === "EXPLOITANT" && report.status !== "VALIDE";
  const boundValidate = validateReportAction.bind(null, report.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.inspection.school.name}
        description={`Inspecteur : ${report.inspection.inspector.name}`}
        actions={<Badge color={report.status === "VALIDE" ? "green" : "orange"}>{report.status}</Badge>}
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
        {canValidate && (
          <form action={boundValidate} className="mt-4">
            <Button type="submit">Valider le rapport</Button>
          </form>
        )}
      </Card>

      {report.inspection.forms.map((form) => {
        const def = FICHE_DEFINITIONS[form.type as FicheType];
        const data = form.data as Record<string, string>;
        return (
          <Card key={form.id}>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">{def.title}</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {def.fields.map((f) => (
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
        {(session.user.role === "EXPLOITANT" || session.user.role === "CHEF_POOL") && (
          <CommentForm reportId={report.id} />
        )}
      </Card>
    </div>
  );
}
