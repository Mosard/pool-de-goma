import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONVERSION_TABLES,
  addDays,
  computeFiche,
  computePoste,
  computeTable,
  formatReportNumber,
  initialsOf,
  mentionFor,
  noteFromPercent,
  noteFromTable,
  percentZ,
  schoolYearOf,
} from "@/lib/fiches/calculs";
import type { FicheDef, RatedPosteDef, TableDef } from "@/lib/fiches/types";

// Intervalles imprimés sur les fiches (notes 4 / 3 / 2 / 1 / 0), recopiés tels quels.
const PRINTED: Record<"C3" | "C2C_C3B", Record<number, string>> = {
  C3: {
    2: "8-7 | 6 | 5-4 | 3 | 2-0",
    3: "12-10 | 9 | 8-6 | 5 | 4-0",
    4: "16-13 | 12 | 11-8 | 7 | 6-0",
    5: "20-16 | 15-14 | 13-10 | 9-8 | 7-0",
    6: "24-20 | 19-17 | 16-12 | 11-10 | 9-0",
    7: "28-23 | 22-20 | 19-14 | 13-12 | 11-0",
    8: "32-26 | 25-23 | 22-16 | 15-13 | 12-0",
    9: "36-29 | 28-26 | 25-18 | 17-15 | 14-0",
    10: "40-32 | 31-28 | 27-20 | 19-16 | 15-0",
  },
  // Ligne 8 : « 25 – 2 » imprimé, lu 25–22.
  C2C_C3B: {
    2: "8-7 | 6 | 5-4 | 3 | 2-0",
    3: "12-10 | 9-8 | 7-6 | 5 | 4-0",
    4: "16-13 | 12-11 | 10-8 | 7-6 | 5-0",
    5: "20-16 | 15-14 | 13-10 | 9-8 | 7-0",
    6: "24-19 | 18-17 | 16-12 | 11-10 | 9-0",
    7: "28-22 | 21-20 | 19-14 | 13-11 | 10-0",
    8: "32-26 | 25-22 | 21-16 | 15-13 | 12-0",
    9: "36-29 | 28-26 | 25-18 | 17-15 | 14-0",
    10: "40-32 | 31-28 | 27-20 | 19-16 | 15-0",
  },
};

function expectedNote(printed: string, points: number): number {
  const cells = printed.split("|").map((c) => c.trim());
  for (let i = 0; i < cells.length; i++) {
    const [hi, lo = hi] = cells[i].split("-").map(Number);
    if (points <= hi && points >= lo) return 4 - i;
  }
  throw new Error(`${points} hors des intervalles ${printed}`);
}

for (const table of ["C3", "C2C_C3B"] as const) {
  test(`tableau ${table} : chaque total de chaque ligne donne la note imprimée`, () => {
    for (let rr = 2; rr <= 10; rr++) {
      assert.ok(CONVERSION_TABLES[table][rr], `ligne ${rr} présente`);
      for (let p = 0; p <= rr * 4; p++) {
        assert.equal(noteFromTable(table, rr, p), expectedNote(PRINTED[table][rr], p), `${table} ligne ${rr}, ${p} points`);
      }
    }
  });
}

test("les deux tableaux diffèrent bien (ex. C2 : total 8 à la ligne 3)", () => {
  assert.equal(noteFromTable("C3", 3, 8), 2);
  assert.equal(noteFromTable("C2C_C3B", 3, 8), 3);
});

test("Z = P × 100 / (Rr × 4) arrondi : exemple du module C2 (P = 28, Rr = 13 → 54 % → 2)", () => {
  assert.equal(percentZ(28, 13), 54);
  assert.equal(noteFromPercent(54), 2);
});

test("tableau général des % : bornes 100–80, 79–70, 69–50, 49–40, 39–0", () => {
  const cases: [number, number][] = [[100, 4], [80, 4], [79, 3], [70, 3], [69, 2], [50, 2], [49, 1], [40, 1], [39, 0], [0, 0]];
  for (const [z, note] of cases) assert.equal(noteFromPercent(z), note, `${z} %`);
});

