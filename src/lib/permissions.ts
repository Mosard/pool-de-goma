import { prisma } from "@/lib/prisma";
import {
  IPP_VIEW_MODE_EXTRA_ROLE_KEYS,
  PERMISSIONS,
  PUBLICATION_AUTHORITY_ROLE_KEYS,
  RESTRICTED_ROLE_KEYS,
  ROLE_KEYS,
  VIEW_MODE_HOLDER_ROLE_KEYS,
  type PermissionKey,
} from "@/lib/rbac-data";
import { canGrantRole, hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { readViewMode, type ViewMode } from "@/lib/view-mode";
import { applyAdjustments } from "@/lib/access-rules";

// Fonctions pures réexportées (les composants client importent directement
// permission-checks, ce module-ci lisant la base et les cookies).
export { canGrantRole, hasPermission, hasPermissionAnyPool, isChiefOf, poolsWithPermission } from "@/lib/permission-checks";
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
  /** Détient RÉELLEMENT un rôle autorisé à « Voir comme » (Super Admin, IPP). */
  canViewAs: boolean;
  /** Fonction simulée (« Voir comme »), sinon null. */
  viewMode: ActiveViewMode | null;
};

async function loadRealAccess(userId: string) {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, status: true } });
  if (!dbUser || dbUser.status !== "ACTIVE") return null;

  const [userRoles, adjustments] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    }),
    prisma.userPermission.findMany({ where: { userId }, select: { poolId: true, effect: true, permission: { select: { key: true } } } }),
  ]);

  const roles: SessionRole[] = userRoles.map((ur) => ({ key: ur.role.key, label: ur.role.label, poolId: ur.poolId }));
  const fromRoles: SessionPermission[] = [];
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      fromRoles.push({ permissionKey: rp.permission.key, poolId: ur.poolId, organizationId: dbUser.organizationId });
    }
  }
  // Ajustements individuels (écran « Gérer les accès ») : retraits puis ajouts.
  const permissions = applyAdjustments(
    fromRoles,
    adjustments.map((a) => ({ permissionKey: a.permission.key, poolId: a.poolId, effect: a.effect })),
    dbUser.organizationId
  );
  return { organizationId: dbUser.organizationId, roles, permissions };
}

/**
 * Droits simulés : ceux de la fonction choisie, pour le POOL choisi s'il
 * s'agit d'une fonction de POOL. null si le mode est invalide (fonction
 * inconnue ou réservée, POOL absent, inactif ou d'une autre organisation).
 *
 * `limitTo` (IPP) : seules les fonctions de POOL se simulent, et chaque
 * permission simulée n'est conservée que si le compte la détient déjà
 * réellement pour ce POOL — la bascule ne donne jamais plus de droits.
 */
