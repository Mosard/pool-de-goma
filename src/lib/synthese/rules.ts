// Règles du rapport de synthèse (décisions du 2026-10-08,
// docs/rapport-synthese-exploitant.md § 9, et cellules de l'IPP,
// docs/exploitants-ipp-cellules.md § 6). Fonctions PURES : elles
// reçoivent les rôles et permissions EFFECTIFS de l'acteur, relus en base
// par l'appelant (loadUserAccess), jamais une valeur venue du navigateur.
// Mêmes principes que le circuit des rapports d'inspection
// (src/lib/workflow.ts) : transitions déclarées, permission exigée sur le
// POOL (ou la cellule) de la ressource, auteur seul pour resoumettre.

import { PERMISSIONS, ROLE_KEYS, WORKFLOW_STATUS_KEYS as W } from "@/lib/rbac-data";
import { cellsWithPermission, hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { PROVINCE_CODE } from "@/lib/fiches/calculs";

export type SynthesisStatusKey = "BROUILLON" | "SOUMIS" | "A_CORRIGER" | "VALIDE" | "SIGNE";

/** Libellés repris des statuts des rapports d'inspection (mêmes clés). */
export const SYNTHESIS_STATUS_LABELS: Record<SynthesisStatusKey, string> = {
  BROUILLON: "Brouillon",
  SOUMIS: "Soumis",
  A_CORRIGER: "À corriger",
  // Synthèse de cellule : validée par l'IPA et transmise à l'IPP pour signature.
  VALIDE: "Validé",
  SIGNE: "Signé par l'IPP",
};

export const SYNTHESIS_STATUS_COLOR: Record<SynthesisStatusKey, "gray" | "orange" | "red" | "green"> = {
  BROUILLON: "gray",
  SOUMIS: "orange",
  A_CORRIGER: "red",
  VALIDE: "green",
  SIGNE: "green",
};

export type Actor = { id: string; organizationId: string; roles: SessionRole[]; permissions: SessionPermission[] };

export type SynthesisMeta = {
  authorId: string;
  organizationId: string;
  /** null : synthèse provinciale (ancien circuit) ou de cellule. */
  poolId: string | null;
  /** Cellule de l'IPP : synthèse préparée par la cellule et signée par son IPA (décisions D3, D6). */
  cellId: string | null;
  status: SynthesisStatusKey;
};

/** Q3/Q4 : valident (et lisent les synthèses provinciales) l'IPP et le Super Admin ; l'IPA ne voit plus que sa cellule (D4). */
export const SYNTHESIS_VALIDATOR_ROLE_KEYS: readonly string[] = [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN];

/** Q1 : rapports dont l'exploitation a commencé (branche POOL). */
export const EXPLOITED_REPORT_STATUSES: readonly string[] = [W.EN_EXPLOITATION, W.TRANSMIS, W.EN_ATTENTE_VALIDATION, W.VALIDE, W.CLOTURE];

/** Synthèse de cellule : rapports dont la cellule a terminé l'exploitation (branche IPP). */
export const CELL_EXPLOITED_STAGES: readonly string[] = ["EXPLOITE", "SIGNE"];

export const EDITABLE_STATUSES: readonly SynthesisStatusKey[] = ["BROUILLON", "A_CORRIGER"];

function isSuperAdmin(actor: Actor): boolean {
  return actor.roles.some((r) => r.key === ROLE_KEYS.SUPER_ADMIN);
}

function holdsCell(actor: Actor, key: string, cellId: string | null): boolean {
  return Boolean(cellId) && hasPermission(actor.permissions, key, { cellId });
}

/**
 * Où l'acteur peut rédiger : POOL (Q6 : `reports.review_pool` — exploitant,
 * chef de POOL) ; `provincial` : portée organisation (ancien circuit) ;
 * cellules : `reports.review_cell` de SA cellule (exploitant de l'IPP).
 */
export function authorScopes(actor: Actor): { provincial: boolean; poolIds: string[]; cellIds: string[] } {
  const own = actor.permissions.filter((p) => p.permissionKey === PERMISSIONS.REPORTS_REVIEW_POOL && !p.cellId && p.organizationId === actor.organizationId);
  return {
    provincial: own.some((p) => p.poolId === null),
    poolIds: [...new Set(own.flatMap((p) => (p.poolId ? [p.poolId] : [])))],
    cellIds: cellsWithPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_CELL),
  };
}

/** Peut rédiger une synthèse de ce POOL (ou provinciale si poolId est null) dans cette organisation. */
export function canAuthorIn(actor: Actor, poolId: string | null, organizationId: string): boolean {
  if (organizationId !== actor.organizationId) return false;
  if (poolId === null) return authorScopes(actor).provincial;
  return hasPermission(actor.permissions.filter((p) => !p.cellId), PERMISSIONS.REPORTS_REVIEW_POOL, { poolId, organizationId });
}

