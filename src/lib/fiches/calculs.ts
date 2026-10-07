// Calculs des fiches officielles (fonctions pures, testées dans
// calculs.test.ts). Règles : docs/inventaire-fiches-inspection.md, § 8 et
// décisions du § 10 (chaque fiche garde son propre tableau de conversion).

import type {
  Block,
  ComputedDef,
  Condition,
  ConversionTableId,
  FicheDef,
  FicheValues,
  RatedPosteDef,
  SectionDef,
  TableDef,
  TableRow,
} from "@/lib/fiches/types";

// ---------------------------------------------------------------------------
// Barèmes
// ---------------------------------------------------------------------------

/** Mentions des notes 0 à 4 [fiches C2, C2C, C3, C3B, C5A]. */
export const MENTIONS = ["MEDIOCRE", "ASSEZ BON", "BON", "TRES BON", "ELITE"] as const;
export type Mention = (typeof MENTIONS)[number];

/** Bornes basses (en %) des notes 4, 3, 2, 1 — tableau général : 100–80, 79–70, 69–50, 49–40, 39–0. */
export const PERCENT_BOUNDS: readonly [number, number, number, number] = [80, 70, 50, 40];

type Bounds = readonly [number, number, number, number];

/**
 * Bornes basses (en points) des notes 4, 3, 2, 1 selon le nombre de rubriques
 * remplies (lignes 2 à 10), en dessous : note 0. Recopié des fiches :
 *  - C3 : tableau de « C3.docx » ;
 *  - C2C_C3B : tableau imprimé sur C2C et C3B (identiques). La case « 25 – 2 »
 *    de la ligne 8 est une coquille, lue 25–22 par continuité avec « 21 – 16 ».
 */
export const CONVERSION_TABLES: Record<ConversionTableId, Readonly<Record<number, Bounds>>> = {
  C3: {
    2: [7, 6, 4, 3],
    3: [10, 9, 6, 5],
    4: [13, 12, 8, 7],
    5: [16, 14, 10, 8],
    6: [20, 17, 12, 10],
    7: [23, 20, 14, 12],
    8: [26, 23, 16, 13],
    9: [29, 26, 18, 15],
    10: [32, 28, 20, 16],
  },
  C2C_C3B: {
    2: [7, 6, 4, 3],
    3: [10, 8, 6, 5],
    4: [13, 11, 8, 6],
    5: [16, 14, 10, 8],
    6: [19, 17, 12, 10],
    7: [22, 20, 14, 11],
    8: [26, 22, 16, 13],
    9: [29, 26, 18, 15],
    10: [32, 28, 20, 16],
  },
};

function noteFromBounds(value: number, bounds: Bounds): number {
  if (value >= bounds[0]) return 4;
  if (value >= bounds[1]) return 3;
  if (value >= bounds[2]) return 2;
  if (value >= bounds[3]) return 1;
  return 0;
}

/** Arrondi à l'entier le plus proche, 0,5 vers le haut (exemples du module : 53,8 → 54 ; 85,7 → 86). */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9);
}

/** Z = P × 100 / (Rr × 4), arrondi [DOC module § C2]. null sans rubrique remplie. */
export function percentZ(points: number, filled: number): number | null {
  if (filled <= 0) return null;
  return roundHalfUp((points * 100) / (filled * 4));
}

/** Note 0 à 4 d'un pourcentage, selon le tableau général de conversion. */
export function noteFromPercent(z: number): number {
  return noteFromBounds(z, PERCENT_BOUNDS);
}

/**
 * Note 0 à 4 d'un total de `points` pour `filled` rubriques remplies, lue à la
 * ligne `filled` du tableau de la fiche [DOC module § C3, C3M]. Hors des
 * lignes imprimées (1 rubrique, plus de 10), par le pourcentage Z [décision
 * Q1, § 10]. null si aucune rubrique n'est remplie.
 */
export function noteFromTable(table: ConversionTableId, filled: number, points: number): number | null {
  if (filled <= 0) return null;
  const bounds = CONVERSION_TABLES[table][filled];
  if (bounds) return noteFromBounds(points, bounds);
  return noteFromPercent(percentZ(points, filled)!);
}

export function mentionFor(note: number | null): Mention | null {
  return note === null ? null : MENTIONS[note];
}

// ---------------------------------------------------------------------------
// Visibilité conditionnelle
// ---------------------------------------------------------------------------

export function isVisible(cond: Condition | undefined, values: FicheValues): boolean {
  if (!cond) return true;
  return values[cond.field] === cond.equals;
}

