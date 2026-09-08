import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";

const STATUS_COLOR: Record<string, "gray" | "blue" | "green" | "orange"> = {
  BROUILLON: "gray",
  SOUMIS: "orange",
  EN_REVUE: "blue",
  VALIDE: "green",
};

export default async function RapportsPage() {
  const session = await auth();
  const role = session!.user.role;

  const reports = await prisma.report.findMany({
    where: role === "CHEF_POOL" ? undefined : { status: { in: ["SOUMIS", "EN_REVUE", "VALIDE"] } },
    orderBy: { updatedAt: "desc" },
    include: { inspection: { include: { school: true, inspector: true } } },
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
                  <td className="px-6 py-3"><Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge></td>
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
