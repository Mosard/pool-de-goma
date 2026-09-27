// Vérifications PURES sur des permissions déjà chargées (session) : sans base
// ni cookies, donc importables par les composants client (menus).

import type { PermissionKey } from "@/lib/rbac-data";

export type SessionPermission = { permissionKey: string; poolId: string | null; organizationId: string };
export type SessionRole = { key: string; label: string; poolId: string | null };

/**
 * `poolId: null` sur une permission signifie une portée organisation (accès
 * à tous les pools de l'organisation de l'acteur — jamais à toute la base).
 * Sinon la permission n'est valable que pour le pool concerné — il faut
 * alors fournir `opts.poolId` correspondant.
 *
 * Quand `opts.poolId` cible une ressource précise, une permission à portée
 * organisation ne s'applique que si cette ressource appartient à la même
 * organisation que l'acteur (`opts.organizationId`, à fournir par
 * l'appelant — typiquement `pool.organizationId` de la ressource visée).
 * Sans `opts.poolId` (contrôle de type "ai-je cette permission quelque
 * part", sans ressource ciblée), la vérification d'organisation est
 * inutile : les permissions chargées sont déjà celles de l'acteur, donc
 * déjà scoping à sa propre organisation.
 */
export function hasPermission(
  permissions: SessionPermission[],
  key: PermissionKey | string,
  opts?: { poolId?: string | null; organizationId?: string | null }
): boolean {
  return permissions.some((p) => {
    if (p.permissionKey !== key) return false;
    if (p.poolId === null) {
      if (opts?.poolId == null) return true;
      return opts.organizationId != null && opts.organizationId === p.organizationId;
    }
    return opts?.poolId != null && p.poolId === opts.poolId;
  });
}

/** Détient la fonction de chef de CE POOL (rôles effectifs, mode « voir comme » compris). */
export function isChiefOf(roles: SessionRole[], poolId: string): boolean {
  return roles.some((r) => r.key === "chef_pool" && r.poolId === poolId);
}

/** Portée organisation : vrai si l'utilisateur détient la permission pour au moins un pool, quel qu'il soit (toujours dans sa propre organisation). */
export function hasPermissionAnyPool(permissions: SessionPermission[], key: PermissionKey | string): boolean {
  return permissions.some((p) => p.permissionKey === key);
}

/** Liste des pools pour lesquels l'utilisateur détient la permission (vide si aucun, "ALL" si portée organisation — dans ce cas résoudre via `prisma.pool.findMany({ where: { organizationId } })` avec l'organisation de l'acteur). */
export function poolsWithPermission(permissions: SessionPermission[], key: PermissionKey | string): string[] | "ALL" {
  const matches = permissions.filter((p) => p.permissionKey === key);
  if (matches.some((p) => p.poolId === null)) return "ALL";
  return matches.map((p) => p.poolId as string);
}
