// Test de bout en bout des fiches officielles de l'inspection itinérante, à
// lancer UNIQUEMENT sur une base locale jetable, migrée et seedée
// (npm run db:seed). Écrit des fiches et rapports de test sur des écoles de
// démonstration. Refuse toute base non locale.
//
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-fiches-flow.ts

import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError, loadUserAccess } from "../../src/lib/permissions";
import { PERMISSIONS, ROLE_KEYS, WORKFLOW_STATUS_KEYS } from "../../src/lib/rbac-data";
import { applyTransition, getWorkflowStatusByKey, refreshInspectionStatus } from "../../src/lib/workflow";
import { computeFiche } from "../../src/lib/fiches/calculs";
import { getFicheDef } from "../../src/lib/fiches/defs/index";
import { ensureOfficialTemplates, nextReportNumber, proposedTemplates } from "../../src/lib/fiches/server";
import { REPORT_SCOPE_INCLUDE, reportScope } from "../../src/lib/fiches/report-scope";
import { validateFiche } from "../../src/lib/fiches/validation";
import { loadAiReports } from "../../src/lib/ai/reports";
import type { FicheData, RatedPosteDef } from "../../src/lib/fiches/types";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const SIG = { name: "Signataire", image: "data:image/png;base64,AAAA", signedAt: new Date().toISOString() };

/** C3 complète : toutes les rubriques à 3, en-tête et signatures remplis. */
function completeC3(): FicheData {
  const def = getFicheDef("C3", 1)!;
  const values: FicheData["values"] = {
    "entete.inspecteur": "Inspecteur démo",
    "entete.niveauDiscipline": "Primaire",
    "entete.posteAttache": "POOL démo",
    "entete.anneeScolaire": "2026-2027",
    "entete.niveau": "P",
    "entete.etablissement": "EP démo",
    "entete.enseignant": "Enseignant démo",
    "1.discipline": "Français",
    "1.classe": "4e",
    "1.presents": "30",
    "1.inscrits": "32",
  };
  for (const s of def.sections) for (const b of s.blocks) if (b.kind === "rated") for (const i of (b as RatedPosteDef).items) values[i.id] = "3";
  return { format: 2, values, signatures: { "sig.enseignant": SIG, "sig.ce": SIG, "sig.inspecteur": SIG } };
}

