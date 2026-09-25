import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { AssignmentForm } from "./assignment-form";
import { revokeAssignmentAction } from "./actions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool, poolsWithPermission } from "@/lib/permissions";

export default async function AffectationsPage() {
  const session = await auth();
  const user = session!.user;
  if (!hasPermissionAnyPool(user.permissions, PERMISSIONS.ASSIGNMENTS_MANAGE)) redirect("/dashboard");

  // POOL couverts par la permission (et non User.poolId) : même règle que la
  // vérification serveur de createAssignmentAction.
  const scope = poolsWithPermission(user.permissions, PERMISSIONS.ASSIGNMENTS_MANAGE);
  const poolFilter =
    scope === "ALL" ? { pool: { organizationId: user.organizationId } } : { poolId: { in: scope } };

  const [schools, inspectors, assignments] = await Promise.all([
    prisma.school.findMany({
      where: { active: true, ...poolFilter },
      orderBy: { name: "asc" },
      select: { id: true, name: true, pool: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        organizationId: user.organizationId,
        roles: { some: { role: { key: ROLE_KEYS.INSPECTEUR }, ...poolFilter } },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        roles: { where: { role: { key: ROLE_KEYS.INSPECTEUR } }, select: { pool: { select: { name: true } } } },
      },
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
      <AssignmentForm
        schools={schools.map((s) => ({ id: s.id, name: `${s.name} — ${s.pool.name}` }))}
        inspectors={inspectors.map((i) => ({
          id: i.id,
          name: `${i.name} — ${i.roles.map((r) => r.pool?.name ?? "?").join(", ")}`,
        }))}
      />

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
                    <ConfirmButton
                      label="Révoquer"
                      confirmLabel="Révoquer"
                      variant="danger"
                      className="!min-h-0 px-3 py-1.5 text-xs"
                      formAction={revokeAssignmentAction.bind(null, a.id)}
                    />
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
