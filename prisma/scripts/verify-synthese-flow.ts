// Vérification de bout en bout du rapport de synthèse de l'exploitant, sur
// base : création dans son périmètre, refus d'un rapport hors périmètre,
// circuit complet (soumission, renvoi pour correction, resoumission par
// l'auteur seul, validation), numéro officiel et versions, audit à chaque
// étape, notifications, lecture par fonction, lien vers les rapports d'origine.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée
// (npm run db:seed). Crée sa propre organisation de test. Refuse toute base
// non locale.
//
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-synthese-flow.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError } from "../../src/lib/permissions";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS as S } from "../../src/lib/rbac-data";
import {
  createSynthesis,
  eligibleReports,
  getSynthesis,
  listSyntheses,
  loadActor,
  setSynthesisSources,
  synthesesIncludingReport,
  transitionSynthesis,
  updateSynthesis,
} from "../../src/lib/synthese/server";
import { resolveDashboardScopes } from "../../src/lib/dashboard/scope";
import { loadSynthesisCounts } from "../../src/lib/dashboard/data";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const RUN = Date.now().toString(36);
const FULL = { objet: "Trimestre 1", analyse: "Analyse d'ensemble.", constats: "Constats.", recommandations: "", conclusion: "Conclusion." };

async function refused(fn: () => Promise<unknown>, message?: string) {
  await assert.rejects(fn, (e: unknown) => e instanceof ForbiddenError, message);
}