test("arrondi à 0,5 vers le haut avant lecture (79,5 % → 80 % → 4)", () => {
  // 159 / (50 × 4) = 79,5 %
  assert.equal(percentZ(159, 50), 80);
  assert.equal(noteFromPercent(percentZ(159, 50)!), 4);
  assert.equal(percentZ(0, 0), null);
});

test("hors des lignes 2 à 10, conversion par le pourcentage", () => {
  assert.equal(noteFromTable("C3", 1, 4), 4);
  assert.equal(noteFromTable("C3", 1, 2), 2);
  // 15 rubriques, 45 points sur 60 = 75 % → 3
  assert.equal(noteFromTable("C2C_C3B", 15, 45), 3);
  assert.equal(noteFromTable("C3", 0, 0), null);
});

const posteTable: RatedPosteDef = {
  kind: "rated",
  id: "2.9",
  label: "Documents de l'enseignant",
  scale: "0-4",
  conversion: { method: "table", table: "C3" },
  items: Array.from({ length: 8 }, (_, i) => ({ id: `2.9.${i + 1}`, label: `r${i + 1}` })),
};

test("poste noté : « – » et « S.O. » exclus de P et de Rr ; exemple du module C3 (P = 21 pour 8 Rr → 2)", () => {
  const values = { "2.9.1": "3", "2.9.2": "3", "2.9.3": "3", "2.9.4": "3", "2.9.5": "3", "2.9.6": "2", "2.9.7": "2", "2.9.8": "2" };
  const r = computePoste(posteTable, values);
  assert.equal(r.points, 21);
  assert.equal(r.filled, 8);
  assert.equal(r.note, 2);

  const withNeutral = { ...values, "2.9.7": "-", "2.9.8": "SO" };
  const r2 = computePoste(posteTable, withNeutral);
  assert.equal(r2.points, 17);
  assert.equal(r2.filled, 6);
  assert.equal(r2.neutralized, 2);
  // Ligne 6 du tableau C3 : 17 → 3 (19–17)
  assert.equal(r2.note, 3);
});

test("poste noté : rubriques vides signalées, poste entièrement neutralisé non calculable", () => {
  const r = computePoste(posteTable, { "2.9.1": "4" });
  assert.deepEqual(r.missing, ["2.9.2", "2.9.3", "2.9.4", "2.9.5", "2.9.6", "2.9.7", "2.9.8"]);
  const allNeutral = Object.fromEntries(posteTable.items.map((i) => [i.id, "-"]));
  assert.equal(computePoste(posteTable, allNeutral).note, null);
});

test("poste en pourcentage (C2, C5A, C6B)", () => {
  const poste: RatedPosteDef = { ...posteTable, conversion: { method: "percent" } };
  const values = { "2.9.1": "4", "2.9.2": "4", "2.9.3": "3", "2.9.4": "3", "2.9.5": "2", "2.9.6": "2", "2.9.7": "1", "2.9.8": "1" };
  // 20 / 32 = 62,5 % → 63 % → 2
  const r = computePoste(poste, values);
  assert.equal(r.percent, 63);
  assert.equal(r.note, 2);
});

test("poste M à E (C2B) : compté, sans conversion", () => {
  const poste: RatedPosteDef = { kind: "rated", id: "2", label: "Tenue", scale: "M-E", conversion: null, items: [{ id: "2.1", label: "a" }, { id: "2.2", label: "b" }] };
  const r = computePoste(poste, { "2.1": "TB", "2.2": "-" });
  assert.equal(r.filled, 1);
  assert.equal(r.note, null);
});

