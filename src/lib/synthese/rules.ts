// Règles du rapport de synthèse (décisions du 2026-10-08,
// docs/rapport-synthese-exploitant.md § 9). Fonctions PURES : elles
// reçoivent les rôles et permissions EFFECTIFS de l'acteur, relus en base
// par l'appelant (loadUserAccess), jamais une valeur venue du navigateur.
// Mêmes principes que le circuit des rapports d'inspection
// (src/lib/workflow.ts) : transitions déclarées, permission exigée sur le
// POOL de la ressource, auteur seul pour resoumettre.

import { PERMISSIONS, ROLE_KEYS, WORKFLOW_STATUS_KEYS as W } from "@/lib/rbac-data";
import { hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { PROVINCE_CODE } from "@/lib/fiches/calculs";

export type SynthesisStatusKey = "BROUILLON" | "SOUMIS" | "A_CORRIGER" | "VALIDE";

/** Libellés repris des statuts des rapports d'inspection (mêmes clés). */
export const SYNTHESIS_STATUS_LABELS: Record<SynthesisStatusKey, string> = {
  BROUILLON: "Brouillon",
  SOUMIS: "Soumis",
  A_CORRIGER: "À corriger",
  VALIDE: "Validé",
};

export const SYNTHESIS_STATUS_COLOR: Record<SynthesisStatusKey, "gray" | "orange" | "red" | "green"> = {
  BROUILLON: "gray",
  SOUMIS: "orange",
  A_CORRIGER: "red",
  VALIDE: "green",
};

export type Actor = { id: string; organizationId: string; roles: SessionRole[]; permissions: SessionPermission[] };

export type SynthesisMeta = {
  authorId: string;
  organizationId: string;
  /** null : synthèse provinciale. */
  poolId: string | null;
  status: SynthesisStatusKey;
};

/** Q3/Q4 : valident (et lisent les synthèses provinciales) l'IPP, les IPP adjoints et le Super Admin. */
export const SYNTHESIS_VALIDATOR_ROLE_KEYS: readonly string[] = [ROLE_KEYS.IPP, ROLE_KEYS.IPA, ROLE_KEYS.SUPER_ADMIN];

/** Q1 : rapports dont l'exploitation a commencé. */
export const EXPLOITED_REPORT_STATUSES: readonly string[] = [W.EN_EXPLOITATION, W.TRANSMIS, W.EN_ATTENTE_VALIDATION, W.VALIDE, W.CLOTURE];

export const EDITABLE_STATUSES: readonly SynthesisStatusKey[] = ["BROUILLON", "A_CORRIGER"];

/** POOL où l'acteur peut rédiger (Q6 : `reports.review_pool` — exploitant, chef de POOL) ; `provincial` : portée organisation (exploitant IPP). */
export function authorScopes(actor: Actor): { provincial: boolean; poolIds: string[] } {
  const own = actor.permissions.filter((p) => p.permissionKey === PERMISSIONS.REPORTS_REVIEW_POOL && p.organizationId === actor.organizationId);
  return { provincial: own.some((p) => p.poolId === null), poolIds: [...new Set(own.flatMap((p) => (p.poolId ? [p.poolId] : [])))] };
}

/** Peut rédiger une synthèse de ce POOL (ou provinciale si poolId est null) dans cette organisation. */
export function canAuthorIn(actor: Actor, poolId: string | null, organizationId: string): boolean {
  if (organizationId !== actor.organizationId) return false;
  if (poolId === null) return authorScopes(actor).provincial;
  return hasPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_POOL, { poolId, organizationId });
}

export function isValidator(actor: Actor, organizationId: string): boolean {
  return (
    actor.organizationId === organizationId &&
    actor.roles.some((r) => SYNTHESIS_VALIDATOR_ROLE_KEYS.includes(r.key)) &&
    hasPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE, { poolId: null, organizationId })
  );
}

export function isAuthor(actor: Actor, s: SynthesisMeta): boolean {
  return actor.id === s.authorId;
}

