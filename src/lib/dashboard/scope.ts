// Périmètre des tableaux de bord : décision UNIQUE de ce qu'un compte voit
// sur /dashboard. Fonction pure, calculée à partir des rôles et permissions
// EFFECTIFS de la session (loadUserAccess côté serveur, mode « Voir comme »
// compris) — jamais d'un identifiant transmis par le navigateur. Toutes les
// requêtes du tableau de bord (src/lib/dashboard/data.ts) reçoivent un
// DashboardScope produit ici et ne filtrent que par lui.
//
// Cumul de fonctions : les droits d'un compte sont l'union de ses fonctions
// (loadUserAccess). Le tableau de bord en affiche une section par fonction,
// chacune bornée au périmètre de CETTE fonction et étiquetée à l'écran.

import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import type { SessionPermission, SessionRole } from "@/lib/permission-checks";

export type DashboardKind =
  /** IPP (et Super Admin hors simulation) : pilotage provincial. */
  | "pilotage_provincial"
  /**
   * Cellule de l'IPP (décisions du 2026-10-08) : exploitant de l'IPP rattaché
   * à une cellule, ou IPA responsable de la cellule (signature). Uniquement
   * les rapports et synthèses de SA cellule, sans les indicateurs de l'IPP.
   */
  | "exploitation_cellule"
  /** Secrétaire de l'IPP : rapports arrivés au secrétariat, envois aux cellules. */
  | "secretariat_ipp"
  /** Fonction provinciale d'exploitation hors cellule (agent IPP, fonction créée dans Paramètres). */
  | "exploitation_provinciale"
  /** Informaticien : administration de la plateforme (comptes, POOL), sans statistiques de rapports. */
  | "administration"
  /** Chargé des médias : ses contenus du site public. */
  | "contenus"
  /** Chef de POOL : pilotage de SON POOL. */
  | "pilotage_pool"
  /** Exploitant de POOL : exploitation des rapports de SON POOL. */
  | "exploitation_pool"
  /** Secrétaire de POOL : écoles de SON POOL. */
  | "ecoles_pool"
  /** Inspecteur itinérant : ses écoles, ses inspections, ses rapports. */
  | "itinerant"
  /** Fonction sans tableau de bord défini (agent de POOL, fonction sans permission de suivi). */
  | "aucun";

export type DashboardScope = {
  kind: DashboardKind;
  userId: string;
  organizationId: string;
  /** null : toute l'organisation (vues provinciales uniquement). Sinon le seul POOL autorisé. */
  poolId: string | null;
  /** Vue de cellule : la seule cellule autorisée (rapports affectés à elle). */
  cellId: string | null;
  /** Fonction à l'origine de cette section (libellé affiché). */
  roleKey: string;
  roleLabel: string;
  /** Compte de démonstration : ne compte que les rapports de démonstration (et l'inverse), comme /rapports et /exploitation. */
  isDemo: boolean;
};

export type DashboardSubject = {
  id: string;
  organizationId: string;
  /** Lu en base (User.isDemo), jamais transmis par le navigateur. */
  isDemo: boolean;
  roles: SessionRole[];
  permissions: SessionPermission[];
};

const PROVINCIAL_KINDS: readonly DashboardKind[] = [
  "pilotage_provincial",
  "exploitation_cellule",
  "secretariat_ipp",
  "exploitation_provinciale",
  "administration",
  "contenus",
];

export function isProvincialKind(kind: DashboardKind): boolean {
  return PROVINCIAL_KINDS.includes(kind);
}

// Fonctions connues → vue. Une fonction absente de cette table (agent IPP,
// fonction créée depuis Paramètres) est classée d'après ses permissions
// (kindFromPermissions), jamais en pilotage provincial.
const ROLE_KIND: Partial<Record<string, DashboardKind>> = {
  [ROLE_KEYS.SUPER_ADMIN]: "pilotage_provincial",
  [ROLE_KEYS.IPP]: "pilotage_provincial",
  // D4, D6 : l'IPA ne voit que sa cellule, qu'il dirige et dont il signe les rapports.
  [ROLE_KEYS.IPA]: "exploitation_cellule",
  [ROLE_KEYS.EXPLOITANT_IPP]: "exploitation_cellule",
  [ROLE_KEYS.SECRETAIRE_IPP]: "secretariat_ipp",
  [ROLE_KEYS.INFORMATICIEN]: "administration",
  [ROLE_KEYS.CHARGE_MEDIAS]: "contenus",
  [ROLE_KEYS.CHEF_POOL]: "pilotage_pool",
  [ROLE_KEYS.EXPLOITANT_POOL]: "exploitation_pool",
  [ROLE_KEYS.SECRETAIRE_POOL]: "ecoles_pool",
  [ROLE_KEYS.INSPECTEUR]: "itinerant",
  [ROLE_KEYS.AGENT_POOL]: "aucun",
};

