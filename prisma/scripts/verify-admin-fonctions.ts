// Vérification sur base (décisions du 2026-10-13) : fonction « Admin » (droits
// du Super Admin, attribuée par un Super Admin seulement) ; modification d'une
// fonction personnalisée (titulaires mis à jour aussitôt) ; suppression avec
// retrait à tous ; fonctions système protégées ; pouvoirs réservés interdits.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-admin-fonctions.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError, loadUserAccess } from "../../src/lib/permissions";
import { PERMISSIONS, ROLE_KEYS, SUPER_ADMIN_EXCLUDED_PERMISSIONS } from "../../src/lib/rbac-data";
import { hasPermission } from "../../src/lib/permission-checks";
import { applyAccessChanges } from "../../src/lib/access-admin";
import { deleteCustomFunction, updateCustomFunction } from "../../src/lib/functions-admin";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

const TAG = `va${Date.now().toString(36)}`;
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`✔ ${name}`);
}
const refused = (fn: () => Promise<unknown>) => assert.rejects(fn, (e) => e instanceof ForbiddenError);

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const role = async (key: string) => prisma.roleDefinition.findUniqueOrThrow({ where: { key }, include: { rolePermissions: { include: { permission: true } } } });
  const mk = async (label: string, keys: string[]) => {
    const u = await prisma.user.create({ data: { name: `${TAG} ${label}`, email: `${TAG}.${label}@verif.test`, passwordHash: "x", status: "ACTIVE", organizationId: org.id, isDemo: false } });
    for (const k of keys) await prisma.userRole.create({ data: { userId: u.id, roleId: (await role(k)).id } });
    return u;
  };
  const sa = await mk("sa", [ROLE_KEYS.SUPER_ADMIN]);
  const ipp = await mk("ipp", [ROLE_KEYS.IPP]);
  const info = await mk("info", [ROLE_KEYS.INFORMATICIEN]);
  const futurAdmin = await mk("admin", []);
  const cible = await mk("cible", []);
  const titulaire = await mk("titulaire", []);
  const as = (u: { id: string }) => ({ id: u.id, organizationId: org.id });
  const admin = await role(ROLE_KEYS.ADMIN);
  const superAdmin = await role(ROLE_KEYS.SUPER_ADMIN);

  await check("Admin : fonction système avec exactement les permissions du Super Admin (pouvoirs réservés exclus)", async () => {
    assert.equal(admin.isSystem, true);
    const keys = (r: typeof admin) => r.rolePermissions.map((x) => x.permission.key).sort();
    assert.deepEqual(keys(admin), keys(superAdmin));
    for (const k of SUPER_ADMIN_EXCLUDED_PERMISSIONS) assert.equal(keys(admin).includes(k), false, k);
  });

  await check("Admin : attribuée par le Super Admin ; refusée à l'IPP et à l'informaticien", async () => {
    for (const u of [ipp, info]) await refused(() => applyAccessChanges(u.id, futurAdmin.id, { addRoles: [{ roleId: admin.id, poolId: null }], removeUserRoleIds: [], adjustments: [] }));
    await applyAccessChanges(sa.id, futurAdmin.id, { addRoles: [{ roleId: admin.id, poolId: null }], removeUserRoleIds: [], adjustments: [] });
    const a = await loadUserAccess(futurAdmin.id, { viewMode: null });
    assert.equal(a.superAdmin, true);
    assert.equal(a.viewModeKind, "full");
    for (const k of [PERMISSIONS.USERS_MANAGE, PERMISSIONS.REPORTS_VALIDATE, PERMISSIONS.REPORTS_ROUTE_IPP, PERMISSIONS.PUBLICATION_MANAGE]) assert.ok(hasPermission(a.permissions, k), k);
    for (const k of [PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, PERMISSIONS.PERSONNEL_RECORDS_READ_ALL]) assert.equal(hasPermission(a.permissions, k), false, k);
  });

  await check("Admin agit comme un Super Admin : attribue la fonction d'IPA ; ne peut pas attribuer « Admin »", async () => {
    await applyAccessChanges(futurAdmin.id, cible.id, { addRoles: [{ roleId: (await role(ROLE_KEYS.IPA)).id, poolId: null }], removeUserRoleIds: [], adjustments: [] });
    await refused(() => applyAccessChanges(futurAdmin.id, titulaire.id, { addRoles: [{ roleId: admin.id, poolId: null }], removeUserRoleIds: [], adjustments: [] }));
  });

  const perso = await prisma.roleDefinition.create({
    data: { key: `${TAG}_perso`, label: `${TAG} perso`, scope: "PROVINCE", isSystem: false, rolePermissions: { create: [{ permission: { connect: { key: PERMISSIONS.SCHOOLS_MANAGE } } }] } },
  });
  await prisma.userRole.create({ data: { userId: titulaire.id, roleId: perso.id } });

  await check("modifier une fonction personnalisée : le titulaire hérite aussitôt ; journal avant / après", async () => {
    assert.equal(hasPermission((await loadUserAccess(titulaire.id, { viewMode: null })).permissions, PERMISSIONS.AUDIT_VIEW), false);
    await updateCustomFunction(as(ipp), perso.id, { label: `${TAG} perso`, description: null, permissionKeys: [PERMISSIONS.SCHOOLS_MANAGE, PERMISSIONS.AUDIT_VIEW] });
    assert.ok(hasPermission((await loadUserAccess(titulaire.id, { viewMode: null })).permissions, PERMISSIONS.AUDIT_VIEW));
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "function.update", entityId: perso.id } });
    assert.deepEqual((log.newValue as { permissionKeys: string[] }).permissionKeys, [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.SCHOOLS_MANAGE].sort());
  });

  await check("fonction personnalisée : pouvoirs réservés et présence sensibles refusés ; fonctions système non modifiables", async () => {
    await refused(() => updateCustomFunction(as(ipp), perso.id, { label: "x perso", description: null, permissionKeys: [PERMISSIONS.PRESENCE_SCHEDULE_MANAGE] }));
    await refused(() => updateCustomFunction(as(sa), perso.id, { label: "x perso", description: null, permissionKeys: [PERMISSIONS.CELLS_PERSONNEL_MANAGE] }));
    await refused(async () => updateCustomFunction(as(ipp), (await role(ROLE_KEYS.SECRETAIRE_IPP)).id, { label: "x", description: null, permissionKeys: [] }));
    await refused(() => updateCustomFunction(as(sa), admin.id, { label: "x", description: null, permissionKeys: [] }));
  });

  await check("supprimer : fonction système refusée ; personnalisée supprimée et retirée à son titulaire, journalisée", async () => {
    await refused(async () => deleteCustomFunction(as(sa), (await role(ROLE_KEYS.IPA)).id));
    await refused(() => deleteCustomFunction(as(titulaire), perso.id));
    const r = await deleteCustomFunction(as(info), perso.id);
    assert.equal(r.holdersRemoved, 1);
    assert.equal(await prisma.roleDefinition.count({ where: { id: perso.id } }), 0);
    assert.equal(await prisma.userRole.count({ where: { userId: titulaire.id } }), 0);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "function.delete", entityId: perso.id, actorId: info.id } }));
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "user.role_remove", entityId: titulaire.id } }));
  });

  console.log(`\n${passed} vérifications réussies (préfixe ${TAG}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