/** Peut rédiger une synthèse de CETTE cellule (exploitant rattaché à elle). */
export function canAuthorInCell(actor: Actor, cellId: string | null, organizationId: string): boolean {
  return organizationId === actor.organizationId && holdsCell(actor, PERMISSIONS.REPORTS_REVIEW_CELL, cellId);
}

export function isValidator(actor: Actor, organizationId: string): boolean {
  return (
    actor.organizationId === organizationId &&
    actor.roles.some((r) => SYNTHESIS_VALIDATOR_ROLE_KEYS.includes(r.key)) &&
    hasPermission(actor.permissions.filter((p) => !p.cellId), PERMISSIONS.REPORTS_REVIEW_PROVINCE, { poolId: null, organizationId })
  );
}

export function isAuthor(actor: Actor, s: SynthesisMeta): boolean {
  return actor.id === s.authorId;
}

/**
 * Lecture : l'auteur toujours ; un brouillon n'est lu que par lui. Sinon :
 * synthèse de cellule → exploitants et IPA de la cellule, Super Admin ;
 * l'IPP (et tout valideur provincial) seulement une fois SIGNÉE (D3) ;
 * synthèse de POOL → détenteurs de `reports.review_pool` sur ce POOL (chef,
 * exploitants) et niveau provincial (`reports.review_province`) ;
 * synthèse provinciale → IPP, Super Admin (Q4).
 */
export function canRead(actor: Actor, s: SynthesisMeta): boolean {
  if (isAuthor(actor, s)) return true;
  if (actor.organizationId !== s.organizationId || s.status === "BROUILLON") return false;
  if (s.cellId) {
    if (isSuperAdmin(actor)) return true;
    if (holdsCell(actor, PERMISSIONS.REPORTS_REVIEW_CELL, s.cellId) || holdsCell(actor, PERMISSIONS.REPORTS_SIGN_CELL, s.cellId)) return true;
    // L'IPP lit la synthèse dès que l'IPA l'a validée et transmise (pour la signer).
    return (s.status === "VALIDE" || s.status === "SIGNE") && isValidator(actor, s.organizationId);
  }
  if (s.poolId === null) return isValidator(actor, s.organizationId);
  const target = { poolId: s.poolId, organizationId: s.organizationId };
  const own = actor.permissions.filter((p) => !p.cellId);
  return hasPermission(own, PERMISSIONS.REPORTS_REVIEW_POOL, target) || hasPermission(own, PERMISSIONS.REPORTS_REVIEW_PROVINCE, target);
}

/** Modifier le texte et les rapports retenus : l'auteur seul, en brouillon ou renvoyée pour correction, s'il a encore le droit de rédiger ici. */
export function canEdit(actor: Actor, s: SynthesisMeta): boolean {
  if (!isAuthor(actor, s) || !EDITABLE_STATUSES.includes(s.status)) return false;
  return s.cellId ? canAuthorInCell(actor, s.cellId, s.organizationId) : canAuthorIn(actor, s.poolId, s.organizationId);
}

/**
 * Renvoyer pour correction. Cellule : son IPA (ou le Super Admin). POOL
 * (Q2) : `reports.review_province` ; provinciale : IPP, Super Admin. Jamais l'auteur.
 */
export function canReturn(actor: Actor, s: SynthesisMeta): boolean {
  if (s.status !== "SOUMIS" || isAuthor(actor, s) || actor.organizationId !== s.organizationId) return false;
  if (s.cellId) return isSuperAdmin(actor) || holdsCell(actor, PERMISSIONS.REPORTS_SIGN_CELL, s.cellId);
  if (s.poolId === null) return isValidator(actor, s.organizationId);
  return hasPermission(actor.permissions.filter((p) => !p.cellId), PERMISSIONS.REPORTS_REVIEW_PROVINCE, { poolId: s.poolId, organizationId: s.organizationId });
}

/**
 * Valider, jamais l'auteur. Synthèse de POOL ou provinciale (Q3) : IPP ou
 * Super Admin. Synthèse de cellule (2026-10-09) : l'IPA de la cellule (chef
 * de cellule) valide et la TRANSMET à l'IPP pour signature.
 */
export function canValidate(actor: Actor, s: SynthesisMeta): boolean {
  if (s.status !== "SOUMIS" || isAuthor(actor, s) || actor.organizationId !== s.organizationId) return false;
  if (s.cellId) return isSuperAdmin(actor) || holdsCell(actor, PERMISSIONS.REPORTS_SIGN_CELL, s.cellId);
  return isValidator(actor, s.organizationId);
}

/** Signer une synthèse de cellule validée et transmise : l'IPP principal (ou le Super Admin), jamais l'auteur. */
export function canSign(actor: Actor, s: SynthesisMeta): boolean {
  if (!s.cellId || s.status !== "VALIDE" || isAuthor(actor, s)) return false;
  return isValidator(actor, s.organizationId);
}

