import { prisma } from "@/lib/prisma";
import { PERMISSIONS, PUBLICATION_AUTHORITY_ROLE_KEYS, RESTRICTED_ROLE_KEYS, ROLE_KEYS, type PermissionKey } from "@/lib/rbac-data";
import { hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { readViewMode, type ViewMode } from "@/lib/view-mode";

// Fonctions pures réexportées (les composants client importent directement
// permission-checks, ce module-ci lisant la base et les cookies).
export { hasPermission, hasPermissionAnyPool, poolsWithPermission } from "@/lib/permission-checks";
export type { SessionPermission, SessionRole } from "@/lib/permission-checks";

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée pour ce rôle.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type ActiveViewMode = { role: string; label: string; poolId: string | null; poolName: string | null };

export type UserAccess = {
  roles: SessionRole[];
  permissions: SessionPermission[];
  /** Détient RÉELLEMENT le rôle Super Admin (indépendamment du mode simulé). */
  superAdmin: boolean;
  /** Fonction simulée par le Super Admin (« Voir comme »), sinon null. */
  viewMode: ActiveViewMode | null;
};

async function loadRealAccess(userId: string) {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, status: true } });
  if (!dbUser || dbUser.status !== "ACTIVE") return null;

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const roles: SessionRole[] = userRoles.map((ur) => ({ key: ur.role.key, label: ur.role.label, poolId: ur.poolId }));
  const permissions: SessionPermission[] = [];
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissions.push({ permissionKey: rp.permission.key, poolId: ur.poolId, organizationId: dbUser.organizationId });
    }
  }
  return { organizationId: dbUser.organizationId, roles, permissions };
}

/**
 * Droits simulés : ceux de la fonction choisie, pour le POOL choisi s'il
 * s'agit d'une fonction de POOL. null si le mode est invalide (fonction
 * inconnue ou réservée, POOL absent, inactif ou d'une autre organisation).
 */
async function simulateAccess(mode: ViewMode, organizationId: string): Promise<Omit<UserAccess, "superAdmin"> | null> {
  if (RESTRICTED_ROLE_KEYS.includes(mode.role)) return null;
  const role = await prisma.roleDefinition.findUnique({
    where: { key: mode.role },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) return null;
  let pool: { id: string; name: string } | null = null;
  if (role.scope === "POOL") {
    if (!mode.poolId) return null;
    pool = await prisma.pool.findFirst({
      where: { id: mode.poolId, organizationId, active: true },
      select: { id: true, name: true },
    });
    if (!pool) return null;
  }
  const poolId = pool?.id ?? null;
  return {
    roles: [{ key: role.key, label: role.label, poolId }],
    permissions: role.rolePermissions.map((rp) => ({ permissionKey: rp.permission.key, poolId, organizationId })),
    viewMode: { role: role.key, label: role.label, poolId, poolName: pool?.name ?? null },
  };
}

/**
 * Charge les rôles + permissions EFFECTIFS d'un utilisateur depuis la base.
 * Un compte qui n'est pas ACTIVE (suspendu, désactivé, en attente) n'a aucune
 * permission, même si son jeton de session (JWT) est encore valide.
 *
 * Super Admin en mode « Voir comme » : droits de la fonction simulée, et
 * uniquement ceux-là — contrôles serveur compris. Le mode est lu dans le
 * cookie de la requête, sauf si `opts.viewMode` est fourni (null = aucun).
 */
export async function loadUserAccess(userId: string, opts?: { viewMode?: ViewMode | null }): Promise<UserAccess> {
  const real = await loadRealAccess(userId);
  if (!real) return { roles: [], permissions: [], superAdmin: false, viewMode: null };

  const superAdmin = real.roles.some((r) => r.key === ROLE_KEYS.SUPER_ADMIN);
  if (!superAdmin) return { roles: real.roles, permissions: real.permissions, superAdmin: false, viewMode: null };

  const mode = opts && "viewMode" in opts ? opts.viewMode : await readViewMode();
  const simulated = mode ? await simulateAccess(mode, real.organizationId) : null;
  if (!simulated) return { roles: real.roles, permissions: real.permissions, superAdmin: true, viewMode: null };
  return { ...simulated, superAdmin: true };
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

/**
 * Actions qui modifient une information présentée comme officielle (fiche
 * d'un POOL, nomination du chef, fonctions, publication) : interdites aux
 * comptes de démonstration, dont les identifiants sont connus.
 */
export async function requireOfficialActor(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isDemo: true } });
  if (!user || user.isDemo) {
    throw new ForbiddenError(
      "Action refusée : vous êtes connecté avec un compte de démonstration, qui ne peut agir que sur des données de démonstration. Cette opération touche des données officielles et doit être faite depuis un compte officiel."
    );
  }
}

/** Message de refus si l'acteur est un compte de démonstration, sinon null (pour les formulaires à état). */
export async function demoRefusal(userId: string, targetIsDemo = false): Promise<string | null> {
  if (targetIsDemo) return null;
  try {
    await requireOfficialActor(userId);
    return null;
  } catch (e) {
    if (e instanceof ForbiddenError) return e.message;
    throw e;
  }
}

export async function isDemoActor(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isDemo: true } });
  return user?.isDemo ?? true;
}

/**
 * Un compte de démonstration peut manipuler des données de démonstration
 * (tests), mais jamais des données réelles : sinon il modifierait ce que
 * le site présente comme officiel.
 */
export async function requireOfficialActorUnlessDemoTarget(actorId: string, targetIsDemo: boolean): Promise<void> {
  if (!targetIsDemo) await requireOfficialActor(actorId);
}

/**
 * Autorisation de publier un agent : permission publication.manage ET rôle
 * IPP ou Informaticien (décision de l'Inspection), compte officiel.
 */
export async function requirePublicationAuthority(userId: string): Promise<void> {
  await requireOfficialActor(userId);
  const { roles, permissions } = await loadUserAccess(userId);
  if (
    !hasPermission(permissions, PERMISSIONS.PUBLICATION_MANAGE) ||
    !roles.some((r) => PUBLICATION_AUTHORITY_ROLE_KEYS.includes(r.key))
  ) {
    throw new ForbiddenError("Seuls l'IPP, l'informaticien et le Super Admin peuvent autoriser une publication.");
  }
}

/** Détient RÉELLEMENT le rôle Super Admin (le mode « Voir comme » n'y change rien). */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  return (await loadUserAccess(userId, { viewMode: null })).superAdmin;
}

export async function getRoleLabels(): Promise<Record<string, string>> {
  const roles = await prisma.roleDefinition.findMany();
  return Object.fromEntries(roles.map((r) => [r.key, r.label]));
}

export { PERMISSIONS };
