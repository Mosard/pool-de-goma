import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { actorPools, listManageableAccounts, loadActor } from "@/lib/access-admin";
import { canOpenAccessScreen } from "@/lib/access-rules";

const STATUS: Record<string, { label: string; color: "green" | "orange" | "red" | "gray" }> = {
  ACTIVE: { label: "Actif", color: "green" },
  PENDING: { label: "En attente", color: "orange" },
  SUSPENDED: { label: "Suspendu", color: "red" },
  DISABLED: { label: "Désactivé", color: "gray" },
};

// « Gérer les accès » : comptes que la personne connectée a le droit de gérer,
// et seulement ceux-là (docs/ecran-gestion-acces.md, § 4).
export default async function GererLesAccesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pool?: string; fonction?: string; etat?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canOpenAccessScreen(session.user.roles)) redirect("/dashboard");
  const actor = await loadActor(session.user.id);
  const sp = await searchParams;
  const [accounts, pools, roles] = await Promise.all([
    listManageableAccounts(actor, { q: sp.q, poolId: sp.pool, roleKey: sp.fonction, status: sp.etat }),
    actorPools(actor),
    prisma.roleDefinition.findMany({ orderBy: { label: "asc" }, select: { key: true, label: true } }),
  ]);
  const field = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader title="Gérer les accès" description="Fonctions et permissions des comptes que vous avez le droit de gérer" />

      <Card>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">
            Recherche
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Nom ou identifiant" className={field} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            POOL
            <select name="pool" defaultValue={sp.pool ?? ""} className={field}>
              <option value="">Tous</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Fonction
            <select name="fonction" defaultValue={sp.fonction ?? ""} className={field}>
              <option value="">Toutes</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            État
            <select name="etat" defaultValue={sp.etat ?? ""} className={field}>
              <option value="">Tous</option>
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="sm:col-start-5">
            Filtrer
          </Button>
        </form>
      </Card>

      {accounts.length === 0 ? (
        <EmptyState message="Aucun compte à gérer pour ces critères." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-gray-100">
            {accounts.map((u) => (
              <li key={u.id}>
                <Link href={`/parametres/acces/${u.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-blue-50/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {u.name} {u.isDemo && <span className="text-xs text-gray-400">(démo)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {u.username ?? u.email} · {u.pool?.name ?? "Sans POOL"}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {u.roles.length
                        ? u.roles
                            .map((r) =>
                              r.pool
                                ? `${r.role.label} (${r.pool.name})`
                                : r.role.scope === "CELL"
                                  ? `${r.role.label} — ${r.cell ? `cellule ${r.cell.code}` : "cellule à choisir"}`
                                  : r.role.label
                            )
                            .join(" · ")
                        : "Aucune fonction"}
                    </p>
                  </div>
                  <Badge color={STATUS[u.status]?.color ?? "gray"}>{STATUS[u.status]?.label ?? u.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
