// Règles du rapport de synthèse : périmètre (POOL, cellule de l'IPP), sélection
// des rapports, circuit (renvoi pour correction et resoumission par l'auteur
// seul, validation au POOL, signature de l'IPA pour une cellule), numérotation
// et format. Droits repris de la configuration réelle (ROLE_PERMISSIONS du
// seed), rattachés comme en base (bindRolePermissions).
// Vérification sur base (écritures, audit) : prisma/scripts/verify-synthese-flow.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS as W, type RoleKey } from "@/lib/rbac-data";
import type { SessionPermission, SessionRole } from "@/lib/permission-checks";
import { bindRolePermissions } from "@/lib/cells/rules";
import {
  auditActionFor,
  authorScopes,
  availableTransitions,
  canAuthorIn,
  canAuthorInCell,
  canEdit,
  canIncludeReport,
  canRead,
  canReturn,
  canSign,
  canValidate,
  findTransition,
  formatSynthesisNumber,
  numberScopeCode,
  synthesisReference,
  type Actor,
  type SynthesisMeta,
} from "@/lib/synthese/rules";
import { missingSections, sanitizeContent } from "@/lib/synthese/format";

const ORG = "org";
const A = "pool-a";
const B = "pool-b";
const C1 = "cell-1";
const C2 = "cell-2";

function actor(id: string, ...grants: { role: RoleKey; poolId?: string | null; cellId?: string | null }[]): Actor {
  const roles: SessionRole[] = [];
  const permissions: SessionPermission[] = [];
  for (const g of grants) {
    const poolId = g.poolId ?? null;
    const cellId = g.cellId ?? null;
    roles.push({ key: g.role, label: g.role, poolId, cellId });
    permissions.push(...bindRolePermissions({ roleKey: g.role, permissionKeys: ROLE_PERMISSIONS[g.role], poolId, cellId, ipaCellId: cellId, organizationId: ORG }));
  }
  return { id, organizationId: ORG, roles, permissions };
}

const exploitA = actor("exploitA", { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: A });
const chefA = actor("chefA", { role: ROLE_KEYS.CHEF_POOL, poolId: A });
const exploitB = actor("exploitB", { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: B });
const exploitC1 = actor("exploitC1", { role: ROLE_KEYS.EXPLOITANT_IPP, cellId: C1 });
const exploitC1b = actor("exploitC1b", { role: ROLE_KEYS.EXPLOITANT_IPP, cellId: C1 });
const exploitC2 = actor("exploitC2", { role: ROLE_KEYS.EXPLOITANT_IPP, cellId: C2 });
const exploitSansCellule = actor("exploitSans", { role: ROLE_KEYS.EXPLOITANT_IPP });
const ipaC1 = actor("ipaC1", { role: ROLE_KEYS.IPA, cellId: C1 });
const ipaC2 = actor("ipaC2", { role: ROLE_KEYS.IPA, cellId: C2 });
const agentIpp = actor("agentIpp", { role: ROLE_KEYS.AGENT_IPP });
const ipp = actor("ipp", { role: ROLE_KEYS.IPP });
const superAdmin = actor("sa", { role: ROLE_KEYS.SUPER_ADMIN });
const inspA = actor("inspA", { role: ROLE_KEYS.INSPECTEUR, poolId: A });
const informaticien = actor("info", { role: ROLE_KEYS.INFORMATICIEN });

const poolSynth = (status: SynthesisMeta["status"]): SynthesisMeta => ({ authorId: "exploitA", organizationId: ORG, poolId: A, cellId: null, status });
const cellSynth = (status: SynthesisMeta["status"]): SynthesisMeta => ({ authorId: "exploitC1", organizationId: ORG, poolId: null, cellId: C1, status });
// Synthèse provinciale de l'ancien circuit (avant les cellules), conservée.
const provSynth = (status: SynthesisMeta["status"]): SynthesisMeta => ({ authorId: "ancien", organizationId: ORG, poolId: null, cellId: null, status });
const report = (poolId: string, statusKey: string, isDemo = false, track: { stage: string; cellId: string | null } | null = null) => ({
  poolId,
  organizationId: ORG,
  statusKey,
  isDemo,
  track,
});

