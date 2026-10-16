// Fiche individuelle du personnel : droits, validation, intégrité. Données fictives.

import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS, PERMISSIONS, PRESENCE_NOT_INDIVIDUALLY_GRANTABLE } from "@/lib/rbac-data";
import { bindPersonnelHeadPermissions, bindRecordReaderPermissions, withoutReservedForSimulation } from "@/lib/cells/rules";
import type { SessionPermission } from "@/lib/permission-checks";
import { ALL_GROUPS, CHILD_FIELDS, DIPLOMA_FIELDS, PERSONNEL_FILE_SECTIONS, PROMOTION_FIELDS, findFieldsGroup } from "./defs";
import { changedKeys, completeness, fileAccess, isCivilDate, parseField, parseFieldsGroup, userColumnsToGroupValues } from "./rules";

const ORG = "org-1";
const perm = (key: string, extra: Partial<SessionPermission> = {}): SessionPermission => ({ permissionKey: key, poolId: null, organizationId: ORG, ...extra });
const actor = (permissions: SessionPermission[] = [], over: Partial<{ id: string; isDemo: boolean; organizationId: string }> = {}) => ({
  id: "agent-a",
  organizationId: ORG,
  isDemo: false,
  permissions,
  ...over,
});
const target = (over: Partial<{ id: string; isDemo: boolean; organizationId: string }> = {}) => ({ id: "agent-b", organizationId: ORG, isDemo: false, ...over });

test("Sa propre fiche : lecture, modification et PDF sans aucune permission, sans observation", () => {
  assert.deepEqual(fileAccess(actor(), target({ id: "agent-a" })), { self: true, read: true, edit: true, pdf: true, observe: false });
});

test("Scénario D : un agent n'accède à aucune autre fiche (refus = fiche introuvable)", () => {
  assert.equal(fileAccess(actor(), target()), null);
  // Les présences ne donnent pas la fiche.
  assert.equal(fileAccess(actor([perm(PERMISSIONS.PRESENCE_READ_ALL)]), target()), null);
});

test("Lecture seule (personnel.records.read_all) ; modification et observations (edit_all)", () => {
  assert.deepEqual(fileAccess(actor([perm(PERMISSIONS.PERSONNEL_RECORDS_READ_ALL)]), target()), { self: false, read: true, edit: false, pdf: true, observe: false });
  const editor = [perm(PERMISSIONS.PERSONNEL_RECORDS_READ_ALL), perm(PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL)];
  assert.deepEqual(fileAccess(actor(editor), target()), { self: false, read: true, edit: true, pdf: true, observe: true });
  // La modification sans la lecture (lecture retirée individuellement) n'ouvre rien.
  assert.equal(fileAccess(actor([perm(PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL)]), target()), null);
});

test("Portée : jamais une copie de POOL ou de cellule, jamais une autre organisation, démo et réel séparés", () => {
  const both = (extra: Partial<SessionPermission>) => [perm(PERMISSIONS.PERSONNEL_RECORDS_READ_ALL, extra), perm(PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL, extra)];
  assert.equal(fileAccess(actor(both({ poolId: "pool-1" })), target()), null);
  assert.equal(fileAccess(actor(both({ cellId: "cell-1" })), target()), null);
  assert.equal(fileAccess(actor(both({ organizationId: "org-2" })), target()), null);
  assert.equal(fileAccess(actor(both({})), target({ organizationId: "org-2" })), null);
  assert.equal(fileAccess(actor(both({})), target({ isDemo: true })), null);
  assert.equal(fileAccess(actor(), null), null);
});

test("Matrice validée : Super Admin, Admin, IPP, informaticien lisent ET modifient ; aucune autre fonction", () => {
  for (const role of ["super_admin", "admin", "ipp", "informaticien"]) {
    const keys = bindRecordReaderPermissions([role], ORG).map((p) => p.permissionKey);
    assert.deepEqual(keys.sort(), [PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL, PERMISSIONS.PERSONNEL_RECORDS_READ_ALL].sort(), role);
    assert.equal(fileAccess(actor(bindRecordReaderPermissions([role], ORG)), target())?.edit, true, role);
  }
  for (const role of ["inspecteur", "chef_pool", "exploitant", "ipa", "secretaire_ipp", "secretaire_pool"]) {
    assert.deepEqual(bindRecordReaderPermissions([role], ORG), [], role);
  }
});

test("IPA responsable de LA cellule du personnel : lecture et modification ; rien sinon", () => {
  const head = bindPersonnelHeadPermissions({ ipaCell: { id: "c", active: true, mandate: "PERSONNEL", organizationId: ORG }, activePersonnelCellCount: 1, organizationId: ORG });
  assert.equal(fileAccess(actor(head), target())?.edit, true);
  const general = bindPersonnelHeadPermissions({ ipaCell: { id: "c", active: true, mandate: "GENERAL", organizationId: ORG }, activePersonnelCellCount: 1, organizationId: ORG });
  assert.equal(fileAccess(actor(general), target()), null);
});

test("« Voir comme » : aucune fiche d'autrui en simulation ; jamais un ajout individuel ni une fonction personnalisée", () => {
  const sim = withoutReservedForSimulation(bindRecordReaderPermissions(["ipp"], ORG));
  assert.equal(fileAccess(actor(sim), target()), null);
  assert.ok((PRESENCE_NOT_INDIVIDUALLY_GRANTABLE as readonly string[]).includes(PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL));
  assert.ok(CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS.includes(PERMISSIONS.PERSONNEL_RECORDS_EDIT_ALL));
});