const ficheSynthese: FicheDef = {
  format: 2,
  code: "TEST",
  version: 1,
  title: "Fiche de test",
  module: "C",
  scope: "visite",
  source: "test",
  levels: true,
  destinataires: [],
  header: [],
  sections: [
    {
      id: "s",
      title: "S",
      blocks: [
        { kind: "field", id: "type", label: "Type", type: "choice", options: ["CPP", "CPS"] },
        { kind: "rated", id: "a", label: "A", scale: "0-4", conversion: { method: "percent" }, items: [{ id: "a.1", label: "" }, { id: "a.2", label: "" }] },
        { kind: "rated", id: "b", label: "B", scale: "0-4", conversion: { method: "percent" }, items: [{ id: "b.1", label: "" }], showIf: { field: "type", equals: "CPP" } },
        { kind: "rated", id: "c", label: "C", scale: "0-4", conversion: { method: "percent" }, items: [{ id: "c.1", label: "" }], showIf: { field: "type", equals: "CPS" } },
      ],
    },
  ],
  synthese: {
    label: "Évaluation synthétique intermédiaire",
    parts: [
      { id: "p1", label: "A", source: "a" },
      { id: "p2", label: "B ou C", source: "b", sourceIf: [{ field: "type", equals: "CPS", source: "c" }] },
      { id: "p3", label: "Manuelle", source: "manuelle" },
    ],
    table: "C3",
    row: 3,
    finalLabel: "Appréciation finale",
  },
};

test("synthèse C2 / C5A : total des 3 notes converti à la ligne 3 du tableau de C3, avec mention", () => {
  // a : 8/8 = 100 % → 4 ; b : 2/4 = 50 % → 2 ; manuelle : 2 → total 8 → C3 ligne 3 : 8 → 2 (BON)
  const values = { type: "CPP", "a.1": "4", "a.2": "4", "b.1": "2", manuelle: "2" };
  const s = computeFiche(ficheSynthese, values).synthese!;
  assert.deepEqual(s.parts.map((p) => p.note), [4, 2, 2]);
  assert.equal(s.total, 8);
  assert.equal(s.note, 2);
  assert.equal(s.mention, "BON");
});

test("synthèse : la colonne choisie (CPS) remplace la colonne CPP ; une partie manquante bloque la note finale", () => {
  const values = { type: "CPS", "a.1": "4", "a.2": "4", "b.1": "0", "c.1": "4", manuelle: "4" };
  const fiche = computeFiche(ficheSynthese, values);
  assert.equal(fiche.postes.b, undefined, "poste masqué non calculé");
  assert.equal(fiche.synthese!.total, 12);
  assert.equal(fiche.synthese!.mention, "ELITE");
  assert.equal(computeFiche(ficheSynthese, { type: "CPS", "a.1": "4" }).synthese!.note, null);
});

test("mentions des notes 0 à 4", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(mentionFor), ["MEDIOCRE", "ASSEZ BON", "BON", "TRES BON", "ELITE"]);
  assert.equal(mentionFor(null), null);
});

test("tableaux : pourcentage R × 100 / P (exemple A3 : 30 réalisés sur 35 prévus → 86), totaux et sous-totaux", () => {
  const table: TableDef = {
    kind: "table",
    id: "t",
    label: "",
    columns: [
      { id: "mois", label: "Mois", type: "text" },
      { id: "p", label: "P", type: "number" },
      { id: "r", label: "R", type: "number" },
      { id: "pct", label: "%", type: "number", percentOf: { num: "r", den: "p" } },
    ],
    sumColumns: ["p", "r"],
    groupBy: "mois",
  };
  const res = computeTable(table, {
    t: [
      { _id: "1", mois: "Octobre", p: "35", r: "30" },
      { _id: "2", mois: "Octobre", p: "5", r: "" },
      { _id: "3", mois: "Novembre", p: "0", r: "2" },
    ],
  });
  assert.equal(res.percents["1"].pct, 86);
  assert.equal(res.percents["2"].pct, null);
  assert.equal(res.percents["3"].pct, null, "pas de division par zéro");
  assert.deepEqual(res.totals, { p: 40, r: 32 });
  assert.deepEqual(res.subtotals, { Octobre: { p: 40, r: 30 }, Novembre: { p: 0, r: 2 } });
});

