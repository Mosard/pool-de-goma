// Vérification sur base des périmètres de tableau de bord : pour chaque
// fonction, le compte voit ses données et ne voit pas celles hors de son
// périmètre (autre POOL, autre inspecteur, autre organisation), y compris
// quand un POOL ou un inspecteur étranger est demandé dans l'URL.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée
// (npm run db:seed : fonctions, permissions, statuts). Crée ses propres
// organisations de test. Refuse toute base non locale.
//
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-dashboard-scopes.ts

import assert from "node:assert/strict";
import type { InspectionStatus } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { loadUserAccess } from "../../src/lib/permissions";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS as S } from "../../src/lib/rbac-data";
import { resolveDashboardScopes, type DashboardScope } from "../../src/lib/dashboard/scope";
import {
  loadAdministration,
  loadContenus,
  loadEcolesPool,
  loadExploitation,
  loadItinerant,
  loadPilotageProvincial,
  loadPoolDetail,
} from "../../src/lib/dashboard/data";
import type { ViewMode } from "../../src/lib/view-mode";

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

async function scopesOf(userId: string, viewMode: ViewMode | null = null): Promise<DashboardScope[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { organizationId: true, isDemo: true } });
  const access = await loadUserAccess(userId, { viewMode });
  return resolveDashboardScopes({ id: userId, organizationId: user.organizationId, isDemo: user.isDemo, roles: access.roles, permissions: access.permissions });
}

async function single(userId: string, kind: DashboardScope["kind"], viewMode: ViewMode | null = null): Promise<DashboardScope> {
  const scopes = await scopesOf(userId, viewMode);
  assert.deepEqual(
    scopes.map((s) => s.kind),
    [kind]
  );
  return scopes[0];
}

