// Vérification sur base des lots 2 à 5 « Présence du personnel » : appareils
// et jetons, associations datées, réception (idempotence, doublons, désordre,
// retard, rejets), synthèses recalculées, périmètres de consultation par APPEL
// DIRECT (global, cellule, soi-même, filtres forcés), horaire et calendrier
// réservés, changement de cellule et de responsable, simulateur isolé.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée.
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-presence.ts

import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { ForbiddenError } from "../../src/lib/permissions";
import { ROLE_KEYS } from "../../src/lib/rbac-data";
import { setCellIpa, setExploitantCell } from "../../src/lib/cells/assignments";
import { addCalendarDay, removeCalendarDay, saveSchedule } from "../../src/lib/presence/config";
import { authenticateDevice, createDevice, createMapping, endMapping, issueDeviceToken, presenceSimulatorEnabled, revokeDeviceToken } from "../../src/lib/presence/devices";
import { IngestConflictError, ingestBatch } from "../../src/lib/presence/ingest";
import { VALIDATED_SCHEDULE_DEFAULTS } from "../../src/lib/presence/settings";
import { addDays, gomaDateKey, gomaIsoWeekday } from "../../src/lib/presence/time";
import { loadOwnRows, loadPresenceRows, loadPresenceViewer, loadUnmappedIdentifiers } from "../../src/lib/presence/views";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

const TAG = `vz${Date.now().toString(36)}`;
const createdCells: string[] = [];
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`✔ ${name}`);
}
const refused = (fn: () => Promise<unknown>) => assert.rejects(fn, (e) => e instanceof ForbiddenError);

