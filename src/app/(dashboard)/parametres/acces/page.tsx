import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
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
  const filtered = Boolean(sp.q || sp.pool || sp.fonction || sp.etat);

  return (
    <div className="space-y-6">
      <PageHeader title="Gérer les accès" description="Fonctions et permissions des comptes que vous avez le droit de gérer" />

      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <Field label="Recherche" className="lg:col-span-2">
          <span className="relative block">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Nom ou identifiant" className="pl-9" type="search" />
          </span>
        </Field>
        <Field label="POOL">
          <Select name="pool" defaultValue={sp.pool ?? ""}>
            <option value="">Tous</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fonction">
          <Select name="fonction" defaultValue={sp.fonction ?? ""}>
            <option value="">Toutes</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="État">
          <Select name="etat" defaultValue={sp.etat ?? ""}>
            <option value="">Tous</option>
            {Object.entries(STATUS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" size="sm" className="min-h-[42px] px-5">
            Filtrer
          </Button>
          {filtered && (
            <Link href="/parametres/acces" className="rounded-full px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      {accounts.length === 0 ? (
        <EmptyState message="Aucun compte à gérer pour ces critères." />
      ) : (
        <Card className="overflow-hidden p-0">
          <p className="border-b border-gray-100 bg-gray-50/80 px-5 py-2.5 text-xs font-medium text-gray-500">{accounts.length} compte(s)</p>
          <ul className="divide-y divide-gray-100">
            {accounts.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/parametres/acces/${u.id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/80 focus-visible:bg-blue-50/60 focus-visible:outline-none"
                >
                  <Avatar name={u.name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {u.name} {u.isDemo && <span className="text-xs font-normal text-gray-400">(démo)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {u.username ?? u.email} · {u.pool?.name ?? "Sans POOL"}
                    </p>
                    <p className="mt-1 text-pretty text-xs text-gray-600">
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
                  <ChevronRight size={16} aria-hidden className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
