// Règles du rapport de synthèse : périmètre, sélection des rapports, circuit
// (renvoi pour correction et resoumission par l'auteur seul), numérotation et
// format. Droits repris de la configuration réelle (ROLE_PERMISSIONS du seed).
// Vérification sur base (écritures, audit) : prisma/scripts/verify-synthese-flow.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS as W, type RoleKey } from "@/lib/rbac-data";
import type { SessionPermission, SessionRole } from "@/lib/permission-checks";
import {
  auditActionFor,
  authorScopes,
  availableTransitions,
  canAuthorIn,
  canEdit,
  canIncludeReport,
  canRead,
  canReturn,
  canValidate,
  findTransition,
  formatSynthesisNumber,
  synthesisReference,
  type Actor,
  type SynthesisMeta,
} from "@/lib/synthese/rules";
import { missingSections, sanitizeContent } from "@/lib/synthese/format";

const ORG = "org";
const A = "pool-a";
const B = "pool-b";

function actor(id: string, ...grants: { role: RoleKey; poolId?: string | null }[]): Actor {
  const roles: SessionRole[] = [];
  const permissions: SessionPermission[] = [];
  for (const g of grants) {
    const poolId = g.poolId ?? null;
    roles.push({ key: g.role, label: g.role, poolId });
    for (const k of ROLE_PERMISSIONS[g.role]) permissions.push({ permissionKey: k, poolId, organizationId: ORG });
  }
  return { id, organizationId: ORG, roles, permissions };
}

const exploitA = actor("exploitA", { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: A });
const chefA = actor("chefA", { role: ROLE_KEYS.CHEF_POOL, poolId: A });
const exploitB = actor("exploitB", { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: B });
const exploitIpp = actor("exploitIpp", { role: ROLE_KEYS.EXPLOITANT_IPP });
const exploitIpp2 = actor("exploitIpp2", { role: ROLE_KEYS.EXPLOITANT_IPP });
const agentIpp = actor("agentIpp", { role: ROLE_KEYS.AGENT_IPP });
const ipp = actor("ipp", { role: ROLE_KEYS.IPP });
const ipa = actor("ipa", { role: ROLE_KEYS.IPA });
const superAdmin = actor("sa", { role: ROLE_KEYS.SUPER_ADMIN });
const inspA = actor("inspA", { role: ROLE_KEYS.INSPECTEUR, poolId: A });
const informaticien = actor("info", { role: ROLE_KEYS.INFORMATICIEN });

const poolSynth = (status: SynthesisMeta["status"]): SynthesisMeta => ({ authorId: "exploitA", organizationId: ORG, poolId: A, status });
const provSynth = (status: SynthesisMeta["status"]): SynthesisMeta => ({ authorId: "exploitIpp", organizationId: ORG, poolId: null, status });
const report = (poolId: string, statusKey: string, isDemo = false) => ({ poolId, organizationId: ORG, statusKey, isDemo });

test("Rédaction : exploitant et chef de POOL dans leur POOL, exploitant IPP partout ; pas l'inspecteur ni l'informaticien", () => {
  assert.ok(canAuthorIn(exploitA, A, ORG));
  assert.equal(canAuthorIn(exploitA, B, ORG), false);
  assert.equal(canAuthorIn(exploitA, null, ORG), false, "pas de synthèse provinciale pour un exploitant de POOL");
  assert.ok(canAuthorIn(chefA, A, ORG), "Q6 : le chef de POOL rédige");
  assert.ok(canAuthorIn(exploitIpp, null, ORG) && canAuthorIn(exploitIpp, B, ORG));
  assert.deepEqual(authorScopes(exploitIpp), { provincial: true, poolIds: [] });
  assert.equal(canAuthorIn(inspA, A, ORG), false);
  assert.equal(canAuthorIn(informaticien, null, ORG), false);
  assert.equal(canAuthorIn(ipp, null, ORG), false, "l'IPP valide, il ne rédige pas");
  assert.equal(canAuthorIn(exploitA, A, "autre-org"), false);
});

test("Sélection : rapports exploités de son périmètre seulement", () => {
  const s = { organizationId: ORG, poolId: A, isDemo: false };
  assert.ok(canIncludeReport(exploitA, s, report(A, W.EN_EXPLOITATION)));
  assert.ok(canIncludeReport(exploitA, s, report(A, W.VALIDE)));
  assert.equal(canIncludeReport(exploitA, s, report(B, W.EN_EXPLOITATION)), false, "hors de son POOL");
  for (const k of [W.BROUILLON, W.SOUMIS, W.RECU, W.A_CORRIGER, W.REJETE]) {
    assert.equal(canIncludeReport(exploitA, s, report(A, k)), false, `exploitation non commencée : ${k}`);
  }
  assert.equal(canIncludeReport(exploitA, s, report(A, W.TRANSMIS, true)), false, "rapport de démonstration dans une synthèse officielle");
  assert.equal(canIncludeReport(exploitA, s, { ...report(A, W.TRANSMIS), organizationId: "autre-org" }), false);
  // Synthèse provinciale : tous les POOL pour l'exploitant IPP ; jamais pour un exploitant de POOL (synthèse forgée).
  const prov = { organizationId: ORG, poolId: null, isDemo: false };
  assert.ok(canIncludeReport(exploitIpp, prov, report(B, W.TRANSMIS)));
  assert.equal(canIncludeReport(exploitA, prov, report(B, W.TRANSMIS)), false);
});

