import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import { FicheForm } from "../fiche-form";
import { ReportForm } from "../report-form";

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">
          {completed}/{total} fiche{total > 1 ? "s" : ""} complétée{completed > 1 ? "s" : ""}
        </span>
        <span className="text-gray-500">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [inspection, templates] = await Promise.all([
    prisma.inspection.findUnique({
      where: { id },
      include: { school: true, inspector: true, forms: true, report: { include: { status: true } } },
    }),
    prisma.formTemplate.findMany({
      where: { active: true },
      orderBy: [{ category: { code: "asc" } }, { code: "asc" }],
      include: { category: true },
    }),
  ]);

  if (!inspection) notFound();

  const user = session.user;
  const isOwner = inspection.inspectorId === user.id;
  const canEditFiches = isOwner && inspection.status !== "RAPPORT_SOUMIS" && inspection.status !== "VALIDEE";

  const formsByTemplate = new Map(inspection.forms.map((f) => [f.formTemplateId, f]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={inspection.school.name}
        description={`Inspecteur : ${inspection.inspector.name}`}
        actions={<Badge color="blue">{inspection.status}</Badge>}
      />

      <ProgressBar completed={inspection.forms.filter((f) => f.completed).length} total={templates.length} />

      {templates.map((template) => {
        const existing = formsByTemplate.get(template.id);
        return (
          <FicheForm
            key={template.id}
            inspectionId={inspection.id}
            template={template}
            existingData={(existing?.data as Record<string, string>) ?? undefined}
            completed={existing?.completed ?? false}
            readOnly={!canEditFiches}
          />
        );
      })}

      {isOwner && inspection.status !== "PLANIFIEE" && (
        <>
          {inspection.status === "RAPPORT_SOUMIS" || inspection.status === "VALIDEE" ? (
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Rapport soumis</h3>
              <p className="text-sm text-gray-700">{inspection.report?.summary}</p>
              {inspection.report?.recommendations && (
                <p className="mt-2 text-sm text-gray-500">
                  Recommandations : {inspection.report.recommendations}
                </p>
              )}
              {inspection.report && (
                <p className="mt-2 text-xs text-gray-400">Statut actuel : {inspection.report.status.label}</p>
              )}
            </Card>
          ) : (
            <ReportForm inspectionId={inspection.id} />
          )}
        </>
      )}
    </div>
  );
}
