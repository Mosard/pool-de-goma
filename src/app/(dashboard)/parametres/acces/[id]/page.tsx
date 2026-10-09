import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import { ForbiddenError } from "@/lib/permissions";
import { canGrantRole } from "@/lib/permission-checks";
import { ROLES_MANAGED_ELSEWHERE, actorPools, grantableRoles, inheritedPermissions, loadActor, loadManageableAccount } from "@/lib/access-admin";
import { canOpenAccessScreen } from "@/lib/access-rules";
import { AccessEditor } from "./access-editor";

export default async function CompteAccesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canOpenAccessScreen(session.user.roles)) redirect("/dashboard");
  const actor = await loadActor(session.user.id);

  let target;
  try {
    target = await loadManageableAccount(actor, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  const [inherited, catalog, pools, allPools, roles, cells] = await Promise.all([
    inheritedPermissions(target.id),
    prisma.permission.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }], select: { key: true, label: true, category: true } }),
    actorPools(actor),
    prisma.pool.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, name: true } }),
    grantableRoles(actor.roles),
    // Cellules actives (rattachement obligatoire de l'exploitant de l'IPP).
    prisma.cell.findMany({ where: { organizationId: actor.organizationId, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const poolNames = Object.fromEntries(allPools.map((p) => [p.id, p.name]));

  const STATUS: Record<string, string> = { ACTIVE: "Actif", PENDING: "En attente", SUSPENDED: "Suspendu", DISABLED: "Désactivé" };

  return (
    <div className="space-y-6">
      <Link href="/parametres/acces" className="text-xs font-medium text-blue-600 hover:underline">
        ← Gérer les accès
      </Link>
      <PageHeader
        title={target.name}
        description={`${target.username ?? target.email} · ${target.pool?.name ?? "Sans POOL"}`}
        actions={<Badge color={target.status === "ACTIVE" ? "green" : "orange"}>{STATUS[target.status] ?? target.status}</Badge>}
      />
      {target.status !== "ACTIVE" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ce compte n&apos;est pas actif : il n&apos;a aucun droit tant qu&apos;il ne l&apos;est pas, quels que soient ses fonctions et ajustements.
        </p>
      )}
      <AccessEditor
        targetId={target.id}
        actor={{ organizationId: actor.organizationId, roles: actor.roles, permissions: actor.permissions }}
        poolNames={poolNames}
        actorPools={pools}
        currentRoles={target.roles.map((r) => ({
          userRoleId: r.id,
          roleKey: r.role.key,
          // « Exploitant de l'IPP — cellule IPAF », ou « — cellule à choisir » (aucun accès tant qu'elle manque).
          label: r.role.scope === "CELL" ? `${r.role.label} — ${r.cell ? `cellule ${r.cell.code}` : "en attente d'affectation (Direction)"}` : r.role.label,
          poolId: r.poolId,
          removable: !ROLES_MANAGED_ELSEWHERE.includes(r.role.key) && canGrantRole(actor.roles, r.role.key, r.poolId),
          reason: ROLES_MANAGED_ELSEWHERE.includes(r.role.key) ? "Se gère depuis la fiche du POOL." : "Fonction que vous ne pouvez pas retirer.",
        }))}
        addableRoles={roles.map((r) => ({
          id: r.id,
          key: r.key,
          label: r.label,
          scope: r.scope,
          pools: r.scope === "POOL" ? pools.filter((p) => canGrantRole(actor.roles, r.key, p.id)) : [],
          cells: r.scope === "CELL" ? cells : [],
        })).filter((r) => r.scope === "PROVINCE" || r.pools.length > 0 || r.cells.length > 0)}
        catalog={catalog}
        inherited={inherited}
        adjustments={target.permissionAdjustments.map((a) => ({ permissionKey: a.permission.key, poolId: a.poolId, effect: a.effect }))}
      />
    </div>
  );
}
