// Écran « Gérer les accès » : lecture et modification des fonctions et des
// ajustements individuels d'un compte (docs/ecran-gestion-acces.md). Tous les
// contrôles se font ici, côté serveur, sur les droits de l'acteur relus en
// base : jamais sur ce qu'envoie le navigateur.

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  ForbiddenError,
  loadUserAccess,
  requireAuthorityOverAccount,
  requireOfficialActorUnlessDemoTarget,
  requireRoleGrant,
  type SessionRole,
} from "@/lib/permissions";
import { canGrantRole } from "@/lib/permission-checks";
import { ASSIGNMENT_END_REASONS, RESTRICTED_ROLE_KEYS, ROLE_KEYS } from "@/lib/rbac-data";
import {
  canAdjustPermission,
  canManageAccount,
  canOpenAccessScreen,
  isProvincialManager,
  type Actor,
  type Adjustment,
  type AdjustmentEffect,
} from "@/lib/access-rules";

/** Fonctions qui ne se gèrent pas depuis cet écran : le chef se nomme depuis la fiche du POOL ; le Super Admin, jamais. */
export const ROLES_MANAGED_ELSEWHERE: readonly string[] = [ROLE_KEYS.CHEF_POOL, ...RESTRICTED_ROLE_KEYS];

export async function loadActor(actorId: string): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actorId }, select: { id: true, organizationId: true } });
  const { roles, permissions } = await loadUserAccess(actorId);
  return { id: user.id, organizationId: user.organizationId, roles, permissions };
}

export function requireAccessScreen(actor: Actor) {
  if (!canOpenAccessScreen(actor.roles)) throw new ForbiddenError("Vous ne gérez les accès d'aucun compte.");
}

