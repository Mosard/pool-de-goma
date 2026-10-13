// Secrétariat de l'IPP (décision du 2026-10-12) : les secrétaires de l'IPP et
// les informaticiens reçoivent et orientent les rapports ; aucune autre fonction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { PERMISSIONS, ROLE_KEYS, type RoleKey } from "@/lib/rbac-data";
import { bindRolePermissions, holdsRouteIpp } from "@/lib/cells/rules";
import { NAV_ITEMS, isNavItemVisible } from "@/components/nav-items";

const ORG = "org";

test("Secrétariat : secrétaires de l'IPP, informaticiens, Super Admin et Admin ; aucune autre fonction", () => {
  const holders = (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).filter((r) => ROLE_PERMISSIONS[r].includes(PERMISSIONS.REPORTS_ROUTE_IPP)).sort();
  assert.deepEqual(holders, [ROLE_KEYS.ADMIN, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SECRETAIRE_IPP, ROLE_KEYS.SUPER_ADMIN].sort());
});

test("informaticien : droit d'orienter les rapports et entrée « Secrétariat » dans son menu", () => {
  const permissions = bindRolePermissions({
    roleKey: ROLE_KEYS.INFORMATICIEN,
    permissionKeys: ROLE_PERMISSIONS[ROLE_KEYS.INFORMATICIEN],
    poolId: null,
    cellId: null,
    ipaCellId: null,
    organizationId: ORG,
  });
  assert.ok(holdsRouteIpp({ permissions }, ORG));
  const entry = NAV_ITEMS.find((i) => i.href === "/secretariat")!;
  assert.ok(isNavItemVisible(entry, { permissions, roleKeys: [ROLE_KEYS.INFORMATICIEN] }));
});