/**
 * Lecture : l'auteur toujours ; un brouillon n'est lu que par lui. Sinon :
 * synthèse de POOL → détenteurs de `reports.review_pool` sur ce POOL (chef,
 * exploitants) et niveau provincial (`reports.review_province`) ;
 * synthèse provinciale → IPP, IPP adjoints, Super Admin (Q4).
 */
export function canRead(actor: Actor, s: SynthesisMeta): boolean {
  if (isAuthor(actor, s)) return true;
  if (actor.organizationId !== s.organizationId || s.status === "BROUILLON") return false;
  if (s.poolId === null) return isValidator(actor, s.organizationId);
  const target = { poolId: s.poolId, organizationId: s.organizationId };
  return (
    hasPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_POOL, target) ||
    hasPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE, target)
  );
}

/** Modifier le texte et les rapports retenus : l'auteur seul, en brouillon ou renvoyée pour correction, s'il a encore le droit de rédiger ici. */
export function canEdit(actor: Actor, s: SynthesisMeta): boolean {
  return isAuthor(actor, s) && EDITABLE_STATUSES.includes(s.status) && canAuthorIn(actor, s.poolId, s.organizationId);
}

/** Q2 : renvoyer pour correction — `reports.review_province` (synthèse de POOL) ; IPP, IPA, Super Admin (provinciale). Jamais l'auteur. */
export function canReturn(actor: Actor, s: SynthesisMeta): boolean {
  if (s.status !== "SOUMIS" || isAuthor(actor, s) || actor.organizationId !== s.organizationId) return false;
  if (s.poolId === null) return isValidator(actor, s.organizationId);
  return hasPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE, { poolId: s.poolId, organizationId: s.organizationId });
}

/** Q3 : valider — IPP, IPP adjoint ou Super Admin, jamais l'auteur. */
export function canValidate(actor: Actor, s: SynthesisMeta): boolean {
  return s.status === "SOUMIS" && !isAuthor(actor, s) && isValidator(actor, s.organizationId);
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
  if (to === "A_CORRIGER") return "synthesis.return";
  return "synthesis.validate";
}

/**
 * Un rapport d'inspection peut-il entrer dans cette synthèse ? Même
 * organisation ; même POOL (ou tout POOL pour une synthèse provinciale) ;
 * `reports.review_pool` de l'acteur sur le POOL du rapport ; exploitation
 * commencée (Q1) ; démonstration avec démonstration seulement.
 */
export function canIncludeReport(
  actor: Actor,
  s: Pick<SynthesisMeta, "organizationId" | "poolId"> & { isDemo: boolean },
  report: { poolId: string | null; organizationId: string | null; statusKey: string; isDemo: boolean }
): boolean {
  if (!report.poolId || report.organizationId !== s.organizationId) return false;
  if (s.poolId !== null && report.poolId !== s.poolId) return false;
  if (!EXPLOITED_REPORT_STATUSES.includes(report.statusKey)) return false;
  if (report.isDemo !== s.isDemo) return false;
  return hasPermission(actor.permissions, PERMISSIONS.REPORTS_REVIEW_POOL, { poolId: report.poolId, organizationId: s.organizationId });
}

// ─── Numéro officiel (Q7) ──────────────────────────────────────────────────

/** Code du périmètre dans le numéro : code du POOL, ou « IPP » pour une synthèse provinciale. */
export function numberScopeCode(poolCode: string | null): string {
  return poolCode ?? "IPP";
}

/** 61/<POOL>/SYN.<n°>/<année>, attribué à la première soumission et jamais modifié. */
export function formatSynthesisNumber(p: { scope: string; seq: number; year: number }): string {
  return [PROVINCE_CODE, p.scope, `SYN.${String(p.seq).padStart(3, "0")}`, String(p.year)].join("/");
}

/** Référence complète : numéro suivi de la version soumise (-V1, -V2 après une correction…). */
export function synthesisReference(number: string | null, version: number): string | null {
  return number ? `${number}-V${Math.max(version, 1)}` : null;
}
