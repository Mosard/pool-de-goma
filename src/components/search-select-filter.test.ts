// Scénario G : recherche au clavier dans une liste importante. Noms fictifs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { filterOptions, normalizeSearch } from "./search-select-filter";

const agents = Array.from({ length: 400 }, (_, i) => ({ value: `u${i}`, label: `Agent Numéro${i} Fictif`, hint: i % 2 ? "POOL Exemple" : undefined }));
agents.push({ value: "u-x", label: "Élodie Kambéré Exemple", hint: "Cellule IPAF" });

test("Sans accents ni majuscules, mots dans n'importe quel ordre", () => {
  assert.equal(normalizeSearch("  Élodie   KAMBÉRÉ "), "elodie kambere");
  assert.deepEqual(filterOptions(agents, "kambere elo").map((o) => o.value), ["u-x"]);
  assert.deepEqual(filterOptions(agents, "ipaf").map((o) => o.value), ["u-x"]);
});

test("Recherche vide : toute la liste ; aucune correspondance : liste vide", () => {
  assert.equal(filterOptions(agents, "").length, agents.length);
  assert.deepEqual(filterOptions(agents, "introuvable"), []);
});

test("Une liste de 400 entrées se réduit à la bonne personne", () => {
  assert.deepEqual(filterOptions(agents, "numéro123 ").map((o) => o.value), ["u123"]);
});
