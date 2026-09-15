import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { PERMISSIONS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";

const STATUS_COLOR: Record<string, "gray" | "blue" | "green" | "orange" | "red"> = {
  [WORKFLOW_STATUS_KEYS.BROUILLON]: "gray",
  [WORKFLOW_STATUS_KEYS.SOUMIS]: "orange",
  [WORKFLOW_STATUS_KEYS.RECU]: "orange",
  [WORKFLOW_STATUS_KEYS.EN_EXPLOITATION]: "blue",
  [WORKFLOW_STATUS_KEYS.A_CORRIGER]: "red",
  [WORKFLOW_STATUS_KEYS.TRANSMIS]: "blue",
  [WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION]: "orange",
  [WORKFLOW_STATUS_KEYS.VALIDE]: "green",
  [WORKFLOW_STATUS_KEYS.REJETE]: "red",
  [WORKFLOW_STATUS_KEYS.CLOTURE]: "green",
};

export default async function RapportsPage() {
  const session = await auth();
  const user = session!.user;

  const canReview =
    hasPermissionAnyPool(user.permissions, PERMISSIONS.REPORTS_REVIEW_POOL) ||
    hasPermissionAnyPool(user.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE) ||
    hasPermissionAnyPool(user.permissions, PERMISSIONS.REPORTS_VALIDATE);
  const isProvinceScoped = user.permissions.some((p) => p.poolId === null);

  const reports = await prisma.report.findMany({
    where: canReview
      ? isProvinceScoped
        ? { inspection: { school: { pool: { organizationId: user.organizationId } } } }
        : { inspection: { school: { poolId: user.poolId ?? "__none__" } } }
      : { inspection: { inspectorId: user.id } },
    orderBy: { updatedAt: "desc" },
    include: { status: true, inspection: { include: { school: true, inspector: true } } },
  });

  return (
    <div>
      <PageHeader title="Rapports" description={`${reports.length} rapport(s)`} />
      {reports.length === 0 ? (
        <EmptyState message="Aucun rapport pour le moment." />
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
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{r.inspection.school.name}</td>
                  <td className="px-6 py-3 text-gray-600">{r.inspection.inspector.name}</td>
                  <td className="px-6 py-3">
                    <Badge color={STATUS_COLOR[r.status.key] ?? "gray"}>{r.status.label}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/rapports/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
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
