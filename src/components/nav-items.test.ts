// Menus regroupés (décisions du 2026-10-09) : ordre des onglets, entrées
// supprimées, visibilité par fonction. Le menu n'accorde aucun droit : chaque
// page garde son contrôle serveur (vérifié séparément par appel direct).

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { PERMISSIONS, ROLE_KEYS, type RoleKey } from "@/lib/rbac-data";
import type { SessionPermission } from "@/lib/permission-checks";
import { bindRolePermissions } from "@/lib/cells/rules";
import {
  COMPTES_TABS,
  EXPLOITATION_TABS,
  INSPECTEURS_TABS,
  NAV_ITEMS,
  isNavItemActive,
  isNavItemVisible,
  matchesPath,
  navItemHref,
  sectionForPath,
  visibleSubTabs,
  visibleTabs,
  type NavContext,
} from "./nav-items";

const ORG = "org";

function ctx(role: RoleKey, opts: { poolId?: string; cellId?: string } = {}): NavContext {
  const poolId = opts.poolId ?? null;
  const cellId = opts.cellId ?? null;
  const permissions: SessionPermission[] = bindRolePermissions({
    roleKey: role,
    permissionKeys: ROLE_PERMISSIONS[role],
    poolId,
    cellId,
    ipaCellId: cellId,
    organizationId: ORG,
  });
  return { permissions, roleKeys: [role] };
}

const entries = (c: NavContext) => NAV_ITEMS.filter((i) => isNavItemVisible(i, c)).map((i) => i.label);
const tabs = (list: typeof EXPLOITATION_TABS, c: NavContext) => visibleTabs(list, c).map((t) => t.label);

test("Exploitation : quatre onglets, dans l'ordre exact", () => {
  assert.deepEqual(
    EXPLOITATION_TABS.map((t) => t.label),
    ["Inspection et fiches", "Rapports", "Exploitation", "Synthèses"]
  );
  assert.deepEqual(INSPECTEURS_TABS.map((t) => t.label), ["Liste des inspecteurs", "Affectations"]);
  assert.deepEqual(COMPTES_TABS.map((t) => t.label), ["Validation des comptes", "Publication des comptes"]);
});

test("Entrées principales redondantes retirées (les pages restent à la même adresse)", () => {
  const top = NAV_ITEMS.map((i) => i.label);
  for (const gone of ["Affectations", "Inspections & fiches", "Rapports", "Fiches de période", "Synthèses", "Publication"]) {
    assert.ok(!top.includes(gone), `entrée encore présente : ${gone}`);
  }
  assert.equal(top.filter((l) => l === "Exploitation").length, 1);
  assert.equal(top.filter((l) => l === "Inspecteurs").length, 1);
  assert.equal(top.filter((l) => l === "Demandes de compte").length, 1);
});

test("Rattachement des pages aux espaces, liens existants compris", () => {
  const label = (p: string) => sectionForPath(p)?.label ?? null;
  for (const p of ["/inspections", "/inspections/x", "/fiches", "/fiches/x", "/rapports", "/rapports/x", "/rapports/x/pdf", "/rapports/export.xlsx", "/exploitation", "/syntheses", "/syntheses/nouvelle", "/syntheses/x"]) {
    assert.equal(label(p), "Exploitation", p);
  }
  for (const p of ["/inspecteurs", "/inspecteurs/nouveau", "/affectations"]) assert.equal(label(p), "Inspecteurs", p);
  for (const p of ["/comptes", "/publication"]) assert.equal(label(p), "Demandes de compte", p);
  for (const p of ["/secretariat", "/direction", "/dashboard", "/ecoles"]) assert.equal(label(p), null, p);
  // « /inspections » ne couvre pas « /inspecteurs », et inversement.
  assert.ok(!matchesPath("/inspecteurs", "/inspections"));
  assert.ok(!matchesPath("/inspections", "/inspecteurs"));
  const exploitation = NAV_ITEMS.find((i) => i.label === "Exploitation")!;
  assert.ok(isNavItemActive(exploitation, "/syntheses/abc"));
  assert.ok(!isNavItemActive(exploitation, "/inspecteurs"));
});

