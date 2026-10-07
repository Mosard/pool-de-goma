import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFICIAL_FICHES, commonHeaderFields, getFicheDef, resolveFicheDef } from "@/lib/fiches/defs/index";
import { computeFiche, visibleBlocks } from "@/lib/fiches/calculs";
import { isForbiddenAnswer, validateFiche } from "@/lib/fiches/validation";
import type { Block, FicheData, FicheDef, FicheValues, RatedPosteDef } from "@/lib/fiches/types";

function allBlocks(def: FicheDef): Block[] {
  return def.sections.flatMap((s) => s.blocks);
}
function ratedPostes(def: FicheDef): RatedPosteDef[] {
  return allBlocks(def).filter((b): b is RatedPosteDef => b.kind === "rated");
}

test("les 16 fiches du dossier sont enregistrées, une seule par (code, version)", () => {
  assert.deepEqual(
    OFFICIAL_FICHES.map((d) => d.code).sort(),
    ["A11", "A12", "A2", "A3", "A4", "A5", "A6", "C1", "C2", "C2B", "C2C", "C3", "C3B", "C5A", "C6B", "F1"]
  );
  const keys = OFFICIAL_FICHES.map((d) => `${d.code}@${d.version}`);
  assert.equal(new Set(keys).size, keys.length);
  // F1 officiel = version 2 (la version 1 est la fiche simulée, décision Q7).
  assert.equal(getFicheDef("F1", 2)?.title, "ACTION DE FORMATION");
  assert.equal(getFicheDef("F1", 1), null);
});

for (const def of OFFICIAL_FICHES) {
  test(`${def.code} : identifiants uniques et références valides`, () => {
    const ids: string[] = [...commonHeaderFields(def), ...def.header].map((f) => f.id);
    for (const b of allBlocks(def)) {
      if (b.kind === "text") continue;
      ids.push(b.id);
      if (b.kind === "rated") ids.push(...b.items.map((i) => i.id));
    }
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dup, [], `identifiants en double : ${dup.join(", ")}`);

    const known = new Set(ids);
    for (const p of def.synthese?.parts ?? []) {
      assert.ok(known.has(p.source), `synthèse ${p.id} : source ${p.source} inconnue`);
      for (const alt of p.sourceIf ?? []) assert.ok(known.has(alt.source), `synthèse ${p.id} : source ${alt.source} inconnue`);
    }
    for (const c of def.checks ?? []) {
      if (c.type === "lte") assert.ok(known.has(c.a) && known.has(c.b));
      if (c.type === "includesIf") assert.ok(known.has(c.field) && known.has(c.when.field));
      if (c.type === "totalsEqual") assert.ok(known.has(c.a.table) && known.has(c.b.table));
    }
    if (def.instanceLabel) assert.ok(known.has(def.instanceLabel), `instanceLabel ${def.instanceLabel} inconnu`);
  });
}

test("C2 : 13 + 37 + 67 rubriques, comme sur la fiche", () => {
  const c2 = getFicheDef("C2", 1)!;
  assert.deepEqual(ratedPostes(c2).map((p) => [p.id, p.items.length]), [["2.2", 13], ["3.2", 37], ["4.1", 67]]);
});

test("C3 : 10 postes ; « 2.8.6 » imprimé deux fois conservé ; 2.11.10 reprend le poste 2.10", () => {
  const c3 = getFicheDef("C3", 1)!;
  assert.deepEqual(ratedPostes(c3).map((p) => p.items.length), [8, 5, 5, 8, 7, 5, 5, 7, 8, 6]);
  const strat = ratedPostes(c3).find((p) => p.id === "2.8")!;
  assert.equal(strat.items[6].num, "2.8.6");
  assert.equal(c3.synthese!.parts[9].source, "2.10");
});

