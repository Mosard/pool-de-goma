// Clés stables pour permissions, rôles et statuts de workflow. Utilisé à la
// fois par l'application (contrôle d'accès) et par prisma/seed.ts (données
// de référence), pour éviter les chaînes dupliquées entre les deux.

export const PERMISSIONS = {
  ACCOUNTS_MANAGE: "accounts.manage",
  USERS_MANAGE: "users.manage",
  POOLS_MANAGE: "pools.manage",
  SCHOOLS_MANAGE: "schools.manage",
  ASSIGNMENTS_MANAGE: "assignments.manage",
  INSPECTIONS_CONDUCT: "inspections.conduct",
  REPORTS_REVIEW_POOL: "reports.review_pool",
  REPORTS_REVIEW_PROVINCE: "reports.review_province",
  REPORTS_VALIDATE: "reports.validate",
  // Branche IPP des rapports (2026-10-08, docs/exploitants-ipp-cellules.md).
  REPORTS_ROUTE_IPP: "reports.route_ipp",
  REPORTS_REVIEW_CELL: "reports.review_cell",
  REPORTS_SIGN_CELL: "reports.sign_cell",
  AUDIT_VIEW: "audit.view",
  FORM_TEMPLATES_MANAGE: "form_templates.manage",
  PUBLICATION_MANAGE: "publication.manage",
  DIRECTION_MANAGE: "direction.manage",
  CONTENT_WRITE: "content.write",
  CONTENT_PUBLISH: "content.publish",
  AI_ANALYZE: "ai.analyze",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: { key: PermissionKey; label: string; category: string }[] = [
  { key: PERMISSIONS.ACCOUNTS_MANAGE, label: "Valider / refuser les demandes de compte", category: "Comptes" },
  { key: PERMISSIONS.USERS_MANAGE, label: "Gérer les utilisateurs et leurs rôles", category: "Comptes" },
  { key: PERMISSIONS.POOLS_MANAGE, label: "Créer / modifier / archiver les pools", category: "Organisation" },
  { key: PERMISSIONS.SCHOOLS_MANAGE, label: "Créer / modifier les fiches écoles", category: "Écoles" },
  { key: PERMISSIONS.ASSIGNMENTS_MANAGE, label: "Affecter les inspecteurs aux écoles", category: "Écoles" },
  { key: PERMISSIONS.INSPECTIONS_CONDUCT, label: "Réaliser des inspections et soumettre des rapports", category: "Inspections" },
  { key: PERMISSIONS.REPORTS_REVIEW_POOL, label: "Exploiter les rapports au niveau du pool", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_REVIEW_PROVINCE, label: "Exploiter les rapports au niveau du bureau IPP", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_VALIDATE, label: "Valider ou rejeter un rapport", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_ROUTE_IPP, label: "Secrétariat de l'IPP : recevoir les rapports et les envoyer à une cellule", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_REVIEW_CELL, label: "Exploiter les rapports affectés à sa cellule et préparer ses synthèses", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_SIGN_CELL, label: "Signer et transmettre à l'IPP les rapports et synthèses de sa cellule (IPA)", category: "Circuit de validation" },
  { key: PERMISSIONS.AUDIT_VIEW, label: "Consulter le journal d'audit", category: "Administration" },
  { key: PERMISSIONS.FORM_TEMPLATES_MANAGE, label: "Gérer les catégories et fiches d'inspection", category: "Administration" },
  { key: PERMISSIONS.PUBLICATION_MANAGE, label: "Autoriser la publication publique des profils (nom, fonction, photo)", category: "Publication" },
  { key: PERMISSIONS.DIRECTION_MANAGE, label: "Gérer la Direction de l'Inspection (attributions des IPP adjoints)", category: "Publication" },
  { key: PERMISSIONS.CONTENT_WRITE, label: "Rédiger des actualités, articles et communiqués (brouillons, soumission)", category: "Site public" },
  { key: PERMISSIONS.CONTENT_PUBLISH, label: "Valider et publier les contenus du site, les renvoyer en correction ou les retirer", category: "Site public" },
  { key: PERMISSIONS.AI_ANALYZE, label: "Consulter et lancer les analyses IA des rapports", category: "IA" },
];

export const ROLE_KEYS = {
  IPP: "ipp",
  IPA: "ipa",
  INSPECTEUR: "inspecteur",
  EXPLOITANT_POOL: "exploitant_pool",
  CHEF_POOL: "chef_pool",
  EXPLOITANT_IPP: "exploitant_ipp",
  AGENT_IPP: "agent_ipp",
  AGENT_POOL: "agent_pool",
  SECRETAIRE_POOL: "secretaire_pool",
  INFORMATICIEN: "informaticien",
  CHARGE_MEDIAS: "charge_medias",
  SECRETAIRE_IPP: "secretaire_ipp",
  SUPER_ADMIN: "super_admin",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

// Permissions de cellule : elles ne valent QUE pour une cellule précise —
// celle de la fonction (UserRole.cellId, exploitant de l'IPP) ou celle dont
// la personne est l'IPA responsable (Cell.ipaId). Sans cellule, elles ne
// donnent rien : jamais d'accès provincial de repli (décisions du 2026-10-08).
export const CELL_PERMISSION_KEYS: readonly string[] = [PERMISSIONS.REPORTS_REVIEW_CELL, PERMISSIONS.REPORTS_SIGN_CELL];

// IPA : ses analyses IA sont aussi bornées à sa cellule (décision D4).
export const IPA_CELL_BOUND_KEYS: readonly string[] = [...CELL_PERMISSION_KEYS, PERMISSIONS.AI_ANALYZE];

// Fonctions rattachées à une cellule : un accès provincial (review_province,
// review_pool sur tous les POOL) ne peut pas leur être redonné individuellement.
export const CELL_BOUND_ROLE_KEYS: readonly string[] = [ROLE_KEYS.EXPLOITANT_IPP, ROLE_KEYS.IPA];

// Décision D7 : dans la branche IPP, l'IPP principal ne lit que les rapports
// signés et transmis par une cellule (et l'historique antérieur). Ses vues de
// pilotage chiffrées et ses autres pouvoirs ne changent pas.
export const SIGNED_ONLY_READER_ROLE_KEYS: readonly string[] = [ROLE_KEYS.IPP];

// Motif de fin d'une affectation (Assignment.endReason).
export const ASSIGNMENT_END_REASONS = {
  REVOKED: "revoked",
  ACCOUNT_SUSPENDED: "account_suspended",
  SCHOOL_POOL_CHANGED: "school_pool_changed",
  ROLE_REMOVED: "role_removed",
} as const;

export const ASSIGNMENT_END_REASON_LABELS: Record<string, string> = {
  [ASSIGNMENT_END_REASONS.REVOKED]: "Retirée",
  [ASSIGNMENT_END_REASONS.ACCOUNT_SUSPENDED]: "Compte suspendu",
  [ASSIGNMENT_END_REASONS.SCHOOL_POOL_CHANGED]: "École changée de POOL",
  [ASSIGNMENT_END_REASONS.ROLE_REMOVED]: "Fonction d'inspecteur retirée",
};

// Fonction officielle de l'Inspection depuis le 2026-10-08 (décision de
// l'Inspection) : accès complet, sur tous les POOL, pour administrer la
// plateforme et assister chaque profil, y compris l'autorisation de
// publication (décision du 2026-09-27). Il peut aussi « voir comme » une
// fonction précise (src/lib/view-mode.ts). Toute action est tracée dans le
// journal d'audit sous le nom du compte. Son attribution reste réservée
// (RESTRICTED_ROLE_KEYS, script serveur).
export const SUPER_ADMIN_LABEL = "Super Admin";
export const SUPER_ADMIN_DESCRIPTION =
  "Fonction officielle de l'Inspection : accès complet à la plateforme pour l'administration, l'assistance et le dépannage. Toutes ses actions sont tracées.";
export const SUPER_ADMIN_PERMISSIONS: readonly PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);

// Fonctions qui ne s'attribuent JAMAIS depuis l'application (formulaire public,
// validation de demande, création de compte, fiche POOL) : uniquement par le
// script serveur prisma/scripts/grant-super-admin.ts. Leur clé est réservée.
export const RESTRICTED_ROLE_KEYS: readonly string[] = [ROLE_KEYS.SUPER_ADMIN];

// « Voir comme » (bascule de profil) : Super Admin (toute fonction non
// réservée) et IPP (décision du 2026-09-29 : fonctions de POOL seulement,
// pour suivre chaque POOL, sans jamais dépasser ses propres droits).
export const VIEW_MODE_HOLDER_ROLE_KEYS: readonly string[] = [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.IPP];

// Fonctions provinciales que l'IPP peut AUSSI simuler (décision du
// 2026-10-03 : basculer dans l'espace du chargé des médias). Leurs droits
// sont pris tels quels, sans être bornés aux droits réels de l'IPP : la
// rédaction ne publie rien sans validation d'un autre compte habilité.
export const IPP_VIEW_MODE_EXTRA_ROLE_KEYS: readonly string[] = [ROLE_KEYS.CHARGE_MEDIAS];

// Décision de l'Inspection : seuls l'IPP et l'informaticien autorisent la
// publication d'un agent (le Chef de POOL, notamment, ne le peut pas).
// Le Super Admin aussi (décision du 2026-09-27), sauf lorsqu'il simule une
// autre fonction : il n'a alors que les droits de celle-ci.
export const PUBLICATION_AUTHORITY_ROLE_KEYS: readonly string[] = [
  ROLE_KEYS.IPP,
  ROLE_KEYS.INFORMATICIEN,
  ROLE_KEYS.SUPER_ADMIN,
];

// Qui peut attribuer (et retirer) chaque fonction — décision du 2026-10-07 :
// seuls l'IPP, l'informaticien, le Super Admin et, selon le cas, le chef du
// POOL concerné donnent des accès. Les fonctions provinciales sensibles (IPA,
// informaticien) relèvent de l'IPP ; la fonction d'IPP, du seul Super Admin.
// Le chef de POOL n'attribue que la fonction d'inspecteur (comptes déjà
// validés) et les fonctions d'appui, et seulement dans son propre POOL
// (voir canGrantRole). Liste vide : jamais depuis l'application.
const PROVINCIAL_GRANTORS: readonly RoleKey[] = [ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN];
const POOL_SUPPORT_GRANTORS: readonly RoleKey[] = [...PROVINCIAL_GRANTORS, ROLE_KEYS.CHEF_POOL];
export const ROLE_GRANTORS: Readonly<Record<RoleKey, readonly RoleKey[]>> = {
  [ROLE_KEYS.SUPER_ADMIN]: [],
  [ROLE_KEYS.IPP]: [ROLE_KEYS.SUPER_ADMIN],
  [ROLE_KEYS.IPA]: [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN],
  [ROLE_KEYS.INFORMATICIEN]: [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN],
  [ROLE_KEYS.EXPLOITANT_IPP]: PROVINCIAL_GRANTORS,
  [ROLE_KEYS.AGENT_IPP]: PROVINCIAL_GRANTORS,
  [ROLE_KEYS.CHARGE_MEDIAS]: PROVINCIAL_GRANTORS,
  [ROLE_KEYS.SECRETAIRE_IPP]: PROVINCIAL_GRANTORS,
  [ROLE_KEYS.INSPECTEUR]: POOL_SUPPORT_GRANTORS,
  [ROLE_KEYS.CHEF_POOL]: PROVINCIAL_GRANTORS,
  [ROLE_KEYS.EXPLOITANT_POOL]: POOL_SUPPORT_GRANTORS,
  [ROLE_KEYS.SECRETAIRE_POOL]: POOL_SUPPORT_GRANTORS,
  [ROLE_KEYS.AGENT_POOL]: POOL_SUPPORT_GRANTORS,
};
// Fonctions créées depuis Paramètres : niveau provincial, et l'acteur doit
// lui-même détenir chacune de leurs permissions (requireRoleGrant).
export const CUSTOM_ROLE_GRANTORS: readonly RoleKey[] = PROVINCIAL_GRANTORS;

export const WORKFLOW_STATUS_KEYS = {
  BROUILLON: "BROUILLON",
  SOUMIS: "SOUMIS",
  RECU: "RECU",
  EN_EXPLOITATION: "EN_EXPLOITATION",
  A_CORRIGER: "A_CORRIGER",
  TRANSMIS: "TRANSMIS",
  EN_ATTENTE_VALIDATION: "EN_ATTENTE_VALIDATION",
  VALIDE: "VALIDE",
  REJETE: "REJETE",
  CLOTURE: "CLOTURE",
} as const;

export type WorkflowStatusKey = (typeof WORKFLOW_STATUS_KEYS)[keyof typeof WORKFLOW_STATUS_KEYS];
