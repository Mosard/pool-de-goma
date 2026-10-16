// Import des écoles (docs/import-ecoles-excel.md) : validation des lignes,
// règles de création / mise à jour, canevas et lecture de fichiers réels.
// Le contrôle d'accès et l'écriture en base sont vérifiés par
// prisma/scripts/verify-schools-import.ts (base locale).

import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { IMPORT_COLUMNS, SCHOOLS_SHEET_NAME, matchHeader } from "@/lib/schools-import/columns";
import { planCreate, planUpdate, validateRows, type RawRow, type SchoolImportData } from "@/lib/schools-import/validate";
import { ImportFileError, buildSchoolTemplate, readSchoolRows } from "@/lib/schools-import/workbook";
import { isSecondaryType, normalizeOptions, parseCount, parseManagement } from "@/lib/school-fields";
import { schoolSchema } from "@/lib/validations";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";

const row = (line: number, cells: RawRow["cells"]): RawRow => ({
  line,
  cells: { poolCode: "GOMA", code: `EP-${line}`, name: "EP Les Volcans", province: "Nord-Kivu", territoire: "Goma", ...cells },
});

test("champs : secondaire, options, nombres", () => {
  assert.ok(isSecondaryType("École SECONDAIRE"));
  assert.ok(!isSecondaryType("Primaire"));
  assert.equal(normalizeOptions(" Pédagogie générale ,Scientifique;; scientifique , "), "Pédagogie générale, Scientifique");
  assert.equal(normalizeOptions("  "), null);
  assert.equal(parseCount("12"), 12);
  assert.equal(parseCount(12), 12);
  assert.equal(parseCount("12,0"), 12);
  assert.equal(parseCount(""), null);
  for (const bad of ["-1", "12.5", "douze", "1e3"]) assert.equal(parseCount(bad), "invalid", bad);
});

test("ligne valide : POOL du fichier = POOL choisi (casse ignorée), cellules vides = null", () => {
  const { valid, rejected } = validateRows([row(2, { poolCode: "goma", classCount: "8", teacherCount: "" })], "GOMA");
  assert.equal(rejected.length, 0);
  assert.equal(valid[0].data.classCount, 8);
  assert.equal(valid[0].data.teacherCount, null);
  assert.equal(valid[0].data.director, null);
});

