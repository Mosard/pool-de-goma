// Vérification de bout en bout de l'import Excel des écoles
// (docs/import-ecoles-excel.md), sur base locale seedée UNIQUEMENT.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-schools-import.ts
//
// Comptes : ceux du jeu de démonstration (IPP, informaticien, chef de POOL,
// exploitant, inspecteur) + deux comptes OFFICIELS créés ici (secrétaire de
// POOL, Super Admin), pour couvrir aussi la règle démonstration / réel.

import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError } from "../../src/lib/permissions";
import { ROLE_KEYS } from "../../src/lib/rbac-data";
import { IMPORT_COLUMNS, type ImportField } from "../../src/lib/schools-import/columns";
import { importSchools, manageablePools } from "../../src/lib/schools-import/server";
import { readSchoolRows } from "../../src/lib/schools-import/workbook";

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
const RUN = Date.now().toString(36).toUpperCase();

type Line = Partial<Record<ImportField, string | number>>;
async function xlsx(lines: Line[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Écoles");
  ws.addRow(IMPORT_COLUMNS.map((c) => c.header));
  for (const l of lines) ws.addRow(IMPORT_COLUMNS.map((c) => l[c.field] ?? null));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const school = (poolCode: string, code: string, over: Line = {}): Line => ({
  poolCode,
  code,
  name: `EP Vérif ${code}`,
  province: "Nord-Kivu",
  territoire: "Goma",
  type: "Primaire",
  ...over,
});

async function officialUser(email: string, roleKey: string, poolId: string | null, organizationId: string) {
  const role = await prisma.roleDefinition.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: "ACTIVE", isDemo: false },
    create: { email, name: `Vérif ${roleKey}`, passwordHash: "-", status: "ACTIVE", isDemo: false, organizationId, poolId },
  });
  const has = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, poolId } });
  if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, poolId } });
  return user.id;
}

