// Test de bout en bout, PAR HTTP, de la réception ADMS directe (pointeuse
// ZKTeco simulée) : identification par numéro de série, appairage, empreinte,
// chemin secret, ATTLOG (temps réel, renvoi, rattrapage après coupure),
// quarantaine d'horloge, tables biométriques ignorées sans lecture, INFO,
// reprise d'un recalcul interrompu, envois simultanés, middleware contourné.
//
// À lancer UNIQUEMENT sur une base locale jetable, avec l'application démarrée
// sur cette même base et ADMS_DEVICE_CACHE_MS=0 (aucune mémoire d'appareil).
// Usage : POSTGRES_URL=<url locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-adms-http.ts

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { ROLE_KEYS } from "../../src/lib/rbac-data";
import {
  cancelDeviceCommand,
  createDevice,
  createMapping,
  deleteUnmappedDeviceUser,
  enrollAgentOnDevice,
  issueAdmsPathSecret,
  openAdmsPairing,
  removeAgentFromDevice,
  requestDeviceInventory,
  setDeviceDisabled,
} from "../../src/lib/presence/devices";
import { saveSchedule } from "../../src/lib/presence/config";
import { VALIDATED_SCHEDULE_DEFAULTS } from "../../src/lib/presence/settings";
import { addDays, dateKeyToDbDate, gomaClock, gomaDateKey } from "../../src/lib/presence/time";

const url = process.env.POSTGRES_URL ?? "";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) || !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base et une application locales.");
  process.exit(2);
}

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const RUN = Date.now().toString(36).toUpperCase();
const SN = `TEST${RUN}`;
const UA = "iClock Proxy/1.09";
const IP = "203.0.113.10";

