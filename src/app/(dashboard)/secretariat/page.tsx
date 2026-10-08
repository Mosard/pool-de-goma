import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { REPORT_SCOPE_INCLUDE, reportScope } from "@/lib/fiches/report-scope";
import { demoWhere } from "@/lib/exports/scope";
import { holdsRouteIpp, isSuperAdmin } from "@/lib/cells/rules";
import { loadCellActor } from "@/lib/cells/server";

const LIMIT = 200;

// Secrétariat de l'IPP (décision D1) : les rapports soumis arrivent ici et le
// secrétaire les envoie, au nom de l'IPP, à la cellule correspondante. Accès
// vérifié côté serveur (reports.route_ipp, droits relus en base).
export default async function SecretariatPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await loadCellActor(session.user.id);
  if (!holdsRouteIpp(actor, actor.organizationId) && !isSuperAdmin(actor.roles)) redirect("/dashboard");
  const me = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { isDemo: true } });
  const org = actor.organizationId;

  const [waiting, cells, legacyCount] = await Promise.all([
    prisma.report.findMany({
      where: { AND: [{ ippTrack: { is: { organizationId: org, stage: "AU_SECRETARIAT" } } }, demoWhere(me.isDemo)] },
      include: REPORT_SCOPE_INCLUDE,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: LIMIT,
    }),
    prisma.cell.findMany({
      where: { organizationId: org },
      orderBy: [{ active: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, active: true, ipa: { select: { name: true } } },
    }),
    prisma.reportIppTrack.count({ where: { organizationId: org, stage: "AU_SECRETARIAT", legacy: true, report: demoWhere(me.isDemo) } }),
  ]);
  const byCell = await prisma.reportIppTrack.groupBy({
    by: ["cellId", "stage"],
    where: { organizationId: org, cellId: { not: null }, report: demoWhere(me.isDemo) },
    _count: { _all: true },
  });
  const count = (cellId: string, stage: string) => byCell.find((r) => r.cellId === cellId && r.stage === stage)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secrétariat de l'IPP"
        description={`${waiting.length}${waiting.length === LIMIT ? "+" : ""} rapport(s) à envoyer à une cellule`}
      />

      {cells.filter((c) => c.active).length === 0 && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          Aucune cellule n&apos;est encore créée : l&apos;équipe métier les saisit dans Paramètres → Cellules.
        </Card>
      )}

      <Card className="p-0">
        <h3 className="px-6 pt-4 text-sm font-semibold text-gray-900">À envoyer à une cellule</h3>
        {legacyCount > 0 && (
          <p className="px-6 pt-1 text-xs text-gray-500">
            Dont {legacyCount} rapport(s) antérieur(s) au circuit des cellules : cellule indéterminable, à orienter.
          </p>
        )}
        {waiting.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun rapport en attente au secrétariat." />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {waiting.map((r) => {
              const s = reportScope(r);
              const poolName = r.inspection?.school.pool.name ?? r.form?.inspection?.school.pool.name ?? r.form?.pool?.name ?? "—";
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
                  <span>
                    <strong>{s.title}</strong> · {poolName} · <span className="text-gray-500">{s.authorName}</span>
                    {s.number && <span className="text-xs text-gray-500"> · {s.number}</span>}
                    {r.ippTrack?.legacy && (
                      <span className="ml-2">
                        <Badge color="gray">Antérieur, à orienter</Badge>
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{(r.submittedAt ?? r.createdAt).toLocaleDateString("fr-FR")}</span>
                    <Link href={`/rapports/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Lire et envoyer
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {cells.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Cellule</th>
                <th className="px-4 py-3">IPA responsable</th>
                <th className="px-4 py-3 text-right">En exploitation</th>
                <th className="px-4 py-3 text-right">À valider (IPA)</th>
                <th className="px-4 py-3 text-right">Transmis à l&apos;IPP</th>
                <th className="px-4 py-3 text-right">Signés (IPP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cells.map((c) => (
                <tr key={c.id} className={c.active ? "" : "text-gray-400"}>
                  <td className="px-4 py-3 font-medium">
                    {c.code} — {c.name}
                    {!c.active && " (archivée)"}
                  </td>
                  <td className="px-4 py-3">{c.ipa?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{count(c.id, "AFFECTE")}</td>
                  <td className="px-4 py-3 text-right">{count(c.id, "EXPLOITE")}</td>
                  <td className="px-4 py-3 text-right">{count(c.id, "VALIDE")}</td>
                  <td className="px-4 py-3 text-right">{count(c.id, "SIGNE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
