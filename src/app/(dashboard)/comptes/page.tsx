import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { PERMISSIONS, RESTRICTED_ROLE_KEYS, ROLE_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool, isDemoActor } from "@/lib/permissions";
import { isDemoEmail } from "@/lib/accounts";
import { RequestReview } from "./request-review";

export default async function ComptesPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.ACCOUNTS_MANAGE)) {
    redirect("/dashboard");
  }

  const [requests, roles, pools, actorIsDemo] = await Promise.all([
    prisma.accountRequest.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { requestedRole: true, pool: true },
    }),
    // Le chef de POOL se nomme depuis la fiche du POOL, jamais à la validation.
    prisma.roleDefinition.findMany({
      where: { key: { notIn: [ROLE_KEYS.CHEF_POOL, ...RESTRICTED_ROLE_KEYS] } },
      orderBy: { label: "asc" },
      select: { id: true, label: true, scope: true },
    }),
    prisma.pool.findMany({
      where: { organizationId: session.user.organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    isDemoActor(session.user.id),
  ]);

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader title="Demandes de compte" description={`${pending.length} demande(s) en attente`} />

      {actorIsDemo && (
        <Alert variant="info">
          Vous êtes connecté avec un compte de démonstration : vous pouvez traiter les demandes de démonstration
          (adresse en .test), pas les demandes réelles, qui doivent être validées depuis un compte officiel.
        </Alert>
      )}

      <Card className="overflow-x-auto p-0">
        {pending.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucune demande en attente." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">Nom</th>
                <th className="px-6 py-3">Identifiant</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Rôle demandé</th>
                <th className="px-6 py-3">Pool demandé</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-700">
                    {r.username ?? <span className="font-sans text-gray-400">— (activation par lien)</span>}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {r.email}
                    {isDemoEmail(r.email) && (
                      <span className="ml-2">
                        <Badge color="gray">Démo</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{r.requestedRole?.label ?? "—"}</td>
                  <td className="px-6 py-3 text-gray-600">{r.pool?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-right align-top">
                    <RequestReview
                      requestId={r.id}
                      requestedRoleId={r.requestedRoleId}
                      requestedPoolId={r.poolId}
                      roles={roles}
                      pools={pools}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Historique</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune demande traitée.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-gray-900">{r.name} — {r.email}</span>
                <Badge color={r.status === "APPROVED" ? "green" : "red"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