/** Blocs effectivement affichés (sections et blocs conditionnels résolus). */
export function visibleBlocks(def: FicheDef, values: FicheValues): { section: SectionDef; block: Block }[] {
  const out: { section: SectionDef; block: Block }[] = [];
  for (const section of def.sections) {
    if (!isVisible(section.showIf, values)) continue;
    for (const block of section.blocks) {
      if ("showIf" in block && !isVisible(block.showIf, values)) continue;
      out.push({ section, block });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Postes notés
// ---------------------------------------------------------------------------

export const NEUTRAL_VALUES = ["-", "SO"] as const;
export const NOTE_VALUES = ["4", "3", "2", "1", "0"] as const;
export const APPRECIATION_VALUES = ["E", "TB", "B", "AB", "M"] as const;

export type PosteResult = {
  /** P : total des points des rubriques notées. */
  points: number;
  /** Rr : nombre de rubriques portant des points (« – » et « S.O. » exclus). */
  filled: number;
  neutralized: number;
  /** Rubriques laissées vides. */
  missing: string[];
  /** Z (méthode « percent » ou repli hors tableau), sinon null. */
  percent: number | null;
  /** Note convertie 0 à 4, null si non calculable ou poste sans conversion. */
  note: number | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function computePoste(poste: RatedPosteDef, values: FicheValues): PosteResult {
  let points = 0;
  let filled = 0;
  let neutralized = 0;
  const missing: string[] = [];
  for (const item of poste.items) {
    const v = str(values[item.id]);
    if (v === "") {
      // Rubrique laissée en blanc sur la fiche et non intitulée : ignorée.
      if (poste.freeItems?.includes(item.id) && str(values[`${item.id}#libelle`]) === "") continue;
      missing.push(item.id);
    } else if ((NEUTRAL_VALUES as readonly string[]).includes(v)) {
      neutralized++;
    } else if (poste.scale === "0-4" && (NOTE_VALUES as readonly string[]).includes(v)) {
      points += Number(v);
      filled++;
    } else if (poste.scale === "M-E" && (APPRECIATION_VALUES as readonly string[]).includes(v)) {
      filled++;
    }
  }
  let note: number | null = null;
  let percent: number | null = null;
  if (poste.scale === "0-4" && poste.conversion && filled > 0) {
    if (poste.conversion.method === "percent") {
      percent = percentZ(points, filled);
      note = noteFromPercent(percent!);
    } else {
      note = noteFromTable(poste.conversion.table, filled, points);
      if (!CONVERSION_TABLES[poste.conversion.table][filled]) percent = percentZ(points, filled);
    }
  }
  return { points, filled, neutralized, missing, percent, note };
}

// ---------------------------------------------------------------------------
// Évaluation synthétique
// ---------------------------------------------------------------------------

export type SyntheseResult = {
  parts: { id: string; label: string; note: number | null }[];
  total: number | null;
  note: number | null;
  mention: Mention | null;
};

export function computeSynthese(def: FicheDef, values: FicheValues, postes: Record<string, PosteResult>): SyntheseResult | null {
  const s = def.synthese;
  if (!s) return null;
  const parts = s.parts.map((p) => {
    const alt = p.sourceIf?.find((c) => values[c.field] === c.equals);
    const source = alt?.source ?? p.source;
    let note: number | null = null;
    if (postes[source]) {
      note = postes[source].note;
    } else {
      // Note saisie à la main (ex. C2C 6.1 « Domaine contrôlé »).
      const v = str(values[source]);
      note = (NOTE_VALUES as readonly string[]).includes(v) ? Number(v) : null;
    }
    return { id: p.id, label: p.label, note };
  });
  if (parts.some((p) => p.note === null)) return { parts, total: null, note: null, mention: null };
  const total = parts.reduce((sum, p) => sum + (p.note ?? 0), 0);
  const bounds = CONVERSION_TABLES[s.table][s.row];
  const note = noteFromBounds(total, bounds);
  return { parts, total, note, mention: mentionFor(note) };
}

// ---------------------------------------------------------------------------
// Tableaux (sommes, sous-totaux, pourcentages)
// ---------------------------------------------------------------------------

export function toNumber(v: unknown): number | null {
  const s = str(v).replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type TableResult = {
  /** Colonnes calculées par ligne (sommes `sumOf`, pourcentages `percentOf`) : rowId → colonne → valeur. */
  percents: Record<string, Record<string, number | null>>;
  totals: Record<string, number>;
  /** Sous-totaux par valeur de la colonne `groupBy` (ex. par mois, A2). */
  subtotals: Record<string, Record<string, number>>;
  /** Ligne « % » : total de chaque colonne rapporté au total de la colonne de référence. */
  columnPercents: Record<string, number | null>;
};

export function rowsOf(table: TableDef, values: FicheValues): TableRow[] {
  const v = values[table.id];
  const rows = Array.isArray(v) ? (v.filter((r) => typeof r === "object" && r !== null) as TableRow[]) : [];
  if (!table.fixedRows) return rows;
  const byId = new Map(rows.map((r) => [r._id, r]));
  return table.fixedRows.map((fr) => byId.get(fr.id) ?? ({ _id: fr.id } as TableRow));
}

export function computeTable(table: TableDef, values: FicheValues): TableResult {
  const rows = rowsOf(table, values);
  const percents: TableResult["percents"] = {};
  const totals: Record<string, number> = {};
  const subtotals: TableResult["subtotals"] = {};
  for (const row of rows) {
    const computed = (percents[row._id] ??= {});
    // Valeur effective d'une cellule : calculée si la colonne l'est, sinon saisie.
    const cell = (colId: string): number | null => (colId in computed ? computed[colId] : toNumber(row[colId]));
    for (const col of table.columns) {
      if (!col.sumOf) continue;
      const parts = col.sumOf.map((c) => toNumber(row[c]));
      computed[col.id] = parts.every((n) => n === null) ? null : parts.reduce<number>((s, n) => s + (n ?? 0), 0);
    }
    for (const col of table.columns) {
      if (!col.percentOf) continue;
      const num = cell(col.percentOf.num);
      const den = cell(col.percentOf.den);
      computed[col.id] = num !== null && den !== null && den > 0 ? roundHalfUp((num * 100) / den) : null;
    }
    for (const colId of table.sumColumns ?? []) {
      const n = cell(colId) ?? 0;
      totals[colId] = (totals[colId] ?? 0) + n;
      if (table.groupBy) {
        const g = str(row[table.groupBy]);
        if (g !== "") {
          const bucket = (subtotals[g] ??= {});
          bucket[colId] = (bucket[colId] ?? 0) + n;
        }
      }
    }
  }
  for (const colId of table.sumColumns ?? []) totals[colId] ??= 0;
  const columnPercents: TableResult["columnPercents"] = {};
  if (table.percentRow) {
    const ref = totals[table.percentRow.of] ?? 0;
    for (const colId of table.sumColumns ?? []) {
      columnPercents[colId] = ref > 0 ? roundHalfUp((totals[colId] * 100) / ref) : null;
    }
  }
  return { percents, totals, subtotals, columnPercents };
}

// ---------------------------------------------------------------------------
// Valeurs calculées déclaratives
// ---------------------------------------------------------------------------

/** Ajoute des jours à une date AAAA-MM-JJ (calendrier civil, sans fuseau). */
export function addDays(isoDate: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeDerived(c: ComputedDef, values: FicheValues): string | null {
  const f = c.formula;
  const from = str(values[f.from]);
  if (!from) return null;
  const days = f.daysIf && values[f.daysIf.field] === f.daysIf.equals ? f.daysIf.days : f.days;
  return addDays(from, days);
}

// ---------------------------------------------------------------------------
// Calcul complet d'une fiche
// ---------------------------------------------------------------------------

export type FicheComputed = {
  postes: Record<string, PosteResult>;
  tables: Record<string, TableResult>;
  derived: Record<string, string | null>;
  synthese: SyntheseResult | null;
};

export function computeFiche(def: FicheDef, values: FicheValues): FicheComputed {
  const postes: FicheComputed["postes"] = {};
  const tables: FicheComputed["tables"] = {};
  const derived: FicheComputed["derived"] = {};
  for (const { block } of visibleBlocks(def, values)) {
    if (block.kind === "rated") postes[block.id] = computePoste(block, values);
    else if (block.kind === "table") tables[block.id] = computeTable(block, values);
    else if (block.kind === "computed") derived[block.id] = computeDerived(block, values);
  }
  return { postes, tables, derived, synthese: computeSynthese(def, values, postes) };
}

// ---------------------------------------------------------------------------
// Numérotation des rapports [DOC module « Numérotation du rapport »]
// ---------------------------------------------------------------------------

/** Code de la province éducationnelle Nord-Kivu 1 (tableau 1 du module). */
export const PROVINCE_CODE = "61";

/** Initiales en capitales des nom, postnom et prénom (ex. « MUNANGI MPUNG Denis-Didier » → « MMDD »). */
export function initialsOf(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "")[0]?.toUpperCase() ?? "")
    .join("");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** « 61 / PP01 / KMD / C3.04 / 06 / 2026 » sans espaces : 61/PP01/KMD/C3.04/06/2026. */
export function formatReportNumber(p: {
  poolCode: string;
  initials: string;
  code: string;
  thematic: number;
  universal: number;
  year: number;
}): string {
  return [PROVINCE_CODE, p.poolCode, p.initials, `${p.code}.${pad2(p.thematic)}`, pad2(p.universal), String(p.year)].join("/");
}

/** Année scolaire (septembre à août) d'une date : « 2026-2027 ». */
export function schoolYearOf(d: Date): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}