test("Rédaction : POOL pour l'exploitant et le chef de POOL ; cellule pour son exploitant ; ni l'IPA, ni l'IPP, ni l'inspecteur", () => {
  assert.ok(canAuthorIn(exploitA, A, ORG));
  assert.equal(canAuthorIn(exploitA, B, ORG), false);
  assert.equal(canAuthorIn(exploitA, null, ORG), false, "pas de synthèse provinciale pour un exploitant de POOL");
  assert.ok(canAuthorIn(chefA, A, ORG), "Q6 : le chef de POOL rédige");
  assert.ok(canAuthorInCell(exploitC1, C1, ORG));
  assert.equal(canAuthorInCell(exploitC1, C2, ORG), false, "pas la cellule d'à côté");
  assert.equal(canAuthorIn(exploitC1, null, ORG), false, "plus de synthèse provinciale (Q8 retiré)");
  assert.equal(canAuthorIn(exploitC1, A, ORG), false, "plus d'exploitation de POOL (Q8 retiré)");
  assert.deepEqual(authorScopes(exploitC1), { provincial: false, poolIds: [], cellIds: [C1] });
  assert.deepEqual(authorScopes(exploitSansCellule), { provincial: false, poolIds: [], cellIds: [] }, "sans cellule : rien");
  assert.equal(canAuthorInCell(ipaC1, C1, ORG), false, "l'IPA signe, il ne rédige pas");
  assert.equal(canAuthorIn(inspA, A, ORG), false);
  assert.equal(canAuthorIn(informaticien, null, ORG), false);
  assert.equal(canAuthorIn(ipp, null, ORG), false, "l'IPP valide, il ne rédige pas");
  assert.equal(canAuthorIn(exploitA, A, "autre-org"), false);
});

test("Sélection POOL : rapports exploités de son POOL seulement", () => {
  const s = { organizationId: ORG, poolId: A, isDemo: false };
  assert.ok(canIncludeReport(exploitA, s, report(A, W.EN_EXPLOITATION)));
  assert.ok(canIncludeReport(exploitA, s, report(A, W.VALIDE)));
  assert.equal(canIncludeReport(exploitA, s, report(B, W.EN_EXPLOITATION)), false, "hors de son POOL");
  for (const k of [W.BROUILLON, W.SOUMIS, W.RECU, W.A_CORRIGER, W.REJETE]) {
    assert.equal(canIncludeReport(exploitA, s, report(A, k)), false, `exploitation non commencée : ${k}`);
  }
  assert.equal(canIncludeReport(exploitA, s, report(A, W.TRANSMIS, true)), false, "rapport de démonstration dans une synthèse officielle");
  assert.equal(canIncludeReport(exploitA, s, { ...report(A, W.TRANSMIS), organizationId: "autre-org" }), false);
  assert.equal(canIncludeReport(exploitC1, s, report(A, W.EN_EXPLOITATION)), false, "un exploitant de cellule n'exploite pas le POOL");
});

test("Sélection cellule : seulement les rapports AFFECTÉS à sa cellule et dont la cellule a terminé l'exploitation", () => {
  const s = { organizationId: ORG, poolId: null, cellId: C1, isDemo: false };
  assert.ok(canIncludeReport(exploitC1, s, report(A, W.SOUMIS, false, { stage: "EXPLOITE", cellId: C1 })), "rapport de n'importe quel POOL");
  assert.ok(canIncludeReport(exploitC1, s, report(B, W.SOUMIS, false, { stage: "SIGNE", cellId: C1 })));
  assert.equal(canIncludeReport(exploitC1, s, report(A, W.SOUMIS, false, { stage: "EXPLOITE", cellId: C2 })), false, "rapport d'une autre cellule");
  assert.equal(canIncludeReport(exploitC1, s, report(A, W.SOUMIS, false, { stage: "AFFECTE", cellId: C1 })), false, "exploitation pas terminée");
  assert.equal(canIncludeReport(exploitC1, s, report(A, W.SOUMIS, false, { stage: "AU_SECRETARIAT", cellId: null })), false, "pas encore affecté");
  assert.equal(canIncludeReport(exploitC1, s, report(A, W.VALIDE)), false, "sans branche IPP");
  assert.equal(canIncludeReport(exploitC2, s, report(A, W.SOUMIS, false, { stage: "EXPLOITE", cellId: C1 })), false, "synthèse forgée sur une autre cellule");
});