test("tableaux à lignes imprimées : lignes manquantes créées vides", () => {
  const table: TableDef = { kind: "table", id: "t", label: "", columns: [{ id: "n", label: "N", type: "number" }], fixedRows: [{ id: "C1", label: "C1" }, { id: "C2", label: "C2" }], sumColumns: ["n"] };
  assert.deepEqual(computeTable(table, { t: [{ _id: "C2", n: "3" }] }).totals, { n: 3 });
});

test("A12 : délai de justification de 20 jours, 30 hors de la localité [module § A12]", () => {
  assert.equal(addDays("2026-10-07", 20), "2026-10-27");
  assert.equal(addDays("2026-12-20", 30), "2027-01-19");
  assert.equal(addDays("07/10/2026", 20), null);
});

test("numérotation à double entrée : 61/PP01/KMD/C3.04/06/2026", () => {
  assert.equal(formatReportNumber({ poolCode: "PP01", initials: "KMD", code: "C3", thematic: 4, universal: 6, year: 2026 }), "61/PP01/KMD/C3.04/06/2026");
  assert.equal(formatReportNumber({ poolCode: "PS03", initials: "AB", code: "C2B", thematic: 12, universal: 123, year: 2027 }), "61/PS03/AB/C2B.12/123/2027");
});

test("initiales du nom complet (exemple du module : MUNANGI MPUNG Denis-Didier → MMDD)", () => {
  assert.equal(initialsOf("MUNANGI", "MPUNG", "Denis-Didier"), "MMDD");
  assert.equal(initialsOf("Kasongo Mulamba", null, "Élodie"), "KME");
});

test("année scolaire : septembre à août", () => {
  assert.equal(schoolYearOf(new Date(2026, 8, 1)), "2026-2027");
  assert.equal(schoolYearOf(new Date(2027, 7, 31)), "2026-2027");
});

test("A4 bilan : somme en ligne des trimestres puis % du bilan (sumOf avant percentOf)", () => {
  const table: TableDef = {
    kind: "table",
    id: "m",
    label: "",
    columns: [
      { id: "t1p", label: "", type: "number" },
      { id: "t1r", label: "", type: "number" },
      { id: "t2p", label: "", type: "number" },
      { id: "t2r", label: "", type: "number" },
      { id: "bp", label: "", type: "number", sumOf: ["t1p", "t2p"] },
      { id: "br", label: "", type: "number", sumOf: ["t1r", "t2r"] },
      { id: "bpct", label: "", type: "number", percentOf: { num: "br", den: "bp" } },
    ],
    fixedRows: [{ id: "M1", label: "MODULE 1" }, { id: "M2", label: "MODULE 2" }],
    sumColumns: ["bp", "br"],
  };
  const res = computeTable(table, { m: [{ _id: "M1", t1p: "10", t1r: "8", t2p: "10", t2r: "9" }] });
  assert.equal(res.percents.M1.bp, 20);
  assert.equal(res.percents.M1.br, 17);
  assert.equal(res.percents.M1.bpct, 85);
  assert.equal(res.percents.M2.bp, null, "ligne vide : pas de total");
  assert.deepEqual(res.totals, { bp: 20, br: 17 });
});

test("synoptique de la notation : ligne % = total de colonne × 100 / total général (balance carrée)", () => {
  const table: TableDef = {
    kind: "table",
    id: "n",
    label: "",
    columns: [
      { id: "n4", label: "4", type: "number" },
      { id: "n3", label: "3", type: "number" },
      { id: "tot", label: "TOTAUX", type: "number", sumOf: ["n4", "n3"] },
    ],
    fixedRows: [{ id: "C2", label: "C2" }, { id: "C3q", label: "C3" }],
    sumColumns: ["n4", "n3", "tot"],
    percentRow: { of: "tot" },
  };
  const res = computeTable(table, { n: [{ _id: "C2", n4: "1", n3: "2" }, { _id: "C3q", n4: "0", n3: "5" }] });
  assert.deepEqual(res.totals, { n4: 1, n3: 7, tot: 8 });
  assert.deepEqual(res.columnPercents, { n4: 13, n3: 88, tot: 100 });
});