async function simulateAccess(
  mode: ViewMode,
  organizationId: string,
  limitTo: SessionPermission[] | null
): Promise<Omit<UserAccess, "superAdmin" | "canViewAs"> | null> {
  if (RESTRICTED_ROLE_KEYS.includes(mode.role)) return null;
  const role = await prisma.roleDefinition.findUnique({
    where: { key: mode.role },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) return null;
  // IPP : fonctions de POOL, plus les fonctions provinciales autorisées
  // (chargé des médias), dont les droits ne sont pas bornés.
  const ippExtra = IPP_VIEW_MODE_EXTRA_ROLE_KEYS.includes(role.key);
  if (limitTo && role.scope !== "POOL" && !ippExtra) return null;
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
  const permissions = role.rolePermissions
    .map((rp) => ({ permissionKey: rp.permission.key, poolId, organizationId }))
    .filter((p) => !limitTo || ippExtra || hasPermission(limitTo, p.permissionKey, { poolId, organizationId }));
  return {
    roles: [{ key: role.key, label: role.label, poolId }],
    permissions,
    viewMode: { role: role.key, label: role.label, poolId, poolName: pool?.name ?? null },
  };
}

/**
 * Charge les rôles + permissions EFFECTIFS d'un utilisateur depuis la base.
 * Un compte qui n'est pas ACTIVE (suspendu, désactivé, en attente) n'a aucune
 * permission, même si son jeton de session (JWT) est encore valide.
 *
 * Mode « Voir comme » : droits de la fonction simulée, et uniquement
 * ceux-là — contrôles serveur compris. Super Admin : toute fonction non
 * réservée. IPP : fonctions de POOL, bornées à ses propres droits, et
 * chargé des médias (IPP_VIEW_MODE_EXTRA_ROLE_KEYS, droits non bornés).
 * Le mode est lu dans le cookie de la requête, sauf si `opts.viewMode` est
 * fourni (null = aucun) ; il est ignoré pour tout autre compte.
 */
export async function loadUserAccess(userId: string, opts?: { viewMode?: ViewMode | null }): Promise<UserAccess> {
  const real = await loadRealAccess(userId);
  if (!real) return { roles: [], permissions: [], superAdmin: false, canViewAs: false, viewMode: null };

  const superAdmin = real.roles.some((r) => r.key === ROLE_KEYS.SUPER_ADMIN);
  const canViewAs = real.roles.some((r) => VIEW_MODE_HOLDER_ROLE_KEYS.includes(r.key));
  const own = { roles: real.roles, permissions: real.permissions, superAdmin, canViewAs, viewMode: null };
  if (!canViewAs) return own;

  const mode = opts && "viewMode" in opts ? opts.viewMode : await readViewMode();
  const simulated = mode ? await simulateAccess(mode, real.organizationId, superAdmin ? null : real.permissions) : null;
  if (!simulated) return own;
  return { ...simulated, superAdmin, canViewAs };
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

/**
 * Attribuer ou retirer une fonction (décision du 2026-10-07) : selon
 * ROLE_GRANTORS et les rôles effectifs de l'acteur, jamais sur ses propres
 * fonctions, jamais une fonction réservée. Une fonction créée depuis
 * Paramètres ne s'attribue que si l'acteur détient chacune de ses
 * permissions : on ne donne jamais plus de droits qu'on n'en a.
 */
export async function requireRoleGrant(
  actorId: string,
  params: { roleKey: string; poolId: string | null; organizationId: string; targetUserId?: string | null }
): Promise<void> {
  if (params.targetUserId && params.targetUserId === actorId) {
    throw new ForbiddenError("Vous ne pouvez pas modifier vos propres fonctions : demandez-le à un autre responsable habilité.");
  }
  const role = await prisma.roleDefinition.findUnique({
    where: { key: params.roleKey },
    include: { rolePermissions: { include: { permission: true } } },
  });
  const label = role?.label ?? params.roleKey;
  const refusal = new ForbiddenError(`Vous n'êtes pas habilité à attribuer ou retirer la fonction « ${label} ».`);
  if (!role || RESTRICTED_ROLE_KEYS.includes(role.key)) throw refusal;

  const { roles, permissions } = await loadUserAccess(actorId);
  if (!canGrantRole(roles, role.key, params.poolId)) throw refusal;
  if (!role.isSystem) {
    const scope = { poolId: params.poolId, organizationId: params.organizationId };
    if (!role.rolePermissions.every((rp) => hasPermission(permissions, rp.permission.key, scope))) throw refusal;
  }
}

/**
 * Agir sur l'accès d'un compte (suspendre, remettre un lien de mot de passe) :
 * seulement si l'acteur pourrait attribuer CHACUNE de ses fonctions — sans
 * quoi l'informaticien pourrait, par exemple, prendre la main sur le compte
 * de l'IPP. `allowSelf` : action permise sur son propre compte.
 */
export async function requireAuthorityOverAccount(
  actorId: string,
  params: { targetUserId: string; organizationId: string; allowSelf?: boolean }
): Promise<void> {
  if (params.targetUserId === actorId) {
    if (params.allowSelf) return;
    throw new ForbiddenError("Vous ne pouvez pas faire cette action sur votre propre compte.");
  }
  const targetRoles = await prisma.userRole.findMany({
    where: { userId: params.targetUserId },
    select: { poolId: true, role: { select: { key: true, label: true } } },
  });
  for (const tr of targetRoles) {
    try {
      await requireRoleGrant(actorId, { roleKey: tr.role.key, poolId: tr.poolId, organizationId: params.organizationId });
    } catch (e) {
      if (!(e instanceof ForbiddenError)) throw e;
      throw new ForbiddenError(`Ce compte exerce la fonction « ${tr.role.label} », qui dépasse votre niveau d'habilitation.`);
    }
  }
}

/** Détient RÉELLEMENT le rôle Super Admin (le mode « Voir comme » n'y change rien). */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  return (await loadUserAccess(userId, { viewMode: null })).superAdmin;
}

/** Détient RÉELLEMENT un rôle autorisé à « Voir comme » (Super Admin ou IPP). */
export async function canUseViewMode(userId: string): Promise<boolean> {
  return (await loadUserAccess(userId, { viewMode: null })).canViewAs;
}

export async function getRoleLabels(): Promise<Record<string, string>> {
  const roles = await prisma.roleDefinition.findMany();
  return Object.fromEntries(roles.map((r) => [r.key, r.label]));
}

export { PERMISSIONS };

/**
 * Comptes qui détiennent EFFECTIVEMENT une permission pour ce POOL (ou pour
 * l'organisation si poolId est vide) : fonctions, ajustements individuels
 * (ajouts et retraits) et statut ACTIVE compris, droits réels (sans « Voir
 * comme »). Sert aux notifications et à la recherche de valideurs.
 */
export async function usersHoldingPermission(params: {
  permissionKey: string;
  organizationId: string;
  poolId?: string | null;
  where?: { isDemo?: boolean; excludeUserId?: string };
}): Promise<string[]> {
  const poolFilter = params.poolId ? [{ poolId: null }, { poolId: params.poolId }] : [{ poolId: null }];
  const candidates = await prisma.user.findMany({
    where: {
      organizationId: params.organizationId,
      status: "ACTIVE",
      ...(params.where?.isDemo !== undefined ? { isDemo: params.where.isDemo } : {}),
      ...(params.where?.excludeUserId ? { id: { not: params.where.excludeUserId } } : {}),
      OR: [
        { roles: { some: { OR: poolFilter, role: { rolePermissions: { some: { permission: { key: params.permissionKey } } } } } } },
        { permissionAdjustments: { some: { effect: "GRANT", OR: poolFilter, permission: { key: params.permissionKey } } } },
      ],
    },
    select: { id: true },
  });
  const holders: string[] = [];
  for (const c of candidates) {
    const { permissions } = await loadUserAccess(c.id, { viewMode: null });
    const target = params.poolId ? { poolId: params.poolId, organizationId: params.organizationId } : undefined;
    if (hasPermission(permissions, params.permissionKey, target)) holders.push(c.id);
  }
  return holders;
}