/** Dernier lundi passé, au moins 7 jours avant aujourd'hui (jours ouvrés de test). */
function pastMonday(): string {
  let d = addDays(gomaDateKey(new Date()), -7);
  while (gomaIsoWeekday(d) !== 1) d = addDays(d, -1);
  return d;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  // Une seule cellule active PERSONNEL : celles d'anciens tests locaux sont archivées (base locale).
  await prisma.cell.updateMany({ where: { organizationId: org.id, active: true, mandate: "PERSONNEL" }, data: { active: false, ipaId: null } });
  const roleId = async (key: string) => (await prisma.roleDefinition.findUniqueOrThrow({ where: { key } })).id;
  const mk = async (label: string, roleKey: string | null) => {
    const u = await prisma.user.create({
      data: { name: `${TAG} ${label}`, email: `${TAG}.${label}@verif.test`, passwordHash: "x", status: "ACTIVE", organizationId: org.id, isDemo: false },
    });
    if (roleKey) await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(roleKey) } });
    return u;
  };
  const ipp = await mk("ipp", ROLE_KEYS.IPP);
  const sa = await mk("sa", ROLE_KEYS.SUPER_ADMIN);
  const info = await mk("info", ROLE_KEYS.INFORMATICIEN);
  const secr = await mk("secr", ROLE_KEYS.SECRETAIRE_IPP);
  const ipaPers = await mk("ipapers", ROLE_KEYS.IPA);
  const ipaOther = await mk("ipaother", ROLE_KEYS.IPA);
  const ipaNew = await mk("ipanew", ROLE_KEYS.IPA);
  const agent = await mk("agent", ROLE_KEYS.AGENT_IPP);
  const expOther = await mk("expother", ROLE_KEYS.EXPLOITANT_IPP);
  const expPers = await mk("exppers", ROLE_KEYS.EXPLOITANT_IPP);
  const as = (u: { id: string }) => ({ id: u.id, organizationId: org.id });
  const pers = await prisma.cell.create({ data: { organizationId: org.id, code: `${TAG}P`.toUpperCase().slice(0, 20), name: `${TAG} personnel`, mandate: "PERSONNEL" } });
  const other = await prisma.cell.create({ data: { organizationId: org.id, code: `${TAG}O`.toUpperCase().slice(0, 20), name: `${TAG} autre` } });
  createdCells.push(pers.id, other.id);
  await setCellIpa(as(ipp), { cellId: pers.id, ipaId: ipaPers.id, via: "direction" });
  await setCellIpa(as(ipp), { cellId: other.id, ipaId: ipaOther.id, via: "direction" });
  await setExploitantCell(as(ipp), { userId: expOther.id, cellId: other.id, via: "direction" });
  await setExploitantCell(as(ipp), { userId: expPers.id, cellId: pers.id, via: "direction" });
  const D = pastMonday();
  const D2 = addDays(D, 1);
  // Appartenance datée (fixture de test) : connue depuis une semaine avant la période observée.
  await prisma.staffCellTerm.updateMany({ where: { userId: { in: [expOther.id, expPers.id] } }, data: { startedAt: new Date(`${addDays(D, -7)}T00:00:00Z`) } });
  await saveSchedule(as(ipp), VALIDATED_SCHEDULE_DEFAULTS);

  let device!: { id: string; organizationId: string; isSimulator: boolean };
  await check("appareil : créé par une secrétaire (non vérifié) ; refusé à un agent, à un exploitant, à un autre IPA", async () => {
    device = await createDevice(as(secr), { label: `${TAG} pointeuse`, siteLabel: `${TAG} Bureau de l'IPP` });
    assert.equal((await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } })).status, "NON_VERIFIE");
    for (const u of [agent, expOther, ipaOther]) await refused(() => createDevice(as(u), { label: "x", siteLabel: "y" }));
  });

  await check("jeton : stocké haché, authentifie l'appareil ; révoqué → refus ; jamais dans le journal", async () => {
    const token = await issueDeviceToken(as(info), device.id);
    const cred = await prisma.deviceCredential.findFirstOrThrow({ where: { deviceId: device.id } });
    assert.equal(JSON.stringify(cred).includes(token), false);
    assert.equal((await authenticateDevice(`Bearer ${token}`))?.id, device.id);
    assert.equal(await authenticateDevice(`Bearer ${token}x`), null);
    const t2 = await issueDeviceToken(as(sa), device.id);
    const c2 = await prisma.deviceCredential.findFirstOrThrow({ where: { deviceId: device.id, id: { not: cred.id } } });
    await revokeDeviceToken(as(ipp), c2.id);
    assert.equal(await authenticateDevice(`Bearer ${t2}`), null);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "presence.token_issue", entityId: cred.id } });
    assert.equal(JSON.stringify(log).includes(token), false);
    for (const u of [agent, ipaOther]) await refused(() => issueDeviceToken(as(u), device.id));
  });

  await check("associations : secrétaire, informaticien, IPA du personnel ; chevauchement refusé ; autre IPA refusé ; journalisées", async () => {
    await createMapping(as(secr), { deviceId: device.id, deviceUserId: "101", userId: expOther.id, fromDateKey: addDays(D, -7) });
    await createMapping(as(info), { deviceId: device.id, deviceUserId: "102", userId: expPers.id, fromDateKey: addDays(D, -7) });
    await createMapping(as(ipaPers), { deviceId: device.id, deviceUserId: "103", userId: agent.id, fromDateKey: addDays(D, -7) });
    await refused(() => createMapping(as(ipp), { deviceId: device.id, deviceUserId: "101", userId: agent.id, fromDateKey: D }));
    await refused(() => createMapping(as(ipaOther), { deviceId: device.id, deviceUserId: "104", userId: agent.id, fromDateKey: D }));
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "presence.mapping_create", actorId: secr.id } }));
  });

  const events = [
    { deviceUserId: "101", localTime: `${D}T08:20:00`, direction: "IN" },
    { deviceUserId: "101", localTime: `${D}T16:00:00`, direction: "OUT" },
    { deviceUserId: "102", localTime: `${D}T08:15:00`, direction: "IN" },
    { deviceUserId: "999", localTime: `${D}T09:00:00`, direction: "IN" },
    { deviceUserId: "101", localTime: "pas-une-heure" },
  ];
  await check("réception : 4 acceptés, 1 rejeté ; rejeu identique sans effet ; même clé autre contenu refusée ; renvoi du journal → doublons", async () => {
    const r = await ingestBatch(device, { idempotencyKey: `${TAG}-lot-1`, events, source: "DEVICE" });
    assert.equal(r.accepted, 4);
    assert.equal(r.rejected.length, 1);
    const again = await ingestBatch(device, { idempotencyKey: `${TAG}-lot-1`, events, source: "DEVICE" });
    assert.equal(again.replayed, true);
    await assert.rejects(() => ingestBatch(device, { idempotencyKey: `${TAG}-lot-1`, events: events.slice(0, 2), source: "DEVICE" }), IngestConflictError);
    const resend = await ingestBatch(device, { idempotencyKey: `${TAG}-lot-2`, events, source: "DEVICE" });
    assert.equal(resend.accepted, 0);
    assert.equal(resend.duplicates, 4);
    assert.equal(await prisma.rawPunch.count({ where: { deviceId: device.id } }), 4);
  });

  const viewRows = async (u: { id: string }, f: Record<string, string | undefined> = {}, from = D, to = D) =>
    loadPresenceRows((await loadPresenceViewer(u.id))!, { from, to, ...f });

  await check("synthèse : 8 h 20 → retard signalé, durée non calculée ; départ 16 h → 45 min proposées ; 8 h 15 → pas de retard", async () => {
    const rows = await viewRows(ipp);
    const a = rows.find((r) => r.userId === expOther.id)!.summary;
    assert.equal(a.late, true);
    assert.equal(a.lateMinutes, null);
    assert.equal(a.overtimeProposedMin, 45);
    const b = rows.find((r) => r.userId === expPers.id)!.summary;
    assert.equal(b.late, false);
    assert.equal(b.status, "ENTREE_SEULE");
    assert.equal(rows.find((r) => r.userId === agent.id)!.summary.status, "AUCUN_POINTAGE");
  });

  await check("pointage tardif et dans le désordre : sortie reçue après coup → journée recalculée ; brut intact", async () => {
    const before = await prisma.rawPunch.findMany({ where: { deviceId: device.id }, orderBy: { id: "asc" } });
    await ingestBatch(device, {
      idempotencyKey: `${TAG}-lot-3`,
      events: [
        { deviceUserId: "102", localTime: `${D}T15:10:00`, direction: "OUT" },
        { deviceUserId: "101", localTime: `${D2}T07:59:00`, direction: "IN" },
      ],
      source: "DEVICE",
    });
    const row = (await viewRows(ipp)).find((r) => r.userId === expPers.id)!;
    assert.equal(row.summary.status, "ENTREE_SORTIE");
    assert.equal(row.summary.overtimeProposedMin, null);
    const after = await prisma.rawPunch.findMany({ where: { id: { in: before.map((b) => b.id) } }, orderBy: { id: "asc" } });
    assert.deepEqual(after, before);
  });

  await check("identifiant non associé : signalé, jamais rapproché ; association rétroactive explicite → pris en compte", async () => {
    assert.ok((await loadUnmappedIdentifiers(org.id)).some((u) => u.deviceUserId === "999" && u.deviceId === device.id));
    await createMapping(as(ipaPers), { deviceId: device.id, deviceUserId: "999", userId: ipaNew.id, fromDateKey: D });
    assert.equal((await loadUnmappedIdentifiers(org.id)).some((u) => u.deviceUserId === "999" && u.deviceId === device.id), false);
    const own = await loadOwnRows((await loadPresenceViewer(ipaNew.id))!, D, D);
    assert.equal(own[0].summary.arrival, "09:00:00");
  });

  await check("périmètres par appel direct : global ; cellule seulement ; soi-même ; filtres forcés hors périmètre → rien ; aucune donnée privée", async () => {
    const ids = async (u: { id: string }, f: Record<string, string> = {}) => (await viewRows(u, f)).map((r) => r.userId).sort();
    for (const u of [ipp, sa, info, secr, ipaPers]) {
      const seen = await ids(u);
      for (const t of [expOther.id, expPers.id, agent.id]) assert.ok(seen.includes(t), u.name);
    }
    assert.deepEqual(await ids(ipaOther), [expOther.id]);
    assert.deepEqual(await ids(ipaOther, { cellId: pers.id }), []);
    assert.deepEqual(await ids(ipaOther, { userId: expPers.id }), []);
    assert.deepEqual(await ids(expOther), [expOther.id]);
    assert.deepEqual(await ids(agent, { userId: expOther.id }), []);
    const row = (await viewRows(ipp))[0];
    for (const k of ["email", "phone", "nombreEnfants", "dateNaissance", "matricule", "passwordHash"]) assert.equal(JSON.stringify(row).includes(`"${k}"`), false, k);
  });

  await check("horaire : refusé à la secrétaire, à l'informaticien, au Super Admin, à un autre IPA ; IPP et IPA du personnel → recalcul ; journal avant / après", async () => {
    for (const u of [secr, info, sa, ipaOther]) await refused(() => saveSchedule(as(u), { ...VALIDATED_SCHEDULE_DEFAULTS, lateAfter: "08:30" }));
    await saveSchedule(as(ipp), { ...VALIDATED_SCHEDULE_DEFAULTS, lateAfter: "08:30" });
    const late = async () => (await viewRows(ipp)).find((r) => r.userId === expOther.id)!.summary.late;
    assert.equal(await late(), false);
    await saveSchedule(as(ipaPers), VALIDATED_SCHEDULE_DEFAULTS);
    assert.equal(await late(), true);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "presence.schedule_update", actorId: ipp.id }, orderBy: { createdAt: "desc" } });
    assert.equal((log.newValue as { lateAfter: string }).lateAfter, "08:30");
    assert.equal((log.oldValue as { lateAfter: string }).lateAfter, "08:15");
  });

  await check("calendrier : jour non travaillé par l'IPA du personnel → aucun retard ; refusé à la secrétaire ; retrait par l'IPP → recalcul", async () => {
    await refused(() => addCalendarDay(as(secr), { dateKey: D, label: "Test" }));
    await addCalendarDay(as(ipaPers), { dateKey: D, label: `${TAG} jour de test` });
    const s = async () => (await viewRows(ipp)).find((r) => r.userId === expOther.id)!.summary;
    assert.equal((await s()).status, "JOUR_NON_TRAVAILLE");
    assert.equal((await s()).late, null);
    const day = await prisma.calendarDay.findFirstOrThrow({ where: { organizationId: org.id, label: `${TAG} jour de test` } });
    await removeCalendarDay(as(ipp), day.id);
    assert.equal((await s()).late, true);
  });

  await check("changement de cellule : l'ancien responsable garde les jours d'appartenance passés, pas les suivants", async () => {
    await setExploitantCell(as(ipp), { userId: expOther.id, cellId: pers.id, via: "direction" });
    assert.ok((await viewRows(ipaOther)).some((r) => r.userId === expOther.id));
    const tomorrow = addDays(gomaDateKey(new Date()), 1);
    assert.equal((await viewRows(ipaOther, {}, tomorrow, tomorrow)).some((r) => r.userId === expOther.id), false);
  });

  await check("responsable remplacé (par une secrétaire) : l'ancien perd la vue globale dès sa requête suivante, le remplaçant la reçoit", async () => {
    await setCellIpa(as(secr), { cellId: pers.id, ipaId: ipaNew.id, via: "cellules" });
    assert.equal((await loadPresenceViewer(ipaPers.id))!.scope.kind, "self");
    assert.equal((await loadPresenceViewer(ipaNew.id))!.scope.kind, "all");
    await refused(() => saveSchedule(as(ipaPers), VALIDATED_SCHEDULE_DEFAULTS));
  });

  await check("fin d'association : les pointages après la fin ne sont plus attribués (signalés non associés)", async () => {
    const m = await prisma.deviceUserMapping.findFirstOrThrow({ where: { deviceId: device.id, deviceUserId: "101" } });
    await endMapping(as(secr), { mappingId: m.id, endDateKey: D2, reason: "Test" });
    const own = await loadOwnRows((await loadPresenceViewer(expOther.id))!, D2, D2);
    assert.equal(own[0].summary.status, "SANS_IDENTIFIANT");
    assert.ok((await loadUnmappedIdentifiers(org.id)).some((u) => u.deviceUserId === "101" && u.partly));
  });

  await check("simulateur : indisponible sans PRESENCE_SIMULATOR ; données marquées « Simulation » ; source incompatible refusée", async () => {
    assert.equal(presenceSimulatorEnabled({ POSTGRES_URL: url }), false);
    await refused(() => createDevice(as(secr), { label: "sim", siteLabel: "sim", simulator: true }));
    process.env.PRESENCE_SIMULATOR = "1";
    const sim = await createDevice(as(secr), { label: `${TAG} sim`, siteLabel: `${TAG} simulé`, simulator: true });
    await createMapping(as(secr), { deviceId: sim.id, deviceUserId: "S1", userId: agent.id, fromDateKey: D });
    await ingestBatch(sim, { idempotencyKey: `${TAG}-sim`, events: [{ deviceUserId: "S1", localTime: `${D2}T08:00:00`, direction: "IN" }], source: "SIMULATOR" });
    const own = await loadOwnRows((await loadPresenceViewer(agent.id))!, D2, D2);
    assert.equal(own[0].summary.simulated, true);
    await assert.rejects(() => ingestBatch(sim, { idempotencyKey: `${TAG}-sim-2`, events: [{ deviceUserId: "S1", localTime: `${D2}T09:00:00` }], source: "DEVICE" }));
    await assert.rejects(() => ingestBatch(device, { idempotencyKey: `${TAG}-sim-3`, events: [{ deviceUserId: "S1", localTime: `${D2}T09:00:00` }], source: "SIMULATOR" }));
    delete process.env.PRESENCE_SIMULATOR;
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
