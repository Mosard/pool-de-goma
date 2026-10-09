// Vérification sur base des cellules de l'IPP et de la branche IPP des
// rapports (décisions du 2026-10-08, docs/exploitants-ipp-cellules.md § 6) :
// arrivée au secrétariat à la soumission, envoi, réaffectation, exploitation,
// réouverture, transmission par synthèse ; isolation entre cellules par APPEL DIRECT aux
// fonctions serveur (lecture, listes, export, PDF, étapes) ; aucun accès sans
// cellule ; traçabilité de chaque transmission ; branche POOL indépendante ;
// « Gérer les accès » ; affectations depuis la Direction (avant, après,
// deux cellules, changement, retrait — décisions du 2026-10-09).
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-cellules.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError, loadUserAccess } from "../../src/lib/permissions";
import { PERMISSIONS, ROLE_KEYS, WORKFLOW_STATUS_KEYS as S } from "../../src/lib/rbac-data";
import { applyTrackAction, canActorReadReport, loadCellActor, openIppTrack } from "../../src/lib/cells/server";
import { loadExportSubject, loadReportRows } from "../../src/lib/exports/server";
import { PdfAccessError, loadReportPdfSource } from "../../src/lib/exports/report-pdf-source";
import { applyTransition } from "../../src/lib/workflow";
import { applyAccessChanges } from "../../src/lib/access-admin";
import { resolveDashboardScopes } from "../../src/lib/dashboard/scope";
import { loadCellule } from "../../src/lib/dashboard/data";
import { setCellIpa, setExploitantCell } from "../../src/lib/cells/assignments";
import { cellAssignmentLabel } from "../../src/lib/cells/rules";

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
async function refused(fn: () => Promise<unknown>, message?: string) {
  await assert.rejects(fn, (e: unknown) => e instanceof ForbiddenError, message);
}

const RUN = Date.now().toString(36);