async function main() {
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const status = new Map((await prisma.workflowStatus.findMany()).map((s) => [s.key, s]));
  assert.ok(roles.size > 0 && status.size > 0, "Base non seedée : lancez d'abord npm run db:seed.");

  // ── Données de test ─────────────────────────────────────────────────────
  const org = await prisma.organization.create({ data: { code: `T-${RUN}`, name: "Organisation de test" } });
  const orgX = await prisma.organization.create({ data: { code: `X-${RUN}`, name: "Autre organisation" } });
  const pool = (o: string, code: string, name: string) => prisma.pool.create({ data: { organizationId: o, code: `${code}-${RUN}`, name } });
  const pA = await pool(org.id, "PA", "POOL A");
  const pB = await pool(org.id, "PB", "POOL B");
  const pX = await pool(orgX.id, "PX", "POOL X");
  const school = (poolId: string, code: string) =>
    prisma.school.create({ data: { poolId, code: `${code}-${RUN}`, name: `École ${code}`, province: "Nord-Kivu", territoire: "Goma" } });
  const sA = await school(pA.id, "SA");
  const sA2 = await school(pA.id, "SA2");
  const sB = await school(pB.id, "SB");
  const sX = await school(pX.id, "SX");

  async function user(name: string, orgId: string, grants: { role: string; poolId?: string }[]) {
    return prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(/\W+/g, ".")}.${RUN}@verif.test`,
        passwordHash: "x",
        status: "ACTIVE",
        organizationId: orgId,
        roles: { create: grants.map((g) => ({ roleId: roles.get(g.role)!.id, poolId: g.poolId ?? null })) },
      },
    });
  }
  const ipp = await user("IPP", org.id, [{ role: ROLE_KEYS.IPP }]);
  // Fonction provinciale d'exploitation hors cellule : une fonction créée dans Paramètres
  // avec la lecture provinciale (l'Agent IPP ne lit plus la province depuis le 2026-10-09 ;
  // l'exploitant de l'IPP est rattaché à une cellule, prisma/scripts/verify-cellules.ts).
  const provincialRole = await prisma.roleDefinition.create({
    data: {
      key: `conseiller_${RUN}`,
      label: "Conseiller provincial (test)",
      scope: "PROVINCE",
      rolePermissions: { create: [{ permission: { connect: { key: "reports.review_province" } } }] },
    },
  });
  roles.set(provincialRole.key, provincialRole);
  const exploitIpp = await user("Conseiller provincial", org.id, [{ role: provincialRole.key }]);
  const ipa = await user("IPA", org.id, [{ role: ROLE_KEYS.IPA }]);
  const info = await user("Informaticien", org.id, [{ role: ROLE_KEYS.INFORMATICIEN }]);
  const media = await user("Medias", org.id, [{ role: ROLE_KEYS.CHARGE_MEDIAS }]);
  const chefA = await user("Chef A", org.id, [{ role: ROLE_KEYS.CHEF_POOL, poolId: pA.id }]);
  const exploitA = await user("Exploitant A", org.id, [{ role: ROLE_KEYS.EXPLOITANT_POOL, poolId: pA.id }]);
  const secA = await user("Secretaire A", org.id, [{ role: ROLE_KEYS.SECRETAIRE_POOL, poolId: pA.id }]);
  const agentA = await user("Agent A", org.id, [{ role: ROLE_KEYS.AGENT_POOL, poolId: pA.id }]);
  const inspA = await user("Inspecteur A", org.id, [{ role: ROLE_KEYS.INSPECTEUR, poolId: pA.id }]);
  const inspB = await user("Inspecteur B", org.id, [{ role: ROLE_KEYS.INSPECTEUR, poolId: pB.id }]);
  const cumul = await user("Chef A exploitant B", org.id, [
    { role: ROLE_KEYS.CHEF_POOL, poolId: pA.id },
    { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: pB.id },
  ]);
  const ippX = await user("IPP X", orgX.id, [{ role: ROLE_KEYS.IPP }]);

  // inspA : affecté à SA ; ancienne affectation à SB terminée, avec une
  // inspection et un rapport validé (historique à conserver).
  await prisma.assignment.create({ data: { schoolId: sA.id, inspectorId: inspA.id, assignedById: ipp.id } });
  await prisma.assignment.create({
    data: { schoolId: sB.id, inspectorId: inspA.id, assignedById: ipp.id, active: false, endedAt: new Date(), endReason: "revoked" },
  });
  await prisma.assignment.create({ data: { schoolId: sB.id, inspectorId: inspB.id, assignedById: ipp.id } });

  async function inspectionWithReport(schoolId: string, inspectorId: string, statusKey: string | null, inspectionStatus: InspectionStatus = "RAPPORT_SOUMIS") {
    const inspection = await prisma.inspection.create({ data: { schoolId, inspectorId, status: inspectionStatus } });
    const report = statusKey
      ? await prisma.report.create({
          data: { inspectionId: inspection.id, statusId: status.get(statusKey)!.id, submittedAt: statusKey === S.BROUILLON ? null : new Date() },
        })
      : null;
    return { inspection, report };
  }
  const a1 = await inspectionWithReport(sA.id, inspA.id, S.SOUMIS);
  const a2 = await inspectionWithReport(sA.id, inspA.id, S.A_CORRIGER, "EN_COURS");
  await inspectionWithReport(sA.id, inspA.id, S.BROUILLON, "EN_COURS");
  await inspectionWithReport(sB.id, inspA.id, S.VALIDE, "VALIDEE");
  await inspectionWithReport(sA.id, inspA.id, null, "PLANIFIEE");
  const b1 = await inspectionWithReport(sB.id, inspB.id, S.EN_ATTENTE_VALIDATION);
  // Rapport d'une fiche de période (sans inspection), rattaché par son POOL.
  const periodTemplate = await prisma.formTemplate.findFirstOrThrow();
  const periodForm = await prisma.form.create({ data: { formTemplateId: periodTemplate.id, authorId: inspB.id, poolId: pB.id, completed: true } });
  await prisma.report.create({
    data: { formId: periodForm.id, poolId: pB.id, authorId: inspB.id, statusId: status.get(S.TRANSMIS)!.id, submittedAt: new Date() },
  });
  const x1 = await inspectionWithReport(sX.id, ippX.id, S.SOUMIS);

  await prisma.reportStatusHistory.create({
    data: {
      reportId: a2.report!.id,
      fromStatusId: status.get(S.EN_EXPLOITATION)!.id,
      toStatusId: status.get(S.A_CORRIGER)!.id,
      changedById: exploitIpp.id,
      comment: "Compléter la rubrique 3",
    },
  });
  await prisma.comment.create({ data: { reportId: a2.report!.id, authorId: exploitIpp.id, content: "Merci de corriger." } });
  await prisma.comment.create({ data: { reportId: b1.report!.id, authorId: ipp.id, content: "Commentaire pour B." } });
  await prisma.content.create({
    data: { organizationId: org.id, kind: "ACTUALITE", title: "Brouillon", slug: `brouillon-${RUN}`, summary: "r", body: "b", authorId: media.id },
  });
  console.log("Données créées : 5 rapports reçus et 1 brouillon dans l'organisation de test, 1 rapport dans une autre organisation.");

  // ── Vérifications par fonction ──────────────────────────────────────────
  await check("IPP : pilotage de toute son organisation, rien d'une autre organisation", async () => {
    const s = await single(ipp.id, "pilotage_provincial");
    const d = await loadPilotageProvincial(s);
    assert.equal(d.received, 5, "5 rapports reçus (brouillon exclu)");
    assert.deepEqual(
      d.byPool.map((p) => p.pool.name),
      ["POOL A", "POOL B"]
    );
    assert.equal(d.buckets.a_valider, 1);
    assert.equal(await loadPoolDetail(s, pX.id, null), null, "POOL d'une autre organisation refusé");
    const detailA = await loadPoolDetail(s, pA.id, inspA.id);
    assert.equal(detailA?.pool.id, pA.id);
    assert.deepEqual(
      detailA?.inspectors.map((i) => i.id),
      [inspA.id]
    );
  });

  await check("Fonction provinciale d'exploitation (créée dans Paramètres) : tous les POOL, pas le pilotage", async () => {
    const s = await single(exploitIpp.id, "exploitation_provinciale");
    const d = await loadExploitation(s);
    assert.equal(d.received, 5);
    assert.deepEqual(
      d.byPool.map((p) => [p.pool.name, p.received]),
      [
        ["POOL A", 2],
        ["POOL B", 3],
      ]
    );
    assert.equal(d.myActions, 1, "son changement de statut est compté");
    assert.equal(d.counts.attente_validation, 1);
    assert.ok(!d.oldestPending.some((r) => r.id === x1.report!.id));
    await assert.rejects(() => loadPilotageProvincial(s), "la vue de pilotage lui est refusée côté serveur");
  });

  await check("IPP adjoint sans cellule : aucune vue (D4 : il ne voit que sa cellule)", async () => {
    const s = await single(ipa.id, "aucun");
    await assert.rejects(() => loadExploitation(s));
    await assert.rejects(() => loadPilotageProvincial(s));
  });

  await check("Informaticien : administration, aucune donnée de rapport", async () => {
    const s = await single(info.id, "administration");
    const d = await loadAdministration(s);
    assert.equal(d.activePools, 2);
    assert.equal(d.activeUsers, 12);
    await assert.rejects(() => loadExploitation(s));
  });

  await check("Chargé des médias : ses seuls contenus", async () => {
    const s = await single(media.id, "contenus");
    assert.deepEqual((await loadContenus(s)).counts, { BROUILLON: 1 });
  });

  await check("Chef de POOL A : son POOL, même si l'URL vise le POOL B ou un inspecteur de B", async () => {
    const s = await single(chefA.id, "pilotage_pool");
    const d = await loadPoolDetail(s, pB.id, inspB.id);
    assert.equal(d?.pool.id, pA.id, "le POOL demandé dans l'URL est ignoré");
    assert.equal(d?.received, 2, "l'ancien rapport de l'inspecteur A, fait dans une école du POOL B, compte pour le POOL B");
    assert.deepEqual(
      d?.inspectors.map((i) => i.id),
      [inspA.id]
    );
    assert.equal(d?.selectedInspector, null, "inspecteur d'un autre POOL refusé");
    await assert.rejects(() => loadPilotageProvincial(s));
  });

  await check("Exploitant de POOL A : rapports de son POOL uniquement", async () => {
    const s = await single(exploitA.id, "exploitation_pool");
    const d = await loadExploitation(s);
    assert.equal(d.received, 2);
    assert.deepEqual(
      d.byPool.map((p) => p.pool.id),
      [pA.id]
    );
    assert.deepEqual(
      d.oldestPending.map((r) => r.id),
      [a1.report!.id]
    );
    assert.equal(d.counts.corrections, 1);
  });

  await check("Secrétaire de POOL A : écoles de son POOL", async () => {
    const s = await single(secA.id, "ecoles_pool");
    const d = await loadEcolesPool(s);
    assert.equal(d?.active, 2);
    assert.deepEqual(
      d?.unassigned.map((x) => x.id),
      [sA2.id],
      "SA est affectée, SB n'est pas de son POOL"
    );
  });

  await check("Agent de POOL : aucun tableau de bord", async () => {
    await single(agentA.id, "aucun");
  });

  await check("Inspecteur A : ses écoles et rapports, historique conservé, rien de l'inspecteur B", async () => {
    const s = await single(inspA.id, "itinerant");
    const d = await loadItinerant(s);
    assert.deepEqual(
      d.assignments.map((a) => a.schoolName),
      ["École SA"],
      "affectation terminée exclue"
    );
    assert.equal(d.reportCount, 4, "SOUMIS, A_CORRIGER, BROUILLON et l'ancien rapport du POOL B");
    assert.ok(
      d.reportsByStatus.some((r) => r.key === S.VALIDE),
      "historique après changement d'affectation"
    );
    assert.equal(d.realized, 2);
    assert.equal(d.planned.length, 1);
    assert.deepEqual(
      d.corrections.map((c) => [c.id, c.comment]),
      [[a2.report!.id, "Compléter la rubrique 3"]]
    );
    assert.deepEqual(
      d.recentComments.map((c) => c.content),
      ["Merci de corriger."],
      "pas le commentaire du rapport de B"
    );
    await assert.rejects(() => loadExploitation(s));
    await assert.rejects(() => loadPoolDetail(s, pA.id, null));
  });

  await check("Inspecteur B : ses seuls rapports", async () => {
    const s = await single(inspB.id, "itinerant");
    const d = await loadItinerant(s);
    assert.equal(d.reportCount, 2);
    assert.deepEqual(
      d.recentComments.map((c) => c.content),
      ["Commentaire pour B."]
    );
  });

  await check("Cumul (chef de A + exploitant de B) : deux sections, chacune à son POOL", async () => {
    const scopes = await scopesOf(cumul.id);
    assert.deepEqual(
      scopes.map((s) => [s.kind, s.poolId]),
      [
        ["pilotage_pool", pA.id],
        ["exploitation_pool", pB.id],
      ]
    );
    assert.equal((await loadExploitation(scopes[1])).received, 3);
    assert.equal((await loadPoolDetail(scopes[0], null, null))?.received, 2);
  });

  await check("IPP en « Voir comme » chef du POOL A : uniquement le POOL A", async () => {
    const s = await single(ipp.id, "pilotage_pool", { role: ROLE_KEYS.CHEF_POOL, poolId: pA.id });
    assert.equal(s.poolId, pA.id);
    assert.equal((await loadPoolDetail(s, pB.id, null))?.pool.id, pA.id);
  });

  await check("IPP d'une autre organisation : ne voit que la sienne", async () => {
    const s = await single(ippX.id, "pilotage_provincial");
    assert.equal((await loadPilotageProvincial(s)).received, 1);
    assert.equal(await loadPoolDetail(s, pA.id, null), null);
  });

  // Cas signalé le 2026-10-08 : inspecteur réel, école de démonstration. Le
  // rapport est de démonstration : invisible des comptes réels (comme sur
  // /rapports et /exploitation), visible des comptes de démonstration.
  await check("Démonstration et officiel séparés : rapport d'une école de démonstration", async () => {
    const sDemo = await prisma.school.create({
      data: { poolId: pA.id, code: `SD-${RUN}`, name: "École démo", province: "Nord-Kivu", territoire: "Goma", isDemo: true },
    });
    await inspectionWithReport(sDemo.id, inspA.id, S.SOUMIS);
    const exploitDemo = await user("Exploitant A demo", org.id, [{ role: ROLE_KEYS.EXPLOITANT_POOL, poolId: pA.id }]);
    await prisma.user.update({ where: { id: exploitDemo.id }, data: { isDemo: true } });

    const real = await loadExploitation(await single(exploitA.id, "exploitation_pool"));
    assert.equal(real.received, 2, "compte réel : rapport de l'école de démonstration exclu");
    assert.ok(!real.oldestPending.some((r) => r.title.includes("École démo")));
    assert.equal((await loadPilotageProvincial(await single(ipp.id, "pilotage_provincial"))).received, 5);

    const demo = await loadExploitation(await single(exploitDemo.id, "exploitation_pool"));
    assert.equal(demo.received, 1, "compte de démonstration : uniquement le rapport de démonstration");
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