test("C5A : la colonne choisie détermine les postes affichés et la synthèse", () => {
  const c5a = getFicheDef("C5A", 1)!;
  const cps = "2. CONSEILLER PEDAGOGIQUE DU SECONDAIRE";
  const ids = visibleBlocks(c5a, { typeAdjoint: cps }).filter(({ block }) => block.kind === "rated").map(({ block }) => (block as RatedPosteDef).id);
  assert.deepEqual(ids, ["2.1", "2.2", "2.3"]);
});

test("C3 complète : note finale calculée à la ligne 10 du tableau de C3", () => {
  const c3 = getFicheDef("C3", 1)!;
  const values: FicheValues = {};
  // Toutes les rubriques à 3 : chaque poste → 3 ; total 30 → ligne 10 (31–28 → 3).
  for (const p of ratedPostes(c3)) for (const i of p.items) values[i.id] = "3";
  const s = computeFiche(c3, values).synthese!;
  assert.deepEqual(s.parts.map((x) => x.note), Array(10).fill(3));
  assert.equal(s.total, 30);
  assert.equal(s.mention, "TRES BON");
});

test("C6B : chaque chapitre est converti séparément, sans synthèse", () => {
  const c6b = getFicheDef("C6B", 1)!;
  const values: FicheValues = { "5.1.1": "4", "5.1.2": "4", "5.1.3": "2" };
  const r = computeFiche(c6b, values);
  assert.equal(r.postes["5.1"].percent, 83);
  assert.equal(r.postes["5.1"].note, 4);
  assert.equal(r.synthese, null);
});

test("A12 : délai de justification calculé (30 jours hors de la localité)", () => {
  const a12 = getFicheDef("A12", 1)!;
  assert.equal(computeFiche(a12, { "ouverture.date": "2026-10-07", "ouverture.memeLocalite": "Non" }).derived.delai, "2026-11-06");
  assert.equal(computeFiche(a12, { "ouverture.date": "2026-10-07", "ouverture.memeLocalite": "Oui" }).derived.delai, "2026-10-27");
});

