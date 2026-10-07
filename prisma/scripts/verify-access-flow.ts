// Test de bout en bout de l'écran « Gérer les accès », à lancer UNIQUEMENT sur
// une base locale jetable, migrée et seedée (npm run db:seed). Écrit des
// fonctions, ajustements et entrées d'audit sur des comptes de démonstration.
// Refuse toute base non locale.
//
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-access-flow.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError, hasPermission, loadUserAccess, usersHoldingPermission } from "../../src/lib/permissions";
import { applyAccessChanges, listManageableAccounts, loadActor } from "../../src/lib/access-admin";
import { PERMISSIONS, ROLE_KEYS } from "../../src/lib/rbac-data";

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
const refused = (p: Promise<unknown>) => assert.rejects(p, (e: unknown) => e instanceof ForbiddenError);
const NOTHING = { addRoles: [], removeUserRoleIds: [], adjustments: [] };

async function byEmail(email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } } } });
}

async function main() {
  const ipp = await byEmail("ipp@ipp-nordkivu1.test");
  const info = await byEmail("informaticien@ipp-nordkivu1.test");
  const chef = await byEmail("chef.goma@ipp-nordkivu1.test");
  const insp = await byEmail("inspecteur.goma@ipp-nordkivu1.test");
  const exploitantIpp = await byEmail("exploitant.ipp@ipp-nordkivu1.test");
  const gomaPool = chef.roles.find((r) => r.role.key === ROLE_KEYS.CHEF_POOL)!.poolId!;
  const otherPool = await prisma.pool.findFirstOrThrow({ where: { organizationId: ipp.organizationId, id: { not: gomaPool } } });
  const otherInspector = await prisma.user.findFirstOrThrow({
    where: { isDemo: true, roles: { some: { role: { key: ROLE_KEYS.INSPECTEUR }, poolId: otherPool.id } } },
  });
  const auditCount = () => prisma.auditLog.count({ where: { entityType: "User", metadata: { path: ["via"], equals: "gestion-acces" } } });

  await step("listes : chacun ne voit que les comptes qu'il peut gérer", async () => {
    const ippList = (await listManageableAccounts(await loadActor(ipp.id), {})).map((u) => u.id);
    assert.ok(ippList.includes(info.id) && ippList.includes(insp.id));
    assert.ok(!ippList.includes(ipp.id), "jamais soi-même");
    const infoList = (await listManageableAccounts(await loadActor(info.id), {})).map((u) => u.id);
    assert.ok(!infoList.includes(ipp.id), "l'informaticien ne voit pas l'IPP");
    assert.ok(infoList.includes(insp.id));
    const chefList = await listManageableAccounts(await loadActor(chef.id), {});
    assert.ok(chefList.some((u) => u.id === insp.id), "inspecteur de son POOL");
    assert.ok(!chefList.some((u) => u.id === otherInspector.id), "pas un inspecteur d'un autre POOL");
    assert.ok(!chefList.some((u) => u.id === exploitantIpp.id), "pas un compte provincial");
  });

  await step("IPP : retrait individuel d'une permission héritée et ajout d'une autre, avec audit", async () => {
    const before = await auditCount();
    const res = await applyAccessChanges(ipp.id, exploitantIpp.id, {
      ...NOTHING,
      adjustments: [
        { permissionKey: PERMISSIONS.AI_ANALYZE, poolId: null, effect: "REVOKE" },
        { permissionKey: PERMISSIONS.REPORTS_VALIDATE, poolId: null, effect: "GRANT" },
      ],
    });
    assert.equal(res.changed, 2);
    const { permissions } = await loadUserAccess(exploitantIpp.id, { viewMode: null });
    assert.ok(!hasPermission(permissions, PERMISSIONS.AI_ANALYZE), "retrait appliqué au calcul des droits");
    assert.ok(hasPermission(permissions, PERMISSIONS.REPORTS_VALIDATE), "ajout appliqué");
    assert.ok(hasPermission(permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE), "le reste de la fonction est intact");
    assert.equal(await auditCount(), before + 2);
    const last = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.permission_grant", entityId: exploitantIpp.id }, orderBy: { createdAt: "desc" } });
    assert.equal(last.actorId, ipp.id);
    assert.deepEqual(last.newValue, { permissionKey: PERMISSIONS.REPORTS_VALIDATE, poolId: null, effect: "GRANT" });
  });

  await step("notifications : les ajustements individuels sont pris en compte", async () => {
    const validators = await usersHoldingPermission({ permissionKey: PERMISSIONS.REPORTS_VALIDATE, organizationId: ipp.organizationId });
    assert.ok(validators.includes(exploitantIpp.id), "ajout individuel");
    const analysts = await usersHoldingPermission({ permissionKey: PERMISSIONS.AI_ANALYZE, organizationId: ipp.organizationId });
    assert.ok(!analysts.includes(exploitantIpp.id), "retrait individuel");
  });

  await step("annulation des ajustements : retour exact aux droits de la fonction", async () => {
    await applyAccessChanges(ipp.id, exploitantIpp.id, NOTHING);
    const { permissions } = await loadUserAccess(exploitantIpp.id, { viewMode: null });
    assert.ok(hasPermission(permissions, PERMISSIONS.AI_ANALYZE));
    assert.ok(!hasPermission(permissions, PERMISSIONS.REPORTS_VALIDATE));
    assert.equal(await prisma.userPermission.count({ where: { userId: exploitantIpp.id } }), 0);
  });

  await step("jamais sur soi-même", async () => {
    await refused(applyAccessChanges(ipp.id, ipp.id, NOTHING));
  });

  await step("informaticien : compte de l'IPP hors de portée, même en contournant l'interface", async () => {
    await refused(applyAccessChanges(info.id, ipp.id, { ...NOTHING, adjustments: [{ permissionKey: PERMISSIONS.AUDIT_VIEW, poolId: null, effect: "REVOKE" }] }));
  });

  await step("informaticien : ne donne pas une permission qu'il ne détient pas", async () => {
    await refused(applyAccessChanges(info.id, insp.id, { ...NOTHING, adjustments: [{ permissionKey: PERMISSIONS.REPORTS_VALIDATE, poolId: null, effect: "GRANT" }] }));
    assert.equal(await prisma.userPermission.count({ where: { userId: insp.id } }), 0, "rien n'est écrit");
  });

  await step("permission sensible : pas d'ajout individuel, même par l'IPP", async () => {
    await refused(applyAccessChanges(ipp.id, insp.id, { ...NOTHING, adjustments: [{ permissionKey: PERMISSIONS.USERS_MANAGE, poolId: null, effect: "GRANT" }] }));
  });

  await step("chef de POOL : ajuste dans son POOL, refusé ailleurs et sur tous les POOL", async () => {
    const ok = await applyAccessChanges(chef.id, insp.id, {
      ...NOTHING,
      adjustments: [{ permissionKey: PERMISSIONS.SCHOOLS_MANAGE, poolId: gomaPool, effect: "GRANT" }],
    });
    assert.equal(ok.changed, 1);
    await refused(
      applyAccessChanges(chef.id, insp.id, {
        ...NOTHING,
        adjustments: [
          { permissionKey: PERMISSIONS.SCHOOLS_MANAGE, poolId: gomaPool, effect: "GRANT" },
          { permissionKey: PERMISSIONS.SCHOOLS_MANAGE, poolId: otherPool.id, effect: "GRANT" },
        ],
      })
    );
    await refused(applyAccessChanges(chef.id, insp.id, { ...NOTHING, adjustments: [{ permissionKey: PERMISSIONS.SCHOOLS_MANAGE, poolId: null, effect: "GRANT" }] }));
    await refused(applyAccessChanges(chef.id, otherInspector.id, NOTHING));
    // Remise en état.
    await applyAccessChanges(chef.id, insp.id, NOTHING);
  });

  await step("fonctions : le chef retire puis rend une fonction d'appui ; ne nomme pas un chef ici", async () => {
    const target = await byEmail("inspecteur.goma@ipp-nordkivu1.test");
    const exploitantRole = await prisma.roleDefinition.findUniqueOrThrow({ where: { key: ROLE_KEYS.EXPLOITANT_POOL } });
    const chiefRole = await prisma.roleDefinition.findUniqueOrThrow({ where: { key: ROLE_KEYS.CHEF_POOL } });
    await applyAccessChanges(chef.id, target.id, { ...NOTHING, addRoles: [{ roleId: exploitantRole.id, poolId: gomaPool }] });
    const added = await prisma.userRole.findFirstOrThrow({ where: { userId: target.id, roleId: exploitantRole.id, poolId: gomaPool } });
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "user.role_add", entityId: target.id, actorId: chef.id } }));
    await applyAccessChanges(chef.id, target.id, { ...NOTHING, removeUserRoleIds: [added.id] });
    assert.equal(await prisma.userRole.count({ where: { id: added.id } }), 0);
    await refused(applyAccessChanges(chef.id, target.id, { ...NOTHING, addRoles: [{ roleId: chiefRole.id, poolId: gomaPool }] }));
    await refused(applyAccessChanges(chef.id, target.id, { ...NOTHING, addRoles: [{ roleId: exploitantRole.id, poolId: otherPool.id }] }));
  });

  await step("compte suspendu : aucun droit, ajustements compris", async () => {
    await applyAccessChanges(ipp.id, exploitantIpp.id, { ...NOTHING, adjustments: [{ permissionKey: PERMISSIONS.REPORTS_VALIDATE, poolId: null, effect: "GRANT" }] });
    await prisma.user.update({ where: { id: exploitantIpp.id }, data: { status: "SUSPENDED" } });
    const { permissions } = await loadUserAccess(exploitantIpp.id, { viewMode: null });
    assert.equal(permissions.length, 0);
    await prisma.user.update({ where: { id: exploitantIpp.id }, data: { status: "ACTIVE" } });
    await applyAccessChanges(ipp.id, exploitantIpp.id, NOTHING);
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
