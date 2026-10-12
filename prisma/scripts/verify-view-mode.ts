// Vérification sur base de la bascule « Voir comme » (décision du 2026-10-12) :
// informaticien et secrétaire de l'IPP en consultation (toute fonction sauf
// Super Admin, écran complet, pouvoirs réservés compris) ; Super Admin et IPP
// inchangés ; les autres fonctions sans bascule. Le refus des écritures est
// vérifié par HTTP, le cookie de bascule n'existant qu'en requête.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-view-mode.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { loadUserAccess } from "../../src/lib/permissions";
import { PERMISSIONS, PERSONNEL_HEAD_KEYS, ROLE_KEYS } from "../../src/lib/rbac-data";
import { hasPermission } from "../../src/lib/permission-checks";
import { setCellIpa } from "../../src/lib/cells/assignments";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

const TAG = `vm${Date.now().toString(36)}`;
let passed = 0;
const createdCells: string[] = [];
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`✔ ${name}`);
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  await prisma.cell.updateMany({ where: { organizationId: org.id, active: true, mandate: "PERSONNEL" }, data: { active: false, ipaId: null } });
  const roleId = async (key: string) => (await prisma.roleDefinition.findUniqueOrThrow({ where: { key } })).id;
  const mk = async (label: string, keys: string[]) => {
    const u = await prisma.user.create({
      data: { name: `${TAG} ${label}`, email: `${TAG}.${label}@verif.test`, passwordHash: "x", status: "ACTIVE", organizationId: org.id, isDemo: false },
    });
    for (const k of keys) await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(k) } });
    return u;
  };
  const info = await mk("info", [ROLE_KEYS.INFORMATICIEN]);
  const info2 = await mk("info2", [ROLE_KEYS.INFORMATICIEN]);
  const secr = await mk("secr", [ROLE_KEYS.SECRETAIRE_IPP]);
  const sa = await mk("sa", [ROLE_KEYS.SUPER_ADMIN]);
  const ipp = await mk("ipp", [ROLE_KEYS.IPP]);
  const agent = await mk("agent", [ROLE_KEYS.AGENT_IPP]);
  const ipa = await mk("ipa", [ROLE_KEYS.IPA]);
  const pers = await prisma.cell.create({ data: { organizationId: org.id, code: `${TAG}P`.toUpperCase().slice(0, 20), name: `${TAG} personnel`, mandate: "PERSONNEL" } });
  createdCells.push(pers.id);
  await setCellIpa({ id: ipp.id, organizationId: org.id }, { cellId: pers.id, ipaId: ipa.id, via: "direction" });
  const pool = await prisma.pool.findFirstOrThrow({ where: { organizationId: org.id, active: true } });

  await check("les deux informaticiens et la secrétaire : bascule en consultation ; agent et IPA : aucune bascule", async () => {
    for (const u of [info, info2, secr]) {
      const a = await loadUserAccess(u.id, { viewMode: null });
      assert.equal(a.canViewAs, true, u.name);
      assert.equal(a.viewModeKind, "readonly", u.name);
    }
    for (const u of [agent, ipa]) assert.equal((await loadUserAccess(u.id, { viewMode: null })).canViewAs, false, u.name);
    assert.equal((await loadUserAccess(sa.id, { viewMode: null })).viewModeKind, "full");
    assert.equal((await loadUserAccess(ipp.id, { viewMode: null })).viewModeKind, "bounded");
  });

  await check("consultation de l'IPP : écran complet (signature, calendrier, approbation), marqué lecture seule", async () => {
    const a = await loadUserAccess(info.id, { viewMode: { role: ROLE_KEYS.IPP, poolId: null } });
    assert.equal(a.viewMode?.role, ROLE_KEYS.IPP);
    assert.equal(a.viewMode?.readOnly, true);
    for (const k of [PERMISSIONS.REPORTS_VALIDATE, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, PERMISSIONS.PRESENCE_REQUESTS_APPROVE_FINAL, PERMISSIONS.USERS_MANAGE]) {
      assert.ok(hasPermission(a.permissions, k), k);
    }
  });

  await check("consultation de l'IPA de la cellule du personnel : fiches et pouvoirs du responsable visibles (lecture seule)", async () => {
    const a = await loadUserAccess(secr.id, { viewMode: { role: ROLE_KEYS.IPA, poolId: null, cellId: pers.id } });
    assert.equal(a.viewMode?.readOnly, true);
    for (const k of PERSONNEL_HEAD_KEYS) assert.ok(hasPermission(a.permissions, k), k);
  });

  await check("consultation d'une fonction de POOL et d'un exploitant : POOL / cellule exigés et vérifiés", async () => {
    const chef = await loadUserAccess(info2.id, { viewMode: { role: ROLE_KEYS.CHEF_POOL, poolId: pool.id } });
    assert.equal(chef.viewMode?.poolId, pool.id);
    assert.ok(hasPermission(chef.permissions, PERMISSIONS.ASSIGNMENTS_MANAGE, { poolId: pool.id, organizationId: org.id }));
    assert.equal((await loadUserAccess(info2.id, { viewMode: { role: ROLE_KEYS.CHEF_POOL, poolId: null } })).viewMode, null);
    assert.equal((await loadUserAccess(info2.id, { viewMode: { role: ROLE_KEYS.EXPLOITANT_IPP, poolId: null, cellId: null } })).viewMode, null);
  });

  await check("Super Admin jamais simulable ; Super Admin et IPP inchangés (pouvoirs réservés toujours exclus de leur bascule)", async () => {
    assert.equal((await loadUserAccess(info.id, { viewMode: { role: ROLE_KEYS.SUPER_ADMIN, poolId: null } })).viewMode, null);
    const asIpp = await loadUserAccess(sa.id, { viewMode: { role: ROLE_KEYS.IPP, poolId: null } });
    assert.equal(asIpp.viewMode?.readOnly, undefined);
    assert.equal(hasPermission(asIpp.permissions, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE), false);
    assert.equal((await loadUserAccess(ipp.id, { viewMode: { role: ROLE_KEYS.INFORMATICIEN, poolId: null } })).viewMode, null);
  });

  await check("hors bascule : l'informaticien garde exactement ses droits (ni signature, ni calendrier)", async () => {
    const a = await loadUserAccess(info.id, { viewMode: null });
    assert.equal(hasPermission(a.permissions, PERMISSIONS.REPORTS_VALIDATE), false);
    assert.equal(hasPermission(a.permissions, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE), false);
  });

  console.log(`\n${passed} vérifications réussies (préfixe ${TAG}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (createdCells.length) await prisma.cell.updateMany({ where: { id: { in: createdCells } }, data: { active: false, ipaId: null } });
    await prisma.$disconnect();
  });
