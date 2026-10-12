// Bascule en consultation (décision du 2026-10-12) : informaticien et
// secrétaires de l'IPP basculent dans toute fonction sauf Super Admin, en
// lecture seule ; Super Admin et IPP gardent leur bascule actuelle.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_KEYS, viewModeKind } from "@/lib/rbac-data";
import { isWriteOperation, shouldBlockWrite } from "@/lib/read-only-guard";
import { ForbiddenError, ReadOnlyModeError } from "@/lib/errors";

test("type de bascule : Super Admin complet, IPP borné, informaticien et secrétaire de l'IPP en consultation, autres aucun", () => {
  assert.equal(viewModeKind([ROLE_KEYS.SUPER_ADMIN]), "full");
  assert.equal(viewModeKind([ROLE_KEYS.IPP]), "bounded");
  assert.equal(viewModeKind([ROLE_KEYS.INFORMATICIEN]), "readonly");
  assert.equal(viewModeKind([ROLE_KEYS.SECRETAIRE_IPP]), "readonly");
  // Cumul : la bascule la plus large de ses fonctions réelles.
  assert.equal(viewModeKind([ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN]), "full");
  assert.equal(viewModeKind([ROLE_KEYS.SECRETAIRE_IPP, ROLE_KEYS.IPP]), "bounded");
  for (const k of [ROLE_KEYS.IPA, ROLE_KEYS.EXPLOITANT_IPP, ROLE_KEYS.AGENT_IPP, ROLE_KEYS.CHEF_POOL, ROLE_KEYS.INSPECTEUR, ROLE_KEYS.CHARGE_MEDIAS]) {
    assert.equal(viewModeKind([k]), null, k);
  }
});

test("garde d'écriture : toute écriture refusée en consultation, sauf le journal d'audit ; lectures libres", () => {
  const ro = { viewModeActive: true, realRoleKeys: [ROLE_KEYS.INFORMATICIEN] };
  for (const op of ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]) {
    assert.equal(shouldBlockWrite({ ...ro, model: "AttendanceSetting", operation: op }), true, op);
  }
  for (const op of ["findMany", "findUnique", "findFirst", "count", "aggregate", "groupBy"]) {
    assert.equal(isWriteOperation(op), false, op);
    assert.equal(shouldBlockWrite({ ...ro, model: "User", operation: op }), false, op);
  }
  assert.equal(shouldBlockWrite({ ...ro, model: "AuditLog", operation: "create" }), false);
});

test("garde d'écriture : aucun effet sans bascule active, ni pour le Super Admin ou l'IPP en bascule", () => {
  assert.equal(shouldBlockWrite({ model: "Cell", operation: "update", viewModeActive: false, realRoleKeys: [ROLE_KEYS.INFORMATICIEN] }), false);
  assert.equal(shouldBlockWrite({ model: "Cell", operation: "update", viewModeActive: true, realRoleKeys: [ROLE_KEYS.SUPER_ADMIN] }), false);
  assert.equal(shouldBlockWrite({ model: "Cell", operation: "update", viewModeActive: true, realRoleKeys: [ROLE_KEYS.IPP] }), false);
  assert.equal(shouldBlockWrite({ model: "Cell", operation: "update", viewModeActive: true, realRoleKeys: [ROLE_KEYS.SECRETAIRE_IPP] }), true);
});

test("refus de consultation : une ForbiddenError, donc affichée par les formulaires existants", () => {
  const e = new ReadOnlyModeError();
  assert.ok(e instanceof ForbiddenError);
  assert.match(e.message, /Mode consultation/);
});
