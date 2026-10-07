// Vérification de bout en bout des exports, sur base locale seedée UNIQUEMENT.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-exports.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { buildReportsWorkbook, loadExportSubject, loadReportRows, resolveFilters } from "../../src/lib/exports/server";
import { PdfAccessError, loadReportPdfSource } from "../../src/lib/exports/report-pdf-source";
import { ROLE_KEYS } from "../../src/lib/rbac-data";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.POSTGRES_URL ?? "")) {
  console.error("Refus : base locale uniquement.");
  process.exit(2);
}
let passed = 0;
const step = async (name: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
};
const id = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

async function main() {
  const [ipp, exploitantIpp, chef, exploitantPool, inspecteur] = await Promise.all(
    ["ipp", "exploitant.ipp", "chef.goma", "exploitant.goma", "inspecteur.goma"].map((e) => id(`${e}@ipp-nordkivu1.test`))
  );
  const goma = (await prisma.userRole.findFirstOrThrow({ where: { userId: chef, role: { key: ROLE_KEYS.CHEF_POOL } } })).poolId!;
  const all = async (userId: string, raw: Record<string, string> = {}) => {
    const subject = await loadExportSubject(userId);
    const { filters, error } = await resolveFilters(subject, raw);
    return { subject, error, rows: error ? [] : await loadReportRows(subject, filters, 100_000) };
  };

  await step("inspecteur : uniquement ses propres rapports", async () => {
    const { rows } = await all(inspecteur);
    const name = (await prisma.user.findUniqueOrThrow({ where: { id: inspecteur } })).name;
    assert.ok(rows.every((r) => r.inspecteur === name));
  });
  await step("chef et exploitant de POOL : uniquement leur POOL", async () => {
    const poolName = (await prisma.pool.findUniqueOrThrow({ where: { id: goma } })).name;
    for (const u of [chef, exploitantPool]) {
      const { rows } = await all(u);
      assert.ok(rows.length > 0 && rows.every((r) => r.pool === poolName), "rapports de son POOL seulement");
    }
  });
  await step("exploitant IPP et IPP : toute la province (plusieurs POOL)", async () => {
    for (const u of [exploitantIpp, ipp]) assert.ok(new Set((await all(u)).rows.map((r) => r.pool)).size > 1);
  });
  await step("démonstration et officiel séparés", async () => {
    const official = await prisma.user.findFirst({ where: { isDemo: false, status: "ACTIVE" } });
    if (official) assert.ok((await all(official.id)).rows.every((r) => !r.ecole.toLowerCase().includes("démo")));
    assert.ok((await all(ipp)).subject.isDemo, "les comptes du jeu de démonstration ne voient que la démonstration");
  });
  await step("requête forgée : POOL hors périmètre refusé", async () => {
    const other = await prisma.pool.findFirstOrThrow({ where: { id: { not: goma } } });
    assert.match((await all(chef, { pool: other.id })).error ?? "", /hors de votre périmètre/);
    assert.match((await all(inspecteur, { inspecteur: ipp })).error ?? "", /vos propres rapports/);
  });
  await step("Excel : fichier valide, une ligne par rapport filtré", async () => {
    const { rows } = await all(chef, { pool: goma });
    const buf = await buildReportsWorkbook(rows);
    assert.equal(buf.subarray(0, 2).toString(), "PK");
  });
  await step("PDF (préparation) : version de fiche du rapport, accès refusé hors périmètre", async () => {
    const r = await prisma.report.findFirstOrThrow({ where: { formId: { not: null } }, include: { form: { include: { formTemplate: true } } } });
    const legacy = await prisma.report.findFirst({ where: { inspectionId: { not: null }, inspection: { school: { poolId: goma } } } });
    const chefSubject = await loadExportSubject(chef);
    {
      const pdf = await loadReportPdfSource(await loadExportSubject(ipp), r.id);
      assert.equal(pdf.version, `${r.form!.formTemplate.code} v${r.form!.formTemplate.version}`);
    }
    if (legacy) assert.equal((await loadReportPdfSource(chefSubject, legacy.id)).version, "ancien format");
    const outside = await prisma.report.findFirstOrThrow({ where: { inspection: { school: { poolId: { not: goma } } } } });
    await assert.rejects(loadReportPdfSource(await loadExportSubject(inspecteur), outside.id), PdfAccessError);
  });
  console.log(`\n${passed} vérifications réussies.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
