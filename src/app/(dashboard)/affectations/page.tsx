import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { AssignmentForm } from "./assignment-form";
import { revokeAssignmentAction } from "./actions";
import { ASSIGNMENT_END_REASON_LABELS, PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
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

  // Historique : affectations terminées (jamais supprimées), plus récentes
  // d'abord.
  const history = await prisma.assignment.findMany({
    where: { active: false, school: poolFilter },
    orderBy: [{ endedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    include: {
      school: { select: { name: true } },
      inspector: { select: { name: true } },
      endedBy: { select: { name: true } },
    },
  });
  const today = new Date();
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "Africa/Lubumbashi" }) : "—");

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
                <th className="px-6 py-3">Date d&apos;effet</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{a.school.name}</td>
                  <td className="px-6 py-3 text-gray-600">{a.inspector.name}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {fmt(a.effectiveFrom)}
                    {a.effectiveFrom > today && <span className="ml-1 text-xs text-amber-700">(à venir)</span>}
                  </td>
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

      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Historique des affectations terminées</h2>
        <Card className="overflow-x-auto p-0">
          {history.length === 0 ? (
            <div className="p-6">
              <EmptyState message="Aucune affectation terminée." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-3">École</th>
                  <th className="px-6 py-3">Inspecteur</th>
                  <th className="px-6 py-3">Date d&apos;effet</th>
                  <th className="px-6 py-3">Fin</th>
                  <th className="px-6 py-3">Motif</th>
                  <th className="px-6 py-3">Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((a) => (
                  <tr key={a.id}>
                    <td className="px-6 py-3 text-gray-900">{a.school.name}</td>
                    <td className="px-6 py-3 text-gray-600">{a.inspector.name}</td>
                    <td className="px-6 py-3 text-gray-600">{fmt(a.effectiveFrom)}</td>
                    <td className="px-6 py-3 text-gray-600">{fmt(a.endedAt)}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {a.endReason ? ASSIGNMENT_END_REASON_LABELS[a.endReason] ?? a.endReason : "Non renseigné (antérieur)"}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{a.endedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