test("Définitions : rubriques uniques, champs uniques par rubrique, sept sections I à VII", () => {
  assert.deepEqual(
    PERSONNEL_FILE_SECTIONS.map((s) => s.roman),
    ["I", "II", "III", "IV", "V", "VI", "VII"]
  );
  const keys = ALL_GROUPS.map((g) => g.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const g of ALL_GROUPS) {
    if (g.kind !== "fields") continue;
    const fk = g.fields.map((f) => f.key);
    assert.equal(new Set(fk).size, fk.length, g.key);
  }
  for (const list of [PROMOTION_FIELDS, DIPLOMA_FIELDS, CHILD_FIELDS]) assert.equal(new Set(list.map((f) => f.key)).size, list.length);
});

test("Scénario I : aucune rubrique n'écrit une fonction, un POOL, une cellule ou un statut de compte", () => {
  const userColumns = ALL_GROUPS.flatMap((g) => (g.kind === "fields" ? g.fields.flatMap((f) => (f.userColumn ? [f.userColumn] : [])) : []));
  assert.deepEqual([...new Set(userColumns)].sort(), ["dateNaissance", "matricule", "nombreEnfants", "phone", "postnom", "prenom", "sex"]);
  // Grade et affectation déclarés restent dans la fiche.
  const aff = parseFieldsGroup(findFieldsGroup("affectation")!, { ministere: "Ministère fictif", province: "Province fictive" });
  assert.ok(aff.ok);
  assert.deepEqual(aff.ok && aff.user, {});
  const grade = parseFieldsGroup(findFieldsGroup("gradeFonction")!, { grade: "Grade fictif" });
  assert.ok(grade.ok && grade.data.grade === "Grade fictif" && Object.keys(grade.user).length === 0);
});

test("Champs du compte : postnom, prénom, sexe et date de naissance vont dans User, pas dans la fiche", () => {
  const r = parseFieldsGroup(findFieldsGroup("identite")!, { sex: "F", nom: "NOMFICTIF", postnom: "Postnom", prenom: "Prénom", dateNaissance: "1990-05-17", nationalite: "Fictive" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.data, { nom: "NOMFICTIF", nationalite: "Fictive" });
  assert.equal(r.user.sex, "F");
  assert.equal(r.user.postnom, "Postnom");
  assert.equal(r.user.dateNaissance?.toISOString(), "1990-05-17T00:00:00.000Z");
  // Un champ vidé efface la valeur du compte (null), il ne la conserve pas en silence.
  const cleared = parseFieldsGroup(findFieldsGroup("identite")!, {});
  assert.ok(cleared.ok && cleared.user.postnom === null && cleared.user.sex === null);
  const shown = userColumnsToGroupValues(findFieldsGroup("identite")!, { postnom: "Postnom", sex: "M", dateNaissance: new Date("1990-05-17T00:00:00Z") });
  assert.deepEqual(shown, { sex: "M", postnom: "Postnom", dateNaissance: "1990-05-17" });
});

test("Validation : tout est facultatif ; dates, années, OUI/NON, choix, e-mail et téléphone contrôlés", () => {
  const f = (kind: Parameters<typeof parseField>[0]["kind"], options?: { value: string; label: string }[]) => ({ key: "x", label: "X", kind, options });
  assert.deepEqual(parseField(f("text"), "  "), { ok: true, value: null });
  assert.ok(isCivilDate("2024-02-29") && !isCivilDate("2023-02-29") && !isCivilDate("31/12/2020"));
  assert.equal(parseField(f("date"), "2023-02-31").ok, false);
  assert.deepEqual(parseField(f("year"), "2011"), { ok: true, value: 2011 });
  assert.equal(parseField(f("year"), "11").ok, false);
  assert.deepEqual(parseField(f("yesno"), "NON"), { ok: true, value: false });
  assert.equal(parseField(f("yesno"), "peut-être").ok, false);
  assert.equal(parseField(f("choice", [{ value: "A", label: "A" }]), "B").ok, false);
  assert.deepEqual(parseField(f("email"), "Agent@Exemple.test"), { ok: true, value: "agent@exemple.test" });
  assert.equal(parseField(f("tel"), "appelez-moi").ok, false);
  assert.deepEqual(parseField(f("list"), "Prime A\n\n Prime B \n"), { ok: true, value: ["Prime A", "Prime B"] });
  assert.equal(parseField(f("text"), "x".repeat(201)).ok, false);
  const bad = parseFieldsGroup(findFieldsGroup("piece")!, { delivreeLe: "2023-13-01" });
  assert.ok(!bad.ok && bad.errors.delivreeLe);
});

test("Journal : noms des champs modifiés seulement", () => {
  assert.deepEqual(changedKeys({ a: "1", b: "2", c: null }, { a: "1", b: "3", d: "4" }), ["b", "d"]);
  assert.deepEqual(changedKeys({ dt: new Date("2020-01-01T00:00:00Z") }, { dt: new Date("2020-01-01T00:00:00Z") }), []);
});

test("Complétude : indicative, une rubrique répétable compte dès la première entrée", () => {
  const empty = completeness({}, { promotions: 0, diplomas: 0, children: 0 });
  assert.equal(empty.filled, 0);
  assert.ok(empty.total > 150);
  const some = completeness({ identite: { nom: "X", sex: "M" } }, { promotions: 2, diplomas: 0, children: 1 });
  assert.equal(some.filled, 4);
});
