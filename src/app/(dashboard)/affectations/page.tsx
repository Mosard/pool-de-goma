import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { AssignmentForm } from "./assignment-form";
import { revokeAssignmentAction } from "./actions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";

export default async function AffectationsPage() {
  const session = await auth();
  const user = session!.user;
  if (!hasPermissionAnyPool(user.permissions, PERMISSIONS.ASSIGNMENTS_MANAGE)) redirect("/dashboard");

  const isProvinceScoped = user.permissions.some((p) => p.poolId === null);
  const poolFilter = isProvinceScoped ? undefined : { poolId: user.poolId ?? "__none__" };

  const [schools, inspectors, assignments] = await Promise.all([
    prisma.school.findMany({
      where: { active: true, ...poolFilter },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", ...poolFilter, roles: { some: { role: { key: ROLE_KEYS.INSPECTEUR } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.assignment.findMany({
      where: { active: true, school: poolFilter },
      orderBy: { createdAt: "desc" },
      include: { school: true, inspector: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Affectations" description="Attribuer des écoles aux inspecteurs itinérants" />
      <AssignmentForm schools={schools} inspectors={inspectors} />

      <Card className="overflow-x-auto p-0">
        {assignments.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucune affectation active." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">École</th>
                <th className="px-6 py-3">Inspecteur</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{a.school.name}</td>
                  <td className="px-6 py-3 text-gray-600">{a.inspector.name}</td>
                  <td className="px-6 py-3 text-right">
                    <form action={revokeAssignmentAction.bind(null, a.id)}>
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        Révoquer
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
