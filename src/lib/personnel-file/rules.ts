// Règles PURES de la fiche individuelle (testées dans rules.test.ts) :
// droits sur une fiche, validation et normalisation des valeurs saisies,
// champs modifiés (journal : noms seulement), complétude indicative.

import { PERMISSIONS } from "@/lib/rbac-data";
import type { SessionPermission } from "@/lib/permission-checks";
import { ALL_GROUPS, type FieldDef, type FieldsGroup, type UserColumn } from "./defs";

// ─── Droits ──────────────────────────────────────────────────────────────────

export type FileAccess = {
  self: boolean;
  read: boolean;
  edit: boolean;
  pdf: boolean;
  /** Observations (colonne « OBS. ») : gestionnaires du personnel, jamais sur leur propre fiche. */
  observe: boolean;
};

type Actor = { id: string; organizationId: string; isDemo: boolean; permissions: readonly SessionPermission[] };
type Target = { id: string; organizationId: string; isDemo: boolean };

/** Permission à portée organisation (jamais une copie de POOL ou de cellule). */
function holdsOrgWide(permissions: readonly SessionPermission[], key: string, organizationId: string): boolean {
  return permissions.some((p) => p.permissionKey === key && p.poolId === null && !p.cellId && p.organizationId === organizationId);
}

export function canEditOtherFiles(permissions: readonly SessionPermission[], organizationId: string): boolean {
  return holdsOrgWide(permissions, PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL, organizationId);
}

/**
 * Droits de `actor` sur la fiche de `target`, ou null (fiche introuvable pour
 * lui : autre organisation, données réelles / de démonstration mêlées, aucun droit).
 * Sa propre fiche : lecture, modification, PDF, sans aucune permission.
 */
export function fileAccess(actor: Actor, target: Target | null): FileAccess | null {
  if (!target || target.organizationId !== actor.organizationId || target.isDemo !== actor.isDemo) return null;
  if (target.id === actor.id) return { self: true, read: true, edit: true, pdf: true, observe: false };
  // La modification suppose la lecture : retirer individuellement la lecture
  // (« Gérer les accès ») coupe aussi la modification.
  const read = holdsOrgWide(actor.permissions, PERMISSIONS.PERSONNEL_RECORDS_READ_ALL, actor.organizationId);
  if (!read) return null;
  const edit = canEditOtherFiles(actor.permissions, actor.organizationId);
  return { self: false, read: true, edit, pdf: true, observe: edit };
}

// ─── Valeurs ─────────────────────────────────────────────────────────────────

export type StoredValue = string | number | boolean | string[];
export type GroupData = Record<string, StoredValue>;
export type UserColumnsData = Partial<{
  postnom: string | null;
  prenom: string | null;
  sex: "M" | "F" | null;
  dateNaissance: Date | null;
  phone: string | null;
  matricule: string | null;
  nombreEnfants: number | null;
}>;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[+0-9 ().\-/]{4,30}$/;
const MAX_LIST_ITEMS = 30;

/** Date civile AAAA-MM-JJ réellement existante (pas de 31 février), entre 1900 et 2100. */
export function isCivilDate(v: string): boolean {
  const m = DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, da));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === da;
}

/** Date civile → instant à minuit UTC (même convention que User.dateNaissance). */
export function civilDateToDb(v: string): Date {
  return new Date(`${v}T00:00:00.000Z`);
}

export function dbToCivilDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type Parsed = { ok: true; value: StoredValue | null } | { ok: false; error: string };