test("Lecture : POOL par le POOL et la province (plus l'IPA) ; cellule par sa cellule ; l'IPP seulement une fois signée", () => {
  assert.ok(canRead(exploitA, poolSynth("BROUILLON")));
  assert.equal(canRead(chefA, poolSynth("BROUILLON")), false);
  assert.equal(canRead(ipp, poolSynth("BROUILLON")), false);
  for (const a of [chefA, ipp, superAdmin]) assert.ok(canRead(a, poolSynth("SOUMIS")), a.id);
  for (const a of [exploitB, inspA, informaticien, ipaC1, exploitC1, agentIpp]) assert.equal(canRead(a, poolSynth("SOUMIS")), false, a.id);

  assert.equal(canRead(exploitC1b, cellSynth("BROUILLON")), false, "brouillon privé à l'auteur");
  for (const a of [exploitC1b, ipaC1, superAdmin]) assert.ok(canRead(a, cellSynth("SOUMIS")), a.id);
  for (const a of [exploitC2, ipaC2, ipp, agentIpp, chefA, exploitSansCellule]) assert.equal(canRead(a, cellSynth("SOUMIS")), false, a.id);
  assert.ok(canRead(ipp, cellSynth("VALIDE")), "validée par l'IPA et transmise : l'IPP la lit pour la signer");
  assert.ok(canRead(ipp, cellSynth("SIGNE")));
  assert.equal(canRead(ipaC2, cellSynth("SIGNE")), false, "jamais une autre cellule");
  assert.equal(canRead(agentIpp, cellSynth("SIGNE")), false, "Agent IPP : plus de portée provinciale");

  for (const a of [ipp, superAdmin]) assert.ok(canRead(a, provSynth("SOUMIS")), a.id);
  for (const a of [ipaC1, exploitC1, agentIpp, chefA]) assert.equal(canRead(a, provSynth("SOUMIS")), false, a.id);
});

test("Modification : l'auteur seul, en brouillon ou à corriger, tant qu'il garde le droit de rédiger ici", () => {
  assert.ok(canEdit(exploitA, poolSynth("BROUILLON")));
  assert.ok(canEdit(exploitA, poolSynth("A_CORRIGER")));
  assert.equal(canEdit(exploitA, poolSynth("SOUMIS")), false);
  assert.equal(canEdit(exploitA, poolSynth("VALIDE")), false);
  assert.equal(canEdit(chefA, poolSynth("BROUILLON")), false, "un autre rédacteur du même POOL");
  assert.ok(canEdit(exploitC1, cellSynth("BROUILLON")));
  assert.equal(canEdit(exploitC1b, cellSynth("BROUILLON")), false, "un autre exploitant de la cellule");
  assert.equal(canEdit(ipaC1, cellSynth("A_CORRIGER")), false);
  // Auteur passé dans une autre cellule : il ne modifie plus.
  const exAuteur = { ...exploitC2, id: "exploitC1" };
  assert.equal(canEdit(exAuteur, cellSynth("BROUILLON")), false);
});

test("Circuit POOL : renvoi par le niveau provincial, validation par l'IPP ; plus par l'IPA", () => {
  assert.deepEqual(
    availableTransitions(exploitA, poolSynth("BROUILLON")).map((t) => t.to),
    ["SOUMIS"]
  );
  for (const a of [ipp, superAdmin]) assert.ok(canReturn(a, poolSynth("SOUMIS")), a.id);
  for (const a of [exploitA, chefA, exploitB, ipaC1, agentIpp]) assert.equal(canReturn(a, poolSynth("SOUMIS")), false, a.id);
  assert.equal(findTransition("SOUMIS", "A_CORRIGER")?.commentRequired, true);
  assert.deepEqual(
    availableTransitions(exploitA, poolSynth("A_CORRIGER")).map((t) => [t.to, t.label]),
    [["SOUMIS", "Resoumettre"]]
  );
  for (const a of [ipp, superAdmin]) assert.ok(canValidate(a, poolSynth("SOUMIS")), a.id);
  for (const a of [ipaC1, agentIpp, exploitA]) assert.equal(canValidate(a, poolSynth("SOUMIS")), false, a.id);
  assert.equal(canSign(ipaC1, poolSynth("SOUMIS")), false, "une synthèse de POOL ne se signe pas");
  assert.equal(availableTransitions(ipp, poolSynth("VALIDE")).length, 0, "validée : fin du circuit");
  assert.equal(findTransition("BROUILLON", "VALIDE"), null);
});