/** L'IPP renvoie à la cellule une synthèse transmise (motif obligatoire), au lieu de la signer. */
export function canReturnTransmitted(actor: Actor, s: SynthesisMeta): boolean {
  return canSign(actor, s);
}

export type SynthesisTransition = {
  from: SynthesisStatusKey;
  to: SynthesisStatusKey;
  label: string;
  /** Motif obligatoire (renvoi pour correction). */
  commentRequired: boolean;
  allowed: (actor: Actor, s: SynthesisMeta) => boolean;
};

export const SYNTHESIS_TRANSITIONS: readonly SynthesisTransition[] = [
  { from: "BROUILLON", to: "SOUMIS", label: "Soumettre", commentRequired: false, allowed: canEdit },
  { from: "A_CORRIGER", to: "SOUMIS", label: "Resoumettre", commentRequired: false, allowed: canEdit },
  { from: "SOUMIS", to: "A_CORRIGER", label: "Renvoyer pour correction", commentRequired: true, allowed: canReturn },
  { from: "SOUMIS", to: "VALIDE", label: "Valider", commentRequired: false, allowed: canValidate },
  // Synthèse de cellule validée par l'IPA : l'IPP signe, ou renvoie à la cellule.
  { from: "VALIDE", to: "SIGNE", label: "Signer (IPP)", commentRequired: false, allowed: canSign },
  { from: "VALIDE", to: "A_CORRIGER", label: "Renvoyer à la cellule", commentRequired: true, allowed: canReturnTransmitted },
];

export function findTransition(from: SynthesisStatusKey, to: SynthesisStatusKey): SynthesisTransition | null {
  return SYNTHESIS_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

export function availableTransitions(actor: Actor, s: SynthesisMeta): SynthesisTransition[] {
  return SYNTHESIS_TRANSITIONS.filter((t) => t.from === s.status && t.allowed(actor, s));
}

/** Action d'audit de chaque étape. */
export function auditActionFor(from: SynthesisStatusKey, to: SynthesisStatusKey): string {
  if (to === "SOUMIS") return from === "A_CORRIGER" ? "synthesis.resubmit" : "synthesis.submit";
  if (to === "A_CORRIGER") return from === "VALIDE" ? "synthesis.ipp_return" : "synthesis.return";
  if (to === "SIGNE") return "synthesis.sign";
  return "synthesis.validate";
}

/**
 * Un rapport d'inspection peut-il entrer dans cette synthèse ? Même
 * organisation ; démonstration avec démonstration seulement ; puis :
 *  - synthèse de cellule : rapport AFFECTÉ à cette cellule par le
 *    secrétariat et dont la cellule a terminé l'exploitation ; l'acteur
 *    exploite cette cellule ;
 *  - synthèse de POOL ou provinciale : même POOL (ou tout POOL),
 *    `reports.review_pool` de l'acteur sur le POOL du rapport, exploitation
 *    commencée (Q1).
 */
export function canIncludeReport(
  actor: Actor,
  s: Pick<SynthesisMeta, "organizationId" | "poolId"> & { cellId?: string | null; isDemo: boolean },
  report: {
    poolId: string | null;
    organizationId: string | null;
    statusKey: string;
    isDemo: boolean;
    track?: { stage: string; cellId: string | null } | null;
  }
): boolean {
  if (report.organizationId !== s.organizationId || report.isDemo !== s.isDemo) return false;
  if (s.cellId) {
    const t = report.track;
    return Boolean(t && t.cellId === s.cellId && CELL_EXPLOITED_STAGES.includes(t.stage)) && holdsCell(actor, PERMISSIONS.REPORTS_REVIEW_CELL, s.cellId);
  }
  if (!report.poolId) return false;
  if (s.poolId !== null && report.poolId !== s.poolId) return false;
  if (!EXPLOITED_REPORT_STATUSES.includes(report.statusKey)) return false;
  return hasPermission(actor.permissions.filter((p) => !p.cellId), PERMISSIONS.REPORTS_REVIEW_POOL, { poolId: report.poolId, organizationId: s.organizationId });
}

// ─── Numéro officiel (Q7) ──────────────────────────────────────────────────

/** Code du périmètre dans le numéro : sigle de la cellule, code du POOL, ou « IPP » (synthèse provinciale de l'ancien circuit). */
export function numberScopeCode(poolCode: string | null, cellCode: string | null = null): string {
  return cellCode ?? poolCode ?? "IPP";
}

/** 61/<cellule ou POOL>/SYN.<n°>/<année>, attribué à la première soumission et jamais modifié. */
export function formatSynthesisNumber(p: { scope: string; seq: number; year: number }): string {
  return [PROVINCE_CODE, p.scope, `SYN.${String(p.seq).padStart(3, "0")}`, String(p.year)].join("/");
}

/** Référence complète : numéro suivi de la version soumise (-V1, -V2 après une correction…). */
export function synthesisReference(number: string | null, version: number): string | null {
  return number ? `${number}-V${Math.max(version, 1)}` : null;
}
