import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { ForbiddenError } from "@/lib/permissions";
import { searchPersonnel } from "@/lib/personnel/server";
import { STATUS_LABELS, functionLabels } from "@/lib/personnel/record";

// Fiches du personnel (lecture seule) : recherche réservée à la consultation
// globale des fiches (personnel.records.read_all), vérifiée côté serveur à
// chaque requête. La liste n'affiche que l'identification et l'affectation.
export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; poolId?: string; cellId?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sp = await searchParams;
  const page = Number.parseInt(sp.page ?? "1", 10);

  let result;
  try {
    result = await searchPersonnel(session.user.id, { q: sp.q, poolId: sp.poolId || undefined, cellId: sp.cellId || undefined, page });
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/dashboard");
    throw e;
  }
  const org = session.user.organizationId;
  const [pools, cells] = await Promise.all([
    prisma.pool.findMany({ where: { organizationId: org }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.cell.findMany({ where: { organizationId: org, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (n: number) => {
    const qs = new URLSearchParams();
    if (sp.q) qs.set("q", sp.q);
    if (sp.poolId) qs.set("poolId", sp.poolId);
    if (sp.cellId) qs.set("cellId", sp.cellId);
    qs.set("page", String(n));
    return `/personnel?${qs.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Fiches du personnel" description={`${result.total} fiche(s) — consultation en lecture seule, journalisée`} />

      <form className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4" method="get">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Nom, postnom, prénom ou matricule" aria-label="Rechercher" />
        <Select name="poolId" defaultValue={sp.poolId ?? ""} aria-label="POOL">
          <option value="">Tous les POOL</option>
          {pools.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select name="cellId" defaultValue={sp.cellId ?? ""} aria-label="Cellule">
          <option value="">Toutes les cellules</option>
          {cells.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </Select>
        <Button type="submit" variant="ghost">Rechercher</Button>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState message="Aucune fiche ne correspond à cette recherche." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">Nom</th>
                <th className="px-6 py-3">Fonction et affectation</th>
                <th className="px-6 py-3">Statut du compte</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.rows.map((u) => (
                <tr key={u.id} className="hover:bg-blue-50/40">
                  <td className="px-6 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {functionLabels(u).join(" · ") || (u.pool ? `POOL ${u.pool.name}` : "Aucune fonction")}
                  </td>
                  <td className="px-6 py-3">
                    <Badge color={u.status === "ACTIVE" ? "green" : "gray"}>{STATUS_LABELS[u.status] ?? u.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/personnel/${u.id}`} className="text-sm font-medium text-blue-700 underline">
                      Ouvrir la fiche
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          {result.page > 1 ? <Link href={pageHref(result.page - 1)} className="underline">Page précédente</Link> : <span />}
          <span className="text-gray-500">Page {result.page} sur {pages}</span>
          {result.page < pages ? <Link href={pageHref(result.page + 1)} className="underline">Page suivante</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
