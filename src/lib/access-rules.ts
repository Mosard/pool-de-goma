// Règles PURES de l'écran « Gérer les accès » (docs/ecran-gestion-acces.md) :
// droits effectifs avec ajustements individuels, comptes gérables,
// permissions ajustables. Sans base ni cookies : testées dans
// access-rules.test.ts et utilisables côté client (cases désactivées).
// Les actions serveur appliquent les mêmes règles sur les droits relus en base.

import { canGrantRole, hasPermission, isChiefOf, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { PERMISSIONS, ROLE_KEYS, type PermissionKey } from "@/lib/rbac-data";

export type AdjustmentEffect = "GRANT" | "REVOKE";
export type Adjustment = { permissionKey: string; poolId: string | null; effect: AdjustmentEffect };

/**
 * Permissions qui ne s'AJOUTENT pas individuellement (décision Q4, prudente) :
 * gestion des comptes et des utilisateurs, publication et direction (ces deux
 * dernières n'ont d'ailleurs d'effet qu'avec la fonction requise). Leur
 * RETRAIT individuel reste possible.
 */
export const NOT_INDIVIDUALLY_GRANTABLE: readonly PermissionKey[] = [
  PERMISSIONS.ACCOUNTS_MANAGE,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.PUBLICATION_MANAGE,
  PERMISSIONS.DIRECTION_MANAGE,
];

/** Fonctions qui gèrent les accès à l'échelle de la province. */
const PROVINCIAL_MANAGERS: readonly string[] = [ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN];

/**
 * Droits effectifs : permissions des fonctions, moins les retraits
 * individuels (même permission, même portée), plus les ajouts individuels.
 */
export function applyAdjustments(base: SessionPermission[], adjustments: Adjustment[], organizationId: string): SessionPermission[] {
  const revoked = new Set(adjustments.filter((a) => a.effect === "REVOKE").map((a) => `${a.permissionKey}|${a.poolId ?? ""}`));
  const out = new Map<string, SessionPermission>();
  for (const p of base) {
    const k = `${p.permissionKey}|${p.poolId ?? ""}`;
    if (!revoked.has(k)) out.set(k, p);
  }
  for (const a of adjustments) {
    if (a.effect !== "GRANT") continue;
    out.set(`${a.permissionKey}|${a.poolId ?? ""}`, { permissionKey: a.permissionKey, poolId: a.poolId, organizationId });
  }
  return [...out.values()];
}

export type Verdict = { ok: true } | { ok: false; reason: string };
const yes: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

export type Actor = { id: string; organizationId: string; roles: SessionRole[]; permissions: SessionPermission[] };
export type TargetAccount = { id: string; organizationId: string; poolId: string | null; roles: { key: string; poolId: string | null }[] };

export function isProvincialManager(roles: SessionRole[]): boolean {
  return roles.some((r) => PROVINCIAL_MANAGERS.includes(r.key));
}

/** Peut ouvrir l'écran : gère les accès à l'échelle provinciale, ou est chef d'un POOL. */
export function canOpenAccessScreen(roles: SessionRole[]): boolean {
  return isProvincialManager(roles) || roles.some((r) => r.key === ROLE_KEYS.CHEF_POOL && r.poolId);
}

/**
 * Peut gérer ce compte (le voir dans la liste et l'ajuster) :
 *  - jamais le sien, jamais hors de son organisation ;
 *  - compte avec fonctions : l'acteur pourrait attribuer CHACUNE d'elles
 *    (même règle que requireAuthorityOverAccount) ;
 *  - compte sans fonction (décision Q5) : IPP, informaticien, Super Admin,
 *    ou chef du POOL auquel le compte est rattaché.
 */
export function canManageAccount(actor: Pick<Actor, "id" | "organizationId" | "roles">, target: TargetAccount): Verdict {
  if (target.id === actor.id) return no("Vous ne pouvez pas modifier vos propres accès.");
  if (target.organizationId !== actor.organizationId) return no("Compte hors de votre organisation.");
  if (target.roles.length === 0) {
    if (isProvincialManager(actor.roles)) return yes;
    if (target.poolId && isChiefOf(actor.roles, target.poolId)) return yes;
    return no("Compte hors de votre POOL.");
  }
  const blocking = target.roles.find((r) => !canGrantRole(actor.roles, r.key, r.poolId));
  return blocking ? no("Ce compte exerce une fonction que vous ne pouvez pas attribuer.") : yes;
}

/**
 * Peut ajouter (GRANT) ou retirer (REVOKE) individuellement cette permission
 * sur cette portée (poolId vide = tous les POOL) :
 *  - permissions sensibles : pas d'ajout individuel (Q4) ;
 *  - « tous les POOL » : réservé à l'IPP, l'informaticien, le Super Admin ;
 *  - un chef de POOL n'agit que dans son POOL ;
 *  - on ne donne ni ne retire que ce que l'on détient soi-même, sur une
 *    portée au moins aussi large.
 */
export function canAdjustPermission(
  actor: Pick<Actor, "organizationId" | "roles" | "permissions">,
  permissionKey: string,
  poolId: string | null,
  effect: AdjustmentEffect
): Verdict {
  if (effect === "GRANT" && (NOT_INDIVIDUALLY_GRANTABLE as readonly string[]).includes(permissionKey)) {
    return no("Permission sensible : elle ne s'ajoute pas individuellement, seulement par une fonction.");
  }
  const provincial = isProvincialManager(actor.roles);
  if (poolId === null) {
    if (!provincial) return no("Seuls l'IPP, l'informaticien et le Super Admin agissent sur tous les POOL.");
    if (!actor.permissions.some((p) => p.permissionKey === permissionKey && p.poolId === null)) {
      return no("Vous ne détenez pas cette permission sur tous les POOL.");
    }
    return yes;
  }
  if (!provincial && !isChiefOf(actor.roles, poolId)) return no("Hors de votre POOL.");
  if (!hasPermission(actor.permissions, permissionKey, { poolId, organizationId: actor.organizationId })) {
    return no("Vous ne détenez pas cette permission.");
  }
  return yes;
}