/** Valeur saisie → valeur enregistrée (null = champ vide). Aucun champ n'est obligatoire. */
export function parseField(f: FieldDef, raw: unknown): Parsed {
  if (f.kind === "list") {
    const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join("\n") : "";
    const items = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > MAX_LIST_ITEMS) return { ok: false, error: `${MAX_LIST_ITEMS} lignes au plus.` };
    if (items.some((s) => s.length > 200)) return { ok: false, error: "200 caractères au plus par ligne." };
    return { ok: true, value: items.length ? items : null };
  }
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "") return { ok: true, value: null };
  const max = f.maxLength ?? (f.kind === "textarea" ? 2000 : 200);
  if (v.length > max) return { ok: false, error: `${max} caractères au plus.` };
  switch (f.kind) {
    case "date":
      return isCivilDate(v) ? { ok: true, value: v } : { ok: false, error: "Date invalide." };
    case "year": {
      const n = Number(v);
      return /^\d{4}$/.test(v) && n >= 1900 && n <= 2100 ? { ok: true, value: n } : { ok: false, error: "Année sur quatre chiffres." };
    }
    case "number": {
      const n = Number(v);
      return /^\d{1,2}$/.test(v) && n >= 0 && n <= 60 ? { ok: true, value: n } : { ok: false, error: "Nombre entier de 0 à 60." };
    }
    case "email":
      return EMAIL_RE.test(v) ? { ok: true, value: v.toLowerCase() } : { ok: false, error: "Adresse électronique invalide." };
    case "tel":
      return TEL_RE.test(v) ? { ok: true, value: v } : { ok: false, error: "Numéro de téléphone invalide." };
    case "yesno":
      if (v === "OUI") return { ok: true, value: true };
      if (v === "NON") return { ok: true, value: false };
      return { ok: false, error: "Choisir OUI ou NON." };
    case "choice":
      return f.options?.some((o) => o.value === v) ? { ok: true, value: v } : { ok: false, error: "Choix invalide." };
    default:
      return { ok: true, value: v };
  }
}

export type GroupParse = { ok: true; data: GroupData; user: UserColumnsData } | { ok: false; errors: Record<string, string> };

/**
 * Rubrique saisie → données de la fiche + colonnes du compte. Les champs
 * `userColumn` ne sont jamais recopiés dans la fiche. Une clé inconnue est ignorée.
 */
export function parseFieldsGroup(group: FieldsGroup, input: Record<string, unknown>): GroupParse {
  const data: GroupData = {};
  const user: UserColumnsData = {};
  const errors: Record<string, string> = {};
  for (const f of group.fields) {
    const r = parseField(f, input[f.key]);
    if (!r.ok) {
      errors[f.key] = r.error;
      continue;
    }
    // Sexe obligatoire sur le compte (décision du 2026-10-16) : un « Genre » laissé vide ne l'efface pas.
    if (f.userColumn === "sex" && r.value === null) continue;
    if (f.userColumn) setUserColumn(user, f.userColumn, r.value);
    else if (r.value !== null) data[f.key] = r.value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data, user };
}

function setUserColumn(user: UserColumnsData, col: UserColumn, value: StoredValue | null) {
  switch (col) {
    case "sex":
      user.sex = value === "M" || value === "F" ? value : null;
      break;
    case "dateNaissance":
      user.dateNaissance = typeof value === "string" ? civilDateToDb(value) : null;
      break;
    case "nombreEnfants":
      user.nombreEnfants = typeof value === "number" ? value : null;
      break;
    default:
      user[col] = typeof value === "string" ? value : null;
  }
}

/** Valeurs du compte présentées dans la rubrique (mêmes clés que les champs). */
export function userColumnsToGroupValues(group: FieldsGroup, u: Partial<Record<UserColumn, unknown>>): GroupData {
  const out: GroupData = {};
  for (const f of group.fields) {
    if (!f.userColumn) continue;
    const v = u[f.userColumn];
    if (v === null || v === undefined || v === "") continue;
    out[f.key] = v instanceof Date ? (dbToCivilDate(v) as string) : (v as StoredValue);
  }
  return out;
}

/** Noms des champs dont la valeur change (journal : jamais les valeurs). */
export function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined || v === null || v === "" ? null : JSON.stringify(v));
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => norm(before[k]) !== norm(after[k])).sort();
}

// ─── Complétude (indicative, jamais bloquante) ───────────────────────────────

export type GroupValues = Record<string, GroupData>;
export type RepeatCounts = { promotions: number; diplomas: number; children: number };

/** Une rubrique répétable compte pour un champ, renseigné dès la première entrée. */
export function completeness(values: GroupValues, counts: RepeatCounts): { filled: number; total: number; percent: number } {
  let filled = 0;
  let total = 0;
  for (const g of ALL_GROUPS) {
    if (g.kind === "fields") {
      total += g.fields.length;
      const v = values[g.key] ?? {};
      filled += g.fields.filter((f) => v[f.key] !== undefined && v[f.key] !== null).length;
    } else {
      total += 1;
      if (counts[g.kind] > 0) filled += 1;
    }
  }
  return { filled, total, percent: total ? Math.round((filled / total) * 100) : 0 };
}