test("Inspecteur itinérant : ses inspections, fiches et rapports ; ni exploitation, ni synthèses, ni gestion", () => {
  const c = ctx(ROLE_KEYS.INSPECTEUR, { poolId: "A" });
  assert.deepEqual(tabs(EXPLOITATION_TABS, c), ["Inspection et fiches", "Rapports"]);
  assert.deepEqual(visibleSubTabs(EXPLOITATION_TABS[0], c).map((t) => t.subLabel ?? t.label), ["Inspections", "Fiches de période"]);
  const e = entries(c);
  assert.ok(e.includes("Exploitation"));
  assert.ok(!e.includes("Inspecteurs"));
  assert.ok(!e.includes("Demandes de compte"));
  assert.ok(!e.includes("Secrétariat"));
});

test("Exploitant de l'IPP et IPA : onglets d'exploitation seulement avec une cellule", () => {
  assert.deepEqual(tabs(EXPLOITATION_TABS, ctx(ROLE_KEYS.EXPLOITANT_IPP, { cellId: "C1" })), [
    "Inspection et fiches",
    "Rapports",
    "Exploitation",
    "Synthèses",
  ]);
  // Sans affectation : aucun onglet métier de cellule (les pages bloquent aussi côté serveur).
  assert.deepEqual(tabs(EXPLOITATION_TABS, ctx(ROLE_KEYS.EXPLOITANT_IPP)), ["Inspection et fiches", "Rapports"]);
  assert.deepEqual(tabs(EXPLOITATION_TABS, ctx(ROLE_KEYS.IPA)), ["Inspection et fiches", "Rapports"]);
  assert.ok(tabs(EXPLOITATION_TABS, ctx(ROLE_KEYS.IPA, { cellId: "C1" })).includes("Synthèses"));
  for (const c of [ctx(ROLE_KEYS.EXPLOITANT_IPP, { cellId: "C1" }), ctx(ROLE_KEYS.IPA, { cellId: "C1" })]) {
    assert.ok(!entries(c).includes("Demandes de compte"));
    assert.ok(!entries(c).includes("Secrétariat"));
  }
});

test("Inspecteurs : chaque onglet suit sa propre permission", () => {
  for (const role of Object.values(ROLE_KEYS)) {
    const c = ctx(role, { poolId: "A" });
    const t = tabs(INSPECTEURS_TABS, c);
    const has = (k: string) => c.permissions.some((p) => p.permissionKey === k);
    assert.equal(t.includes("Liste des inspecteurs"), has(PERMISSIONS.USERS_MANAGE), role);
    assert.equal(t.includes("Affectations"), has(PERMISSIONS.ASSIGNMENTS_MANAGE), role);
    assert.equal(entries(c).includes("Inspecteurs"), t.length > 0, role);
  }
});

test("Demandes de compte : validation et publication restent deux droits distincts", () => {
  for (const role of Object.values(ROLE_KEYS)) {
    const c = ctx(role, { poolId: "A" });
    const t = tabs(COMPTES_TABS, c);
    const has = (k: string) => c.permissions.some((p) => p.permissionKey === k);
    assert.equal(t.includes("Validation des comptes"), has(PERMISSIONS.ACCOUNTS_MANAGE), role);
    const authority = ([ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN] as string[]).includes(role);
    assert.equal(t.includes("Publication des comptes"), has(PERMISSIONS.PUBLICATION_MANAGE) && authority, role);
  }
  // Permission de publication sans fonction d'autorité : onglet masqué (la page redirige aussi).
  const sansAutorite: NavContext = {
    permissions: [{ permissionKey: PERMISSIONS.PUBLICATION_MANAGE, poolId: null, organizationId: ORG }],
    roleKeys: [ROLE_KEYS.IPA],
  };
  assert.deepEqual(tabs(COMPTES_TABS, sansAutorite), []);
});

test("Le lien d'un espace mène au premier onglet autorisé", () => {
  const inspecteurs = NAV_ITEMS.find((i) => i.label === "Inspecteurs")!;
  const affectationsSeules: NavContext = {
    permissions: [{ permissionKey: PERMISSIONS.ASSIGNMENTS_MANAGE, poolId: "A", organizationId: ORG }],
    roleKeys: [ROLE_KEYS.CHEF_POOL],
  };
  assert.equal(navItemHref(inspecteurs, affectationsSeules), "/affectations");
  const comptes = NAV_ITEMS.find((i) => i.label === "Demandes de compte")!;
  const publicationSeule: NavContext = {
    permissions: [{ permissionKey: PERMISSIONS.PUBLICATION_MANAGE, poolId: null, organizationId: ORG }],
    roleKeys: [ROLE_KEYS.IPP],
  };
  assert.equal(navItemHref(comptes, publicationSeule), "/publication");
});
