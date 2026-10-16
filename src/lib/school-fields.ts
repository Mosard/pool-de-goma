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

/** Statut de gestion : valeurs en base et libellés affichés. Conventionnée : confession à préciser. */
export const SCHOOL_MANAGEMENT_LABELS = { PUBLIC: "Publique", PRIVATE: "Privée", CONVENTIONED: "Conventionnée" } as const;
export type SchoolManagementValue = keyof typeof SCHOOL_MANAGEMENT_LABELS;

/** « Publique » / « Privée » / « Conventionnée » (casse et accents ignorés, masculin toléré) ou valeur enregistrée (formulaire) ; vide = null. */
export function parseManagement(value: string | null | undefined): SchoolManagementValue | null | "invalid" {
  const text = foldText(value ?? "");
  if (text === "") return null;
  if (text === "publique" || text === "public") return "PUBLIC";
  if (text === "privee" || text === "prive" || text === "private") return "PRIVATE";
  if (text === "conventionnee" || text === "conventionne" || text === "conventioned") return "CONVENTIONED";
  return "invalid";
}

function isManagement(value: string | null | undefined): value is SchoolManagementValue {
  return value != null && Object.hasOwn(SCHOOL_MANAGEMENT_LABELS, value);
}

/** « Conventionnée (Catholique) » ; null si non renseigné. */
export function displayManagement(value: string | null | undefined, confession?: string | null): string | null {
  if (!isManagement(value)) return null;
  const label = SCHOOL_MANAGEMENT_LABELS[value];
  return value === "CONVENTIONED" && confession ? `${label} (${confession})` : label;
}

/** Exemples proposés à la saisie ; toute autre confession reste possible. */
export const CONFESSION_SUGGESTIONS = ["Catholique", "Protestante", "Musulmane", "Adventiste"] as const;

/** Confession : espaces nettoyés, vide = null. */
export function normalizeConfession(value: string | null | undefined): string | null {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

/** Règle de la confession sur les valeurs résultantes ; null si tout est cohérent. */
export function confessionProblem(management: string | null | undefined, confession: string | null | undefined): string | null {
  if (management === "CONVENTIONED" && !confession) return CONFESSION_REQUIRED;
  if (management !== "CONVENTIONED" && confession) return CONFESSION_CONVENTIONED_ONLY;
  return null;
}

/** Vrai seulement quand les deux nombres sont connus et que les qualifiés dépassent le total. */
export function qualifiedExceedsTotal(qualified: number | null | undefined, total: number | null | undefined): boolean {
  return qualified != null && total != null && qualified > total;
}

export const MANAGEMENT_INVALID = "Gestion : « Publique », « Privée » ou « Conventionnée » attendu.";
export const CONFESSION_REQUIRED = "École conventionnée : précisez la confession (ex. Catholique, Protestante, Musulmane, Adventiste).";
export const CONFESSION_CONVENTIONED_ONLY = "La confession ne concerne que les écoles conventionnées (gestion « Conventionnée »).";
export const QUALIFIED_EXCEEDS_TOTAL = "Le nombre d'enseignants qualifiés ne peut pas dépasser le nombre d'enseignants.";
export const OPTIONS_SECONDARY_ONLY = "Les options organisées ne concernent que les écoles secondaires (type « Secondaire »).";
export const COUNT_INVALID = "Nombre entier positif attendu.";