/** POOL dans lesquels l'acteur peut agir : tous (gestion provinciale) ou ceux qu'il dirige. */
export async function actorPools(actor: Actor) {
  const chiefPools = actor.roles.filter((r) => r.key === ROLE_KEYS.CHEF_POOL && r.poolId).map((r) => r.poolId as string);
  return prisma.pool.findMany({
    where: { organizationId: actor.organizationId, ...(isProvincialManager(actor.roles) ? {} : { id: { in: chiefPools } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  status: true,
  isDemo: true,
  organizationId: true,
  poolId: true,
  pool: { select: { id: true, name: true } },
  roles: {
    select: {
      id: true,
      poolId: true,
      cellId: true,
      role: { select: { id: true, key: true, label: true, scope: true } },
      pool: { select: { name: true } },
      cell: { select: { code: true, name: true } },
    },
  },
} as const;

/** Comptes que l'acteur peut gérer, avec recherche et filtres. */
export async function listManageableAccounts(
  actor: Actor,
  filters: { q?: string; poolId?: string; roleKey?: string; status?: string }
) {
  const provincial = isProvincialManager(actor.roles);
  const chiefPools = actor.roles.filter((r) => r.key === ROLE_KEYS.CHEF_POOL && r.poolId).map((r) => r.poolId as string);
  const q = filters.q?.trim();
  const users = await prisma.user.findMany({
    where: {
      organizationId: actor.organizationId,
      id: { not: actor.id },
      ...(provincial ? {} : { OR: [{ poolId: { in: chiefPools } }, { roles: { some: { poolId: { in: chiefPools } } } }] }),
      ...(q ? { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" as const } }, { username: { contains: q.toLowerCase() } }, { email: { contains: q.toLowerCase() } }] }] } : {}),
      ...(filters.poolId ? { AND: [{ OR: [{ poolId: filters.poolId }, { roles: { some: { poolId: filters.poolId } } }] }] } : {}),
      ...(filters.roleKey ? { roles: { some: { role: { key: filters.roleKey } } } } : {}),
      ...(filters.status && ["ACTIVE", "PENDING", "SUSPENDED", "DISABLED"].includes(filters.status) ? { status: filters.status as never } : {}),
    },
    select: ACCOUNT_SELECT,
    orderBy: { name: "asc" },
    take: 500,
  });
  return users.filter((u) =>
    canManageAccount(actor, { id: u.id, organizationId: u.organizationId, poolId: u.poolId, roles: u.roles.map((r) => ({ key: r.role.key, poolId: r.poolId })) }).ok
  );
}

/** Compte gérable par l'acteur, ou refus explicite. */
export async function loadManageableAccount(actor: Actor, targetId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      ...ACCOUNT_SELECT,
      permissionAdjustments: { select: { id: true, poolId: true, effect: true, createdAt: true, permission: { select: { key: true } }, pool: { select: { name: true } } } },
    },
  });
  if (!target) throw new ForbiddenError("Compte introuvable.");
  const verdict = canManageAccount(actor, {
    id: target.id,
    organizationId: target.organizationId,
    poolId: target.poolId,
    roles: target.roles.map((r) => ({ key: r.role.key, poolId: r.poolId })),
  });
  if (!verdict.ok) throw new ForbiddenError(verdict.reason);
  return target;
}

/** Permissions de la cible venant de ses fonctions : une entrée par (permission, portée). */
export async function inheritedPermissions(targetId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId: targetId },
    select: { poolId: true, role: { select: { label: true, rolePermissions: { select: { permission: { select: { key: true } } } } } } },
  });
  const out = new Map<string, { permissionKey: string; poolId: string | null; roles: string[] }>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      const k = `${rp.permission.key}|${ur.poolId ?? ""}`;
      const e = out.get(k) ?? { permissionKey: rp.permission.key, poolId: ur.poolId, roles: [] };
      e.roles.push(ur.role.label);
      out.set(k, e);
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------------------
// Application des changements
// ---------------------------------------------------------------------------

export type AccessChanges = {
  /** `cellId` : obligatoire pour une fonction de cellule (exploitant de l'IPP). */
  addRoles: { roleId: string; poolId: string | null; cellId?: string | null }[];
  removeUserRoleIds: string[];
  /** État voulu des ajustements individuels (remplace l'état actuel, après contrôle de chaque différence). */
  adjustments: Adjustment[];
};

const adjKey = (a: { permissionKey: string; poolId: string | null }) => `${a.permissionKey}|${a.poolId ?? ""}`;

/**
 * Applique les changements demandés sur le compte `targetId`, après contrôle
 * serveur de CHACUN d'eux, puis écrit une entrée d'audit par changement.
 * Refuse tout le lot si un seul changement est interdit.
 */
export async function applyAccessChanges(actorId: string, targetId: string, changes: AccessChanges) {
  const actor = await loadActor(actorId);
  requireAccessScreen(actor);
  const target = await loadManageableAccount(actor, targetId);
  await requireOfficialActorUnlessDemoTarget(actorId, target.isDemo);
  // Même règle que pour suspendre ou envoyer un lien : autorité sur CHAQUE fonction du compte.
  await requireAuthorityOverAccount(actorId, { targetUserId: targetId, organizationId: actor.organizationId });

  // --- Fonctions à ajouter ---
  const rolesToAdd: { roleId: string; roleKey: string; poolId: string | null; cellId: string | null }[] = [];
  for (const add of changes.addRoles) {
    const role = await prisma.roleDefinition.findUnique({ where: { id: add.roleId } });
    if (!role || ROLES_MANAGED_ELSEWHERE.includes(role.key)) throw new ForbiddenError("Cette fonction ne s'attribue pas depuis cet écran.");
    const poolId = role.scope === "POOL" ? add.poolId : null;
    if (role.scope === "POOL") {
      if (!poolId) throw new ForbiddenError(`« ${role.label} » : choisissez un POOL.`);
      const pool = await prisma.pool.findFirst({ where: { id: poolId, organizationId: actor.organizationId } });
      if (!pool) throw new ForbiddenError("POOL introuvable.");
    }
    // Fonction de cellule : rattachement OBLIGATOIRE à une cellule active de l'organisation, et une seule.
    const cellId = role.scope === "CELL" ? (add.cellId ?? null) : null;
    if (role.scope === "CELL") {
      if (!cellId) throw new ForbiddenError(`« ${role.label} » : choisissez la cellule.`);
      const cell = await prisma.cell.findFirst({ where: { id: cellId, organizationId: actor.organizationId, active: true } });
      if (!cell) throw new ForbiddenError("Cellule introuvable ou archivée.");
      const kept = target.roles.filter((r) => r.role.id === role.id && !changes.removeUserRoleIds.includes(r.id));
      if (kept.length > 0 || rolesToAdd.some((r) => r.roleId === role.id)) {
        throw new ForbiddenError(`« ${role.label} » : une seule cellule par personne. Retirez d'abord le rattachement actuel.`);
      }
    }
    await requireRoleGrant(actorId, { roleKey: role.key, poolId, organizationId: actor.organizationId, targetUserId: targetId });
    if (!target.roles.some((r) => r.role.id === role.id && r.poolId === poolId && r.cellId === cellId)) {
      rolesToAdd.push({ roleId: role.id, roleKey: role.key, poolId, cellId });
    }
  }

  // --- Fonctions à retirer ---
  const rolesToRemove: (typeof target.roles)[number][] = [];
  for (const id of changes.removeUserRoleIds) {
    const ur = target.roles.find((r) => r.id === id);
    if (!ur) throw new ForbiddenError("Fonction introuvable sur ce compte.");
    if (ROLES_MANAGED_ELSEWHERE.includes(ur.role.key)) throw new ForbiddenError("Cette fonction se retire depuis la fiche du POOL.");
    await requireRoleGrant(actorId, { roleKey: ur.role.key, poolId: ur.poolId, organizationId: actor.organizationId, targetUserId: targetId });
    rolesToRemove.push(ur);
  }

  // Fonctions du compte APRÈS ce lot : un exploitant de cellule ou un IPA ne reçoit pas d'accès provincial.
  const finalRoles = {
    roles: [
      ...target.roles.filter((r) => !rolesToRemove.some((x) => x.id === r.id)).map((r) => ({ key: r.role.key })),
      ...rolesToAdd.map((r) => ({ key: r.roleKey })),
    ],
  };
  const assertAdjustable = (a: Actor, permissionKey: string, poolId: string | null, effect: AdjustmentEffect) => assertAdjustableFor(a, permissionKey, poolId, effect, finalRoles);

  // --- Ajustements individuels : seules les différences sont contrôlées et appliquées ---
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionId = new Map(permissions.map((p) => [p.key, p.id]));
  const current = new Map(target.permissionAdjustments.map((a) => [adjKey({ permissionKey: a.permission.key, poolId: a.poolId }), a]));
  const wanted = new Map<string, Adjustment>();
  for (const a of changes.adjustments) {
    if (!permissionId.has(a.permissionKey)) throw new ForbiddenError("Permission inconnue.");
    if (a.effect !== "GRANT" && a.effect !== "REVOKE") throw new ForbiddenError("Ajustement invalide.");
    wanted.set(adjKey(a), { permissionKey: a.permissionKey, poolId: a.poolId ?? null, effect: a.effect });
  }
  const adjustmentOps: { kind: "set" | "remove"; key: string; next?: Adjustment; prev?: { effect: AdjustmentEffect } }[] = [];
  for (const [k, next] of wanted) {
    const prev = current.get(k);
    if (prev && prev.effect === next.effect) continue;
    // Modifier un ajustement existant suppose de pouvoir défaire le précédent ET poser le nouveau.
    if (prev) assertAdjustable(actor, next.permissionKey, next.poolId, prev.effect);
    assertAdjustable(actor, next.permissionKey, next.poolId, next.effect);
    if (next.poolId) {
      const pool = await prisma.pool.findFirst({ where: { id: next.poolId, organizationId: actor.organizationId } });
      if (!pool) throw new ForbiddenError("POOL introuvable.");
    }
    adjustmentOps.push({ kind: "set", key: k, next, prev: prev ? { effect: prev.effect } : undefined });
  }
  for (const [k, prev] of current) {
    if (wanted.has(k)) continue;
    assertAdjustable(actor, prev.permission.key, prev.poolId, prev.effect);
    adjustmentOps.push({ kind: "remove", key: k, prev: { effect: prev.effect } });
  }

  if (rolesToAdd.length === 0 && rolesToRemove.length === 0 && adjustmentOps.length === 0) return { changed: 0 };

  // --- Écriture (une transaction) ---
  const audits: Parameters<typeof logAudit>[0][] = [];
  const base = { actorId, organizationId: actor.organizationId, entityType: "User", entityId: targetId };
  const metadata = { via: "gestion-acces" };
  await prisma.$transaction(async (tx) => {
    for (const r of rolesToAdd) {
      const created = await tx.userRole.create({ data: { userId: targetId, roleId: r.roleId, poolId: r.poolId, cellId: r.cellId } });
      audits.push({ ...base, action: "user.role_add", newValue: { userRoleId: created.id, roleKey: r.roleKey, poolId: r.poolId, cellId: r.cellId }, metadata });
    }
    for (const ur of rolesToRemove) {
      await tx.userRole.delete({ where: { id: ur.id } });
      let endedAssignments = 0;
      let chiefRemoved = false;
      // Comme sur la fiche du POOL : retirer la fonction d'inspecteur met fin à
      // ses affectations dans ce POOL et à sa fonction de chef de ce POOL.
      if (ur.role.key === ROLE_KEYS.INSPECTEUR && ur.poolId) {
        const ended = await tx.assignment.updateMany({
          where: { inspectorId: targetId, active: true, school: { poolId: ur.poolId } },
          data: { active: false, endedAt: new Date(), endReason: ASSIGNMENT_END_REASONS.ROLE_REMOVED, endedById: actorId },
        });
        const chief = await tx.userRole.deleteMany({ where: { userId: targetId, poolId: ur.poolId, role: { key: ROLE_KEYS.CHEF_POOL } } });
        endedAssignments = ended.count;
        chiefRemoved = chief.count > 0;
      }
      audits.push({
        ...base,
        action: "user.role_remove",
        oldValue: { userRoleId: ur.id, roleKey: ur.role.key, poolId: ur.poolId, cellId: ur.cellId },
        metadata: { ...metadata, endedAssignments, chiefRemoved },
      });
    }
    for (const op of adjustmentOps) {
      const [permissionKey, pool] = op.key.split("|");
      const poolId = pool || null;
      const pid = permissionId.get(permissionKey)!;
      const existing = await tx.userPermission.findFirst({ where: { userId: targetId, permissionId: pid, poolId } });
      if (op.kind === "remove") {
        if (existing) await tx.userPermission.delete({ where: { id: existing.id } });
        audits.push({ ...base, action: "user.permission_adjustment_remove", oldValue: { permissionKey, poolId, effect: op.prev!.effect }, metadata });
      } else {
        if (existing) await tx.userPermission.update({ where: { id: existing.id }, data: { effect: op.next!.effect, grantedById: actorId } });
        else await tx.userPermission.create({ data: { userId: targetId, permissionId: pid, poolId, effect: op.next!.effect, grantedById: actorId } });
        audits.push({
          ...base,
          action: op.next!.effect === "GRANT" ? "user.permission_grant" : "user.permission_revoke",
          oldValue: op.prev ? { permissionKey, poolId, effect: op.prev.effect } : undefined,
          newValue: { permissionKey, poolId, effect: op.next!.effect },
          metadata,
        });
      }
    }
  });
  for (const a of audits) await logAudit(a);
  return { changed: audits.length };
}

function assertAdjustableFor(actor: Actor, permissionKey: string, poolId: string | null, effect: AdjustmentEffect, target: { roles: { key: string }[] }) {
  const v = canAdjustPermission(actor, permissionKey, poolId, effect, target);
  if (!v.ok) throw new ForbiddenError(`${permissionKey}${poolId ? "" : " (tous les POOL)"} : ${v.reason}`);
}

/** Fonctions que l'acteur peut attribuer depuis cet écran (hors chef de POOL et Super Admin). */
export async function grantableRoles(actorRoles: SessionRole[]) {
  const roles = await prisma.roleDefinition.findMany({ orderBy: { label: "asc" }, select: { id: true, key: true, label: true, scope: true } });
  return roles.filter((r) => !ROLES_MANAGED_ELSEWHERE.includes(r.key) && (r.scope === "POOL" ? true : canGrantRole(actorRoles, r.key, null)));
}
