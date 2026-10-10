// Fiches du personnel en lecture seule (décisions du 2026-10-10,
// PRESENCES-BIOMETRIQUES-ANALYSE.md, Révision 2). Règles PURES, testées dans
// record.test.ts : liste blanche des champs lus en base et affichés, valeur
// inconnue « Non renseigné », zéro réellement saisi conservé. Aucun mot de
// passe, identifiant de connexion, jeton, consentement ni donnée biométrique.

import { PERMISSIONS } from "@/lib/rbac-data";
import type { SessionPermission } from "@/lib/permission-checks";

export const NOT_PROVIDED = "Non renseigné";

/** Consultation globale : la permission à portée organisation (jamais une copie de cellule ou de POOL). */
export function canReadPersonnelRecords(permissions: readonly SessionPermission[], organizationId: string): boolean {
  return permissions.some(
    (p) => p.permissionKey === PERMISSIONS.PERSONNEL_RECORDS_READ_ALL && p.poolId === null && !p.cellId && p.organizationId === organizationId
  );
}

const ROLES_SELECT = {
  select: {
    poolId: true,
    pool: { select: { name: true } },
    cell: { select: { code: true, name: true, active: true } },
    role: { select: { key: true, label: true } },
  },
} as const;

/** Champs lus pour la liste et la recherche : identification et affectation seulement. */
export const SEARCH_SELECT = {
  id: true,
  name: true,
  status: true,
  pool: { select: { name: true } },
  cellLed: { select: { code: true, name: true, active: true } },
  roles: ROLES_SELECT,
} as const;

/** Champs lus pour une fiche : liste blanche explicite (Prisma `select`). */
export const RECORD_SELECT = {
  id: true,
  name: true,
  postnom: true,
  prenom: true,
  sex: true,
  dateNaissance: true,
  photoUrl: true,
  email: true,
  phone: true,
  nombreEnfants: true,
  matricule: true,
  statutAdministratif: true,
  mecanise: true,
  status: true,
  pool: { select: { name: true } },
  cellLed: { select: { code: true, name: true, active: true } },
  roles: ROLES_SELECT,
} as const;

/** Champs qui ne doivent JAMAIS figurer dans une sélection de fiche ou de recherche. */
export const FORBIDDEN_FIELDS: readonly string[] = [
  "passwordHash",
  "username",
  "publicationConsentIdentity",
  "publicationConsentPhoto",
  "publicationAuthIdentity",
  "publicationAuthPhoto",
  "passwordResetTokens",
  "isDemo",
];

/** Texte affiché : « Non renseigné » pour une valeur absente ; « 0 » conservé. */
export function displayText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return NOT_PROVIDED;
  if (typeof value === "string" && value.trim() === "") return NOT_PROVIDED;
  return String(value);
}

export function displayYesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return NOT_PROVIDED;
  return value ? "Oui" : "Non";
}

export function displaySex(value: string | null | undefined): string {
  if (value === "M") return "Masculin";
  if (value === "F") return "Féminin";
  return NOT_PROVIDED;
}

/** Date de naissance : date civile enregistrée à minuit UTC, affichée sans décalage de fuseau. */
export function displayBirthDate(value: Date | null | undefined): string {
  if (!value) return NOT_PROVIDED;
  return value.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente d'activation",
  SUSPENDED: "Suspendu",
  DISABLED: "Désactivé",
};

type RoleRow = {
  poolId: string | null;
  pool: { name: string } | null;
  cell: { code: string; name: string; active: boolean } | null;
  role: { key: string; label: string };
};

/** Fonctions et affectation lisibles : « Exploitant — Cellule X », « Inspecteur — POOL Goma ». */
export function functionLabels(p: { roles: RoleRow[]; cellLed: { code: string; name: string; active: boolean } | null }): string[] {
  return p.roles.map((r) => {
    if (r.role.key === "ipa") {
      const c = p.cellLed?.active ? p.cellLed : null;
      return c ? `IPA — Responsable de la cellule ${c.name}` : "IPA — en attente d'affectation à une cellule";
    }
    if (r.role.key === "exploitant_ipp") {
      return r.cell?.active ? `Exploitant — Cellule ${r.cell.name}` : "Exploitant — en attente d'affectation à une cellule";
    }
    return r.pool ? `${r.role.label} — POOL ${r.pool.name}` : r.role.label;
  });
}