async function main() {
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const status = new Map((await prisma.workflowStatus.findMany()).map((s) => [s.key, s]));
  assert.ok(roles.has(ROLE_KEYS.SECRETAIRE_IPP), "Migration des cellules non appliquée.");

  // ── Données de test ─────────────────────────────────────────────────────
  const org = await prisma.organization.create({ data: { code: `CE-${RUN}`, name: "Organisation de test cellules" } });
  const pA = await prisma.pool.create({ data: { organizationId: org.id, code: `CA${RUN}`.toUpperCase(), name: "POOL A" } });
  const pB = await prisma.pool.create({ data: { organizationId: org.id, code: `CB${RUN}`.toUpperCase(), name: "POOL B" } });
  const school = (poolId: string, code: string) =>
    prisma.school.create({ data: { poolId, code: `${code}-${RUN}`, name: `École ${code}`, province: "Nord-Kivu", territoire: "Goma" } });
  const sA = await school(pA.id, "SA");
  const sB = await school(pB.id, "SB");

  async function user(name: string, grants: { role: string; poolId?: string; cellId?: string }[]) {
    return prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(/\W+/g, ".")}.${RUN}@verif.test`,
        passwordHash: "x",
        status: "ACTIVE",
        organizationId: org.id,
        roles: { create: grants.map((g) => ({ roleId: roles.get(g.role)!.id, poolId: g.poolId ?? null, cellId: g.cellId ?? null })) },
      },
    });
  }
  const ipp = await user("IPP", [{ role: ROLE_KEYS.IPP }]);
  const ipa1 = await user("IPA 1", [{ role: ROLE_KEYS.IPA }]);
  const ipa2 = await user("IPA 2", [{ role: ROLE_KEYS.IPA }]);
  const c1 = await prisma.cell.create({ data: { organizationId: org.id, code: `X${RUN}`.toUpperCase(), name: "Cellule 1", ipaId: ipa1.id } });
  const c2 = await prisma.cell.create({ data: { organizationId: org.id, code: `Y${RUN}`.toUpperCase(), name: "Cellule 2", ipaId: ipa2.id } });
  const secretaire = await user("Secretaire IPP", [{ role: ROLE_KEYS.SECRETAIRE_IPP }]);
  const exploitC1 = await user("Exploitant C1", [{ role: ROLE_KEYS.EXPLOITANT_IPP, cellId: c1.id }]);
  const exploitC2 = await user("Exploitant C2", [{ role: ROLE_KEYS.EXPLOITANT_IPP, cellId: c2.id }]);
  const sansCellule = await user("Exploitant sans cellule", [{ role: ROLE_KEYS.EXPLOITANT_IPP }]);
  const exploitPoolA = await user("Exploitant POOL A", [{ role: ROLE_KEYS.EXPLOITANT_POOL, poolId: pA.id }]);
  const chefA = await user("Chef A", [{ role: ROLE_KEYS.CHEF_POOL, poolId: pA.id }]);
  const agentIpp = await user("Agent IPP", [{ role: ROLE_KEYS.AGENT_IPP }]);
  const inspA = await user("Inspecteur A", [{ role: ROLE_KEYS.INSPECTEUR, poolId: pA.id }]);

  // Rapport soumis : même transaction que la soumission réelle (submitFicheAction).
  async function submitted(schoolId: string) {
    const inspection = await prisma.inspection.create({ data: { schoolId, inspectorId: inspA.id, status: "RAPPORT_SOUMIS", completedAt: new Date() } });
    return prisma.$transaction(async (tx) => {
      const report = await tx.report.create({ data: { inspectionId: inspection.id, statusId: status.get(S.SOUMIS)!.id, submittedAt: new Date(), authorId: inspA.id } });
      await openIppTrack(tx, { reportId: report.id, organizationId: org.id, actorId: inspA.id });
      return report;
    });
  }
  const r1 = await submitted(sA.id);
  const r2 = await submitted(sB.id);

  const reads = async (userId: string, reportId: string) => canActorReadReport(await loadCellActor(userId, { real: true }), reportId);
  // Une notification est écrite par canal : on compte celles de l'application.
  const notif = (userId: string, event: string) => prisma.notification.count({ where: { userId, event, channel: "IN_APP" } });

  // ── Vérifications ───────────────────────────────────────────────────────
  await check("Soumission : le rapport arrive au secrétariat (D1), étape tracée ; branche POOL inchangée", async () => {
    const t = await prisma.reportIppTrack.findUniqueOrThrow({ where: { reportId: r1.id } });
    assert.equal(t.stage, "AU_SECRETARIAT");
    assert.equal(t.cellId, null);
    const ev = await prisma.reportIppEvent.findMany({ where: { reportId: r1.id } });
    assert.deepEqual(
      ev.map((e) => [e.fromStage, e.toStage, e.actorId]),
      [[null, "AU_SECRETARIAT", inspA.id]]
    );
    assert.equal((await prisma.report.findUniqueOrThrow({ where: { id: r1.id }, include: { status: true } })).status.key, S.SOUMIS);
  });

  await check("Avant affectation : secrétariat et POOL lisent ; aucune cellule, pas l'IPP (D7), pas l'Agent IPP, pas un compte sans cellule", async () => {
    for (const u of [secretaire, exploitPoolA, chefA, inspA]) assert.ok(await reads(u.id, r1.id), u.name);
    for (const u of [exploitC1, exploitC2, sansCellule, ipa1, ipp, agentIpp]) assert.equal(await reads(u.id, r1.id), false, u.name);
  });

  await check("Envoi à une cellule : réservé au secrétariat, tracé (auteur, date, cellule), audité, notifié à la seule cellule", async () => {
    for (const u of [exploitC1, ipp, ipa1, agentIpp, exploitPoolA]) {
      await refused(() => applyTrackAction(u.id, r1.id, { action: "assign", cellId: c1.id }), `${u.name} : appel direct refusé`);
    }
    await refused(() => applyTrackAction(secretaire.id, r1.id, { action: "assign" }), "cellule obligatoire");
    await applyTrackAction(secretaire.id, r1.id, { action: "assign", cellId: c1.id });
    const t = await prisma.reportIppTrack.findUniqueOrThrow({ where: { reportId: r1.id } });
    assert.equal(t.stage, "AFFECTE");
    assert.equal(t.cellId, c1.id);
    const last = await prisma.reportIppEvent.findFirstOrThrow({ where: { reportId: r1.id }, orderBy: { createdAt: "desc" } });
    assert.deepEqual([last.fromStage, last.toStage, last.cellId, last.actorId], ["AU_SECRETARIAT", "AFFECTE", c1.id, secretaire.id]);
    assert.ok(last.createdAt instanceof Date);
    assert.equal(await prisma.auditLog.count({ where: { entityId: r1.id, action: "report.ipp_assign", actorId: secretaire.id } }), 1);
    assert.equal(await notif(exploitC1.id, "report.ipp_assign"), 1);
    assert.equal(await notif(ipa1.id, "report.ipp_assign"), 1);
    assert.equal(await notif(exploitC2.id, "report.ipp_assign"), 0, "jamais l'autre cellule");
  });

  await check("Isolation : la cellule 2 ne lit, ne liste, n'exporte, ne télécharge ni ne traite le rapport de la cellule 1 (appels directs)", async () => {
    assert.ok(await reads(exploitC1.id, r1.id));
    assert.ok(await reads(ipa1.id, r1.id));
    for (const u of [exploitC2, ipa2, sansCellule]) assert.equal(await reads(u.id, r1.id), false, u.name);
    const rows = async (id: string) => (await loadReportRows(await loadExportSubject(id), {}, 100)).map((r) => r.id);
    assert.deepEqual(await rows(exploitC1.id), [r1.id], "liste et export Excel de la cellule 1 : son rapport seul");
    assert.deepEqual(await rows(exploitC2.id), [], "cellule 2 : rien");
    assert.deepEqual(await rows(sansCellule.id), [], "sans cellule : rien");
    const subjectC2 = await loadExportSubject(exploitC2.id);
    await assert.rejects(() => loadReportPdfSource(subjectC2, r1.id), PdfAccessError, "PDF refusé à l'autre cellule");
    await loadReportPdfSource(await loadExportSubject(exploitC1.id), r1.id);
    await refused(() => applyTrackAction(exploitC2.id, r1.id, { action: "exploit" }), "exploiter le rapport d'une autre cellule");
    await refused(() => applyTrackAction(ipa2.id, r1.id, { action: "return", comment: "x" }), "rouvrir pour une autre cellule");
    await refused(() => applyTrackAction(sansCellule.id, r1.id, { action: "exploit" }), "sans cellule");
  });

  await check("Réaffectation : motif obligatoire, historique (cellule de départ et d'arrivée) conservé", async () => {
    await refused(() => applyTrackAction(secretaire.id, r1.id, { action: "reassign", cellId: c2.id }), "motif obligatoire");
    await refused(() => applyTrackAction(secretaire.id, r1.id, { action: "reassign", cellId: c1.id, comment: "même cellule" }));
    await applyTrackAction(secretaire.id, r1.id, { action: "reassign", cellId: c2.id, comment: "Relève de la cellule 2." });
    const last = await prisma.reportIppEvent.findFirstOrThrow({ where: { reportId: r1.id }, orderBy: { createdAt: "desc" } });
    assert.deepEqual([last.fromCellId, last.cellId, last.comment], [c1.id, c2.id, "Relève de la cellule 2."]);
    assert.equal(await reads(exploitC1.id, r1.id), false, "la cellule 1 perd l'accès");
    assert.ok(await reads(exploitC2.id, r1.id));
  });

  await check("Exploitation, réouverture par l'IPA (motif) ; l'IPP ne lit le rapport qu'une fois source d'une synthèse validée et transmise", async () => {
    await applyTrackAction(exploitC2.id, r1.id, { action: "exploit" });
    await refused(() => applyTrackAction(ipa2.id, r1.id, { action: "return" }), "motif obligatoire");
    await applyTrackAction(ipa2.id, r1.id, { action: "return", comment: "Compléter l'analyse." });
    await applyTrackAction(exploitC2.id, r1.id, { action: "exploit" });
    assert.equal(await reads(ipp.id, r1.id), false, "D7 : pas avant la transmission par la cellule");
    // Synthèse de la cellule 2 validée par son IPA (circuit testé dans verify-synthese-flow.ts).
    await prisma.synthesis.create({
      data: {
        organizationId: org.id,
        cellId: c2.id,
        authorId: exploitC2.id,
        title: "Synthèse de test",
        status: "VALIDE",
        validatedAt: new Date(),
        sources: { create: [{ reportId: r1.id, snapshot: {} }] },
      },
    });
    assert.ok(await reads(ipp.id, r1.id), "transmis : l'IPP le lit");
    assert.equal(await reads(exploitC1.id, r1.id), false, "jamais l'autre cellule");
    await refused(() => applyTrackAction(secretaire.id, r1.id, { action: "reassign", cellId: c1.id, comment: "trop tard" }), "verrouillé par la synthèse");
  });

  await check("Traçabilité : chaque transmission a son entrée (étape, cellule, auteur, date) et son audit", async () => {
    const who = (id: string) => (id === secretaire.id ? "secr" : id === ipa2.id ? "ipa2" : id === exploitC2.id ? "exp2" : id === inspA.id ? "insp" : id);
    const cellOf = (id: string | null) => (id === c1.id ? "C1" : id === c2.id ? "C2" : null);
    const ev = await prisma.reportIppEvent.findMany({ where: { reportId: r1.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(
      ev.map((e) => [e.toStage, cellOf(e.cellId), who(e.actorId)]),
      [
        ["AU_SECRETARIAT", null, "insp"],
        ["AFFECTE", "C1", "secr"],
        ["AFFECTE", "C2", "secr"],
        ["EXPLOITE", "C2", "exp2"],
        ["AFFECTE", "C2", "ipa2"],
        ["EXPLOITE", "C2", "exp2"],
      ]
    );
    const audits = await prisma.auditLog.findMany({ where: { entityId: r1.id, action: { startsWith: "report.ipp_" } }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(
      audits.map((a) => a.action),
      ["report.ipp_assign", "report.ipp_reassign", "report.ipp_exploit", "report.ipp_return", "report.ipp_exploit"]
    );
  });

  await check("Branche POOL indépendante : le POOL exploite ; l'IPP n'agit pas sur un rapport non signé", async () => {
    const pool = await loadUserAccess(exploitPoolA.id, { viewMode: null });
    // r1 (POOL A) avance au POOL, quel que soit le stade IPP.
    await applyTransition({ reportId: r1.id, toStatusKey: S.RECU, actorId: exploitPoolA.id, actorPermissions: pool.permissions, actorPoolId: pA.id, actorOrganizationId: org.id });
    assert.equal((await prisma.report.findUniqueOrThrow({ where: { id: r1.id }, include: { status: true } })).status.key, S.RECU);
    // r2 (POOL B) : hors de son POOL.
    await refused(() =>
      applyTransition({ reportId: r2.id, toStatusKey: S.RECU, actorId: exploitPoolA.id, actorPermissions: pool.permissions, actorPoolId: pA.id, actorOrganizationId: org.id })
    );
    assert.equal((await prisma.reportIppTrack.findUniqueOrThrow({ where: { reportId: r2.id } })).stage, "AU_SECRETARIAT", "branche IPP inchangée");
    assert.equal(await reads(ipp.id, r2.id), false, "D7 : r2 pas transmis");
    // Ancien circuit retiré (2026-10-09) : plus de transmission au bureau IPP ; le POOL termine lui-même.
    const move = (to: string) =>
      applyTransition({ reportId: r1.id, toStatusKey: to, actorId: exploitPoolA.id, actorPermissions: pool.permissions, actorPoolId: pA.id, actorOrganizationId: org.id });
    await move(S.EN_EXPLOITATION);
    await assert.rejects(() => move(S.TRANSMIS), /Transition non autorisée/, "plus de transmission au bureau IPP");
    for (const [from, to] of [
      [S.TRANSMIS, S.EN_ATTENTE_VALIDATION],
      [S.EN_ATTENTE_VALIDATION, S.VALIDE],
      [S.EN_ATTENTE_VALIDATION, S.REJETE],
      [S.VALIDE, S.CLOTURE],
    ]) {
      const n = await prisma.workflowTransition.count({ where: { fromStatus: { key: from }, toStatus: { key: to } } });
      assert.equal(n, 0, `${from} → ${to} retirée`);
    }
    await move(S.CLOTURE);
    assert.equal((await prisma.report.findUniqueOrThrow({ where: { id: r1.id }, include: { status: true } })).status.key, S.CLOTURE, "Exploitation terminée (POOL)");
  });

  await check("Gérer les accès : cellule obligatoire, une seule ; jamais d'accès provincial pour une personne rattachée à une cellule", async () => {
    const exploitantRole = roles.get(ROLE_KEYS.EXPLOITANT_IPP)!;
    const province = { permissionKey: PERMISSIONS.REPORTS_REVIEW_PROVINCE, poolId: null, effect: "GRANT" as const };
    await refused(() => applyAccessChanges(ipp.id, exploitC1.id, { addRoles: [], removeUserRoleIds: [], adjustments: [province] }), "province à un exploitant de cellule");
    await refused(() => applyAccessChanges(ipp.id, ipa1.id, { addRoles: [], removeUserRoleIds: [], adjustments: [province] }), "province à l'IPA (D4)");
    const other = await user("Futur exploitant", []);
    await refused(() => applyAccessChanges(ipp.id, other.id, { addRoles: [{ roleId: exploitantRole.id, poolId: null }], removeUserRoleIds: [], adjustments: [] }), "sans cellule");
    await refused(
      () => applyAccessChanges(ipp.id, exploitC1.id, { addRoles: [{ roleId: exploitantRole.id, poolId: null, cellId: c2.id }], removeUserRoleIds: [], adjustments: [] }),
      "une seule cellule"
    );
    // Rattachement du compte sans cellule à la cellule 2 : il lit alors les rapports de la cellule 2.
    const ur = await prisma.userRole.findFirstOrThrow({ where: { userId: sansCellule.id } });
    await applyAccessChanges(ipp.id, sansCellule.id, { addRoles: [{ roleId: exploitantRole.id, poolId: null, cellId: c2.id }], removeUserRoleIds: [ur.id], adjustments: [] });
    assert.ok(await reads(sansCellule.id, r1.id), "rattaché : il voit sa cellule");
    assert.equal(await prisma.auditLog.count({ where: { entityId: sansCellule.id, action: "user.role_add" } }), 1);
  });

  await check("Tableaux de bord : vue de cellule pour l'exploitant et l'IPA, du secrétariat pour le secrétaire, rien sans cellule", async () => {
    const kinds = async (id: string) => {
      const a = await loadUserAccess(id, { viewMode: null });
      return resolveDashboardScopes({ id, organizationId: org.id, isDemo: false, roles: a.roles, permissions: a.permissions }).map((s) => [s.kind, s.cellId]);
    };
    assert.deepEqual(await kinds(exploitC1.id), [["exploitation_cellule", c1.id]]);
    assert.deepEqual(await kinds(ipa2.id), [["exploitation_cellule", c2.id]]);
    assert.deepEqual(await kinds(secretaire.id), [["secretariat_ipp", null]]);
    const nobody = await user("Exploitant sans cellule 2", [{ role: ROLE_KEYS.EXPLOITANT_IPP }]);
    assert.deepEqual(await kinds(nobody.id), [["aucun", null]]);
    assert.deepEqual((await loadUserAccess(nobody.id, { viewMode: null })).permissions, [], "aucune permission de repli");
  });

  // ── Affectations depuis la Direction (décisions du 2026-10-09) ─────────────
  const informaticien = await user("Informaticien", [{ role: ROLE_KEYS.INFORMATICIEN }]);
  const ipaX = await user("IPA X", [{ role: ROLE_KEYS.IPA }]);
  const expX = await user("Exploitant X", [{ role: ROLE_KEYS.EXPLOITANT_IPP }]);
  const c3 = await prisma.cell.create({ data: { organizationId: org.id, code: `Z${RUN}`.toUpperCase(), name: "Cellule Évaluation" } });
  const poste = await prisma.directionAttribution.create({ data: { organizationId: org.id, label: `Évaluation ${RUN}`, position: 90, cellId: c3.id } });
  const asIpp = { id: ipp.id, organizationId: org.id };
  const access = (id: string) => loadUserAccess(id, { viewMode: null });
  const kindsOf = async (id: string) => {
    const a = await access(id);
    return resolveDashboardScopes({ id, organizationId: org.id, isDemo: false, roles: a.roles, permissions: a.permissions });
  };
  const rowsOf = async (id: string) => (await loadReportRows(await loadExportSubject(id), {}, 100)).map((r) => r.id);
  const pdfRefused = async (id: string, reportId: string) =>
    assert.rejects(async () => loadReportPdfSource(await loadExportSubject(id), reportId), PdfAccessError);

  await check("Avant affectation : IPA et exploitant validés mais en attente — aucun droit, aucun espace, aucun appel direct", async () => {
    for (const u of [ipaX, expX]) {
      const a = await access(u.id);
      assert.equal(a.awaitingCell, true, u.name);
      assert.deepEqual(a.permissions, [], `${u.name} : aucune permission (ni provinciale ni de secours)`);
      assert.deepEqual((await kindsOf(u.id)).map((s) => s.kind), ["aucun"], `${u.name} : aucun tableau de bord métier`);
      for (const r of [r1, r2]) assert.equal(await reads(u.id, r.id), false);
      assert.deepEqual(await rowsOf(u.id), [], "liste et export : rien");
      await pdfRefused(u.id, r1.id);
      await refused(() => applyTrackAction(u.id, r1.id, { action: "exploit" }));
    }
    // Les exploitants de POOL ne sont jamais concernés.
    assert.equal((await access(exploitPoolA.id)).awaitingCell, false);
  });

  await check("Habilitations : l'informaticien affecte un exploitant mais pas un IPA ; jamais soi-même ; un IPA, une cellule ; cellule active", async () => {
    const asInfo = { id: informaticien.id, organizationId: org.id };
    await refused(() => setCellIpa(asInfo, { cellId: c3.id, ipaId: ipaX.id, via: "direction" }), "IPA ← IPP, Super Admin");
    await refused(() => setCellIpa(asIpp, { cellId: c3.id, ipaId: ipa1.id, via: "direction" }), "IPA 1 dirige déjà la cellule 1");
    await refused(() => setExploitantCell({ id: expX.id, organizationId: org.id }, { userId: expX.id, cellId: c3.id, via: "direction" }), "soi-même");
    await refused(() => setExploitantCell(asIpp, { userId: chefA.id, cellId: c3.id, via: "direction" }), "pas exploitant de l'IPP");
    const archived = await prisma.cell.create({ data: { organizationId: org.id, code: `W${RUN}`.toUpperCase(), name: "Cellule archivée", active: false } });
    await refused(() => setExploitantCell(asIpp, { userId: expX.id, cellId: archived.id, via: "direction" }), "cellule archivée");
    assert.equal((await access(expX.id)).awaitingCell, true, "rien n'a changé");
  });

  await check("Après affectation depuis la Direction : droits réels, cellule visible même sans rapport, historique et poste public suivis", async () => {
    await setCellIpa(asIpp, { cellId: c3.id, ipaId: ipaX.id, via: "direction" });
    await setExploitantCell({ id: informaticien.id, organizationId: org.id }, { userId: expX.id, cellId: c3.id, via: "direction" });
    for (const [u, label] of [
      [ipaX, "IPA — Responsable de la cellule Évaluation"],
      [expX, "Exploitant — Cellule Évaluation"],
    ] as const) {
      const a = await access(u.id);
      assert.equal(a.awaitingCell, false, u.name);
      const role = a.roles.find((r) => r.cellId === c3.id)!;
      assert.equal(cellAssignmentLabel(role), label);
      const scopes = await kindsOf(u.id);
      assert.deepEqual(scopes.map((s) => [s.kind, s.cellId]), [["exploitation_cellule", c3.id]]);
      const data = await loadCellule(scopes[0]);
      assert.equal(data.cell?.name, "Cellule Évaluation", "la cellule apparaît sans aucun rapport");
      assert.equal(data.affected + data.exploited, 0, "aucun rapport reçu");
      assert.deepEqual(await rowsOf(u.id), [], "aucun rapport des autres cellules");
      assert.equal(await reads(u.id, r1.id), false, "pas le rapport de la cellule 2");
    }
    assert.ok((await access(expX.id)).permissions.every((p) => p.cellId === c3.id), "toutes les permissions de l'exploitant sont bornées à SA cellule");
    const term = await prisma.cellIpaAssignment.findFirstOrThrow({ where: { cellId: c3.id, endedAt: null } });
    assert.deepEqual([term.ipaId, term.assignedById, term.via], [ipaX.id, ipp.id, "direction"]);
    assert.equal((await prisma.directionAttribution.findUniqueOrThrow({ where: { id: poste.id } })).holderId, ipaX.id, "poste public relié : titulaire = IPA");
    assert.equal(await prisma.auditLog.count({ where: { entityId: c3.id, action: "cell.ipa_assign", actorId: ipp.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { entityId: expX.id, action: "user.cell_assign", actorId: informaticien.id } }), 1);
    assert.equal(await notif(expX.id, "user.cell_assign"), 1);
    assert.equal(await notif(ipaX.id, "cell.ipa_assign"), 1);
  });

  await check("Deux cellules : l'exploitant ne voit que sa cellule ; un changement d'affectation retire l'ancien accès dès la requête suivante", async () => {
    // Rapport de la cellule 3 (r2, encore au secrétariat) : la cellule 3 le voit, la 2 jamais.
    await applyTrackAction(secretaire.id, r2.id, { action: "assign", cellId: c3.id });
    assert.ok(await reads(expX.id, r2.id));
    assert.ok(await reads(ipaX.id, r2.id));
    assert.deepEqual(await rowsOf(expX.id), [r2.id]);
    for (const u of [exploitC2, ipa2]) assert.equal(await reads(u.id, r2.id), false, `${u.name} : pas la cellule 3`);
    assert.equal(await reads(expX.id, r1.id), false, "pas le rapport de la cellule 2");
    assert.equal(await notif(exploitC2.id, "report.ipp_assign"), 0, "notification limitée à la cellule destinataire");
    assert.equal(await notif(expX.id, "report.ipp_assign"), 1);
    // Changement de cellule : 3 → 2.
    await setExploitantCell(asIpp, { userId: expX.id, cellId: c2.id, via: "direction" });
    assert.equal(await reads(expX.id, r2.id), false, "ancienne cellule : accès retiré");
    assert.ok(await reads(expX.id, r1.id), "nouvelle cellule : accès ouvert");
    assert.deepEqual(await rowsOf(expX.id), [r1.id]);
    await pdfRefused(expX.id, r2.id);
    await refused(() => applyTrackAction(expX.id, r2.id, { action: "exploit" }), "plus d'action sur l'ancienne cellule");
    assert.equal(await prisma.userRole.count({ where: { userId: expX.id, role: { key: ROLE_KEYS.EXPLOITANT_IPP } } }), 1, "une seule cellule");
  });

  await check("Retrait : compte de nouveau en attente ; aucun accès restant, y compris par appel direct (lecture, liste, PDF, étape)", async () => {
    await setExploitantCell(asIpp, { userId: expX.id, cellId: null, via: "direction" });
    await setCellIpa(asIpp, { cellId: c3.id, ipaId: null, via: "direction" });
    for (const u of [expX, ipaX]) {
      const a = await access(u.id);
      assert.equal(a.awaitingCell, true, u.name);
      assert.deepEqual(a.permissions, []);
      for (const r of [r1, r2]) assert.equal(await reads(u.id, r.id), false, `${u.name} ${r.id}`);
      assert.deepEqual(await rowsOf(u.id), []);
      await pdfRefused(u.id, r2.id);
      await refused(() => applyTrackAction(u.id, r2.id, { action: "exploit" }));
    }
    const ended = await prisma.cellIpaAssignment.findFirstOrThrow({ where: { cellId: c3.id, ipaId: ipaX.id } });
    assert.ok(ended.endedAt);
    assert.equal(ended.endedById, ipp.id);
    assert.equal((await prisma.directionAttribution.findUniqueOrThrow({ where: { id: poste.id } })).holderId, null, "poste public libéré");
    assert.equal(await prisma.userRole.count({ where: { userId: expX.id, role: { key: ROLE_KEYS.EXPLOITANT_IPP } } }), 1, "la fonction reste ; seule l'affectation est retirée");
  });

  await check("L'accès dépend de l'affectation enregistrée, pas de la présence de l'IPA ; cellule archivée : retour en attente", async () => {
    await setExploitantCell(asIpp, { userId: expX.id, cellId: c3.id, via: "direction" });
    assert.equal((await prisma.cell.findUniqueOrThrow({ where: { id: c3.id } })).ipaId, null);
    assert.equal((await access(expX.id)).awaitingCell, false);
    assert.ok(await reads(expX.id, r2.id), "l'exploitant travaille sans IPA désigné");
    await prisma.cell.update({ where: { id: c3.id }, data: { active: false } });
    assert.equal((await access(expX.id)).awaitingCell, true, "cellule archivée : en attente");
    assert.equal(await reads(expX.id, r2.id), false);
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
