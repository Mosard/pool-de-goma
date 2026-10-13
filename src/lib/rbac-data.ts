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
  // Présence du personnel et fiches (décisions du 2026-10-10,
  // PRESENCES-BIOMETRIQUES-ANALYSE.md, Révision 2). Aucune ne découle d'une autre.
  PRESENCE_READ_ALL: "presence.read_all",
  PRESENCE_READ_CELL: "presence.read_cell",
  PERSONNEL_RECORDS_READ_ALL: "personnel.records.read_all",
  PRESENCE_DEVICES_MANAGE: "presence.devices.manage",
  PRESENCE_ENROLLMENT_MANAGE: "presence.enrollment.manage",
  PRESENCE_SCHEDULE_MANAGE: "presence.schedule.manage",
  PRESENCE_REQUESTS_INITIATE_CELL: "presence.requests.initiate_cell",
  PRESENCE_REQUESTS_INITIATE_UNCELLED: "presence.requests.initiate_uncelled",
  PRESENCE_REQUESTS_VERIFY: "presence.requests.verify",
  PRESENCE_REQUESTS_APPROVE_FINAL: "presence.requests.approve_final",
  PRESENCE_DELEGATIONS_MANAGE: "presence.delegations.manage",
  PRESENCE_PUNCH_CORRECT: "presence.punch.correct",
  PRESENCE_OVERTIME_DECIDE: "presence.overtime.decide",
  CELLS_INTERIM_MANAGE: "cells.interim.manage",
  // Décision Q-A du 2026-10-10 : vocation « gestion du personnel » d'une cellule
  // et responsable IPA de CETTE cellule (les autres cellules gardent leurs règles).
  CELLS_PERSONNEL_MANAGE: "cells.personnel.manage",
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
  { key: PERMISSIONS.REPORTS_VALIDATE, label: "Signer les rapports et synthèses validés et transmis par les cellules (IPP)", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_ROUTE_IPP, label: "Secrétariat de l'IPP : recevoir les rapports et les envoyer à une cellule", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_REVIEW_CELL, label: "Exploiter les rapports affectés à sa cellule et préparer ses synthèses", category: "Circuit de validation" },
  { key: PERMISSIONS.REPORTS_SIGN_CELL, label: "Valider et transmettre à l'IPP les rapports et synthèses de sa cellule (IPA)", category: "Circuit de validation" },
  { key: PERMISSIONS.AUDIT_VIEW, label: "Consulter le journal d'audit", category: "Administration" },
  { key: PERMISSIONS.FORM_TEMPLATES_MANAGE, label: "Gérer les catégories et fiches d'inspection", category: "Administration" },
  { key: PERMISSIONS.PUBLICATION_MANAGE, label: "Autoriser la publication publique des profils (nom, fonction, photo)", category: "Publication" },
  { key: PERMISSIONS.DIRECTION_MANAGE, label: "Gérer la Direction de l'Inspection (attributions des IPP adjoints)", category: "Publication" },
  { key: PERMISSIONS.CONTENT_WRITE, label: "Rédiger des actualités, articles et communiqués (brouillons, soumission)", category: "Site public" },
  { key: PERMISSIONS.CONTENT_PUBLISH, label: "Valider et publier les contenus du site, les renvoyer en correction ou les retirer", category: "Site public" },
  { key: PERMISSIONS.AI_ANALYZE, label: "Consulter et lancer les analyses IA des rapports", category: "IA" },
  { key: PERMISSIONS.PRESENCE_READ_ALL, label: "Consulter les présences de tout le personnel (tous les POOL, bureaux et cellules)", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_READ_CELL, label: "Consulter les présences des personnes de sa cellule", category: "Présence du personnel" },
  { key: PERMISSIONS.PERSONNEL_RECORDS_READ_ALL, label: "Consulter les fiches détaillées de tout le personnel (lecture seule)", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_DEVICES_MANAGE, label: "Administrer les pointeuses et leur synchronisation", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, label: "Associer les identifiants de pointage aux comptes", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, label: "Modifier les seuils horaires et le calendrier", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_REQUESTS_INITIATE_CELL, label: "Initier les demandes (mission, congé, absence) des personnes de sa cellule", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_REQUESTS_INITIATE_UNCELLED, label: "Initier les demandes des agents sans cellule", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_REQUESTS_VERIFY, label: "Vérifier les demandes et décider des absences justifiées", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_REQUESTS_APPROVE_FINAL, label: "Approuver ou signer les missions et congés", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_DELEGATIONS_MANAGE, label: "Déléguer ses pouvoirs d'approbation", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_PUNCH_CORRECT, label: "Corriger les pointages (événements bruts conservés)", category: "Présence du personnel" },
  { key: PERMISSIONS.PRESENCE_OVERTIME_DECIDE, label: "Décider des heures supplémentaires proposées", category: "Présence du personnel" },
  { key: PERMISSIONS.CELLS_INTERIM_MANAGE, label: "Désigner un intérimaire pour une cellule", category: "Présence du personnel" },
  { key: PERMISSIONS.CELLS_PERSONNEL_MANAGE, label: "Attribuer ou retirer la vocation « gestion du personnel » et désigner le responsable de cette cellule", category: "Présence du personnel" },
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
  // Décision du 2026-10-13 : mêmes droits que le Super Admin, attribuée depuis
  // l'écran par un Super Admin seulement.
  ADMIN: "admin",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

