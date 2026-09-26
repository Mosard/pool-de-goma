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
  AUDIT_VIEW: "audit.view",
  FORM_TEMPLATES_MANAGE: "form_templates.manage",
  PUBLICATION_MANAGE: "publication.manage",
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
  { key: PERMISSIONS.AUDIT_VIEW, label: "Consulter le journal d'audit", category: "Administration" },
  { key: PERMISSIONS.FORM_TEMPLATES_MANAGE, label: "Gérer les catégories et fiches d'inspection", category: "Administration" },
  { key: PERMISSIONS.PUBLICATION_MANAGE, label: "Autoriser la publication publique des profils (nom, fonction, photo)", category: "Publication" },
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
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

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

// Décision de l'Inspection : seuls l'IPP et l'informaticien autorisent la
// publication d'un agent (le Chef de POOL, notamment, ne le peut pas).
export const PUBLICATION_AUTHORITY_ROLE_KEYS: readonly string[] = [ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN];

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
