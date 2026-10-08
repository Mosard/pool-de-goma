// Règles PURES des cellules de l'IPP et de la branche IPP des rapports
// (décisions du 2026-10-08, docs/exploitants-ipp-cellules.md § 6). Sans base
// ni cookies : testées dans cells.test.ts. Elles reçoivent les rôles et
// permissions EFFECTIFS relus en base (loadUserAccess), jamais une valeur
// envoyée par le navigateur.

import {
  CELL_BOUND_ROLE_KEYS,
  CELL_PERMISSION_KEYS,
  IPA_CELL_BOUND_KEYS,
  PERMISSIONS,
  ROLE_KEYS,
  SIGNED_ONLY_READER_ROLE_KEYS,
} from "@/lib/rbac-data";
import { hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";

export type IppStageKey = "AU_SECRETARIAT" | "AFFECTE" | "EXPLOITE" | "SIGNE";

export const IPP_STAGE_LABELS: Record<IppStageKey, string> = {
  AU_SECRETARIAT: "Au secrétariat de l'IPP",
  AFFECTE: "Envoyé à la cellule",
  EXPLOITE: "Exploité, à signer par l'IPA",
  SIGNE: "Signé et transmis à l'IPP",
};

/** Stades où la cellule destinataire voit le rapport. */
export const CELL_VISIBLE_STAGES: readonly IppStageKey[] = ["AFFECTE", "EXPLOITE", "SIGNE"];

export type IppTrackInfo = { stage: IppStageKey; cellId: string | null; legacy: boolean; organizationId: string };

export type CellActor = { id: string; organizationId: string; roles: SessionRole[]; permissions: SessionPermission[] };

export function isSuperAdmin(roles: SessionRole[]): boolean {
  return roles.some((r) => r.key === ROLE_KEYS.SUPER_ADMIN);
}

// ─── Droits effectifs : rattachement des permissions à une cellule ─────────

/**
 * Permissions d'une fonction attribuée, avec leur portée :
 *  - permission de cellule (et, pour l'IPA, son analyse IA) : la cellule de
 *    la fonction (UserRole.cellId) ou, pour l'IPA, la cellule dont il est
 *    responsable. Sans cellule : AUCUNE permission, jamais de repli provincial ;
 *  - Super Admin : portée organisation (assistance technique) ;
 *  - sinon : le POOL de la fonction, ou l'organisation.
 */
export function bindRolePermissions(p: {
  roleKey: string;
  permissionKeys: string[];
  poolId: string | null;
  cellId: string | null;
  ipaCellId: string | null;
  organizationId: string;
}): SessionPermission[] {
  const out: SessionPermission[] = [];
  for (const key of p.permissionKeys) {
    const base = { permissionKey: key, organizationId: p.organizationId };
    if (p.roleKey === ROLE_KEYS.SUPER_ADMIN) {
      out.push({ ...base, poolId: p.poolId });
      continue;
    }
    const cellBound = CELL_PERMISSION_KEYS.includes(key) || (p.roleKey === ROLE_KEYS.IPA && IPA_CELL_BOUND_KEYS.includes(key));
    if (cellBound) {
      const cellId = p.roleKey === ROLE_KEYS.IPA ? p.ipaCellId : p.cellId;
      if (cellId) out.push({ ...base, poolId: null, cellId });
      continue;
    }
    out.push({ ...base, poolId: p.poolId });
  }
  return out;
}

const PROVINCIAL_REVIEW_KEYS: readonly string[] = [PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.REPORTS_REVIEW_POOL];

/** Fonction rattachée à une cellule (exploitant de l'IPP, IPA), hors Super Admin. */
export function isCellBound(roles: { key: string }[]): boolean {
  return !roles.some((r) => r.key === ROLE_KEYS.SUPER_ADMIN) && roles.some((r) => CELL_BOUND_ROLE_KEYS.includes(r.key));
}

/**
 * Un ajout individuel ne redonne jamais un accès provincial (review_province,
 * review_pool sur tous les POOL) à une personne rattachée à une cellule, sauf
 * s'il vient d'une autre de ses fonctions. Appliqué au calcul des droits,
 * donc aussi aux ajustements déjà en base.
 */
export function withoutProvincialFallback(roles: { key: string }[], fromRoles: SessionPermission[], effective: SessionPermission[]): SessionPermission[] {
  if (!isCellBound(roles)) return effective;
  const own = new Set(fromRoles.filter((p) => p.poolId === null && !p.cellId).map((p) => p.permissionKey));
  return effective.filter((p) => !(PROVINCIAL_REVIEW_KEYS.includes(p.permissionKey) && p.poolId === null && !p.cellId && !own.has(p.permissionKey)));
}

/** « Gérer les accès » : refus de redonner un accès provincial à une personne rattachée à une cellule. */
export function provincialGrantRefusal(targetRoles: { key: string }[], permissionKey: string, poolId: string | null, effect: "GRANT" | "REVOKE"): string | null {
  if (effect !== "GRANT" || poolId !== null || !PROVINCIAL_REVIEW_KEYS.includes(permissionKey)) return null;
  if (!isCellBound(targetRoles)) return null;
  return "Personne rattachée à une cellule : elle ne reçoit pas d'accès provincial, seulement les rapports affectés à sa cellule.";
}

// ─── Lecture d'un rapport ──────────────────────────────────────────────────

/** Permissions qui donnent accès aux rapports d'un POOL (ou de l'organisation). */
export const POOL_READ_KEYS: readonly string[] = [
  PERMISSIONS.REPORTS_REVIEW_POOL,
  PERMISSIONS.REPORTS_REVIEW_PROVINCE,
  PERMISSIONS.REPORTS_VALIDATE,
  PERMISSIONS.ASSIGNMENTS_MANAGE,
];

/** D7 : l'IPP principal ne lit, dans la branche IPP, que ce que les cellules ont signé (et l'historique). */
export function readsSignedOnly(roles: SessionRole[]): boolean {
  return !isSuperAdmin(roles) && roles.some((r) => SIGNED_ONLY_READER_ROLE_KEYS.includes(r.key));
}

export function holdsRouteIpp(actor: Pick<CellActor, "permissions">, organizationId: string): boolean {
  return actor.permissions.some(
    (p) => p.permissionKey === PERMISSIONS.REPORTS_ROUTE_IPP && !p.cellId && p.poolId === null && p.organizationId === organizationId
  );
}

export function holdsCell(actor: Pick<CellActor, "permissions">, key: string, cellId: string | null): boolean {
  return Boolean(cellId) && hasPermission(actor.permissions, key, { cellId });
}

/** Membre (exploitant) ou IPA de la cellule. */
export function isCellReader(actor: Pick<CellActor, "permissions">, cellId: string | null): boolean {
  return holdsCell(actor, PERMISSIONS.REPORTS_REVIEW_CELL, cellId) || holdsCell(actor, PERMISSIONS.REPORTS_SIGN_CELL, cellId);
}

type ReportScopeLike = { poolId: string | null; organizationId: string | null; authorId: string | null };

/**
 * Lecture d'un rapport (ou de sa fiche) :
 *  - son auteur ;
 *  - branche POOL : une permission de lecture sur le POOL du rapport ;
 *  - portée organisation : toute l'organisation, sauf l'IPP principal (D7) qui
 *    ne lit que les rapports signés par une cellule et l'historique antérieur ;
 *  - secrétariat de l'IPP : tout rapport arrivé dans la branche IPP ;
 *  - cellule : seulement les rapports AFFECTÉS à sa cellule (et après).
 * `visit` : page d'une visite (inspection), hors branche IPP — la portée
 * organisation y garde son effet pour le pilotage.
 */
export function canReadReport(actor: CellActor, scope: ReportScopeLike, track: IppTrackInfo | null, opts: { visit?: boolean } = {}): boolean {
  if (scope.authorId && scope.authorId === actor.id) return true;
  const org = scope.organizationId;
  if (!org || org !== actor.organizationId) return false;
  const held = actor.permissions.filter((x) => !x.cellId && x.organizationId === org && POOL_READ_KEYS.includes(x.permissionKey));
  if (scope.poolId && held.some((x) => x.poolId === scope.poolId)) return true;
  if (held.some((x) => x.poolId === null)) {
    if (opts.visit || !readsSignedOnly(actor.roles)) return true;
    if (track && (track.stage === "SIGNE" || track.legacy)) return true;
  }
  if (!track || track.organizationId !== org) return false;
  if (holdsRouteIpp(actor, org)) return true;
  return CELL_VISIBLE_STAGES.includes(track.stage) && isCellReader(actor, track.cellId);
}

/**
 * Commenter, remplir la partie réservée : lire le rapport ET l'exploiter —
 * au POOL (permissions d'exploitation sur son POOL), ou dans la cellule
 * destinataire. Le secrétariat oriente, il n'exploite pas.
 */
export function canWorkOnReport(actor: CellActor, scope: ReportScopeLike, track: IppTrackInfo | null): boolean {
  if (!canReadReport(actor, scope, track)) return false;
  const target = { poolId: scope.poolId, organizationId: scope.organizationId };
  const atPool = [PERMISSIONS.REPORTS_REVIEW_POOL, PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.REPORTS_VALIDATE].some((k) =>
    hasPermission(actor.permissions, k, target)
  );
  if (atPool) return true;
  return Boolean(track && CELL_VISIBLE_STAGES.includes(track.stage) && isCellReader(actor, track.cellId));
}

// ─── Branche IPP : étapes ──────────────────────────────────────────────────

export type TrackAction = "assign" | "reassign" | "exploit" | "return" | "sign";

export const TRACK_ACTIONS: Record<
  TrackAction,
  { from: readonly IppStageKey[]; to: IppStageKey; label: string; commentRequired: boolean; audit: string }
> = {
  assign: { from: ["AU_SECRETARIAT"], to: "AFFECTE", label: "Envoyer à la cellule", commentRequired: false, audit: "report.ipp_assign" },
  reassign: { from: ["AFFECTE", "EXPLOITE"], to: "AFFECTE", label: "Réaffecter à une autre cellule", commentRequired: true, audit: "report.ipp_reassign" },
  exploit: { from: ["AFFECTE"], to: "EXPLOITE", label: "Exploitation terminée (à signer)", commentRequired: false, audit: "report.ipp_exploit" },
  return: { from: ["EXPLOITE"], to: "AFFECTE", label: "Renvoyer à la cellule", commentRequired: true, audit: "report.ipp_return" },
  sign: { from: ["EXPLOITE"], to: "SIGNE", label: "Signer et transmettre à l'IPP", commentRequired: false, audit: "report.ipp_sign" },
};

/**
 * L'acteur peut-il faire cette étape ? Secrétariat : envoyer et réaffecter
 * (jamais après la signature) ; exploitant de la cellule : terminer
 * l'exploitation ; IPA de la cellule : renvoyer, signer. Le Super Admin
 * (assistance technique) peut tout faire, tracé à son nom.
 */
export function canActOnTrack(actor: CellActor, track: IppTrackInfo, action: TrackAction): boolean {
  if (track.organizationId !== actor.organizationId) return false;
  if (!TRACK_ACTIONS[action].from.includes(track.stage)) return false;
  if (isSuperAdmin(actor.roles)) return true;
  switch (action) {
    case "assign":
    case "reassign":
      return holdsRouteIpp(actor, track.organizationId);
    case "exploit":
      return holdsCell(actor, PERMISSIONS.REPORTS_REVIEW_CELL, track.cellId);
    case "return":
    case "sign":
      return holdsCell(actor, PERMISSIONS.REPORTS_SIGN_CELL, track.cellId);
  }
}

export function availableTrackActions(actor: CellActor, track: IppTrackInfo): TrackAction[] {
  return (Object.keys(TRACK_ACTIONS) as TrackAction[]).filter((a) => canActOnTrack(actor, track, a));
}

/** Périmètre affiché d'une fonction de cellule : « cellule IPAF », ou « cellule à choisir ». */
export function cellRoleSuffix(role: { key: string; cellCode?: string | null }): string | null {
  if (role.key !== ROLE_KEYS.EXPLOITANT_IPP && role.key !== ROLE_KEYS.IPA) return null;
  if (role.cellCode) return `cellule ${role.cellCode}`;
  return role.key === ROLE_KEYS.EXPLOITANT_IPP ? "cellule à choisir" : "sans cellule";
}
