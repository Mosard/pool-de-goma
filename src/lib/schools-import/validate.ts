// Validation PURE des lignes du canevas des écoles (sans base) :
// docs/import-ecoles-excel.md, § 3.3. Une ligne fautive est rejetée avec
// son numéro et son motif ; elle ne bloque jamais les autres.

import { IMPORT_COLUMNS, type ImportField } from "@/lib/schools-import/columns";
import { COUNT_INVALID, OPTIONS_SECONDARY_ONLY, isSecondaryType, normalizeOptions, parseCount, sameCode } from "@/lib/school-fields";

/** Ligne lue dans le fichier : numéro de ligne Excel et texte des cellules (vide = ""). */
export type RawRow = { line: number; cells: Partial<Record<ImportField, string>> };

/** Valeurs d'une ligne valide. null = cellule vide (en mise à jour : valeur existante conservée, décision Q2). */
export type SchoolImportData = {
  code: string;
  name: string;
  province: string;
  territoire: string;
  type: string | null;
  director: string | null;
  phone: string | null;
  address: string | null;
  approvalDecree: string | null;
  classCount: number | null;
  teacherCount: number | null;
  options: string | null;
};

export type ValidRow = { line: number; data: SchoolImportData };
export type Rejection = { line: number; code: string | null; reason: string };

const MIN_LENGTH: Partial<Record<ImportField, number>> = { code: 2, name: 2, province: 2, territoire: 2 };

export function validateRow(row: RawRow, poolCode: string): { ok: true; row: ValidRow } | { ok: false; rejection: Rejection } {
  const text = (field: ImportField) => (row.cells[field] ?? "").replace(/\s+/g, " ").trim();
  const reasons: string[] = [];

  for (const col of IMPORT_COLUMNS) {
    const value = text(col.field);
    if (!value) {
      if (col.required) reasons.push(`${col.label} manquant`);
      continue;
    }
    if (value.length > col.maxLength) reasons.push(`${col.label} : ${col.maxLength} caractères maximum`);
    const min = MIN_LENGTH[col.field];
    if (min && value.length < min) reasons.push(`${col.label} : ${min} caractères minimum`);
    if (col.kind === "count" && parseCount(value) === "invalid") reasons.push(`${col.label} : ${COUNT_INVALID.toLowerCase()} (« ${value} »)`);
  }

  // Le POOL vient TOUJOURS du choix fait à l'écran : la colonne ne sert qu'à vérifier.
  const filePool = text("poolCode");
  if (filePool && !sameCode(filePool, poolCode)) {
    reasons.push(`code du POOL « ${filePool} » différent du POOL choisi (« ${poolCode} »)`);
  }

  const code = text("code");
  if (reasons.length > 0) return { ok: false, rejection: { line: row.line, code: code || null, reason: capitalize(reasons.join(" ; ")) } };

  const optional = (field: ImportField) => text(field) || null;
  const count = (field: "classCount" | "teacherCount") => parseCount(text(field)) as number | null;
  return {
    ok: true,
    row: {
      line: row.line,
      data: {
        code,
        name: text("name"),
        province: text("province"),
        territoire: text("territoire"),
        type: optional("type"),
        director: optional("director"),
        phone: optional("phone"),
        address: optional("address"),
        approvalDecree: optional("approvalDecree"),
        classCount: count("classCount"),
        teacherCount: count("teacherCount"),
        options: normalizeOptions(text("options")),
      },
    },
  };
}

/** Valide toutes les lignes ; un code d'école répété dans le fichier n'est traité qu'à sa première occurrence. */
export function validateRows(rows: RawRow[], poolCode: string): { valid: ValidRow[]; rejected: Rejection[] } {
  const valid: ValidRow[] = [];
  const rejected: Rejection[] = [];
  const firstLine = new Map<string, number>();
  for (const row of rows) {
    const result = validateRow(row, poolCode);
    if (!result.ok) {
      rejected.push(result.rejection);
      continue;
    }
    const key = result.row.data.code.toLowerCase();
    const first = firstLine.get(key);
    if (first !== undefined) {
      rejected.push({ line: row.line, code: result.row.data.code, reason: `Code de l'école déjà présent à la ligne ${first} du fichier` });
      continue;
    }
    firstLine.set(key, row.line);
    valid.push(result.row);
  }
  return { valid, rejected };
}

/** Champs de la fiche école écrits par l'import (jamais poolId, active, isDemo). */
export type SchoolValues = Omit<SchoolImportData, "code">;
export type ExistingSchoolValues = { [K in keyof SchoolValues]: SchoolValues[K] | null };

const VALUE_FIELDS = [
  "name",
  "province",
  "territoire",
  "type",
  "director",
  "phone",
  "address",
  "approvalDecree",
  "classCount",
  "teacherCount",
  "options",
] as const satisfies readonly (keyof SchoolValues)[];

export function planCreate(data: SchoolImportData): { ok: true; values: SchoolImportData } | { ok: false; reason: string } {
  if (data.options && !isSecondaryType(data.type)) return { ok: false, reason: OPTIONS_SECONDARY_ONLY };
  return { ok: true, values: data };
}

/**
 * Mise à jour d'une école existante : seules les cellules remplies
 * remplacent la valeur actuelle (décision Q2). Le code conserve son
 * écriture d'origine. Si l'école n'est plus secondaire, ses options sont
 * retirées, comme dans le formulaire.
 */
export function planUpdate(
  existing: ExistingSchoolValues,
  data: SchoolImportData
): { ok: true; changes: Partial<SchoolValues> } | { ok: false; reason: string } {
  const effectiveType = data.type ?? existing.type;
  if (data.options && !isSecondaryType(effectiveType)) return { ok: false, reason: OPTIONS_SECONDARY_ONLY };
  const changes: Partial<Record<keyof SchoolValues, unknown>> = {};
  for (const field of VALUE_FIELDS) {
    const value = data[field];
    if (value !== null && value !== existing[field]) changes[field] = value;
  }
  if (!isSecondaryType(effectiveType) && existing.options) changes.options = null;
  return { ok: true, changes: changes as Partial<SchoolValues> };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
