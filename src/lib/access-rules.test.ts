import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAdjustments, canAdjustPermission, canManageAccount, canOpenAccessScreen } from "@/lib/access-rules";

const ORG = "org1";
const role = (key: string, poolId: string | null = null) => ({ key, label: key, poolId });
const perm = (permissionKey: string, poolId: string | null = null) => ({ permissionKey, poolId, organizationId: ORG });

const ipp = { id: "ipp", organizationId: ORG, roles: [role("ipp")], permissions: [perm("reports.validate"), perm("schools.manage"), perm("users.manage")] };
const info = { id: "info", organizationId: ORG, roles: [role("informaticien")], permissions: [perm("audit.view"), perm("ai.analyze")] };
const chef = {
  id: "chef",
  organizationId: ORG,
  roles: [role("chef_pool", "p1"), role("inspecteur", "p1")],
  permissions: [perm("schools.manage", "p1"), perm("reports.review_pool", "p1"), perm("inspections.conduct", "p1")],
};
const target = (roles: { key: string; poolId: string | null }[], poolId: string | null = "p1", id = "t") => ({ id, organizationId: ORG, poolId, roles });

test("droits effectifs : retrait exact (permission + portée), puis ajout ; sans ajustement, identiques", () => {
  const base = [perm("schools.manage", "p1"), perm("reports.review_pool", "p1")];
  assert.deepEqual(applyAdjustments(base, [], ORG), base);
  const eff = applyAdjustments(
    base,
    [
      { permissionKey: "schools.manage", poolId: "p1", effect: "REVOKE" },
      { permissionKey: "reports.review_pool", poolId: null, effect: "REVOKE" }, // portée différente : sans effet
      { permissionKey: "ai.analyze", poolId: "p1", effect: "GRANT" },
    ],
    ORG
  );
  assert.deepEqual(eff.map((p) => `${p.permissionKey}|${p.poolId}`).sort(), ["ai.analyze|p1", "reports.review_pool|p1"]);
});

test("ouvrir l'écran : IPP, informaticien, Super Admin, chef de POOL ; pas les autres fonctions", () => {
  assert.ok(canOpenAccessScreen([role("ipp")]));
  assert.ok(canOpenAccessScreen([role("super_admin")]));
  assert.ok(canOpenAccessScreen([role("chef_pool", "p1")]));
  assert.ok(!canOpenAccessScreen([role("ipa")]));
  assert.ok(!canOpenAccessScreen([role("exploitant_ipp")]));
  assert.ok(!canOpenAccessScreen([role("inspecteur", "p1")]));
});

test("jamais sur soi-même, jamais hors de l'organisation", () => {
  assert.equal(canManageAccount(ipp, target([], null, "ipp")).ok, false);
  assert.equal(canManageAccount(ipp, { ...target([]), organizationId: "autre" }).ok, false);
});

test("informaticien : ne gère pas l'IPP, un IPA, un autre informaticien ; gère un inspecteur", () => {
  assert.equal(canManageAccount(info, target([{ key: "ipp", poolId: null }], null)).ok, false);
  assert.equal(canManageAccount(info, target([{ key: "ipa", poolId: null }], null)).ok, false);
  assert.equal(canManageAccount(info, target([{ key: "informaticien", poolId: null }], null)).ok, false);
  assert.equal(canManageAccount(info, target([{ key: "inspecteur", poolId: "p2" }])).ok, true);
});

test("IPP : ne gère pas un autre IPP ni un Super Admin ; gère l'informaticien", () => {
  assert.equal(canManageAccount(ipp, target([{ key: "ipp", poolId: null }], null)).ok, false);
  assert.equal(canManageAccount(ipp, target([{ key: "super_admin", poolId: null }], null)).ok, false);
  assert.equal(canManageAccount(ipp, target([{ key: "informaticien", poolId: null }], null)).ok, true);
});

test("chef de POOL : comptes d'appui de son POOL seulement", () => {
  assert.equal(canManageAccount(chef, target([{ key: "inspecteur", poolId: "p1" }])).ok, true);
  assert.equal(canManageAccount(chef, target([{ key: "inspecteur", poolId: "p2" }], "p2")).ok, false, "autre POOL");
  assert.equal(canManageAccount(chef, target([{ key: "chef_pool", poolId: "p1" }, { key: "inspecteur", poolId: "p1" }])).ok, false, "un autre chef");
  assert.equal(canManageAccount(chef, target([{ key: "exploitant_ipp", poolId: null }], null)).ok, false, "compte provincial");
  // Compte sans fonction (Q5) : seulement s'il est rattaché à son POOL.
  assert.equal(canManageAccount(chef, target([], "p1")).ok, true);
  assert.equal(canManageAccount(chef, target([], "p2")).ok, false);
  assert.equal(canManageAccount(info, target([], null)).ok, true);
});

test("ajuster une permission : on ne donne que ce que l'on détient, sur une portée couverte", () => {
  assert.ok(canAdjustPermission(ipp, "reports.validate", null, "GRANT").ok);
  assert.ok(canAdjustPermission(ipp, "reports.validate", "p3", "GRANT").ok, "portée provinciale couvre un POOL");
  assert.equal(canAdjustPermission(info, "inspections.conduct", null, "GRANT").ok, false, "l'informaticien ne la détient pas");
  assert.ok(canAdjustPermission(chef, "schools.manage", "p1", "GRANT").ok);
  assert.equal(canAdjustPermission(chef, "schools.manage", "p2", "GRANT").ok, false, "hors de son POOL");
  assert.equal(canAdjustPermission(chef, "schools.manage", null, "GRANT").ok, false, "tous les POOL : réservé au provincial");
  assert.equal(canAdjustPermission(chef, "ai.analyze", "p1", "GRANT").ok, false, "ne la détient pas");
});

test("permissions sensibles (Q4) : pas d'ajout individuel, retrait possible", () => {
  const v = canAdjustPermission(ipp, "users.manage", null, "GRANT");
  assert.equal(v.ok, false);
  assert.ok(canAdjustPermission(ipp, "users.manage", null, "REVOKE").ok);
});