test("Circuit cellule (2026-10-09) : soumise par la cellule ; SON IPA renvoie ou valide et transmet ; l'IPP signe ou renvoie", () => {
  assert.deepEqual(
    availableTransitions(exploitC1, cellSynth("BROUILLON")).map((t) => t.to),
    ["SOUMIS"]
  );
  assert.deepEqual(
    availableTransitions(ipaC1, cellSynth("SOUMIS")).map((t) => t.to),
    ["A_CORRIGER", "VALIDE"]
  );
  for (const a of [ipaC2, ipp, agentIpp, exploitC1b, exploitC1]) {
    assert.equal(canValidate(a, cellSynth("SOUMIS")), false, a.id);
    assert.equal(canReturn(a, cellSynth("SOUMIS")), false, a.id);
  }
  assert.equal(canSign(ipp, cellSynth("SOUMIS")), false, "pas avant la validation de l'IPA");
  // Validée et transmise : l'IPP principal signe ou renvoie (motif obligatoire).
  assert.deepEqual(
    availableTransitions(ipp, cellSynth("VALIDE")).map((t) => [t.to, t.commentRequired]),
    [
      ["SIGNE", false],
      ["A_CORRIGER", true],
    ]
  );
  for (const a of [ipaC1, ipaC2, agentIpp, exploitC1, exploitC1b]) assert.equal(canSign(a, cellSynth("VALIDE")), false, a.id);
  assert.ok(canSign(superAdmin, cellSynth("VALIDE")), "assistance technique");
  assert.deepEqual(
    availableTransitions(exploitC1, cellSynth("A_CORRIGER")).map((t) => t.to),
    ["SOUMIS"],
    "resoumission par l'auteur"
  );
  assert.equal(availableTransitions(ipp, cellSynth("SIGNE")).length, 0, "signée : fin du circuit");
  assert.equal(canSign(ipp, poolSynth("VALIDE")), false, "une synthèse de POOL validée est terminée");
});

test("Synthèse provinciale de l'ancien circuit : renvoi et validation par l'IPP et le Super Admin seulement", () => {
  for (const a of [ipp, superAdmin]) {
    assert.ok(canReturn(a, provSynth("SOUMIS")), a.id);
    assert.ok(canValidate(a, provSynth("SOUMIS")), a.id);
  }
  for (const a of [ipaC1, exploitC1, agentIpp]) assert.equal(canReturn(a, provSynth("SOUMIS")), false, a.id);
});

test("Audit : une action par étape", () => {
  assert.equal(auditActionFor("BROUILLON", "SOUMIS"), "synthesis.submit");
  assert.equal(auditActionFor("SOUMIS", "A_CORRIGER"), "synthesis.return");
  assert.equal(auditActionFor("A_CORRIGER", "SOUMIS"), "synthesis.resubmit");
  assert.equal(auditActionFor("SOUMIS", "VALIDE"), "synthesis.validate");
  assert.equal(auditActionFor("VALIDE", "SIGNE"), "synthesis.sign");
  assert.equal(auditActionFor("VALIDE", "A_CORRIGER"), "synthesis.ipp_return");
});

test("Numéro officiel et versions (Q7) : POOL, cellule ou IPP", () => {
  assert.equal(formatSynthesisNumber({ scope: "GOMA", seq: 4, year: 2026 }), "61/GOMA/SYN.004/2026");
  assert.equal(formatSynthesisNumber({ scope: numberScopeCode(null, "IPAF"), seq: 1, year: 2026 }), "61/IPAF/SYN.001/2026");
  assert.equal(numberScopeCode("GOMA"), "GOMA");
  assert.equal(numberScopeCode(null), "IPP");
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