async function auditActions(synthesisId: string) {
  const rows = await prisma.auditLog.findMany({ where: { entityType: "Synthesis", entityId: synthesisId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => r.action);
}

async function notificationsOf(userId: string, event: string) {
  return prisma.notification.count({ where: { userId, event, channel: "IN_APP" } });
}

async function main() {
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const status = new Map((await prisma.workflowStatus.findMany()).map((s) => [s.key, s]));
  assert.ok(roles.size > 0 && status.size > 0, "Base non seedée : lancez d'abord npm run db:seed.");

  // ── Données de test ─────────────────────────────────────────────────────
  const org = await prisma.organization.create({ data: { code: `SY-${RUN}`, name: "Organisation de test synthèse" } });
  const pA = await prisma.pool.create({ data: { organizationId: org.id, code: `PA${RUN}`.toUpperCase(), name: "POOL A" } });
  const pB = await prisma.pool.create({ data: { organizationId: org.id, code: `PB${RUN}`.toUpperCase(), name: "POOL B" } });
  const school = (poolId: string, code: string) =>
    prisma.school.create({ data: { poolId, code: `${code}-${RUN}`, name: `École ${code}`, province: "Nord-Kivu", territoire: "Goma" } });
  const sA = await school(pA.id, "SA");
  const sB = await school(pB.id, "SB");

  async function user(name: string, grants: { role: string; poolId?: string }[]) {
    return prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(/\W+/g, ".")}.${RUN}@verif.test`,
        passwordHash: "x",
        status: "ACTIVE",
        organizationId: org.id,
        roles: { create: grants.map((g) => ({ roleId: roles.get(g.role)!.id, poolId: g.poolId ?? null })) },
      },
    });
  }
  const exploitA = await user("Exploitant A", [{ role: ROLE_KEYS.EXPLOITANT_POOL, poolId: pA.id }]);
  const chefA = await user("Chef A", [{ role: ROLE_KEYS.CHEF_POOL, poolId: pA.id }]);
  const exploitB = await user("Exploitant B", [{ role: ROLE_KEYS.EXPLOITANT_POOL, poolId: pB.id }]);
  const exploitIpp = await user("Exploitant IPP", [{ role: ROLE_KEYS.EXPLOITANT_IPP }]);
  const agentIpp = await user("Agent IPP", [{ role: ROLE_KEYS.AGENT_IPP }]);
  const ipp = await user("IPP", [{ role: ROLE_KEYS.IPP }]);
  const ipa = await user("IPA", [{ role: ROLE_KEYS.IPA }]);
  const inspA = await user("Inspecteur A", [{ role: ROLE_KEYS.INSPECTEUR, poolId: pA.id }]);

  async function legacyReport(schoolId: string, statusKey: string) {
    const inspection = await prisma.inspection.create({ data: { schoolId, inspectorId: inspA.id, status: "RAPPORT_SOUMIS", completedAt: new Date() } });
    return prisma.report.create({ data: { inspectionId: inspection.id, statusId: status.get(statusKey)!.id, submittedAt: new Date() } });
  }
  const rA1 = await legacyReport(sA.id, S.EN_EXPLOITATION);
  const rA2 = await legacyReport(sA.id, S.VALIDE);
  const rA3 = await legacyReport(sA.id, S.SOUMIS); // exploitation non commencée
  const rB1 = await legacyReport(sB.id, S.TRANSMIS);

  const act = (id: string) => loadActor(id, { viewMode: null });
  // Chargés l'un après l'autre : la base locale de test n'a qu'une connexion.
  const actors = [];
  for (const u of [exploitA, chefA, exploitB, exploitIpp, agentIpp, ipp, ipa, inspA]) actors.push(await act(u.id));
  const [aExploitA, aChefA, aExploitB, aExploitIpp, aAgentIpp, aIpp, aIpa, aInspA] = actors;

  let synthId = "";

  // ── Vérifications ───────────────────────────────────────────────────────
  await check("Rapports proposés à l'exploitant de A : exploités et de son POOL seulement", async () => {
    const ids = (await eligibleReports(aExploitA, { poolId: pA.id })).map((r) => r.id).sort();
    assert.deepEqual(ids, [rA1.id, rA2.id].sort());
    await refused(() => eligibleReports(aExploitA, { poolId: pB.id }), "périmètre d'un autre POOL");
    await refused(() => eligibleReports(aInspA, { poolId: pA.id }), "un inspecteur ne rédige pas");
  });

  await check("Création dans son périmètre : informations reprises des rapports d'origine, audit", async () => {
    synthId = await createSynthesis(aExploitA, { title: "Synthèse T1 POOL A", poolId: pA.id, reportIds: [rA1.id, rA2.id] });
    const s = await prisma.synthesis.findUniqueOrThrow({ where: { id: synthId }, include: { sources: true } });
    assert.equal(s.status, "BROUILLON");
    assert.equal(s.poolId, pA.id);
    assert.equal(s.authorId, exploitA.id);
    assert.equal(s.sources.length, 2);
    const snap = s.sources.find((x) => x.reportId === rA1.id)!.snapshot as Record<string, unknown>;
    assert.equal(snap.schoolName, "École SA");
    assert.equal(snap.authorName, "Inspecteur A");
    assert.equal(snap.poolName, "POOL A");
    assert.equal(snap.statusKey, S.EN_EXPLOITATION);
    assert.ok(snap.submittedAt && snap.inspectionDate);
    assert.deepEqual(await auditActions(synthId), ["synthesis.create"]);
  });

  await check("Rapport hors périmètre ou non exploité refusé, rien n'est écrit", async () => {
    const before = await prisma.synthesis.count({ where: { organizationId: org.id } });
    await refused(() => createSynthesis(aExploitA, { title: "Forgée", poolId: pA.id, reportIds: [rA1.id, rB1.id] }), "rapport du POOL B");
    await refused(() => createSynthesis(aExploitA, { title: "Forgée", poolId: pA.id, reportIds: [rA3.id] }), "rapport seulement soumis");
    await refused(() => createSynthesis(aExploitA, { title: "Forgée", poolId: pB.id, reportIds: [rB1.id] }), "synthèse sur un autre POOL");
    await refused(() => createSynthesis(aExploitA, { title: "Forgée", poolId: null, reportIds: [rA1.id] }), "synthèse provinciale");
    await refused(() => setSynthesisSources(aExploitA, synthId, [rA1.id, rB1.id]), "ajout d'un rapport du POOL B");
    assert.equal(await prisma.synthesis.count({ where: { organizationId: org.id } }), before);
    assert.equal(await prisma.synthesisSource.count({ where: { synthesisId: synthId } }), 2);
  });

  await check("Brouillon : lu et modifié par l'auteur seul", async () => {
    assert.equal(await getSynthesis(aChefA, synthId), null, "brouillon privé");
    assert.equal(await getSynthesis(aIpp, synthId), null);
    await refused(() => updateSynthesis(aChefA, synthId, { title: "Pris par le chef", sections: FULL }));
    await refused(() => transitionSynthesis(aChefA, synthId, "SOUMIS"));
    await refused(() => transitionSynthesis(aExploitA, synthId, "SOUMIS"), "sections obligatoires vides");
    await updateSynthesis(aExploitA, synthId, { title: "Synthèse T1 POOL A", sections: FULL });
    await setSynthesisSources(aExploitA, synthId, [rA1.id]);
    await setSynthesisSources(aExploitA, synthId, [rA1.id, rA2.id]);
  });

  await check("Soumission : numéro officiel, version 1, copie, notification du niveau provincial", async () => {
    const r = await transitionSynthesis(aExploitA, synthId, "SOUMIS");
    const year = new Date().getFullYear();
    assert.equal(r.number, `61/${pA.code}/SYN.001/${year}`);
    assert.equal(r.version, 1);
    const versions = await prisma.synthesisVersion.findMany({ where: { synthesisId: synthId } });
    assert.equal(versions.length, 1);
    assert.equal((versions[0].sources as unknown[]).length, 2);
    for (const u of [exploitIpp, agentIpp, ipp, ipa]) assert.equal(await notificationsOf(u.id, "synthesis.submitted"), 1, u.name);
    assert.equal(await notificationsOf(exploitA.id, "synthesis.submitted"), 0, "l'auteur n'est pas notifié de sa propre soumission");
    await refused(() => updateSynthesis(aExploitA, synthId, { title: "Modifiée après soumission", sections: FULL }), "soumise : plus modifiable");
  });

  await check("Lecture après soumission : POOL A et niveau provincial ; pas le POOL B", async () => {
    for (const a of [aChefA, aExploitIpp, aAgentIpp, aIpp, aIpa]) assert.ok(await getSynthesis(a, synthId), a.id);
    assert.equal(await getSynthesis(aExploitB, synthId), null);
    assert.equal(await getSynthesis(aInspA, synthId), null);
    assert.ok(!(await listSyntheses(aExploitB)).some((s) => s.id === synthId));
    // Lien de la source vers la synthèse, depuis le détail du rapport d'origine.
    assert.deepEqual(
      (await synthesesIncludingReport(aChefA, rA1.id)).map((s) => s.id),
      [synthId]
    );
    assert.deepEqual(await synthesesIncludingReport(aExploitB, rA1.id), []);
  });

  await check("Renvoi pour correction : motif obligatoire, jamais par l'auteur, auteur notifié", async () => {
    await refused(() => transitionSynthesis(aExploitA, synthId, "A_CORRIGER", "auto-renvoi"));
    await refused(() => transitionSynthesis(aChefA, synthId, "A_CORRIGER", "pas le niveau provincial"));
    await refused(() => transitionSynthesis(aAgentIpp, synthId, "A_CORRIGER", "  "), "motif vide");
    await transitionSynthesis(aAgentIpp, synthId, "A_CORRIGER", "Préciser les constats par école.");
    assert.equal(await notificationsOf(exploitA.id, "synthesis.needs_correction"), 1);
  });

  await check("Resoumission par l'auteur seul : même numéro, version 2, version renvoyée conservée", async () => {
    await refused(() => transitionSynthesis(aChefA, synthId, "SOUMIS"), "un autre rédacteur du POOL");
    await refused(() => transitionSynthesis(aIpp, synthId, "SOUMIS"));
    await updateSynthesis(aExploitA, synthId, { title: "Synthèse T1 POOL A", sections: { ...FULL, constats: "Constats détaillés par école." } });
    const r = await transitionSynthesis(aExploitA, synthId, "SOUMIS");
    assert.equal(r.version, 2);
    assert.equal(r.number, `61/${pA.code}/SYN.001/${new Date().getFullYear()}`);
    const versions = await prisma.synthesisVersion.findMany({ where: { synthesisId: synthId }, orderBy: { number: "asc" } });
    assert.deepEqual(
      versions.map((v) => (v.content as { sections: Record<string, string> }).sections.constats),
      ["Constats.", "Constats détaillés par école."]
    );
  });

  await check("Validation : ni l'exploitant IPP ni l'agent IPP ; l'IPP adjoint valide ; fin du circuit", async () => {
    await refused(() => transitionSynthesis(aExploitIpp, synthId, "VALIDE"));
    await refused(() => transitionSynthesis(aAgentIpp, synthId, "VALIDE"));
    await transitionSynthesis(aIpa, synthId, "VALIDE");
    const s = await prisma.synthesis.findUniqueOrThrow({ where: { id: synthId } });
    assert.equal(s.status, "VALIDE");
    assert.ok(s.validatedAt);
    await refused(() => transitionSynthesis(aIpp, synthId, "A_CORRIGER", "trop tard"));
    await refused(() => updateSynthesis(aExploitA, synthId, { title: "Après validation", sections: FULL }));
    assert.equal(await notificationsOf(exploitA.id, "synthesis.status_changed"), 1);
  });

  await check("Audit : une entrée par étape du circuit, historique des statuts complet", async () => {
    const actions = (await auditActions(synthId)).filter((a) => a !== "synthesis.update" && a !== "synthesis.sources_change");
    assert.deepEqual(actions, ["synthesis.create", "synthesis.submit", "synthesis.return", "synthesis.resubmit", "synthesis.validate"]);
    const history = await prisma.synthesisStatusHistory.findMany({ where: { synthesisId: synthId }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(
      history.map((h) => [h.fromStatus, h.toStatus, h.version]),
      [
        [null, "BROUILLON", 0],
        ["BROUILLON", "SOUMIS", 1],
        ["SOUMIS", "A_CORRIGER", 1],
        ["A_CORRIGER", "SOUMIS", 2],
        ["SOUMIS", "VALIDE", 2],
      ]
    );
    assert.equal(history[2].comment, "Préciser les constats par école.");
    // Les commentaires des rapports d'inspection ne sont pas touchés.
    assert.equal(await prisma.comment.count({ where: { reportId: { in: [rA1.id, rA2.id] } } }), 0);
  });

  await check("Synthèse provinciale de l'exploitant IPP : tous les POOL ; lue et examinée par IPP et IPA seulement", async () => {
    const id = await createSynthesis(aExploitIpp, { title: "Synthèse provinciale", poolId: null, reportIds: [rA1.id, rB1.id] });
    await updateSynthesis(aExploitIpp, id, { title: "Synthèse provinciale", sections: FULL });
    const r = await transitionSynthesis(aExploitIpp, id, "SOUMIS");
    // Séquence « IPP » commune à la base : le numéro dépend des synthèses provinciales déjà numérotées.
    assert.match(r.number ?? "", new RegExp(`^61/IPP/SYN\\.\\d{3}/${new Date().getFullYear()}$`));
    assert.equal(await getSynthesis(aAgentIpp, id), null);
    assert.equal(await getSynthesis(aChefA, id), null);
    await refused(() => transitionSynthesis(aAgentIpp, id, "A_CORRIGER", "pas habilité"));
    await transitionSynthesis(aIpp, id, "A_CORRIGER", "Ajouter le POOL B.");
    assert.equal((await prisma.synthesis.findUniqueOrThrow({ where: { id } })).status, "A_CORRIGER");
  });

  await check("Un même rapport dans plusieurs synthèses (Q8)", async () => {
    assert.equal(await prisma.synthesisSource.count({ where: { reportId: rA1.id } }), 2);
  });

  await check("Tableaux de bord : compteurs de synthèses limités à ce que chaque fonction peut lire", async () => {
    const count = async (a: Awaited<ReturnType<typeof act>>) => {
      const scope = resolveDashboardScopes({ id: a.id, organizationId: a.organizationId, isDemo: a.isDemo, roles: a.roles, permissions: a.permissions })[0];
      return loadSynthesisCounts(scope, a);
    };
    // POOL A : 1 synthèse validée ; la synthèse provinciale n'est pas du POOL.
    assert.deepEqual(await count(aChefA), { total: 1, myDrafts: 0, myToFix: 0, submitted: 0, toFix: 0, validated: 1 });
    assert.deepEqual(await count(aExploitB), { total: 0, myDrafts: 0, myToFix: 0, submitted: 0, toFix: 0, validated: 0 }, "rien du POOL A");
    // IPP : la synthèse du POOL A (validée) et la provinciale (à corriger).
    assert.deepEqual(await count(aIpp), { total: 2, myDrafts: 0, myToFix: 0, submitted: 0, toFix: 1, validated: 1 });
    // Exploitant IPP : sa synthèse provinciale renvoyée.
    const e = await count(aExploitIpp);
    assert.equal(e.myToFix, 1);
    assert.equal(e.validated, 1);
    // Agent IPP : ne lit pas la synthèse provinciale.
    assert.equal((await count(aAgentIpp)).toFix, 0);
    // Un inspecteur n'a pas de compteur de synthèses.
    const insp = resolveDashboardScopes({ id: aInspA.id, organizationId: aInspA.organizationId, isDemo: aInspA.isDemo, roles: aInspA.roles, permissions: aInspA.permissions })[0];
    await assert.rejects(() => loadSynthesisCounts(insp, aInspA));
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