// Permissions de cellule : elles ne valent QUE pour une cellule précise —
// celle de la fonction (UserRole.cellId, exploitant de l'IPP) ou celle dont
// la personne est l'IPA responsable (Cell.ipaId). Sans cellule, elles ne
// donnent rien : jamais d'accès provincial de repli (décisions du 2026-10-08).
export const CELL_PERMISSION_KEYS: readonly string[] = [
  PERMISSIONS.REPORTS_REVIEW_CELL,
  PERMISSIONS.REPORTS_SIGN_CELL,
  PERMISSIONS.PRESENCE_READ_CELL,
  PERMISSIONS.PRESENCE_REQUESTS_INITIATE_CELL,
];

// Pouvoirs du responsable de la cellule du personnel (décisions du 2026-10-10) :
// ajoutés par loadUserAccess UNIQUEMENT à l'IPA responsable (Cell.ipaId) de la
// cellule active de vocation PERSONNEL (Cell.mandate), à portée organisation.
// Jamais par la fonction seule, jamais en « Voir comme ». Ils cessent dès qu'il
// n'est plus responsable ou que la cellule est archivée.
export const PERSONNEL_HEAD_KEYS: readonly PermissionKey[] = [
  PERMISSIONS.PRESENCE_READ_ALL,
  PERMISSIONS.PERSONNEL_RECORDS_READ_ALL,
  PERMISSIONS.PRESENCE_DEVICES_MANAGE,
  PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE,
  PERMISSIONS.PRESENCE_SCHEDULE_MANAGE,
  PERMISSIONS.PRESENCE_REQUESTS_INITIATE_UNCELLED,
  PERMISSIONS.PRESENCE_REQUESTS_VERIFY,
  PERMISSIONS.PRESENCE_PUNCH_CORRECT,
  PERMISSIONS.PRESENCE_OVERTIME_DECIDE,
  PERMISSIONS.CELLS_PERSONNEL_MANAGE,
];

// Pouvoirs métier qui ne reviennent JAMAIS au Super Admin par son catalogue
// complet, ni en « Voir comme » (simulation de l'IPP ou d'un IPA comprise) :
// fiches détaillées (accès à clarifier, Q-FICHE-2), seuils et calendrier
// (IPP et IPA du personnel seulement), vérification, approbation, délégation,
// heures supplémentaires ; permissions de cellule (il ne dirige aucune cellule).
export const SUPER_ADMIN_EXCLUDED_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.PERSONNEL_RECORDS_READ_ALL,
  PERMISSIONS.PRESENCE_SCHEDULE_MANAGE,
  PERMISSIONS.PRESENCE_REQUESTS_VERIFY,
  PERMISSIONS.PRESENCE_REQUESTS_APPROVE_FINAL,
  PERMISSIONS.PRESENCE_DELEGATIONS_MANAGE,
  PERMISSIONS.PRESENCE_OVERTIME_DECIDE,
  PERMISSIONS.PRESENCE_READ_CELL,
  PERMISSIONS.PRESENCE_REQUESTS_INITIATE_CELL,
];

