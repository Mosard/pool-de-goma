import { prisma } from "@/lib/prisma";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac-data";

export type SessionPermission = { permissionKey: string; poolId: string | null; organizationId: string };
export type SessionRole = { key: string; label: string; poolId: string | null };

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée pour ce rôle.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Charge les rôles + permissions d'un utilisateur directement depuis la base.
 * Un compte qui n'est pas ACTIVE (suspendu, désactivé, en attente) n'a aucune
 * permission, même si son jeton de session (JWT) est encore valide.
 */
export async function loadUserAccess(userId: string): Promise<{
  roles: SessionRole[];
  permissions: SessionPermission[];
}> {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, status: true } });
  if (!dbUser || dbUser.status !== "ACTIVE") return { roles: [], permissions: [] };

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const roles: SessionRole[] = userRoles.map((ur) => ({
    key: ur.role.key,
    label: ur.role.label,
    poolId: ur.poolId,
  }));

  const permissions: SessionPermission[] = [];
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissions.push({ permissionKey: rp.permission.key, poolId: ur.poolId, organizationId: dbUser.organizationId });
    }
  }

  return { roles, permissions };
}

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

/** Revérifie la permission côté serveur en interrogeant la base (ne jamais se fier uniquement au JWT). */
export async function requirePermission(
  userId: string,
  key: PermissionKey,
  opts?: { poolId?: string | null; organizationId?: string | null }
): Promise<SessionPermission[]> {
  const { permissions } = await loadUserAccess(userId);
  if (!hasPermission(permissions, key, opts)) {
    throw new ForbiddenError();
  }
  return permissions;
}

export async function getRoleLabels(): Promise<Record<string, string>> {
  const roles = await prisma.roleDefinition.findMany();
  return Object.fromEntries(roles.map((r) => [r.key, r.label]));
}

export { PERMISSIONS };
