import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { PERMISSIONS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { REPORT_SCOPE_INCLUDE, reportScope, reportsOfAuthor, reportsOfOrganization, reportsOfPool } from "@/lib/fiches/report-scope";

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
        ? reportsOfOrganization(user.organizationId)
        : reportsOfPool(user.poolId ?? "__none__")
      : reportsOfAuthor(user.id),
    orderBy: { updatedAt: "desc" },
    include: REPORT_SCOPE_INCLUDE,
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
                <th className="px-6 py-3">Fiche / École</th>
                <th className="px-6 py-3">N°</th>
                <th className="px-6 py-3">Inspecteur</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{reportScope(r).title}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{reportScope(r).number ?? "—"}</td>
                  <td className="px-6 py-3 text-gray-600">{reportScope(r).authorName}</td>
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
