// Recherche publique des diplômes : critères provisoires, confidentialité,
// règle « rattachement ≠ localisation », absence de source en production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { diplomaYears, normalizeName, parseDiplomaCriteria, FIRST_DIPLOMA_YEAR } from "./criteria";
import { isDiplomaSearchAvailable, outcomeFromMatches, searchDiplomas, toPublicStatus } from "./search";
import { isStatePreviewAllowed, PREVIEW_STATES } from "./apercu";
import type { DiplomaSearchCriteria, DiplomaSourceMatch } from "./types";

const criteria: DiplomaSearchCriteria = {
  nom: "Exemple",
  postNom: null,
  prenom: "Test",
  annee: 2020,
  etablissement: "Établissement fictif",
};

test("un nom seul ne suffit jamais", () => {
  const r = parseDiplomaCriteria({ nom: "Kambale" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["annee", "etablissement", "prenom"]);
});

test("critères complets acceptés, post-nom facultatif", () => {
  const r = parseDiplomaCriteria({ nom: " Exemple ", postNom: "", prenom: "Test", annee: "2020", etablissement: "Institut fictif" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.criteria, { nom: "Exemple", postNom: null, prenom: "Test", annee: 2020, etablissement: "Institut fictif" });
});

test("année hors bornes et caractères invalides refusés", () => {
  const year = new Date().getFullYear();
  for (const annee of [String(FIRST_DIPLOMA_YEAR - 1), String(year + 1), "abc"]) {
    const r = parseDiplomaCriteria({ ...criteria, annee });
    assert.equal(r.ok, false, annee);
  }
  assert.equal(parseDiplomaCriteria({ ...criteria, nom: "<script>" }).ok, false);
  assert.equal(diplomaYears()[0], year);
  assert.equal(diplomaYears().at(-1), FIRST_DIPLOMA_YEAR);
});

test("normalisation des noms pour une correspondance exacte", () => {
  assert.equal(normalizeName("  Mukéndi-wa  Ngoyi "), "MUKENDI WA NGOYI");
  assert.equal(normalizeName("Institut d'Àrt"), "INSTITUT D ART");
});

test("RÈGLE : le POOL de rattachement ne détermine jamais la disponibilité", () => {
  const match: DiplomaSourceMatch = { homePoolName: "Goma", currentLocation: { kind: "IPP" } };
  assert.deepEqual(toPublicStatus(match), { status: "DISPONIBLE_IPP" });

  const enTransfert: DiplomaSourceMatch = { homePoolName: "Goma", currentLocation: { kind: "EN_TRANSFERT" } };
  assert.deepEqual(toPublicStatus(enTransfert), { status: "EN_TRANSFERT" });

  const office = { name: "Nyiragongo", address: null, officialEmail: null, pickupInstructions: null };
  const auPool: DiplomaSourceMatch = { homePoolName: "Goma", currentLocation: { kind: "POOL", office } };
  assert.deepEqual(toPublicStatus(auPool), { status: "DISPONIBLE_POOL", pool: office });
  assert.ok(!JSON.stringify(toPublicStatus(auPool)).includes("Goma"));
});

test("homonymes : aucun détail divulgué", () => {
  const m: DiplomaSourceMatch = { homePoolName: null, currentLocation: { kind: "IPP" } };
  assert.deepEqual(outcomeFromMatches([m, m]), { kind: "PLUSIEURS_CORRESPONDANCES" });
  assert.deepEqual(outcomeFromMatches([]), { kind: "AUCUN_RESULTAT" });
  assert.deepEqual(outcomeFromMatches([m]), { kind: "TROUVE", result: { status: "DISPONIBLE_IPP" } });
});

test("aucune source connectée : service indisponible, jamais de résultat simulé", async () => {
  assert.equal(isDiplomaSearchAvailable(), false);
  assert.deepEqual(await searchDiplomas(criteria), { kind: "SERVICE_INDISPONIBLE" });
});

test("une source en erreur donne un état d'erreur", async () => {
  const failing = { find: async () => Promise.reject(new Error("panne")) };
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await searchDiplomas(criteria, failing), { kind: "ERREUR" });
  } finally {
    console.error = original;
  }
});

test("aperçu des états : jamais en production", () => {
  const saved = { vercel: process.env.VERCEL_ENV, node: process.env.NODE_ENV };
  const env = process.env as Record<string, string | undefined>;
  try {
    env.VERCEL_ENV = "production";
    assert.equal(isStatePreviewAllowed(), false);
    env.VERCEL_ENV = "preview";
    assert.equal(isStatePreviewAllowed(), true);
    delete env.VERCEL_ENV;
    env.NODE_ENV = "production";
    assert.equal(isStatePreviewAllowed(), false);
    env.NODE_ENV = "development";
    assert.equal(isStatePreviewAllowed(), true);
  } finally {
    if (saved.vercel === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = saved.vercel;
    env.NODE_ENV = saved.node;
  }
});

test("les exemples d'aperçu sont manifestement fictifs et couvrent tous les états", () => {
  const kinds = new Set<string>(PREVIEW_STATES.map((s) => (s.outcome.kind === "TROUVE" ? s.outcome.result.status : s.outcome.kind)));
  for (const k of [
    "DISPONIBLE_IPP",
    "DISPONIBLE_POOL",
    "EN_TRANSFERT",
    "RETIRE",
    "RETRAIT_A_CONFIRMER",
    "AUCUN_RESULTAT",
    "PLUSIEURS_CORRESPONDANCES",
    "SERVICE_INDISPONIBLE",
  ]) {
    assert.ok(kinds.has(k), k);
  }
  const pool = PREVIEW_STATES.find((s) => s.key === "pool")!.outcome;
  assert.ok(JSON.stringify(pool).includes(".invalid"));
});
