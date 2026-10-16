// Mise en forme des valeurs de la fiche (écran et PDF) : une valeur absente
// n'est jamais inventée ; elle reste vide (affichée « — » / « Non renseigné »).

import type { FieldDef } from "@/lib/personnel-file/defs";

export type Cell = string | number | boolean | string[] | null | undefined;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatCivilDate(v: string): string {
  if (!DATE_RE.test(v)) return v;
  return new Date(`${v}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
}

/** Texte affiché, ou null si le champ est vide. */
export function formatValue(f: FieldDef, v: Cell): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.join(" ; ") : null;
  switch (f.kind) {
    case "yesno":
      return v === true ? "OUI" : v === false ? "NON" : String(v);
    case "choice":
      return f.options?.find((o) => o.value === v)?.label ?? String(v);
    case "date":
      return formatCivilDate(String(v));
    default:
      return String(v);
  }
}

/** Valeur initiale d'un champ de formulaire. */
export function inputValue(f: FieldDef, v: Cell): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join("\n");
  if (f.kind === "yesno") return v === true ? "OUI" : v === false ? "NON" : "";
  return String(v);
}

/** Ligne de table (Prisma) → valeurs simples, dates civiles en AAAA-MM-JJ. */
export function plainRow(row: Record<string, unknown>, keys: readonly string[]): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  for (const k of keys) {
    const v = row[k];
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : (v as Cell);
  }
  return out;
}