async function call(method: "GET" | "POST", path: string, body?: string, headers: Record<string, string> = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "user-agent": UA, "x-forwarded-for": IP, ...(body !== undefined ? { "content-type": "text/plain" } : {}), ...headers },
    body,
    redirect: "manual",
  });
  return { status: res.status, text: await res.text(), location: res.headers.get("location") };
}
const handshake = (sn = SN) => call("GET", `/iclock/cdata?SN=${sn}&options=all&pushver=2.4.1&language=69`);
const attlog = (body: string, prefix = "") => call("POST", `${prefix}/iclock/cdata?SN=${SN}&table=ATTLOG&Stamp=9999`, body);
const alertOf = (kind: string, where: { deviceId?: string; serialNumber?: string }) => prisma.attendanceDeviceAlert.findFirst({ where: { kind, ...where } });

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const passwordHash = await bcrypt.hash("Verif-Adms-2026!", 10);
  async function user(slug: string, name: string, roleKey: string) {
    const u = await prisma.user.create({
      data: { name, email: `${slug}.${RUN.toLowerCase()}@adms.test`, username: `${slug}${RUN.toLowerCase()}`, passwordHash, status: "ACTIVE", organizationId: org.id, isDemo: false },
    });
    await prisma.userRole.create({ data: { userId: u.id, roleId: roles.get(roleKey)!.id } });
    return u;
  }
  // Noms fictifs (base locale de test).
  const ipp = await user("ipp", `IPP Test ${RUN}`, ROLE_KEYS.IPP);
  const secr = await user("secr", `Secrétaire Test ${RUN}`, ROLE_KEYS.SECRETAIRE_IPP);
  const agent = await user("agent", `Agent Delta ${RUN}`, ROLE_KEYS.AGENT_IPP);
  const as = (u: { id: string }) => ({ id: u.id, organizationId: org.id });
  await saveSchedule(as(ipp), VALIDATED_SCHEDULE_DEFAULTS);

  const today = gomaDateKey(new Date());
  const yest = addDays(today, -1);
  const now = new Date();
  // Heure de Goma décalée de quelques minutes par rapport à maintenant.
  const clock = (deltaMin: number) => gomaClock(new Date(now.getTime() + deltaMin * 60_000));
  const dateAt = (deltaMin: number) => gomaDateKey(new Date(now.getTime() + deltaMin * 60_000));
  const line = (pin: string, date: string, time: string, status = "0", verify = "1") => `${pin}\t${date} ${time}\t${status}\t${verify}\t0\t0\t0\t0\t0\t0\t`;
  const dailyOf = (dateKey: string) => prisma.dailyAttendance.findUnique({ where: { userId_date: { userId: agent.id, date: dateKeyToDbDate(dateKey) } } });

  await check("middleware contourné : /iclock ne redirige jamais vers /login ; requête sans SN = 400", async () => {
    const r = await call("GET", "/iclock/getrequest");
    assert.equal(r.status, 400);
    assert.equal(r.location, null);
  });

  await check("numéro de série inconnu : refus 401 (la pointeuse garde ses données) et signalement", async () => {
    assert.equal((await handshake(`INCONNU${RUN}`)).status, 401);
    assert.ok(await alertOf("SERIE_INCONNUE", { serialNumber: `INCONNU${RUN}` }));
  });

  const apiDevice = await createDevice(as(secr), { label: "Passerelle (test)", siteLabel: "Bureau de l'IPP", serialNumber: `API${RUN}` });
  await check("appareil en mode passerelle : refusé en ADMS ; numéro de série unique ; ADMS exige un numéro valide", async () => {
    assert.equal((await handshake(`API${RUN}`)).status, 401);
    assert.ok(await alertOf("APPAREIL_REFUSE", { deviceId: apiDevice.id }));
    await assert.rejects(createDevice(as(secr), { label: "Doublon", siteLabel: "Bureau X", serialNumber: `API${RUN}`, protocol: "ADMS" }), /déjà enregistré/);
    await assert.rejects(createDevice(as(secr), { label: "Sans série", siteLabel: "Bureau X", protocol: "ADMS" }), /numéro de série/);
  });

  const device = await createDevice(as(secr), { label: "UA300 (test)", siteLabel: "Bureau de l'IPP", vendor: "ZKTeco", model: "UA300", serialNumber: SN, protocol: "ADMS" });
  await createMapping(as(secr), { deviceId: device.id, deviceUserId: "11", userId: agent.id, fromDateKey: addDays(today, -7) });

  await check("appairage : refus tant qu'il n'est pas ouvert ; ouvert → premier contact accepté, empreinte enregistrée", async () => {
    assert.equal((await handshake()).status, 401);
    assert.ok(await alertOf("APPAIRAGE_REQUIS", { deviceId: device.id }));
    await openAdmsPairing(as(secr), device.id);
    const r = await handshake();
    assert.equal(r.status, 200);
    assert.match(r.text, new RegExp(`^GET OPTION FROM: ${SN}\\n`));
    assert.match(r.text, /\nTransFlag=TransData AttLog\n/);
    const d = await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } });
    assert.ok(d.admsPairedAt);
    assert.equal(d.admsPairingUntil, null);
    assert.equal(d.admsPushVersion, "2.4.1");
    assert.equal(d.admsUserAgent, UA);
    assert.equal(d.admsPublicIp, IP);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "presence.adms_paired", entityId: device.id } }));
  });

  const L1 = line("11", dateAt(-30), clock(-30), "0");
  const L2 = line("77", dateAt(-20), clock(-20), "1");
  await check("ATTLOG : « OK: 2 » après enregistrement ; valeurs brutes conservées ; identifiant non associé conservé ; journée calculée", async () => {
    const r = await attlog(`${L1}\n${L2}\n`);
    assert.equal(r.status, 200);
    assert.equal(r.text, "OK: 2");
    const punches = await prisma.rawPunch.findMany({ where: { deviceId: device.id }, orderBy: { punchedAt: "asc" } });
    assert.equal(punches.length, 2);
    assert.equal(punches[0].rawStatus, "0");
    assert.equal(punches[0].direction, "IN");
    assert.equal(punches[1].direction, "OUT");
    assert.equal(punches[1].deviceUserId, "77");
    assert.equal((await dailyOf(gomaDateKey(punches[0].punchedAt)))?.punchCount, 1);
    const batch = await prisma.ingestBatch.findFirstOrThrow({ where: { deviceId: device.id } });
    assert.ok(batch.recomputedAt, "recalcul marqué fait");
    assert.ok((await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } })).lastEventReceivedAt);
  });

  await check("renvoi identique (réponse perdue) : « OK: 2 », aucun doublon", async () => {
    assert.equal((await attlog(`${L1}\n${L2}\n`)).text, "OK: 2");
    assert.equal(await prisma.rawPunch.count({ where: { deviceId: device.id } }), 2);
  });

  await check("rattrapage après coupure : anciens + nouveaux pointages, seuls les nouveaux entrent ; temps réel → décalage mesuré", async () => {
    const L3 = line("11", addDays(yest, -1), "08:05:00", "0");
    const L4 = line("11", dateAt(0), clock(0), "1");
    assert.equal((await attlog(`${L1}\n${L3}\n${L4}\n`)).text, "OK: 3");
    assert.equal(await prisma.rawPunch.count({ where: { deviceId: device.id } }), 4);
    assert.equal((await dailyOf(addDays(yest, -1)))?.punchCount, 1, "jour antérieur recalculé (pointage arrivé en retard)");
    const d = await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } });
    assert.ok(d.lastClockOffsetSec !== null && Math.abs(d.lastClockOffsetSec) < 120, `décalage ${d.lastClockOffsetSec}`);
  });

  await check("horloge en avance : pointage conservé en quarantaine, exclu du calcul, signalé ; jamais rejeté", async () => {
    const future = addDays(today, 2);
    assert.equal((await attlog(`${line("11", future, "09:08:32", "4")}\n`)).text, "OK: 1");
    const p = await prisma.rawPunch.findFirstOrThrow({ where: { deviceId: device.id, rawStatus: "4" } });
    assert.equal(p.clockSuspect, true);
    assert.equal(p.direction, "UNKNOWN");
    assert.equal(await dailyOf(future), null, "aucune journée créée par un pointage en quarantaine");
    assert.ok(await alertOf("HORLOGE_EN_AVANCE", { deviceId: device.id }));
  });

  await check("tables biométriques ou utilisateurs : « OK » sans lecture ni conservation ; seuls le nom et la taille sont signalés", async () => {
    const before = await prisma.rawPunch.count();
    const marker = `MARQUEUR-BIOMETRIQUE-${RUN}`;
    for (const table of ["BIODATA", "USERINFO", "OPERLOG"]) {
      const r = await call("POST", `/iclock/cdata?SN=${SN}&table=${table}&Stamp=1`, `PIN=11\tTMP=${marker}\n`);
      assert.equal(r.status, 200);
      assert.equal(r.text, "OK");
    }
    assert.equal(await prisma.rawPunch.count(), before);
    assert.ok(await alertOf("TABLE_NON_ATTENDUE", { deviceId: device.id }));
    const found = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "AttendanceDeviceAlert" WHERE detail::text LIKE $1`, `%${marker}%`);
    assert.equal(Number(found[0].n), 0, "le contenu n'apparaît nulle part");
  });

  await check("interrogation avec INFO : compteurs (nombres seulement), micrologiciel et IP locale enregistrés ; aucune commande", async () => {
    const r = await call("GET", `/iclock/getrequest?SN=${SN}&INFO=Ver%208.0.4.6-20220616,2,1,5,192.168.0.89,10,7,12,0,111`);
    assert.equal(r.text, "OK");
    const d = await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } });
    assert.deepEqual(d.admsInfo, { firmware: "Ver 8.0.4.6-20220616", users: 2, fingerprints: 1, attLogs: 5, localIp: "192.168.0.89" });
    assert.equal(d.firmware, "Ver 8.0.4.6-20220616");
    assert.equal(d.admsLocalIp, "192.168.0.89");
    assert.equal((await call("POST", `/iclock/devicecmd?SN=${SN}`, "ID=1&Return=0")).text, "OK");
  });

  await check("empreinte modifiée ou IP publique différente : accepté mais signalé", async () => {
    const r = await call("GET", `/iclock/cdata?SN=${SN}&options=all&pushver=3.0.0`, undefined, { "user-agent": "curl/8", "x-forwarded-for": "198.51.100.7" });
    assert.equal(r.status, 200);
    assert.ok(await alertOf("EMPREINTE_MODIFIEE", { deviceId: device.id }));
    assert.ok(await alertOf("IP_PUBLIQUE_CHANGEE", { deviceId: device.id }));
  });

  await check("recalcul interrompu : le renvoi du même lot le refait", async () => {
    const L5 = line("11", yest, "16:30:00", "1");
    assert.equal((await attlog(`${L5}\n`)).text, "OK: 1");
    // Simule un échec du recalcul après l'enregistrement : synthèse périmée, lot non marqué.
    const batch = await prisma.ingestBatch.findFirstOrThrow({ where: { deviceId: device.id }, orderBy: { receivedAt: "desc" } });
    await prisma.ingestBatch.update({ where: { id: batch.id }, data: { recomputedAt: null } });
    await prisma.dailyAttendance.deleteMany({ where: { userId: agent.id, date: dateKeyToDbDate(yest) } });
    assert.equal((await attlog(`${L5}\n`)).text, "OK: 1");
    assert.ok(await dailyOf(yest), "synthèse reconstruite");
    assert.ok((await prisma.ingestBatch.findUniqueOrThrow({ where: { id: batch.id } })).recomputedAt);
  });

  await check("envois simultanés du même lot : tous « OK », un seul enregistrement", async () => {
    const L6 = line("11", yest, "12:00:00", "0");
    const before = await prisma.rawPunch.count({ where: { deviceId: device.id } });
    const rs = await Promise.all([1, 2, 3].map(() => attlog(`${L6}\n`)));
    assert.deepEqual(rs.map((r) => r.text), ["OK: 1", "OK: 1", "OK: 1"]);
    assert.equal(await prisma.rawPunch.count({ where: { deviceId: device.id } }), before + 1);
  });

  // ─── Gestion centralisée : enrôlement, inventaire, blocage ───
  const agent2 = await user("agent2", `Agent Epsilon ${RUN}`, ROLE_KEYS.AGENT_IPP);
  const poll = () => call("GET", `/iclock/getrequest?SN=${SN}`);
  const results = (lines: string[]) => call("POST", `/iclock/devicecmd?SN=${SN}`, lines.join("\n") + "\n");
  const commandsOf = (where: object = {}) => prisma.deviceCommand.findMany({ where: { deviceId: device.id, ...where }, orderBy: { seq: "asc" } });

  await check("pointage d'un PIN sans association : conservé, non compté, signalé", async () => {
    assert.equal((await attlog(`${line("55", yest, "07:30:00", "0")}\n`)).text, "OK: 1");
    assert.ok(await prisma.rawPunch.findFirst({ where: { deviceId: device.id, deviceUserId: "55" } }));
    const a = await alertOf("POINTAGE_NON_AUTORISE", { deviceId: device.id });
    assert.ok(a);
    assert.match(JSON.stringify(a.detail), /"55"/);
  });

  let enrolledPin = "";
  await check("inscription depuis l'application : PIN attribué, association datée, commandes remises à l'interrogation suivante", async () => {
    const { pin } = await enrollAgentOnDevice(as(secr), { deviceId: device.id, userId: agent2.id, fromDateKey: today, captureFingerprint: true, fingerIndex: 1 });
    enrolledPin = pin;
    assert.equal(pin, "78", "au-dessus du plus grand PIN connu (77)");
    assert.ok(await prisma.deviceUserMapping.findFirst({ where: { deviceId: device.id, deviceUserId: pin, userId: agent2.id, validTo: null } }));
    await assert.rejects(enrollAgentOnDevice(as(secr), { deviceId: device.id, userId: agent2.id, fromDateKey: today }), /déjà inscrit/);
    await assert.rejects(enrollAgentOnDevice(as(secr), { deviceId: device.id, userId: ipp.id, pin: "55", fromDateKey: today }), /personne non associée/);
    const r = await poll();
    const lines = r.text.trim().split("\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], new RegExp(`^C:\\d+:DATA UPDATE USERINFO PIN=${pin}\\tName=Agent Epsilon ${RUN}\\tPri=0\\tGrp=1$`));
    assert.match(lines[1], new RegExp(`^C:\\d+:ENROLL_FP PIN=${pin}\\tFID=1\\tRETRY=3\\tOVERWRITE=0$`));
    assert.ok((await commandsOf()).every((c) => c.status === "SENT"));
    // Interrogation suivante sans résultat : rien n'est renvoyé avant 5 minutes.
    assert.equal((await poll()).text, "OK");
  });

  await check("résultats : réussite et échec enregistrés ; échec signalé ; plus rien en attente", async () => {
    const [up, fp] = await commandsOf();
    assert.equal((await results([`ID=${up.seq}&Return=0&CMD=DATA`, `ID=${fp.seq}&Return=-1002&CMD=ENROLL_FP`])).text, "OK");
    const [up2, fp2] = await commandsOf();
    assert.equal(up2.status, "OK");
    assert.equal(fp2.status, "ERROR");
    assert.equal(fp2.returnCode, -1002);
    assert.ok(await alertOf("COMMANDE_EN_ECHEC", { deviceId: device.id }));
    assert.equal((await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } })).admsCommandsPending, false);
    assert.equal((await poll()).text, "OK");
  });

  await check("pointage de l'agent inscrit : compté dans sa journée", async () => {
    const pin = enrolledPin;
    assert.equal((await attlog(`${line(pin, dateAt(-5), clock(-5), "0")}\n`)).text, "OK: 1");
    const d = await prisma.dailyAttendance.findUnique({ where: { userId_date: { userId: agent2.id, date: dateKeyToDbDate(dateAt(-5)) } } });
    assert.equal(d?.punchCount, 1);
  });

  await check("inventaire : réponse non demandée ignorée ; demandée → PIN et privilège seulement ; non associés et administrateurs signalés", async () => {
    const marker = `SECRET-${RUN}`;
    const body = [`USER PIN=1\tName=Chef\tPri=14\tPasswd=${marker}\tCard=[0]`, `FP PIN=1\tFID=6\tTMP=${marker}`, `USER PIN=11\tName=A\tPri=0`, `USER PIN=${enrolledPin}\tName=B\tPri=0`, `USER PIN=55\tName=C\tPri=0`].join("\n");
    assert.equal((await call("POST", `/iclock/cdata?SN=${SN}&table=USERINFO&Stamp=1`, body)).text, "OK");
    assert.equal((await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } })).admsUsers, null, "pas d'inventaire sans demande");
    await requestDeviceInventory(as(secr), device.id);
    assert.match((await poll()).text, /^C:\d+:DATA QUERY USERINFO\n$/);
    assert.equal((await call("POST", `/iclock/cdata?SN=${SN}&table=OPERLOG&Stamp=1`, body)).text, "OK: 4");
    const d = await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } });
    assert.deepEqual(d.admsUsers, [
      { pin: "1", privilege: 14 },
      { pin: "11", privilege: 0 },
      { pin: "55", privilege: 0 },
      { pin: enrolledPin, privilege: 0 },
    ]);
    assert.doesNotMatch(JSON.stringify(d.admsUsers), new RegExp(marker));
    const stray = await alertOf("UTILISATEUR_NON_ASSOCIE_SUR_APPAREIL", { deviceId: device.id });
    assert.match(JSON.stringify(stray?.detail), /"55"/);
    assert.doesNotMatch(JSON.stringify(stray?.detail), /"11"/, "PIN 11 associé");
    assert.ok(await alertOf("ADMINISTRATEUR_SUR_APPAREIL", { deviceId: device.id }));
    const found = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "AttendanceDeviceAlert" WHERE detail::text LIKE $1`, `%${marker}%`);
    assert.equal(Number(found[0].n), 0);
  });

  await check("blocage : retrait à distance d'un PIN non associé ; administrateur ou PIN associé refusés ; annulation avant remise", async () => {
    await assert.rejects(deleteUnmappedDeviceUser(as(secr), device.id, "1"), /Administrateur/);
    await assert.rejects(deleteUnmappedDeviceUser(as(secr), device.id, "11"), /associé/);
    await deleteUnmappedDeviceUser(as(secr), device.id, "55");
    const pending = (await commandsOf({ status: "PENDING" }))[0];
    assert.equal(pending.command, "DATA DELETE USERINFO PIN=55");
    await cancelDeviceCommand(as(secr), pending.id);
    assert.equal((await poll()).text, "OK", "commande annulée : rien n'est remis");
    await deleteUnmappedDeviceUser(as(secr), device.id, "55");
    assert.match((await poll()).text, /^C:\d+:DATA DELETE USERINFO PIN=55\n$/);
    await assert.rejects(enrollAgentOnDevice(as(secr), { deviceId: device.id, userId: ipp.id, pin: "1", fromDateKey: today }), /administrateur de la pointeuse/);
  });

  await check("retrait d'un agent : fin d'association et suppression sur la pointeuse ; ses pointages ultérieurs ne comptent plus", async () => {
    const m = await prisma.deviceUserMapping.findFirstOrThrow({ where: { deviceId: device.id, userId: agent2.id, validTo: null } });
    await removeAgentFromDevice(as(secr), { mappingId: m.id, endDateKey: addDays(today, 1), reason: "Départ (test)", deleteFromDevice: true });
    assert.ok((await prisma.deviceUserMapping.findUniqueOrThrow({ where: { id: m.id } })).validTo);
    assert.match((await poll()).text, new RegExp(`C:\\d+:DATA DELETE USERINFO PIN=${enrolledPin}\\n$`));
  });

  await check("chemin secret : exigé une fois défini ; faux ou absent = 401 ; bon chemin accepté", async () => {
    const secret = await issueAdmsPathSecret(as(secr), device.id);
    assert.equal((await call("GET", `/iclock/getrequest?SN=${SN}`)).status, 401);
    assert.ok(await alertOf("CHEMIN_SECRET_INVALIDE", { deviceId: device.id }));
    assert.equal((await call("GET", `/p/${"x".repeat(32)}/iclock/getrequest?SN=${SN}`)).status, 401);
    const ok = await call("GET", `/p/${secret}/iclock/getrequest?SN=${SN}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.location, null);
    assert.equal((await attlog(`${line("11", yest, "12:30:00", "1")}\n`, `/p/${secret}`)).text, "OK: 1");
  });

  await check("appareil désactivé : refus 401, plus aucun pointage accepté", async () => {
    await setDeviceDisabled(as(secr), device.id, true);
    assert.equal((await handshake()).status, 401);
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
