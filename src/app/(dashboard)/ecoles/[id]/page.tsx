import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import { SchoolForm } from "../school-form";
import { updateSchoolAction } from "../actions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermission } from "@/lib/permissions";

export default async function EcoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      pool: true,
      assignments: { include: { inspector: true }, where: { active: true } },
      inspections: { include: { inspector: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!school) notFound();

  const user = session!.user;
  const canEdit = hasPermission(user.permissions, PERMISSIONS.SCHOOLS_MANAGE, { poolId: school.poolId });
  const boundUpdate = updateSchoolAction.bind(null, school.id);

  const isProvinceScoped = user.permissions.some((p) => p.poolId === null);
  const pools = canEdit
    ? await prisma.pool.findMany({
        where: isProvinceScoped ? { active: true } : { id: school.poolId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title={school.name} description={`${school.code} · Pool ${school.pool.name}`} />

      {canEdit ? (
        <SchoolForm action={boundUpdate} pools={pools} defaultValues={school} />
      ) : (
        <Card>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Pool</dt><dd className="font-medium">{school.pool.name}</dd></div>
            <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{school.province}</dd></div>
            <div><dt className="text-gray-500">Territoire</dt><dd className="font-medium">{school.territoire}</dd></div>
            <div><dt className="text-gray-500">Type</dt><dd className="font-medium">{school.type ?? "—"}</dd></div>
            <div><dt className="text-gray-500">Directeur</dt><dd className="font-medium">{school.director ?? "—"}</dd></div>
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Inspecteurs assignés</h2>
        {school.assignments.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun inspecteur assigné.</p>
        ) : (
          <ul className="space-y-2">
            {school.assignments.map((a) => (
              <li key={a.id} className="text-sm text-gray-700">{a.inspector.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Historique des inspections</h2>
        {school.inspections.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune inspection enregistrée.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {school.inspections.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                <span>{i.inspector.name}</span>
                <Badge color="blue">{i.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
