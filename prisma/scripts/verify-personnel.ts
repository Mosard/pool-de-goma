// Vérification sur base du lot 1 « Présence du personnel » (décisions du
// 2026-10-10, PRESENCES-BIOMETRIQUES-ANALYSE.md, Révision 2) : raccordement à
// la cellule du personnel (avant / après affectation, vocation retirée, deux
// cellules, archivage), refus des autres profils par APPEL DIRECT aux fonctions
// serveur (recherche et fiche), « Voir comme » sans pouvoir réservé, ajout
// individuel refusé, liste blanche des champs, inconnu ≠ zéro, journal sans
// contenu, historique d'appartenance daté.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-personnel.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError, loadUserAccess } from "../../src/lib/permissions";
import { PERMISSIONS, PERSONNEL_HEAD_KEYS, ROLE_KEYS } from "../../src/lib/rbac-data";
import { hasPermission } from "../../src/lib/permission-checks";
import { setCellIpa, setExploitantCell } from "../../src/lib/cells/assignments";
import { applyAccessChanges } from "../../src/lib/access-admin";
import { getPersonnelRecord, searchPersonnel } from "../../src/lib/personnel/server";
import { FORBIDDEN_FIELDS } from "../../src/lib/personnel/record";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

const TAG = `vp${Date.now().toString(36)}`;
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`✔ ${name}`);
}
async function refused(fn: () => Promise<unknown>) {
  await assert.rejects(fn, (e) => e instanceof ForbiddenError);
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const roleId = async (key: string) => (await prisma.roleDefinition.findUniqueOrThrow({ where: { key } })).id;
  const mkUser = async (label: string, roleKey: string | null, extra: Record<string, unknown> = {}) => {
    const u = await prisma.user.create({
      data: { name: `${TAG} ${label}`, email: `${TAG}.${label}@verif.test`, passwordHash: "x", status: "ACTIVE", organizationId: org.id, isDemo: false, ...extra },
    });
    if (roleKey) await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(roleKey) } });
    return u;
  };

  const ipp = await mkUser("ipp", ROLE_KEYS.IPP);
  const sa = await mkUser("sa", ROLE_KEYS.SUPER_ADMIN);
  const info = await mkUser("info", ROLE_KEYS.INFORMATICIEN);
  const secr = await mkUser("secr", ROLE_KEYS.SECRETAIRE_IPP);
  const ipaPers = await mkUser("ipapers", ROLE_KEYS.IPA);
  const ipaOther = await mkUser("ipaother", ROLE_KEYS.IPA);
  const exp = await mkUser("exp", null);
  await prisma.userRole.create({ data: { userId: exp.id, roleId: await roleId(ROLE_KEYS.EXPLOITANT_IPP) } });
  const zero = await mkUser("zero", null, { nombreEnfants: 0, phone: "+000" });
  const unknown = await mkUser("inconnu", null);
  const ippActor = { id: ipp.id, organizationId: org.id };

  // Cellules de test (la vocation n'a pas d'écran d'écriture : Q-A en attente).
  const pers = await prisma.cell.create({ data: { organizationId: org.id, code: `${TAG}P`.toUpperCase().slice(0, 20), name: `${TAG} personnel`, mandate: "PERSONNEL" } });
  const other = await prisma.cell.create({ data: { organizationId: org.id, code: `${TAG}G`.toUpperCase().slice(0, 20), name: `Cellule du personnel ${TAG}` } });

  const records = async (userId: string) => hasPermission((await loadUserAccess(userId, { viewMode: null })).permissions, PERMISSIONS.PERSONNEL_RECORDS_READ_ALL);

  await check("IPA de la cellule du personnel non encore affecté : aucun droit, fiches refusées", async () => {
    const a = await loadUserAccess(ipaPers.id, { viewMode: null });
    assert.equal(a.awaitingCell, true);
    assert.equal(a.permissions.length, 0);
    await refused(() => searchPersonnel(ipaPers.id, {}));
  });

  await check("affectation par l'IPP (Direction) : pouvoirs du responsable, historique CONNU", async () => {
    await setCellIpa(ippActor, { cellId: pers.id, ipaId: ipaPers.id, via: "direction" });
    const a = await loadUserAccess(ipaPers.id, { viewMode: null });
    for (const k of PERSONNEL_HEAD_KEYS) assert.ok(hasPermission(a.permissions, k), k);
    assert.ok(hasPermission(a.permissions, PERMISSIONS.PRESENCE_READ_CELL, { cellId: pers.id }));
    const terms = await prisma.staffCellTerm.findMany({ where: { userId: ipaPers.id } });
    assert.equal(terms.length, 1);
    assert.equal(terms[0].startSource, "CONNUE");
    assert.ok(terms[0].startedAt);
    assert.equal(terms[0].endedAt, null);
    assert.equal(terms[0].via, "direction");
  });

  await check("IPA d'une cellule nommée « du personnel » mais de vocation générale : aucun pouvoir du personnel", async () => {
    await setCellIpa(ippActor, { cellId: other.id, ipaId: ipaOther.id, via: "direction" });
    assert.equal(await records(ipaOther.id), false);
    const a = await loadUserAccess(ipaOther.id, { viewMode: null });
    assert.equal(hasPermission(a.permissions, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE), false);
    assert.ok(hasPermission(a.permissions, PERMISSIONS.PRESENCE_READ_CELL, { cellId: other.id }));
  });

  await check("recherche : liste blanche (identification, affectation), journal sans le texte cherché", async () => {
    const res = await searchPersonnel(ipaPers.id, { q: TAG });
    assert.ok(res.rows.length >= 8);
    for (const row of res.rows) {
      for (const f of [...FORBIDDEN_FIELDS, "email", "phone", "nombreEnfants", "dateNaissance", "matricule", "photoUrl"]) assert.equal(f in row, false, f);
    }
    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: ipaPers.id, action: "personnel.search" }, orderBy: { createdAt: "desc" } });
    assert.equal(JSON.stringify(log).includes(TAG), false);
    assert.equal((log.metadata as { hasQuery?: boolean }).hasQuery, true);
  });

  await check("fiche : champs autorisés seulement ; zéro conservé, inconnu nul ; consultation journalisée sans contenu", async () => {
    const z = await getPersonnelRecord(ipaPers.id, zero.id);
    assert.ok(z);
    for (const f of FORBIDDEN_FIELDS) assert.equal(f in z, false, f);
    assert.equal(z.nombreEnfants, 0);
    const n = await getPersonnelRecord(ipaPers.id, unknown.id);
    assert.equal(n?.nombreEnfants, null);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: ipaPers.id, action: "personnel.record.view", entityId: zero.id } });
    assert.equal(log.oldValue, null);
    assert.equal(log.newValue, null);
    assert.equal(JSON.stringify(log).includes("+000"), false);
    // Les autres IPAP aussi (y compris les autres IPA).
    assert.ok(await getPersonnelRecord(ipaPers.id, ipaOther.id));
  });

  await check("refus par appel direct : IPP, Super Admin, informaticien, secrétaire, autre IPA, exploitant", async () => {
    for (const u of [ipp, sa, info, secr, ipaOther, exp]) {
      await refused(() => searchPersonnel(u.id, { q: TAG }));
      await refused(() => getPersonnelRecord(u.id, zero.id));
    }
  });

  await check("vue globale des présences et appareils pour les cinq profils ; calendrier pour IPP et responsable seulement", async () => {
    for (const u of [ipp, sa, info, secr, ipaPers]) {
      const p = (await loadUserAccess(u.id, { viewMode: null })).permissions;
      assert.ok(hasPermission(p, PERMISSIONS.PRESENCE_READ_ALL), u.name);
      assert.ok(hasPermission(p, PERMISSIONS.PRESENCE_DEVICES_MANAGE), u.name);
      assert.ok(hasPermission(p, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE), u.name);
      assert.equal(hasPermission(p, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE), u.id === ipp.id || u.id === ipaPers.id, u.name);
    }
  });

  await check("« Voir comme » du Super Admin : ni calendrier, ni approbation, ni fiches (IPP ou IPA du personnel simulés)", async () => {
    const asIpp = await loadUserAccess(sa.id, { viewMode: { role: ROLE_KEYS.IPP, poolId: null } });
    assert.equal(asIpp.viewMode?.role, ROLE_KEYS.IPP);
    for (const k of [PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, PERMISSIONS.PRESENCE_REQUESTS_APPROVE_FINAL, PERMISSIONS.PRESENCE_DELEGATIONS_MANAGE]) {
      assert.equal(hasPermission(asIpp.permissions, k), false, k);
    }
    const asIpa = await loadUserAccess(sa.id, { viewMode: { role: ROLE_KEYS.IPA, poolId: null, cellId: pers.id } });
    assert.equal(asIpa.viewMode?.role, ROLE_KEYS.IPA);
    for (const k of PERSONNEL_HEAD_KEYS) assert.equal(hasPermission(asIpa.permissions, k), false, k);
  });

  await check("« Gérer les accès » : ajout individuel du calendrier ou des fiches refusé, même par l'IPP", async () => {
    for (const key of [PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, PERMISSIONS.PERSONNEL_RECORDS_READ_ALL]) {
      await refused(() => applyAccessChanges(ipp.id, secr.id, { addRoles: [], removeUserRoleIds: [], adjustments: [{ permissionKey: key, poolId: null, effect: "GRANT" }] }));
    }
    // Ligne posée directement en base : sans effet sur les droits calculés.
    const perm = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.PRESENCE_SCHEDULE_MANAGE } });
    await prisma.userPermission.create({ data: { userId: secr.id, permissionId: perm.id, effect: "GRANT" } });
    assert.equal(hasPermission((await loadUserAccess(secr.id, { viewMode: null })).permissions, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE), false);
  });

  await check("exploitant de la cellule du personnel : aucun pouvoir du responsable ; historique tenu", async () => {
    await setExploitantCell(ippActor, { userId: exp.id, cellId: pers.id, via: "direction" });
    const p = (await loadUserAccess(exp.id, { viewMode: null })).permissions;
    for (const k of PERSONNEL_HEAD_KEYS) assert.equal(hasPermission(p, k), false, k);
    await setExploitantCell(ippActor, { userId: exp.id, cellId: other.id, via: "direction" });
    const terms = await prisma.staffCellTerm.findMany({ where: { userId: exp.id }, orderBy: { observedAt: "asc" } });
    assert.equal(terms.length, 2);
    assert.equal(terms[0].cellId, pers.id);
    assert.ok(terms[0].endedAt);
    assert.equal(terms[1].cellId, other.id);
    assert.equal(terms[1].endedAt, null);
  });

  await check("vocation retirée ou dédoublée : plus aucun responsable (aucun choix arbitraire)", async () => {
    await prisma.cell.update({ where: { id: pers.id }, data: { mandate: "GENERAL" } });
    assert.equal(await records(ipaPers.id), false);
    await prisma.cell.update({ where: { id: pers.id }, data: { mandate: "PERSONNEL" } });
    assert.equal(await records(ipaPers.id), true);
    await prisma.cell.update({ where: { id: other.id }, data: { mandate: "PERSONNEL" } });
    assert.equal(await records(ipaPers.id), false);
    assert.equal(await records(ipaOther.id), false);
    await prisma.cell.update({ where: { id: other.id }, data: { mandate: "GENERAL" } });
    assert.equal(await records(ipaPers.id), true);
  });

  await check("fin de responsabilité : pouvoirs perdus immédiatement, historique clos, rien de réécrit", async () => {
    const before = await prisma.staffCellTerm.findFirstOrThrow({ where: { userId: ipaPers.id, endedAt: null } });
    await setCellIpa(ippActor, { cellId: pers.id, ipaId: null, via: "direction" });
    const a = await loadUserAccess(ipaPers.id, { viewMode: null });
    assert.equal(a.awaitingCell, true);
    await refused(() => searchPersonnel(ipaPers.id, {}));
    const after = await prisma.staffCellTerm.findUniqueOrThrow({ where: { id: before.id } });
    assert.ok(after.endedAt);
    assert.equal(after.startedAt?.getTime(), before.startedAt?.getTime());
  });

  // Cellules de test archivées : une seule cellule active PERSONNEL doit rester possible pour les tests suivants.
  await prisma.cell.updateMany({ where: { id: { in: [pers.id, other.id] } }, data: { active: false, ipaId: null } });
  console.log(`\n${passed} vérifications réussies (préfixe ${TAG}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
