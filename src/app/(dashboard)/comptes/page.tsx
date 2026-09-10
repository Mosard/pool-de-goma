import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, Button, EmptyState } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { approveAccountRequestAction, rejectAccountRequestAction } from "./actions";

export default async function ComptesPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.ACCOUNTS_MANAGE)) {
    redirect("/dashboard");
  }

  const requests = await prisma.accountRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { requestedRole: true, pool: true },
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader title="Demandes de compte" description={`${pending.length} demande(s) en attente`} />

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
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Rôle demandé</th>
                <th className="px-6 py-3">Pool</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-6 py-3 text-gray-600">{r.email}</td>
                  <td className="px-6 py-3 text-gray-600">{r.requestedRole?.label ?? "—"}</td>
                  <td className="px-6 py-3 text-gray-600">{r.pool?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={approveAccountRequestAction.bind(null, r.id)}>
                        <Button type="submit" className="px-3 py-1.5 text-xs">Valider</Button>
                      </form>
                      <form action={rejectAccountRequestAction.bind(null, r.id)}>
                        <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">Refuser</Button>
                      </form>
                    </div>
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