test("resolveFicheDef : registre en priorité, instantané JSON sinon, null pour l'ancien format", () => {
  const c1 = getFicheDef("C1", 1)!;
  assert.equal(resolveFicheDef({ code: "C1", version: 1, fieldsSchema: {} }), c1);
  const snapshot = JSON.parse(JSON.stringify({ ...c1, code: "ZZ", version: 9 }));
  assert.equal(resolveFicheDef({ code: "ZZ", version: 9, fieldsSchema: snapshot })?.code, "ZZ");
  assert.equal(resolveFicheDef({ code: "A1", version: 1, fieldsSchema: [{ name: "x", label: "x", type: "text" }] }), null);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SIG = { name: "Nom", image: "data:image/png;base64,AAAA", signedAt: "2026-10-07T10:00:00Z" };

function header(def: FicheDef): FicheValues {
  return {
    "entete.inspecteur": "Inspecteur Test",
    "entete.niveauDiscipline": "Primaire",
    "entete.posteAttache": "Pool",
    "entete.anneeScolaire": "2026-2027",
    ...(def.levels ? { "entete.niveau": "P" } : {}),
  };
}

test("RAS, rien, absent, néant refusés comme seule réponse, pas dans une phrase", () => {
  for (const w of ["RAS", "r.a.s.", "Rien", " néant ", "ABSENT"]) assert.ok(isForbiddenAnswer(w), w);
  assert.ok(!isForbiddenAnswer("Enseignant absent sans justification"));
  assert.ok(!isForbiddenAnswer("-"));
});

test("C1 : rubriques non traitées et réponses interdites bloquent la soumission", () => {
  const c1 = getFicheDef("C1", 1)!;
  const values: FicheValues = { ...header(c1), "entete.etablissement": "EP Test", "II.rapportCirconstancie": "Non" };
  for (let i = 1; i <= 10; i++) {
    values[`I.${i}.constats`] = "-";
    values[`I.${i}.solutions`] = "-";
  }
  values["I.1.constats"] = "RAS";
  const data: FicheData = { format: 2, values, signatures: { "sig.ce": SIG, "sig.inspecteur": SIG } };
  const errors = validateFiche(c1, data).filter((i) => i.level === "error");
  assert.deepEqual(errors.map((e) => e.id), ["I.1.constats"]);

  values["I.1.constats"] = "Clôture absente côté route";
  assert.deepEqual(validateFiche(c1, data).filter((i) => i.level === "error"), []);
  delete values["I.2.solutions"];
  assert.ok(validateFiche(c1, data).some((i) => i.id === "I.2.solutions"));
});

test("signatures : manquante, ou refus sans deux témoins, bloque ; refus avec deux témoins accepté", () => {
  const c1 = getFicheDef("C1", 1)!;
  const values: FicheValues = { ...header(c1), "entete.etablissement": "EP", "II.rapportCirconstancie": "Non" };
  for (let i = 1; i <= 10; i++) values[`I.${i}.constats`] = values[`I.${i}.solutions`] = "-";
  const data: FicheData = { format: 2, values, signatures: { "sig.inspecteur": SIG } };
  assert.ok(validateFiche(c1, data).some((i) => i.id === "sig.ce"));
  data.signatures["sig.ce"] = { name: "CE", refused: true, witnesses: [{ name: "T1", image: "x" }], signedAt: "" };
  assert.ok(validateFiche(c1, data).some((i) => i.id === "sig.ce"));
  data.signatures["sig.ce"].witnesses!.push({ name: "T2", image: "y" });
  assert.ok(!validateFiche(c1, data).some((i) => i.id === "sig.ce"));
});

test("C3 : note < 2 sans observation = avertissement ; présents > inscrits = erreur", () => {
  const c3 = getFicheDef("C3", 1)!;
  const values: FicheValues = { ...header(c3), "1.presents": "40", "1.inscrits": "35", "2.1.1": "1" };
  const issues = validateFiche(c3, { format: 2, values, signatures: {} });
  assert.ok(issues.some((i) => i.id === "2.1.1#obs" && i.level === "warning"));
  assert.ok(issues.some((i) => i.id === "1.presents" && i.level === "error"));
  assert.ok(issues.some((i) => i.id === "2.1.2" && i.level === "error"), "rubrique vide signalée");
});

test("A5 : constat d'absence du CE adressé au chef de sous-division", () => {
  const a5 = getFicheDef("A5", 1)!;
  const values: FicheValues = { typeAbsent: "D'UN CHEF D'ETABLISSEMENT", "4.destinataires": ["Au Chef d'Etablissement"] };
  assert.ok(validateFiche(a5, { format: 2, values, signatures: {} }).some((i) => i.id === "4.destinataires" && i.level === "error"));
  values["4.destinataires"] = ["Au Chef de Sous-Division"];
  assert.ok(!validateFiche(a5, { format: 2, values, signatures: {} }).some((i) => i.id === "4.destinataires"));
});

test("A3 : jours du tableau analytique = jours réalisés du tableau statistique", () => {
  const a3 = getFicheDef("A3", 1)!;
  const values: FicheValues = {
    "2": [{ _id: "C1", joursR: "3" }, { _id: "C3", joursR: "6" }],
    "3": [{ _id: "r1", jours: "3" }, { _id: "r2", jours: "5" }],
  };
  const issue = validateFiche(a3, { format: 2, values, signatures: {} }).find((i) => i.id === "3");
  assert.ok(issue && issue.message.includes("8 ≠ 9"));
});

test("champs réservés à un autre service (A5, A6) jamais exigés de l'auteur", () => {
  const a6 = getFicheDef("A6", 1)!;
  const issues = validateFiche(a6, { format: 2, values: header(a6), signatures: { "sig.inspecteur": SIG } });
  assert.deepEqual(issues.filter((i) => i.level === "error"), []);
});