async function main() {
  const legacyReportsBefore = await prisma.report.count({ where: { inspectionId: { not: null } } });
  const simulatedF1 = await prisma.formTemplate.findUnique({ where: { code_version: { code: "F1", version: 1 } } });

  await step("inscription des 16 fiches officielles, sans doublon ni modification des fiches simulées", async () => {
    await ensureOfficialTemplates();
    await ensureOfficialTemplates();
    const official = await prisma.formTemplate.count({ where: { module: { not: null } } });
    assert.equal(official, 16);
    if (simulatedF1) {
      const after = await prisma.formTemplate.findUniqueOrThrow({ where: { id: simulatedF1.id } });
      assert.equal(after.updatedAt.getTime(), simulatedF1.updatedAt.getTime(), "F1 simulée (v1) inchangée");
      assert.match(after.title, /Contrôle financier/);
    }
  });

  await step("fiches proposées : dernière version par code (F1 officielle v2), fiches de période à part", async () => {
    const visite = await proposedTemplates("visite");
    const f1 = visite.find((t) => t.code === "F1")!;
    assert.equal(f1.version, 2);
    assert.match(f1.title, /ACTION DE FORMATION/);
    assert.ok(visite.some((t) => t.code === "C3") && !visite.some((t) => t.code === "A2"));
    const periode = (await proposedTemplates("periode")).map((t) => t.code).sort();
    assert.deepEqual(periode, ["A2", "A3", "A4", "A6"]);
  });

  // Inspecteur et école de démonstration, exploitant IPP, statuts.
  const assignment = await prisma.assignment.findFirstOrThrow({
    where: { active: true, school: { isDemo: true }, inspector: { isDemo: true, status: "ACTIVE" } },
    include: { school: { include: { pool: true } }, inspector: true },
  });
  const inspector = assignment.inspector;
  const school = assignment.school;
  const otherInspector = await prisma.user.findFirst({
    where: { isDemo: true, status: "ACTIVE", id: { not: inspector.id }, roles: { some: { role: { key: ROLE_KEYS.INSPECTEUR }, poolId: school.poolId } } },
  });
  const exploitantIpp = await prisma.user.findFirst({ where: { isDemo: true, status: "ACTIVE", roles: { some: { role: { key: ROLE_KEYS.EXPLOITANT_IPP } } } } });
  const c3Template = (await proposedTemplates("visite")).find((t) => t.code === "C3")!;
  const c1Template = (await proposedTemplates("visite")).find((t) => t.code === "C1")!;
  const inspection = await prisma.inspection.create({ data: { schoolId: school.id, inspectorId: inspector.id, status: "EN_COURS" } });

  const newForm = (templateId: string, data: FicheData) =>
    prisma.form.create({
      data: { inspectionId: inspection.id, formTemplateId: templateId, authorId: inspector.id, poolId: school.poolId, data: data as unknown as Prisma.InputJsonValue },
    });
  const c3a = await newForm(c3Template.id, completeC3());
  const c3b = await newForm(c3Template.id, completeC3());
  const c1 = await newForm(c1Template.id, { format: 2, values: {}, signatures: {} });

  await step("plusieurs C3 dans la même visite ; C3 complète valide, note finale TRES BON", async () => {
    const def = getFicheDef("C3", 1)!;
    assert.deepEqual(validateFiche(def, completeC3()).filter((i) => i.level === "error"), []);
    assert.equal(computeFiche(def, completeC3().values).synthese?.mention, "TRES BON");
    assert.equal(await prisma.form.count({ where: { inspectionId: inspection.id, formTemplateId: c3Template.id } }), 2);
  });

  const soumis = await getWorkflowStatusByKey(WORKFLOW_STATUS_KEYS.SOUMIS);
  const now = new Date();
  async function submit(formId: string, code: string) {
    return prisma.$transaction(async (tx) => {
      const numbering = await nextReportNumber(tx, { authorId: inspector.id, code, poolCode: school.pool.code, author: inspector, now });
      await tx.form.update({ where: { id: formId }, data: { ...numbering, submittedAt: now, completed: true } });
      const report = await tx.report.create({ data: { formId, poolId: school.poolId, authorId: inspector.id, statusId: soumis.id, submittedAt: now } });
      await tx.reportStatusHistory.create({ data: { reportId: report.id, toStatusId: soumis.id, changedById: inspector.id } });
      return { report, numbering };
    });
  }

  const before = await prisma.form.aggregate({ where: { authorId: inspector.id, numberYear: now.getFullYear() }, _max: { universalSeq: true } });
  const u0 = before._max.universalSeq ?? 0;
  const first = await submit(c3a.id, "C3");
  const second = await submit(c3b.id, "C3");

  await step("numérotation à double entrée : n° thématique par code, n° universel continu", async () => {
    assert.equal(second.numbering.universalSeq, first.numbering.universalSeq + 1);
    assert.equal(first.numbering.universalSeq, u0 + 1);
    assert.equal(second.numbering.thematicSeq, first.numbering.thematicSeq + 1);
    assert.match(first.numbering.number, new RegExp(`^61/${school.pool.code}/[A-Z]+/C3\\.\\d{2,}/\\d{2,}/${now.getFullYear()}$`));
  });

  await step("statut de la visite : en cours tant qu'une fiche reste à soumettre, puis « rapport soumis »", async () => {
    await refreshInspectionStatus(inspection.id);
    assert.equal((await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } })).status, "EN_COURS");
    await submit(c1.id, "C1");
    await refreshInspectionStatus(inspection.id);
    assert.equal((await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } })).status, "RAPPORT_SOUMIS");
  });

  await step("périmètre d'un rapport par fiche : POOL, auteur, titre, numéro", async () => {
    const r = await prisma.report.findUniqueOrThrow({ where: { id: first.report.id }, include: REPORT_SCOPE_INCLUDE });
    const scope = reportScope(r);
    assert.equal(scope.poolId, school.poolId);
    assert.equal(scope.authorId, inspector.id);
    assert.equal(scope.title, `C3 — ${school.name}`);
    assert.equal(scope.number, first.numbering.number);
    assert.equal(scope.isDemo, true);
  });

  if (exploitantIpp) {
    await step("exploitant IPP : exploitation au niveau POOL sur tous les POOL (décision Q8)", async () => {
      const { permissions } = await loadUserAccess(exploitantIpp.id, { viewMode: null });
      assert.ok(permissions.some((p) => p.permissionKey === PERMISSIONS.REPORTS_REVIEW_POOL && p.poolId === null));
      assert.ok(permissions.some((p) => p.permissionKey === PERMISSIONS.AI_ANALYZE));
      await applyTransition({
        reportId: first.report.id,
        toStatusKey: WORKFLOW_STATUS_KEYS.RECU,
        actorId: exploitantIpp.id,
        actorPermissions: permissions,
        actorPoolId: null,
        actorOrganizationId: exploitantIpp.organizationId,
      });
      for (const key of [WORKFLOW_STATUS_KEYS.EN_EXPLOITATION, WORKFLOW_STATUS_KEYS.A_CORRIGER]) {
        await applyTransition({ reportId: first.report.id, toStatusKey: key, actorId: exploitantIpp.id, actorPermissions: permissions, actorPoolId: null, actorOrganizationId: exploitantIpp.organizationId, comment: "Test" });
      }
      await refreshInspectionStatus(inspection.id);
      assert.equal((await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } })).status, "EN_COURS", "fiche renvoyée : visite de nouveau en cours");
    });
  } else {
    console.log("  --  exploitant IPP de démonstration absent : étape ignorée");
  }

  if (exploitantIpp && otherInspector) {
    await step("resoumettre : réservé à l'auteur, pas à un autre inspecteur du POOL", async () => {
      const other = await loadUserAccess(otherInspector.id, { viewMode: null });
      await assert.rejects(
        applyTransition({ reportId: first.report.id, toStatusKey: WORKFLOW_STATUS_KEYS.SOUMIS, actorId: otherInspector.id, actorPermissions: other.permissions, actorPoolId: school.poolId, actorOrganizationId: otherInspector.organizationId }),
        (e: unknown) => e instanceof ForbiddenError
      );
      const own = await loadUserAccess(inspector.id, { viewMode: null });
      await applyTransition({ reportId: first.report.id, toStatusKey: WORKFLOW_STATUS_KEYS.SOUMIS, actorId: inspector.id, actorPermissions: own.permissions, actorPoolId: school.poolId, actorOrganizationId: inspector.organizationId });
      const r = await prisma.report.findUniqueOrThrow({ where: { id: first.report.id }, include: { status: true, form: true } });
      assert.equal(r.status.key, WORKFLOW_STATUS_KEYS.SOUMIS);
      assert.equal(r.form?.number, first.numbering.number, "le numéro ne change pas à la resoumission");
    });
  }

  await step("analyse IA : la fiche officielle est lue (note finale aplatie)", async () => {
    const reports = await loadAiReports({
      organizationId: school.pool.organizationId,
      poolId: school.poolId,
      from: new Date(now.getTime() - 86_400_000),
      to: new Date(now.getTime() + 86_400_000),
      isDemo: true,
    });
    const r = reports.find((x) => x.id === second.report.id);
    assert.ok(r, "rapport par fiche présent");
    assert.equal(r!.fields.find((f) => f.key === "C3.noteFinale")?.value, 3);
  });

  await step("rapports existants de l'ancien circuit intacts", async () => {
    assert.equal(await prisma.report.count({ where: { inspectionId: { not: null } } }), legacyReportsBefore);
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