// Permissions du module qui ne s'AJOUTENT pas individuellement (« Gérer les
// accès ») : le calendrier par décision du 2026-10-10, les autres en attente
// de Q-E (refus par défaut). Leur retrait individuel reste possible.
export const PRESENCE_NOT_INDIVIDUALLY_GRANTABLE: readonly PermissionKey[] = [
  PERMISSIONS.PRESENCE_READ_ALL,
  PERMISSIONS.PERSONNEL_RECORDS_READ_ALL,
  PERMISSIONS.PRESENCE_DEVICES_MANAGE,
  PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE,
  PERMISSIONS.PRESENCE_SCHEDULE_MANAGE,
  PERMISSIONS.PRESENCE_REQUESTS_INITIATE_UNCELLED,
  PERMISSIONS.PRESENCE_REQUESTS_VERIFY,
  PERMISSIONS.PRESENCE_REQUESTS_APPROVE_FINAL,
  PERMISSIONS.PRESENCE_DELEGATIONS_MANAGE,
  PERMISSIONS.PRESENCE_PUNCH_CORRECT,
  PERMISSIONS.PRESENCE_OVERTIME_DECIDE,
  PERMISSIONS.CELLS_INTERIM_MANAGE,
  PERMISSIONS.CELLS_PERSONNEL_MANAGE,
];

// Fonctions PERSONNALISÉES (créées ou modifiées dans Paramètres, 2026-10-13) :
// elles ne peuvent porter ni les permissions sensibles du module de présence
// (fonction officielle ou cellule seulement), ni les pouvoirs réservés, ni des
// permissions de cellule (sans effet hors cellule). Évite tout contournement.
export const CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS: readonly string[] = [
  ...new Set<string>([...PRESENCE_NOT_INDIVIDUALLY_GRANTABLE, ...SUPER_ADMIN_EXCLUDED_PERMISSIONS, ...CELL_PERMISSION_KEYS]),
];

// IPA : ses analyses IA sont aussi bornées à sa cellule (décision D4).
export const IPA_CELL_BOUND_KEYS: readonly string[] = [...CELL_PERMISSION_KEYS, PERMISSIONS.AI_ANALYZE];

// Fonctions rattachées à une cellule : un accès provincial (review_province,
// review_pool sur tous les POOL) ne peut pas leur être redonné individuellement.
export const CELL_BOUND_ROLE_KEYS: readonly string[] = [ROLE_KEYS.EXPLOITANT_IPP, ROLE_KEYS.IPA];

// Décision D7 (précisée le 2026-10-09) : dans la branche IPP, l'IPP principal
// ne lit que les rapports validés et transmis par une cellule (qu'il signe) et
// l'historique antérieur. Ses vues de pilotage chiffrées, son analyse IA et ses
// autres pouvoirs ne changent pas.
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
export const SUPER_ADMIN_PERMISSIONS: readonly PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key).filter(
  (k) => !(SUPER_ADMIN_EXCLUDED_PERMISSIONS as readonly string[]).includes(k)
);

// Fonctions qui ne s'attribuent JAMAIS depuis l'application (formulaire public,
// validation de demande, création de compte, fiche POOL) : uniquement par le
// script serveur prisma/scripts/grant-super-admin.ts. Leur clé est réservée.
export const RESTRICTED_ROLE_KEYS: readonly string[] = [ROLE_KEYS.SUPER_ADMIN];

// Super-utilisateurs (décision du 2026-10-13) : Super Admin et Admin ont les
// mêmes droits (catalogue moins SUPER_ADMIN_EXCLUDED_PERMISSIONS) et le même
// traitement partout. Seule différence : l'Admin s'attribue depuis l'écran par
// un Super Admin ; le Super Admin, par le script serveur seulement.
export const SUPERUSER_ROLE_KEYS: readonly string[] = [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN];
export const ADMIN_LABEL = "Admin";
export const ADMIN_DESCRIPTION =
  "Mêmes droits que le Super Admin (administration, assistance, dépannage), attribuée par un Super Admin. Toutes ses actions sont tracées.";

