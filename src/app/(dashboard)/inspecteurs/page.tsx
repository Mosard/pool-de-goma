import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, PageHeader, Badge, Select } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { PERMISSIONS } from "@/lib/rbac-data";
import { canGrantRole, hasPermissionAnyPool } from "@/lib/permissions";
import { toggleUserStatusAction } from "./actions";
import { ReissueActivation } from "./reissue-activation";

export default async function InspecteursPage({
  searchParams,
}: {
  searchParams: Promise<{ poolId?: string; roleKey?: string; status?: string; sex?: string }>;
}) {
  const session = await auth();
  const user = session!.user;
  if (!hasPermissionAnyPool(user.permissions, PERMISSIONS.USERS_MANAGE)) redirect("/dashboard");

  const { poolId, roleKey, status, sex } = await searchParams;

  const [users, pools, roles] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        poolId: poolId || undefined,
        status: status ? (status as "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED") : undefined,
        sex: sex ? (sex as "M" | "F") : undefined,
        roles: roleKey ? { some: { role: { key: roleKey } } } : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { pool: true, roles: { include: { role: true } } },
    }),
    prisma.pool.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.roleDefinition.findMany({ orderBy: { label: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Inspecteurs"
        description={`${users.length} inspecteur(s)`}
        actions={
          <div className="flex gap-2">
            <Link href="/comptes">
              <Button variant="secondary">Demandes de compte</Button>
            </Link>
            <Link href="/inspecteurs/nouveau">
              <Button>Nouvel inspecteur</Button>
            </Link>
          </div>
        }
      />

      <form className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5" method="get">
        <Select name="poolId" defaultValue={poolId ?? ""}>
          <option value="">Tous les pools</option>
          {pools.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select name="roleKey" defaultValue={roleKey ?? ""}>
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.key}>{r.label}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="PENDING">En attente</option>
          <option value="SUSPENDED">Suspendu</option>
          <option value="DISABLED">Désactivé</option>
        </Select>
        <Select name="sex" defaultValue={sex ?? ""}>
          <option value="">Tous les sexes</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </Select>
        <Button type="submit" variant="ghost">Filtrer</Button>
      </form>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="px-6 py-3">Nom</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Rôles</th>
              <th className="px-6 py-3">Pool</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-blue-50/40">
                <td className="px-6 py-3 font-medium text-gray-900">
                  {u.name}
                  {u.username && <span className="block font-mono text-xs font-normal text-gray-500">{u.username}</span>}
                </td>
                <td className="px-6 py-3 text-gray-600">{u.email}</td>
                <td className="px-6 py-3 text-gray-600">{u.roles.map((r) => r.role.label).join(", ") || "—"}</td>
                <td className="px-6 py-3 text-gray-600">{u.pool?.name ?? "—"}</td>
                <td className="px-6 py-3">
                  <Badge color={u.status === "ACTIVE" ? "green" : u.status === "PENDING" ? "orange" : "gray"}>
                    {u.status === "PENDING" ? "En attente d'activation" : u.status}
                  </Badge>
                </td>
                <td className="px-6 py-3 text-right align-top">
                  {/* Au-dessus de son niveau (ROLE_GRANTORS) : ni suspension ni lien d'accès. */}
                  {u.id !== user.id && !u.roles.every((r) => canGrantRole(user.roles, r.role.key, r.poolId)) ? (
                    <span className="text-xs text-gray-400">Hors de votre niveau</span>
                  ) : u.status === "PENDING" ? (
                    <ReissueActivation userId={u.id} status={u.status} />
                  ) : (
                  <div className="flex flex-col items-end gap-2">
                  {u.id !== user.id && (
                  <ConfirmButton
                    label={u.status === "ACTIVE" ? "Suspendre" : "Activer"}
                    confirmLabel={u.status === "ACTIVE" ? "Suspendre" : "Activer"}
                    variant={u.status === "ACTIVE" ? "danger" : "primary"}
                    className="!min-h-0 px-3 py-1.5 text-xs"
                    formAction={toggleUserStatusAction.bind(null, u.id)}
                  />
                  )}
                  {u.status === "ACTIVE" && <ReissueActivation userId={u.id} status={u.status} />}
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