async function main() {
  const [ipp, informaticien, chef, exploitant, inspecteur] = await Promise.all(
    ["ipp", "informaticien", "chef.goma", "exploitant.goma", "inspecteur.goma"].map((e) => id(`${e}@ipp-nordkivu1.test`))
  );
  const gomaId = (await prisma.userRole.findFirstOrThrow({ where: { userId: chef, role: { key: ROLE_KEYS.CHEF_POOL } } })).poolId!;
  const goma = await prisma.pool.findUniqueOrThrow({ where: { id: gomaId } });
  const other = await prisma.pool.findFirstOrThrow({ where: { id: { not: goma.id }, organizationId: goma.organizationId, active: true } });
  const secretaire = await officialUser("verif.secretaire.goma@verif.local", ROLE_KEYS.SECRETAIRE_POOL, goma.id, goma.organizationId);
  const superAdmin = await officialUser("verif.super-admin@verif.local", ROLE_KEYS.SUPER_ADMIN, null, goma.organizationId);

  const run = (actorId: string, poolId: string, lines: Line[]) =>
    xlsx(lines).then((data) => importSchools({ actorId, poolId, fileName: "verif.xlsx", data, viewMode: null }));
  const snapshot = () => prisma.school.findMany({ orderBy: { id: "asc" } });

  const before = await snapshot();
  const c1 = `V${RUN}-01`;
  const c2 = `V${RUN}-02`;

  await step("fichier valide : les écoles sont créées dans le POOL choisi", async () => {
    const r = await run(chef, goma.id, [
      school(goma.code, c1, { classCount: 8, teacherCount: 10, approvalDecree: "MINEPSP/CABMIN/0042/2019" }),
      school(goma.code, c2, { type: "Secondaire", options: "Pédagogie générale, Scientifique" }),
    ]);
    assert.equal(r.created.length, 2);
    assert.equal(r.rejected.length, 0);
    const s = await prisma.school.findUniqueOrThrow({ where: { poolId_code: { poolId: goma.id, code: c1 } } });
    assert.equal(s.classCount, 8);
    assert.equal(s.approvalDecree, "MINEPSP/CABMIN/0042/2019");
    assert.ok(s.isDemo, "créée depuis un compte de démonstration : école de démonstration");
  });

  await step("code déjà existant : mise à jour, pas de doublon ; cellule vide = valeur conservée", async () => {
    const r = await run(chef, goma.id, [school(goma.code, c1.toLowerCase(), { teacherCount: 14, name: "EP Vérif renommée" })]);
    assert.equal(r.created.length, 0);
    assert.equal(r.updated.length, 1);
    const all = await prisma.school.findMany({ where: { poolId: goma.id, code: { equals: c1, mode: "insensitive" } } });
    assert.equal(all.length, 1, "aucun doublon");
    assert.equal(all[0].code, c1, "le code garde son écriture");
    assert.equal(all[0].teacherCount, 14);
    assert.equal(all[0].classCount, 8, "cellule vide : valeur conservée");
    assert.equal(all[0].name, "EP Vérif renommée");
    const again = await run(chef, goma.id, [school(goma.code, c1, { teacherCount: 14, name: "EP Vérif renommée" })]);
    assert.equal(again.unchanged.length, 1);
  });

  await step("lignes fautives rejetées (numéro + motif) sans bloquer les bonnes", async () => {
    const c3 = `V${RUN}-03`;
    const r = await run(chef, goma.id, [
      school(goma.code, c3),
      school(goma.code, `V${RUN}-04`, { name: "" }),
      school(goma.code, ""),
      school(other.code, `V${RUN}-05`),
      school(goma.code, `V${RUN}-06`, { classCount: "douze" }),
      school(goma.code, `V${RUN}-07`, { type: "Primaire", options: "Scientifique" }),
    ]);
    assert.deepEqual(r.created.map((s) => s.code), [c3]);
    assert.deepEqual(r.rejected.map((x) => x.line), [3, 4, 5, 6, 7]);
    assert.match(r.rejected[0].reason, /Nom de l'école manquant/);
    assert.match(r.rejected[1].reason, /Code de l'école manquant/);
    assert.match(r.rejected[2].reason, /différent du POOL choisi/, "le POOL n'est jamais déduit du fichier");
    assert.match(r.rejected[3].reason, /Nombre de classes/);
    assert.match(r.rejected[4].reason, /secondaires/);
    assert.equal(await prisma.school.count({ where: { code: `V${RUN}-05` } }), 0);
  });

  await step("portée : chef de POOL vers un autre POOL refusé, même par appel direct ; rien n'est écrit", async () => {
    const count = await prisma.school.count();
    for (const actor of [chef, secretaire]) {
      await assert.rejects(run(actor, other.id, [school(other.code, `V${RUN}-X`)]), ForbiddenError);
    }
    await assert.rejects(run(chef, "pool-inexistant", [school(goma.code, `V${RUN}-Y`)]), ForbiddenError);
    assert.equal(await prisma.school.count(), count);
  });

  await step("sans schools.manage : inspecteur et exploitant refusés, même dans leur POOL", async () => {
    for (const actor of [inspecteur, exploitant]) {
      await assert.rejects(run(actor, goma.id, [school(goma.code, `V${RUN}-Z`)]), ForbiddenError);
      assert.deepEqual(await manageablePools(actor, { viewMode: null }), []);
    }
  });

  await step("IPP, informaticien et Super Admin : tous les POOL ; même code dans deux POOL = deux écoles", async () => {
    const r1 = await run(ipp, other.id, [school(other.code, c1)]);
    assert.equal(r1.created.length, 1);
    const r2 = await run(informaticien, other.id, [school(other.code, `V${RUN}-08`)]);
    assert.equal(r2.created.length, 1);
    const r3 = await run(superAdmin, other.id, [school(other.code, `V${RUN}-09`)]);
    assert.equal(r3.created.length, 1);
    assert.ok(!(await prisma.school.findUniqueOrThrow({ where: { poolId_code: { poolId: other.id, code: `V${RUN}-09` } } })).isDemo);
    assert.equal(await prisma.school.count({ where: { code: c1 } }), 2);
    const all = await prisma.pool.count({ where: { organizationId: goma.organizationId, active: true } });
    for (const actor of [ipp, informaticien, superAdmin]) assert.equal((await manageablePools(actor, { viewMode: null })).length, all);
    assert.deepEqual((await manageablePools(chef, { viewMode: null })).map((p) => p.id), [goma.id]);
  });

  await step("secrétaire de POOL (officiel) : son POOL ; un compte de démonstration ne modifie pas une école réelle", async () => {
    const real = `V${RUN}-R1`;
    const r = await run(secretaire, goma.id, [school(goma.code, real)]);
    assert.equal(r.created.length, 1);
    const demo = await run(chef, goma.id, [school(goma.code, real, { name: "Tentative démo" })]);
    assert.equal(demo.updated.length, 0);
    assert.match(demo.rejected[0].reason, /démonstration/);
    assert.equal((await prisma.school.findUniqueOrThrow({ where: { poolId_code: { poolId: goma.id, code: real } } })).name, `EP Vérif ${real}`);
  });

  await step("écoles déjà enregistrées préservées (aucune supprimée, aucune modifiée hors fichier)", async () => {
    const after = new Map((await snapshot()).map((s) => [s.id, s]));
    for (const s of before) {
      const now = after.get(s.id);
      assert.ok(now, `école ${s.code} toujours présente`);
      assert.deepEqual({ ...now, updatedAt: null }, { ...s, updatedAt: null }, `école ${s.code} inchangée`);
    }
  });

  await step("traçabilité : récapitulatif d'import et une entrée par école touchée", async () => {
    assert.ok((await prisma.auditLog.count({ where: { action: "school.import", entityId: goma.id } })) >= 3);
    const s = await prisma.school.findUniqueOrThrow({ where: { poolId_code: { poolId: goma.id, code: c1 } } });
    assert.ok((await prisma.auditLog.count({ where: { entityId: s.id, action: { in: ["school.create", "school.update"] } } })) >= 2);
  });

  await step("canevas relu : en-têtes reconnus", async () => {
    assert.deepEqual(await readSchoolRows(await xlsx([])), []);
  });

  console.log(`\n${passed} vérifications réussies.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
