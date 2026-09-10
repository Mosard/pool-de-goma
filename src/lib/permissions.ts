import { prisma } from "@/lib/prisma";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac-data";

export type SessionPermission = { permissionKey: string; poolId: string | null };
export type SessionRole = { key: string; label: string; poolId: string | null };

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée pour ce rôle.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Charge les rôles + permissions d'un utilisateur directement depuis la base. */
export async function loadUserAccess(userId: string): Promise<{
  roles: SessionRole[];
  permissions: SessionPermission[];
}> {
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
      permissions.push({ permissionKey: rp.permission.key, poolId: ur.poolId });
    }
  }

  return { roles, permissions };
}

/**
 * `poolId: null` sur une permission signifie une portée provinciale (accès à
 * tous les pools). Sinon la permission n'est valable que pour le pool
 * concerné — il faut alors fournir `opts.poolId` correspondant.
 */
export function hasPermission(
  permissions: SessionPermission[],
  key: PermissionKey | string,
  opts?: { poolId?: string | null }
): boolean {
  return permissions.some((p) => {
    if (p.permissionKey !== key) return false;
    if (p.poolId === null) return true;
    return opts?.poolId != null && p.poolId === opts.poolId;
  });
}

/** Portée provinciale : vrai si l'utilisateur détient la permission pour au moins un pool, quel qu'il soit. */
export function hasPermissionAnyPool(permissions: SessionPermission[], key: PermissionKey | string): boolean {
  return permissions.some((p) => p.permissionKey === key);
}

/** Liste des pools pour lesquels l'utilisateur détient la permission (vide si aucun, ["*"] si portée provinciale). */
export function poolsWithPermission(permissions: SessionPermission[], key: PermissionKey | string): string[] | "ALL" {
  const matches = permissions.filter((p) => p.permissionKey === key);
  if (matches.some((p) => p.poolId === null)) return "ALL";
  return matches.map((p) => p.poolId as string);
}

/** Revérifie la permission côté serveur en interrogeant la base (ne jamais se fier uniquement au JWT). */
export async function requirePermission(
  userId: string,
  key: PermissionKey,
  opts?: { poolId?: string | null }
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
