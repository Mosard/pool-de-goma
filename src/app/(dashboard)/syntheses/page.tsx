import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { listSyntheses, loadActor } from "@/lib/synthese/server";
import { SYNTHESIS_STATUS_COLOR, SYNTHESIS_STATUS_LABELS, authorScopes, type SynthesisStatusKey } from "@/lib/synthese/rules";

// Rapports de synthèse visibles par le compte connecté (périmètre contrôlé
// côté serveur pour chaque synthèse : src/lib/synthese/rules.ts, canRead).
export default async function SynthesesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await loadActor(session.user.id);
  const scopes = authorScopes(actor);
  const canWrite = scopes.provincial || scopes.poolIds.length > 0;
  const canReview = actor.permissions.some((p) => p.permissionKey === PERMISSIONS.REPORTS_REVIEW_PROVINCE);
  if (!canWrite && !canReview) redirect("/dashboard");
  const rows = await listSyntheses(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports de synthèse"
        description="Synthèses rédigées à partir des rapports d'inspection exploités"
        actions={
          canWrite ? (
            <Link
              href="/syntheses/nouvelle"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Nouvelle synthèse
            </Link>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState message="Aucun rapport de synthèse pour le moment." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">Synthèse</th>
                <th className="px-6 py-3">N°</th>
                <th className="px-6 py-3">Périmètre</th>
                <th className="px-6 py-3">Auteur</th>
                <th className="px-6 py-3">Rapports</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((s) => {
                const status = s.status as SynthesisStatusKey;
                return (
                  <tr key={s.id} className="hover:bg-blue-50/40">
                    <td className="px-6 py-3 font-medium text-gray-900">{s.title}</td>
                    <td className="px-6 py-3 text-xs text-gray-500">{s.reference ?? "—"}</td>
                    <td className="px-6 py-3 text-gray-600">{s.pool ? `POOL ${s.pool.name}` : "Provinciale"}</td>
                    <td className="px-6 py-3 text-gray-600">{s.author.name}</td>
                    <td className="px-6 py-3 text-gray-600">{s._count.sources}</td>
                    <td className="px-6 py-3">
                      <Badge color={SYNTHESIS_STATUS_COLOR[status]}>{SYNTHESIS_STATUS_LABELS[status]}</Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/syntheses/${s.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
