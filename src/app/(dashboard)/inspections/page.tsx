import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { NewInspectionForm } from "./new-inspection-form";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";

const STATUS_COLOR: Record<string, "gray" | "blue" | "green" | "orange"> = {
  PLANIFIEE: "gray",
  EN_COURS: "blue",
  TERMINEE: "orange",
  RAPPORT_SOUMIS: "orange",
  VALIDEE: "green",
};

export default async function InspectionsPage() {
  const session = await auth();
  const user = session!.user;
  const isInspector = hasPermissionAnyPool(user.permissions, PERMISSIONS.INSPECTIONS_CONDUCT);
  const isProvinceScoped = user.permissions.some((p) => p.poolId === null);

  const inspections = await prisma.inspection.findMany({
    where: isInspector
      ? { inspectorId: user.id }
      : isProvinceScoped
        ? undefined
        : { school: { poolId: user.poolId ?? "__none__" } },
    orderBy: { updatedAt: "desc" },
    include: { school: true, inspector: true },
  });

  let assignedSchools: { id: string; name: string }[] = [];
  if (isInspector) {
    const assignments = await prisma.assignment.findMany({
      where: { inspectorId: user.id, active: true },
      include: { school: true },
    });
    assignedSchools = assignments.map((a) => ({ id: a.school.id, name: a.school.name }));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inspections & fiches" description="Suivi des inspections et remplissage des fiches" />

      {isInspector && <NewInspectionForm schools={assignedSchools} />}

      {inspections.length === 0 ? (
        <EmptyState message="Aucune inspection pour le moment." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">École</th>
                <th className="px-6 py-3">Inspecteur</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.map((i) => (
                <tr key={i.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{i.school.name}</td>
                  <td className="px-6 py-3 text-gray-600">{i.inspector.name}</td>
                  <td className="px-6 py-3"><Badge color={STATUS_COLOR[i.status]}>{i.status}</Badge></td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/inspections/${i.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