export function isSuperuserRoleKey(key: string): boolean {
  return SUPERUSER_ROLE_KEYS.includes(key);
}

// « Voir comme » (bascule de profil) : Super Admin (toute fonction non
// réservée) et IPP (décision du 2026-09-29 : fonctions de POOL seulement,
// pour suivre chaque POOL, sans jamais dépasser ses propres droits).
export const VIEW_MODE_HOLDER_ROLE_KEYS: readonly string[] = [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.IPP];

// Fonctions provinciales que l'IPP peut AUSSI simuler (décision du
// 2026-10-03 : basculer dans l'espace du chargé des médias). Leurs droits
// sont pris tels quels, sans être bornés aux droits réels de l'IPP : la
// rédaction ne publie rien sans validation d'un autre compte habilité.
export const IPP_VIEW_MODE_EXTRA_ROLE_KEYS: readonly string[] = [ROLE_KEYS.CHARGE_MEDIAS];

// Bascule en CONSULTATION (décision du 2026-10-12) : l'informaticien et les
// secrétaires de l'IPP voient l'écran de toute fonction (sauf Super Admin),
// pouvoirs réservés compris, mais AUCUNE écriture n'est possible pendant la
// bascule : refus central dans le client Prisma (src/lib/prisma.ts), exports
// et analyses IA refusés.
export const READ_ONLY_VIEW_MODE_ROLE_KEYS: readonly string[] = [ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SECRETAIRE_IPP];

export type ViewModeKind = "full" | "bounded" | "readonly";

/**
 * Type de bascule d'après les fonctions RÉELLES : Super Admin → droits complets
 * de la fonction simulée ; IPP → bornée à ses droits ; informaticien ou
 * secrétaire de l'IPP → consultation seule ; sinon aucune bascule.
 */
export function viewModeKind(realRoleKeys: readonly string[]): ViewModeKind | null {
  if (realRoleKeys.some(isSuperuserRoleKey)) return "full";
  if (realRoleKeys.includes(ROLE_KEYS.IPP)) return "bounded";
  if (realRoleKeys.some((k) => READ_ONLY_VIEW_MODE_ROLE_KEYS.includes(k))) return "readonly";
  return null;
}

// Décision de l'Inspection : seuls l'IPP et l'informaticien autorisent la
// publication d'un agent (le Chef de POOL, notamment, ne le peut pas).
// Le Super Admin aussi (décision du 2026-09-27), sauf lorsqu'il simule une
// autre fonction : il n'a alors que les droits de celle-ci.
export const PUBLICATION_AUTHORITY_ROLE_KEYS: readonly string[] = [
  ROLE_KEYS.IPP,
  ROLE_KEYS.INFORMATICIEN,
  ROLE_KEYS.SUPER_ADMIN,
  ROLE_KEYS.ADMIN,
];

// Qui peut attribuer (et retirer) chaque fonction — décision du 2026-10-07 :
// seuls l'IPP, l'informaticien, le Super Admin et, selon le cas, le chef du
// POOL concerné donnent des accès. Les fonctions provinciales sensibles (IPA,
// informaticien) relèvent de l'IPP ; la fonction d'IPP, du seul Super Admin.
// Le chef de POOL n'attribue que la fonction d'inspecteur (comptes déjà
// validés) et les fonctions d'appui, et seulement dans son propre POOL
// (voir canGrantRole). Liste vide : jamais depuis l'application.
const PROVINCIAL_GRANTORS: readonly RoleKey[] = [ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN];
const POOL_SUPPORT_GRANTORS: readonly RoleKey[] = [...PROVINCIAL_GRANTORS, ROLE_KEYS.CHEF_POOL];
export const ROLE_GRANTORS: Readonly<Record<RoleKey, readonly RoleKey[]>> = {
  [ROLE_KEYS.SUPER_ADMIN]: [],
  // Admin : attribué et retiré par un Super Admin seulement (décision du 2026-10-13).
  [ROLE_KEYS.ADMIN]: [ROLE_KEYS.SUPER_ADMIN],
  [ROLE_KEYS.IPP]: [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN],
  [ROLE_KEYS.IPA]: [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN],
  [ROLE_KEYS.INFORMATICIEN]: [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN],
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
