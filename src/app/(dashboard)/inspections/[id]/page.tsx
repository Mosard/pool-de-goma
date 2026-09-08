import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import { FicheForm } from "../fiche-form";
import { ReportForm } from "../report-form";
import type { FicheType } from "@/lib/fiches";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      school: true,
      inspector: true,
      forms: true,
      report: true,
    },
  });

  if (!inspection) notFound();

  const isOwner = session.user.role === "INSPECTEUR" && inspection.inspectorId === session.user.id;
  const canEdit = isOwner && inspection.status !== "RAPPORT_SOUMIS" && inspection.status !== "VALIDEE";

  const formsByType = new Map(inspection.forms.map((f) => [f.type, f]));
  const ficheTypes: FicheType[] = ["A1", "C101", "T1"];

  return (
    <div className="space-y-6">
      <PageHeader
        title={inspection.school.name}
        description={`Inspecteur : ${inspection.inspector.name}`}
        actions={<Badge color="blue">{inspection.status}</Badge>}
      />

      {ficheTypes.map((type) => {
        const existing = formsByType.get(type);
        return (
          <FicheForm
            key={type}
            inspectionId={inspection.id}
            type={type}
            existingData={(existing?.data as Record<string, string>) ?? undefined}
            completed={existing?.completed ?? false}
            readOnly={!canEdit}
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
            </Card>
          ) : (
            <ReportForm inspectionId={inspection.id} />
          )}
        </>
      )}
    </div>
  );
}