test("Lecture : brouillon privé à l'auteur ; synthèse de POOL lue par le POOL et la province ; provinciale par IPP, IPA, Super Admin", () => {
  assert.ok(canRead(exploitA, poolSynth("BROUILLON")));
  assert.equal(canRead(chefA, poolSynth("BROUILLON")), false);
  assert.equal(canRead(ipp, poolSynth("BROUILLON")), false);
  for (const a of [chefA, exploitIpp, agentIpp, ipp, ipa, superAdmin]) assert.ok(canRead(a, poolSynth("SOUMIS")), a.id);
  for (const a of [exploitB, inspA, informaticien]) assert.equal(canRead(a, poolSynth("SOUMIS")), false, a.id);
  for (const a of [ipp, ipa, superAdmin, exploitIpp]) assert.ok(canRead(a, provSynth("SOUMIS")), a.id);
  for (const a of [exploitIpp2, agentIpp, chefA, exploitA]) assert.equal(canRead(a, provSynth("SOUMIS")), false, a.id);
});

test("Modification : l'auteur seul, en brouillon ou à corriger", () => {
  assert.ok(canEdit(exploitA, poolSynth("BROUILLON")));
  assert.ok(canEdit(exploitA, poolSynth("A_CORRIGER")));
  assert.equal(canEdit(exploitA, poolSynth("SOUMIS")), false);
  assert.equal(canEdit(exploitA, poolSynth("VALIDE")), false);
  assert.equal(canEdit(chefA, poolSynth("BROUILLON")), false, "un autre rédacteur du même POOL");
  assert.equal(canEdit(ipp, poolSynth("A_CORRIGER")), false);
});

test("Circuit complet : soumettre, renvoyer avec motif, resoumettre par l'auteur seul, valider par IPP ou IPA", () => {
  assert.deepEqual(
    availableTransitions(exploitA, poolSynth("BROUILLON")).map((t) => t.to),
    ["SOUMIS"]
  );
  assert.deepEqual(
    availableTransitions(chefA, poolSynth("BROUILLON")).map((t) => t.to),
    []
  );

  // Renvoi : tout reports.review_province (Q2), jamais l'auteur.
  for (const a of [exploitIpp, agentIpp, ipp, ipa, superAdmin]) assert.ok(canReturn(a, poolSynth("SOUMIS")), a.id);
  for (const a of [exploitA, chefA, exploitB]) assert.equal(canReturn(a, poolSynth("SOUMIS")), false, a.id);
  assert.equal(findTransition("SOUMIS", "A_CORRIGER")?.commentRequired, true);

  // Resoumission : l'auteur seul.
  assert.deepEqual(
    availableTransitions(exploitA, poolSynth("A_CORRIGER")).map((t) => [t.to, t.label]),
    [["SOUMIS", "Resoumettre"]]
  );
  for (const a of [chefA, ipp, exploitIpp]) assert.equal(availableTransitions(a, poolSynth("A_CORRIGER")).length, 0, a.id);

  // Validation : IPP, IPA, Super Admin (Q3) ; pas l'exploitant IPP ni l'agent IPP.
  for (const a of [ipp, ipa, superAdmin]) assert.ok(canValidate(a, poolSynth("SOUMIS")), a.id);
  for (const a of [exploitIpp, agentIpp, exploitA]) assert.equal(canValidate(a, poolSynth("SOUMIS")), false, a.id);
  assert.equal(canValidate(ipp, poolSynth("BROUILLON")), false);
  assert.equal(availableTransitions(ipp, poolSynth("VALIDE")).length, 0, "validée : fin du circuit");

  assert.equal(findTransition("BROUILLON", "VALIDE"), null);
  assert.equal(findTransition("VALIDE", "A_CORRIGER"), null);
});

test("Synthèse provinciale (exploitant IPP) : renvoi et validation par IPP, IPA, Super Admin seulement (Q4)", () => {
  for (const a of [ipp, ipa, superAdmin]) {
    assert.ok(canReturn(a, provSynth("SOUMIS")), a.id);
    assert.ok(canValidate(a, provSynth("SOUMIS")), a.id);
  }
  for (const a of [exploitIpp, exploitIpp2, agentIpp]) assert.equal(canReturn(a, provSynth("SOUMIS")), false, a.id);
});

test("Audit : une action par étape", () => {
  assert.equal(auditActionFor("BROUILLON", "SOUMIS"), "synthesis.submit");
  assert.equal(auditActionFor("SOUMIS", "A_CORRIGER"), "synthesis.return");
  assert.equal(auditActionFor("A_CORRIGER", "SOUMIS"), "synthesis.resubmit");
  assert.equal(auditActionFor("SOUMIS", "VALIDE"), "synthesis.validate");
});

test("Numéro officiel et versions (Q7)", () => {
  assert.equal(formatSynthesisNumber({ scope: "GOMA", seq: 4, year: 2026 }), "61/GOMA/SYN.004/2026");
  assert.equal(formatSynthesisNumber({ scope: "IPP", seq: 12, year: 2026 }), "61/IPP/SYN.012/2026");
  assert.equal(synthesisReference("61/GOMA/SYN.004/2026", 2), "61/GOMA/SYN.004/2026-V2");
  assert.equal(synthesisReference(null, 0), null);
});

test("Partie rédigée : texte borné, sections inconnues ignorées, sections obligatoires contrôlées", () => {
  const c = sanitizeContent(1, { analyse: "  Analyse  ", constats: 42, inconnue: "x", conclusion: "a".repeat(30_000) });
  assert.equal(c.sections.analyse, "Analyse");
  assert.equal(c.sections.constats, "");
  assert.equal("inconnue" in c.sections, false);
  assert.equal(c.sections.conclusion.length, 20_000);
  assert.deepEqual(
    missingSections(1, c).map((s) => s.key),
    ["constats"]
  );
});
