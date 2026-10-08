// Règles PURES des champs de la fiche école, partagées par le formulaire
// (client et serveur) et l'import Excel (docs/import-ecoles-excel.md).

/** Majuscules, accents et espaces ignorés : « École  Secondaire » ≈ « ecole secondaire ». */
export function foldText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Le type d'école est libre (décision Q3) : une école est secondaire si son type contient « secondaire ». */
export function isSecondaryType(type: string | null | undefined): boolean {
  return foldText(type ?? "").includes("secondaire");
}

/**
 * Options organisées : saisie libre séparée par des virgules (ou des
 * points-virgules), nettoyée et dédoublonnée. null si rien n'est saisi.
 */
export function normalizeOptions(value: string | null | undefined): string | null {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of (value ?? "").split(/[,;]/)) {
    const item = raw.replace(/\s+/g, " ").trim();
    if (!item || seen.has(foldText(item))) continue;
    seen.add(foldText(item));
    items.push(item);
  }
  return items.length > 0 ? items.join(", ") : null;
}

export const MAX_COUNT = 100_000;

/** Nombre de classes / d'enseignants : entier ≥ 0, vide = null. */
export function parseCount(value: string | number | null | undefined): number | null | "invalid" {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s/g, "");
  if (text === "") return null;
  if (!/^\d+([.,]0+)?$/.test(text)) return "invalid";
  const n = Number.parseInt(text, 10);
  return n <= MAX_COUNT ? n : "invalid";
}

/** Code (POOL ou école) comparé sans tenir compte de la casse ni des espaces de bord (décision Q5). */
export function sameCode(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const OPTIONS_SECONDARY_ONLY = "Les options organisées ne concernent que les écoles secondaires (type « Secondaire »).";
export const COUNT_INVALID = "Nombre entier positif attendu.";
