// Modifier ou supprimer une fonction PERSONNALISÉE (décisions du 2026-10-13).
// Les fonctions système (IPP, IPA, informaticien, secrétaire de l'IPP…) ne se
// modifient ni ne se suppriment : le logiciel en dépend. Droits relus en base,
// compte officiel, audit. Les titulaires d'une fonction modifiée en héritent à
// leur requête suivante ; une fonction supprimée est retirée à tous.

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, hasPermissionAnyPool, loadUserAccess, requireOfficialActor, requirePermission, requireRoleGrant } from "@/lib/permissions";
import { CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS, PERMISSIONS, PERMISSION_CATALOG, RESTRICTED_ROLE_KEYS, isSuperuserRoleKey } from "@/lib/rbac-data";

type Actor = { id: string; organizationId: string };

export const FORBIDDEN_IN_CUSTOM_MESSAGE = "Une fonction personnalisée ne peut pas porter les pouvoirs réservés ni les permissions sensibles de la présence.";

async function requireFunctionManager(actor: Actor) {
  await requirePermission(actor.id, PERMISSIONS.POOLS_MANAGE);
  await requireOfficialActor(actor.id);
}

async function loadCustomFunction(roleId: string) {
  const role = await prisma.roleDefinition.findUnique({
    where: { id: roleId },
    include: { rolePermissions: { include: { permission: true } }, userRoles: { select: { id: true, userId: true, poolId: true, cellId: true } } },
  });
  if (!role) throw new ForbiddenError("Fonction introuvable.");
  if (role.isSystem || RESTRICTED_ROLE_KEYS.includes(role.key) || isSuperuserRoleKey(role.key)) {
    throw new ForbiddenError("Fonction système : elle ne se modifie ni ne se supprime depuis l'écran.");
  }
  return role;
}

/** Nouvelles permissions (libellé, description) d'une fonction personnalisée. */
export async function updateCustomFunction(actor: Actor, roleId: string, input: { label: string; description: string | null; permissionKeys: string[] }) {
  await requireFunctionManager(actor);
  const role = await loadCustomFunction(roleId);
  const label = input.label.trim().slice(0, 80);
  if (label.length < 2) throw new ForbiddenError("Nom : au moins 2 caractères.");
  const valid = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));
  const keys = [...new Set(input.permissionKeys.filter((k) => valid.has(k)))].sort();
  if (keys.some((k) => CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS.includes(k))) throw new ForbiddenError(FORBIDDEN_IN_CUSTOM_MESSAGE);
  // Jamais au-dessus de soi : seulement des permissions que l'auteur détient.
  const { permissions } = await loadUserAccess(actor.id);
  if (keys.some((k) => !hasPermissionAnyPool(permissions, k))) {
    throw new ForbiddenError("Vous ne pouvez inclure dans une fonction que des permissions que vous détenez vous-même.");
  }
  await requireRoleGrant(actor.id, { roleKey: role.key, poolId: null, organizationId: actor.organizationId });
  const description = input.description?.trim().slice(0, 300) || null;
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.roleDefinition.update({
      where: { id: role.id },
      data: { label, description, rolePermissions: { create: keys.map((key) => ({ permission: { connect: { key } } })) } },
    });
  });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "function.update",
    entityType: "RoleDefinition",
    entityId: role.id,
    oldValue: { label: role.label, description: role.description, permissionKeys: role.rolePermissions.map((rp) => rp.permission.key).sort() },
    newValue: { label, description, permissionKeys: keys },
    metadata: { holders: new Set(role.userRoles.map((u) => u.userId)).size },
  });
}

/** Supprime une fonction personnalisée et la retire à tous ses titulaires. */
export async function deleteCustomFunction(actor: Actor, roleId: string): Promise<{ holdersRemoved: number }> {
  await requireFunctionManager(actor);
  const role = await loadCustomFunction(roleId);
  // Habilitation sur chaque titulaire (jamais soi-même).
  for (const ur of role.userRoles) {
    await requireRoleGrant(actor.id, { roleKey: role.key, poolId: ur.poolId, organizationId: actor.organizationId, targetUserId: ur.userId });
  }
  await prisma.$transaction(async (tx) => {
    await tx.accountRequest.updateMany({ where: { requestedRoleId: role.id }, data: { requestedRoleId: null } });
    await tx.userRole.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.roleDefinition.delete({ where: { id: role.id } });
  });
  for (const ur of role.userRoles) {
    await logAudit({
      actorId: actor.id,
      organizationId: actor.organizationId,
      action: "user.role_remove",
      entityType: "User",
      entityId: ur.userId,
      oldValue: { userRoleId: ur.id, roleKey: role.key, poolId: ur.poolId, cellId: ur.cellId },
      metadata: { via: "suppression-fonction" },
    });
  }
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "function.delete",
    entityType: "RoleDefinition",
    entityId: role.id,
    oldValue: { key: role.key, label: role.label, scope: role.scope, permissionKeys: role.rolePermissions.map((rp) => rp.permission.key).sort() },
    metadata: { holdersRemoved: role.userRoles.length },
  });
  return { holdersRemoved: role.userRoles.length };
}