// Permissions dont l'une au moins est nécessaire à la vue : si la fonction a
// perdu ces droits en base, la section retombe sur « aucun ».
const REQUIRED: Record<DashboardKind, readonly string[]> = {
  pilotage_provincial: [PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.REPORTS_VALIDATE],
  exploitation_cellule: [PERMISSIONS.REPORTS_REVIEW_CELL, PERMISSIONS.REPORTS_SIGN_CELL],
  secretariat_ipp: [PERMISSIONS.REPORTS_ROUTE_IPP],
  exploitation_provinciale: [PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.REPORTS_REVIEW_POOL],
  administration: [PERMISSIONS.ACCOUNTS_MANAGE, PERMISSIONS.USERS_MANAGE],
  contenus: [PERMISSIONS.CONTENT_WRITE],
  pilotage_pool: [PERMISSIONS.SCHOOLS_MANAGE, PERMISSIONS.ASSIGNMENTS_MANAGE, PERMISSIONS.REPORTS_REVIEW_POOL],
  exploitation_pool: [PERMISSIONS.REPORTS_REVIEW_POOL],
  ecoles_pool: [PERMISSIONS.SCHOOLS_MANAGE],
  itinerant: [PERMISSIONS.INSPECTIONS_CONDUCT],
  aucun: [],
};

// Vue provinciale : permission à portée organisation (poolId null) ; vue de
// POOL : permission pour CE POOL ; vue de cellule : permission pour CETTE
// cellule (sans cellule, aucune vue : jamais de repli provincial).
function holds(subject: DashboardSubject, kind: DashboardKind, poolId: string | null, cellId: string | null = null): boolean {
  const keys = REQUIRED[kind];
  if (keys.length === 0) return true;
  if (kind === "exploitation_cellule") {
    return Boolean(cellId) && subject.permissions.some((p) => keys.includes(p.permissionKey) && p.cellId === cellId && p.organizationId === subject.organizationId);
  }
  return subject.permissions.some(
    (p) => keys.includes(p.permissionKey) && !p.cellId && p.organizationId === subject.organizationId && p.poolId === poolId
  );
}

function kindFromPermissions(subject: DashboardSubject, poolId: string | null): DashboardKind {
  const order: DashboardKind[] = poolId
    ? ["exploitation_pool", "ecoles_pool", "itinerant"]
    : ["exploitation_provinciale", "administration", "contenus"];
  return order.find((k) => holds(subject, k, poolId)) ?? "aucun";
}

const KIND_ORDER: readonly DashboardKind[] = [
  "pilotage_provincial",
  "secretariat_ipp",
  "exploitation_cellule",
  "exploitation_provinciale",
  "administration",
  "contenus",
  "pilotage_pool",
  "exploitation_pool",
  "ecoles_pool",
  "itinerant",
  "aucun",
];

/**
 * Sections de tableau de bord autorisées pour ce compte, une par fonction
 * (dédoublonnées), dans l'ordre d'importance. Toujours au moins une entrée.
 */
export function resolveDashboardScopes(subject: DashboardSubject): DashboardScope[] {
  const scopes: DashboardScope[] = [];
  for (const role of subject.roles) {
    let kind = ROLE_KIND[role.key] ?? kindFromPermissions(subject, role.poolId);
    // Fonction de POOL sans POOL, ou fonction provinciale rattachée à un POOL : donnée incohérente, rien n'est montré.
    if (kind !== "aucun" && isProvincialKind(kind) !== (role.poolId === null)) kind = "aucun";
    const roleCellId = role.cellId ?? null;
    if (!holds(subject, kind, role.poolId, roleCellId)) kind = "aucun";
    const poolId = isProvincialKind(kind) ? null : role.poolId;
    const cellId = kind === "exploitation_cellule" ? roleCellId : null;
    // L'itinérant voit ses propres données (par auteur, quel que soit le POOL) : une seule section.
    if (scopes.some((s) => s.kind === kind && s.cellId === cellId && (s.poolId === poolId || kind === "itinerant"))) continue;
    scopes.push({
      kind,
      userId: subject.id,
      organizationId: subject.organizationId,
      poolId,
      cellId,
      roleKey: role.key,
      roleLabel: role.label,
      isDemo: subject.isDemo,
    });
  }
  // « aucun » n'est utile que s'il n'y a rien d'autre à montrer.
  const useful = scopes.filter((s) => s.kind !== "aucun");
  const result = useful.length > 0 ? useful : scopes.slice(0, 1);
  if (result.length === 0) {
    result.push({
      kind: "aucun",
      userId: subject.id,
      organizationId: subject.organizationId,
      poolId: null,
      cellId: null,
      roleKey: "",
      roleLabel: "Aucune fonction",
      isDemo: subject.isDemo,
    });
  }
  return result.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

/** La section peut-elle lire les données de ce POOL ? (contrôle des paramètres d'URL). */
export function scopeCoversPool(scope: DashboardScope, pool: { id: string; organizationId: string }): boolean {
  if (pool.organizationId !== scope.organizationId) return false;
  // Une vue de cellule ou de secrétariat ne lit aucun POOL entier.
  if (scope.kind === "exploitation_cellule" || scope.kind === "secretariat_ipp") return false;
  return scope.poolId === null ? isProvincialKind(scope.kind) : scope.poolId === pool.id;
}
