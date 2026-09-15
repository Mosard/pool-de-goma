import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.AUDIT_VIEW)) {
    redirect("/dashboard");
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: true },
  });

  return (
    <div>
      <PageHeader title="Journal d'audit" description={`${logs.length} action(s) récente(s)`} />
      {logs.length === 0 ? (
        <EmptyState message="Aucune action enregistrée pour le moment." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Acteur</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Objet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-3 text-gray-500">{new Date(log.createdAt).toLocaleString("fr-FR")}</td>
                  <td className="px-6 py-3 text-gray-900">{log.actor?.name ?? "Système"}</td>
                  <td className="px-6 py-3">
                    <Badge color="blue">{log.action}</Badge>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{log.entityType} · {log.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