test("lignes fautives rejetées avec numéro et motif, sans bloquer les bonnes", () => {
  const { valid, rejected } = validateRows(
    [
      row(2, {}),
      row(3, { name: "" }),
      row(4, { code: "" }),
      row(5, { poolCode: "KARISIMBI" }),
      row(6, { poolCode: "" }),
      row(7, { teacherCount: "12,5" }),
      row(8, {}),
    ],
    "GOMA"
  );
  assert.deepEqual(valid.map((v) => v.line), [2, 8]);
  const reason = (line: number) => rejected.find((r) => r.line === line)?.reason ?? "";
  assert.match(reason(3), /Nom de l'école manquant/);
  assert.match(reason(4), /Code de l'école manquant/);
  assert.match(reason(5), /KARISIMBI.*différent du POOL choisi/);
  assert.match(reason(6), /Code du POOL manquant/);
  assert.match(reason(7), /Nombre d'enseignants/);
  assert.equal(rejected.find((r) => r.line === 4)?.code, null);
});

test("code répété dans le fichier : seule la première occurrence est traitée (casse ignorée)", () => {
  const { valid, rejected } = validateRows([row(2, { code: "EP-01" }), row(3, { code: "ep-01" })], "GOMA");
  assert.equal(valid.length, 1);
  assert.match(rejected[0].reason, /ligne 2/);
});

const data = (over: Partial<SchoolImportData> = {}): SchoolImportData => ({
  code: "INST-01",
  name: "Institut La Paix",
  province: "Nord-Kivu",
  territoire: "Goma",
  type: null,
  management: null,
  director: null,
  phone: null,
  address: null,
  approvalDecree: null,
  classCount: null,
  teacherCount: null,
  qualifiedTeacherCount: null,
  options: null,
  ...over,
});

test("options : écoles secondaires seulement (décision Q4)", () => {
  assert.equal(planCreate(data({ type: "Primaire", options: "Scientifique" })).ok, false);
  assert.equal(planCreate(data({ options: "Scientifique" })).ok, false, "type absent : pas secondaire");
  assert.equal(planCreate(data({ type: "Secondaire", options: "Scientifique" })).ok, true);
});

test("mise à jour : cellule vide = valeur conservée (Q2), seuls les changements sont écrits", () => {
  const existing = { ...data({ type: "Secondaire", director: "Mme Furaha", classCount: 12, options: "Scientifique" }) };
  const plan = planUpdate(existing, data({ name: "Institut La Paix", teacherCount: 30, director: null }));
  assert.ok(plan.ok);
  assert.deepEqual(plan.changes, { teacherCount: 30 });

  const same = planUpdate(existing, data({ type: "Secondaire" }));
  assert.ok(same.ok && Object.keys(same.changes).length === 0, "rien à changer");

  // Type fourni par le fichier ou déjà enregistré : options acceptées sur une école secondaire existante.
  const opts = planUpdate(existing, data({ options: "Pédagogie générale" }));
  assert.ok(opts.ok);
  assert.equal(opts.changes.options, "Pédagogie générale");

  // L'école n'est plus secondaire : options retirées, comme dans le formulaire.
  const primaire = planUpdate(existing, data({ type: "Primaire" }));
  assert.ok(primaire.ok);
  assert.equal(primaire.changes.options, null);
  assert.equal(planUpdate(existing, data({ type: "Primaire", options: "X" })).ok, false);
});

test("formulaire : nouveaux champs validés, options refusées hors secondaire", () => {
  const base = { poolId: "p1", name: "EP Test", code: " EP-9 ", province: "Nord-Kivu", territoire: "Goma", address: "", director: "", phone: "" };
  const ok = schoolSchema.safeParse({ ...base, type: "Secondaire", approvalDecree: "", classCount: "6", teacherCount: null, options: "A, B" });
  assert.ok(ok.success);
  assert.equal(ok.data.code, "EP-9");
  assert.equal(ok.data.approvalDecree, null);
  assert.equal(ok.data.classCount, 6);
  assert.equal(ok.data.teacherCount, null);
  assert.equal(ok.data.options, "A, B");
  assert.equal(schoolSchema.safeParse({ ...base, type: "Primaire", options: "A" }).success, false);
  assert.equal(schoolSchema.safeParse({ ...base, type: "", classCount: "-3" }).success, false);
  // Formulaire d'une école non secondaire : le champ options n'est pas envoyé.
  assert.ok(schoolSchema.safeParse({ ...base, type: "Primaire", options: null }).success);
});

test("droit schools.manage : IPP, informaticien, Super Admin, chef et secrétaire de POOL", () => {
  for (const role of [ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.CHEF_POOL, ROLE_KEYS.SECRETAIRE_POOL]) {
    assert.ok(ROLE_PERMISSIONS[role].includes(PERMISSIONS.SCHOOLS_MANAGE), role);
  }
  for (const role of [ROLE_KEYS.INSPECTEUR, ROLE_KEYS.EXPLOITANT_POOL, ROLE_KEYS.IPA, ROLE_KEYS.AGENT_POOL]) {
    assert.ok(!ROLE_PERMISSIONS[role].includes(PERMISSIONS.SCHOOLS_MANAGE), role);
  }
});

test("canevas : en-têtes reconnus, codes du POOL et de l'école en tête, mode d'emploi", async () => {
  const buf = await buildSchoolTemplate([{ code: "GOMA", name: "Goma" }]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet(SCHOOLS_SHEET_NAME)!;
  const headers = IMPORT_COLUMNS.map((_, i) => String(ws.getRow(1).getCell(i + 1).value));
  assert.deepEqual(headers.slice(0, 2), ["Code du POOL *", "Code de l'école *"]);
  assert.ok(headers.includes("Arrêté d'agrément"));
  assert.ok(!headers.some((h) => /numéro d'agrément|effectif/i.test(h)), "ni numéro d'agrément ni effectif");
  assert.equal(headers.length, 15);
  assert.ok(headers.includes("Gestion (Publique / Privée)"));
  assert.ok(headers.includes("Nombre d'enseignants qualifiés"));
  // Liste déroulante sur la colonne Gestion, entier ≥ 0 sur les enseignants qualifiés.
  const col = (h: string) => headers.indexOf(h) + 1;
  const mgmt = ws.getRow(2).getCell(col("Gestion (Publique / Privée)")).dataValidation;
  assert.equal(mgmt?.type, "list");
  assert.deepEqual(mgmt?.formulae, ['"Publique,Privée"']);
  const qual = ws.getRow(2).getCell(col("Nombre d'enseignants qualifiés")).dataValidation;
  assert.equal(qual?.type, "whole");
  assert.ok(headers.every((h) => matchHeader(h) !== null));
  assert.ok(wb.getWorksheet("Mode d'emploi"));
  // Canevas vierge relu : aucune école.
  assert.deepEqual(await readSchoolRows(buf), []);
});

async function filledWorkbook(headers: string[], rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Feuil1");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("lecture : colonnes dans un autre ordre, nombres saisis en nombre, lignes vides ignorées", async () => {
  const buf = await filledWorkbook(
    ["Nom de l'école", "code du pool", "Code de l’école", "Province", "Territoire", "Nombre de classes"],
    [
      ["EP Les Volcans", "GOMA", "EP-001", "Nord-Kivu", "Goma", 8],
      [null, null, null, null, null, null],
      ["EP Mapendo", "GOMA", 42, "Nord-Kivu", "Goma", null],
    ]
  );
  const rows = await readSchoolRows(buf);
  assert.deepEqual(rows.map((r) => r.line), [2, 4]);
  assert.equal(rows[0].cells.classCount, "8");
  assert.equal(rows[1].cells.code, "42");
});

test("fichier qui n'est pas le canevas : refus en bloc avec message clair", async () => {
  const buf = await filledWorkbook(["Nom", "Adresse"], [["X", "Y"]]);
  await assert.rejects(readSchoolRows(buf), (e: unknown) => e instanceof ImportFileError && /Code du POOL/.test(e.message));
  await assert.rejects(readSchoolRows(new TextEncoder().encode("pas un classeur")), ImportFileError);
});

test("gestion : Publique / Privée (casse et accents ignorés), autre valeur rejetée", () => {
  assert.equal(parseManagement("Publique"), "PUBLIC");
  assert.equal(parseManagement(" PRIVEE "), "PRIVATE");
  assert.equal(parseManagement("privée"), "PRIVATE");
  assert.equal(parseManagement(""), null);
  assert.equal(parseManagement("Conventionnée"), "invalid");
  const { valid, rejected } = validateRows([row(2, { management: "Privée" }), row(3, { management: "Conventionnée" }), row(4, {})], "GOMA");
  assert.deepEqual(valid.map((v) => [v.line, v.data.management]), [[2, "PRIVATE"], [4, null]]);
  assert.match(rejected[0].reason, /Gestion.*Conventionnée/);
});

test("enseignants qualifiés : entier ≥ 0 et jamais plus que le nombre d'enseignants", () => {
  const { valid, rejected } = validateRows(
    [
      row(2, { teacherCount: "20", qualifiedTeacherCount: "12" }),
      row(3, { teacherCount: "10", qualifiedTeacherCount: "12" }),
      row(4, { qualifiedTeacherCount: "-1" }),
      row(5, { qualifiedTeacherCount: "3.5" }),
      row(6, { qualifiedTeacherCount: "0", teacherCount: "0" }),
      row(7, { qualifiedTeacherCount: "7" }),
    ],
    "GOMA"
  );
  assert.deepEqual(valid.map((v) => v.line), [2, 6, 7]);
  assert.equal(valid[0].data.qualifiedTeacherCount, 12);
  assert.equal(valid[1].data.qualifiedTeacherCount, 0);
  const reason = (line: number) => rejected.find((r) => r.line === line)?.reason ?? "";
  assert.match(reason(3), /qualifiés ne peut pas dépasser.*12 > 10/);
  assert.match(reason(4), /Nombre d'enseignants qualifiés/);
  assert.match(reason(5), /Nombre d'enseignants qualifiés/);
});

test("mise à jour : cohérence qualifiés / total vérifiée sur les valeurs résultantes", () => {
  const existing = data({ teacherCount: 10, qualifiedTeacherCount: 8, management: "PUBLIC" });
  assert.equal(planUpdate(existing, data({ teacherCount: 5 })).ok, false, "nouveau total sous les qualifiés existants");
  assert.equal(planUpdate(existing, data({ qualifiedTeacherCount: 11 })).ok, false, "qualifiés au-dessus du total existant");
  const ok = planUpdate(existing, data({ qualifiedTeacherCount: 10, management: "PRIVATE" }));
  assert.ok(ok.ok);
  assert.deepEqual(ok.changes, { qualifiedTeacherCount: 10, management: "PRIVATE" });
  // Ancien fichier sans les nouvelles colonnes : valeurs enregistrées conservées.
  const legacy = planUpdate(existing, data({ director: "M. Bahati" }));
  assert.ok(legacy.ok);
  assert.deepEqual(legacy.changes, { director: "M. Bahati" });
  assert.equal(planCreate(data({ teacherCount: 3, qualifiedTeacherCount: 4 })).ok, false);
});

test("ancien canevas (13 colonnes, sans Gestion ni qualifiés) : toujours lu, nouveaux champs non renseignés", async () => {
  const legacyHeaders = IMPORT_COLUMNS.filter((c) => c.field !== "management" && c.field !== "qualifiedTeacherCount").map((c) => c.header);
  assert.equal(legacyHeaders.length, 13);
  const buf = await filledWorkbook(legacyHeaders, [["GOMA", "EP-1", "EP Uvira", "Nord-Kivu", "Goma", "Primaire", null, null, null, null, 6, 12, null]]);
  const rows = await readSchoolRows(buf);
  const { valid, rejected } = validateRows(rows, "GOMA");
  assert.equal(rejected.length, 0);
  assert.equal(valid[0].data.teacherCount, 12);
  assert.equal(valid[0].data.management, null);
  assert.equal(valid[0].data.qualifiedTeacherCount, null);
});

test("nouveau canevas rempli : Gestion et qualifiés lus", async () => {
  const buf = await filledWorkbook(
    ["Code du POOL *", "Code de l'école *", "Nom de l'école *", "Province *", "Territoire *", "Gestion (Publique / Privée)", "Nombre d'enseignants", "Nombre d'enseignants qualifiés"],
    [["GOMA", "EP-2", "EP Amani", "Nord-Kivu", "Goma", "Publique", 14, 9]]
  );
  const { valid } = validateRows(await readSchoolRows(buf), "GOMA");
  assert.equal(valid[0].data.management, "PUBLIC");
  assert.equal(valid[0].data.qualifiedTeacherCount, 9);
});

test("formulaire : gestion et enseignants qualifiés", () => {
  const base = { poolId: "p1", name: "EP Test", code: "EP-9", province: "Nord-Kivu", territoire: "Goma", type: "Primaire" };
  const ok = schoolSchema.safeParse({ ...base, management: "PRIVATE", teacherCount: "10", qualifiedTeacherCount: "10" });
  assert.ok(ok.success);
  assert.equal(ok.data.management, "PRIVATE");
  assert.equal(ok.data.qualifiedTeacherCount, 10);
  const empty = schoolSchema.safeParse({ ...base, management: "", qualifiedTeacherCount: "" });
  assert.ok(empty.success);
  assert.equal(empty.data.management, null);
  assert.equal(empty.data.qualifiedTeacherCount, null);
  assert.equal(schoolSchema.safeParse({ ...base, management: "Autre" }).success, false);
  const over = schoolSchema.safeParse({ ...base, teacherCount: "4", qualifiedTeacherCount: "5" });
  assert.equal(over.success, false);
  assert.deepEqual(over.error?.issues[0].path, ["qualifiedTeacherCount"]);
  assert.equal(schoolSchema.safeParse({ ...base, qualifiedTeacherCount: "-2" }).success, false);
});
