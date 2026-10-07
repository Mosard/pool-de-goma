import Link from "next/link";
import { redirect } from "next/navigation";
import { clsx } from "clsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { eligibleReports, loadActor, snapshotOf } from "@/lib/synthese/server";
import { authorScopes } from "@/lib/synthese/rules";
import { CreateSynthesisForm } from "../forms";

// Création d'une synthèse : choix du périmètre (parmi ceux où le compte peut
// rédiger) puis des rapports exploités de ce périmètre. Le paramètre d'URL
// ne fait que choisir parmi les périmètres autorisés.
export default async function NouvelleSynthesePage({ searchParams }: { searchParams: Promise<{ perimetre?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await loadActor(session.user.id);
  const scopes = authorScopes(actor);
  if (!scopes.provincial && scopes.poolIds.length === 0) redirect("/syntheses");

  const pools = await prisma.pool.findMany({
    where: { organizationId: actor.organizationId, active: true, ...(scopes.provincial ? {} : { id: { in: scopes.poolIds } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const options = [
    ...(scopes.provincial ? [{ value: "province", label: "Toute la province" }] : []),
    ...pools.map((p) => ({ value: p.id, label: `POOL ${p.name}` })),
  ];
  const { perimetre: requested } = await searchParams;
  const selected = options.find((o) => o.value === requested) ?? options[0];
  if (!selected) redirect("/syntheses");

  const reports = await eligibleReports(actor, { poolId: selected.value === "province" ? null : selected.value });
  const reportOptions = reports.map((r) => {
    const s = snapshotOf(r);
    return { id: r.id, title: s.title, number: s.number, poolName: s.poolName, authorName: s.authorName, statusLabel: s.statusLabel, submittedAt: s.submittedAt };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Nouvelle synthèse" description="Choisissez le périmètre puis les rapports d'inspection exploités à reprendre." />
      {options.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Périmètre de la synthèse">
          {options.map((o) => (
            <Link
              key={o.value}
              href={`/syntheses/nouvelle?perimetre=${o.value}`}
              aria-current={o.value === selected.value ? "page" : undefined}
              className={clsx(
                "inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium",
                o.value === selected.value ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {o.label}
            </Link>
          ))}
        </nav>
      )}
      <Card>
        <p className="mb-4 text-sm text-gray-600">
          Périmètre : <strong className="text-gray-900">{selected.label}</strong>. Seuls les rapports dont l&apos;exploitation a commencé
          sont proposés.
        </p>
        <CreateSynthesisForm perimetre={selected.value} reports={reportOptions} />
      </Card>
    </div>
  );
}
