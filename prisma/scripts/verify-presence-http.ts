// Test de bout en bout, PAR HTTP, des présences (lots 2 à 5) : réception par
// un appareil authentifié par jeton (401, 409, 413, 422, rejeu), contact et
// horloge, curseur de changements, pages réelles selon le profil (global,
// cellule, soi-même, filtres forcés), perte de la vue globale pendant une
// session ouverte, simulateur.
//
// À lancer UNIQUEMENT sur une base locale jetable, avec l'application démarrée
// sur cette même base (next start, PRESENCE_SIMULATOR=1).
// Usage : POSTGRES_URL=<url locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-presence-http.ts
// KEEP=1 : conserve le scénario (cellule active) pour des captures d'écran.

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { ROLE_KEYS } from "../../src/lib/rbac-data";
import { setCellIpa, setExploitantCell } from "../../src/lib/cells/assignments";
import { createDevice, createMapping, issueDeviceToken } from "../../src/lib/presence/devices";
import { saveSchedule } from "../../src/lib/presence/config";
import { VALIDATED_SCHEDULE_DEFAULTS } from "../../src/lib/presence/settings";
import { addDays, gomaDateKey, gomaIsoWeekday } from "../../src/lib/presence/time";

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

const RUN = Date.now().toString(36);
const PASSWORD = "Verif-Presence-2026!";
const createdCells: string[] = [];

class Browser {
  jar = new Map<string, string>();
  private store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async get(path: string) {
    const res = await fetch(BASE + path, { headers: { cookie: this.cookie() }, redirect: "manual" });
    this.store(res);
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  }
  async login(identifier: string) {
    const csrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: this.cookie() } });
    this.store(csrf);
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: this.cookie() },
      body: new URLSearchParams({ identifier, password: PASSWORD, csrfToken, callbackUrl: `${BASE}/dashboard` }),
      redirect: "manual",
    });
    this.store(res);
    return [...this.jar.keys()].some((k) => k.includes("session-token"));
  }
}

const shows = (html: string, marker: string) => html.includes(marker) || html.includes(marker.replace(/'/g, "&#x27;"));
const redirectedTo = (r: { status: number; location: string | null }, path: string) => r.status >= 300 && r.status < 400 && (r.location ?? "").includes(path);

function recentMonday(): string {
  let d = addDays(gomaDateKey(new Date()), -1);
  while (gomaIsoWeekday(d) !== 1) d = addDays(d, -1);
  return d;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  await prisma.cell.updateMany({ where: { organizationId: org.id, active: true, mandate: "PERSONNEL" }, data: { active: false, ipaId: null } });
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  async function user(slug: string, name: string, roleKey: string) {
    const u = await prisma.user.create({
      data: { name, email: `${slug}.${RUN}@http.test`, username: `${slug}${RUN}`, passwordHash, status: "ACTIVE", organizationId: org.id, isDemo: false },
    });
    await prisma.userRole.create({ data: { userId: u.id, roleId: roles.get(roleKey)!.id } });
    return u;
  }
  // Noms fictifs (base locale de test).
  const ipp = await user("ipp", `IPP Test ${RUN}`, ROLE_KEYS.IPP);
  const secr = await user("secr", `Secrétaire Test ${RUN}`, ROLE_KEYS.SECRETAIRE_IPP);
  const head = await user("resp", `IPA Personnel Test ${RUN}`, ROLE_KEYS.IPA);
  const ipaB = await user("ipab", `IPA Formation Test ${RUN}`, ROLE_KEYS.IPA);
  const expA = await user("expa", `Agent Alpha ${RUN}`, ROLE_KEYS.EXPLOITANT_IPP);
  const expB = await user("expb", `Agent Beta ${RUN}`, ROLE_KEYS.EXPLOITANT_IPP);
  const agent = await user("agent", `Agent Gamma ${RUN}`, ROLE_KEYS.AGENT_IPP);
  const as = (u: { id: string }) => ({ id: u.id, organizationId: org.id });
  const pers = await prisma.cell.create({ data: { organizationId: org.id, code: `PERS${RUN}`.toUpperCase().slice(0, 20), name: "Gestion du personnel (test)", mandate: "PERSONNEL" } });
  const form = await prisma.cell.create({ data: { organizationId: org.id, code: `IPAF${RUN}`.toUpperCase().slice(0, 20), name: "Formations (test)" } });
  createdCells.push(pers.id, form.id);
  await setCellIpa(as(ipp), { cellId: pers.id, ipaId: head.id, via: "direction" });
  await setCellIpa(as(ipp), { cellId: form.id, ipaId: ipaB.id, via: "direction" });
  await setExploitantCell(as(ipp), { userId: expA.id, cellId: pers.id, via: "direction" });
  await setExploitantCell(as(ipp), { userId: expB.id, cellId: form.id, via: "direction" });
  const D = recentMonday();
  await prisma.staffCellTerm.updateMany({ where: { userId: { in: [expA.id, expB.id] } }, data: { startedAt: new Date(`${addDays(D, -7)}T00:00:00Z`) } });
  await saveSchedule(as(ipp), VALIDATED_SCHEDULE_DEFAULTS);
  const device = await createDevice(as(secr), { label: "Pointeuse entrée (test)", siteLabel: "Bureau de l'IPP" });
  const device2 = await createDevice(as(secr), { label: "Pointeuse (test)", siteLabel: "Bureau de l'IPAF" });
  const token = await issueDeviceToken(as(secr), device.id);
  for (const [dev, id, u] of [[device, "11", expA], [device2, "21", expB], [device, "13", agent]] as const) {
    await createMapping(as(secr), { deviceId: dev.id, deviceUserId: id, userId: u.id, fromDateKey: addDays(D, -7) });
  }

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const auth = { authorization: `Bearer ${token}` };
  const lot = {
    events: [
      { deviceUserId: "11", localTime: `${D}T08:20:00`, direction: "IN" },
      { deviceUserId: "11", localTime: `${D}T16:00:00`, direction: "OUT" },
      { deviceUserId: "13", localTime: `${D}T07:55:00`, direction: "IN" },
      { deviceUserId: "13", localTime: `${D}T12:00:00`, direction: "OUT" },
      { deviceUserId: "13", localTime: `${D}T13:00:00`, direction: "IN" },
      { deviceUserId: "77", localTime: `${D}T09:10:00`, direction: "IN" },
    ],
  };

  await check("réception HTTP : sans jeton 401 ; clé absente 422 ; lot accepté ; rejeu identique ; même clé autre contenu 409 ; trop d'événements 413", async () => {
    assert.equal((await post("/api/presence/v1/ingest", lot, { "idempotency-key": `k-${RUN}-1` })).status, 401);
    assert.equal((await post("/api/presence/v1/ingest", lot, { authorization: "Bearer ppt_00000000_fauxfauxfauxfauxfauxfaux", "idempotency-key": `k-${RUN}-1` })).status, 401);
    assert.equal((await post("/api/presence/v1/ingest", lot, auth)).status, 422);
    const ok = await post("/api/presence/v1/ingest", lot, { ...auth, "idempotency-key": `k-${RUN}-1` });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { accepted: number };
    assert.equal(body.accepted, 6);
    const again = (await (await post("/api/presence/v1/ingest", lot, { ...auth, "idempotency-key": `k-${RUN}-1` })).json()) as { replayed: boolean };
    assert.equal(again.replayed, true);
    assert.equal((await post("/api/presence/v1/ingest", { events: lot.events.slice(0, 1) }, { ...auth, "idempotency-key": `k-${RUN}-1` })).status, 409);
    const big = { events: Array.from({ length: 501 }, () => lot.events[0]) };
    assert.equal((await post("/api/presence/v1/ingest", big, { ...auth, "idempotency-key": `k-${RUN}-2` })).status, 413);
  });

  await check("contact d'appareil : décalage d'horloge mesuré (brut) ; jeton requis", async () => {
    assert.equal((await post("/api/presence/v1/heartbeat", {})).status, 401);
    const r = (await (await post("/api/presence/v1/heartbeat", { deviceTime: `${gomaDateKey(new Date())}T00:00:00` }, auth)).json()) as { clockOffsetSec: number | null };
    assert.equal(typeof r.clockOffsetSec, "number");
  });

  const s = new Browser();
  const h = new Browser();
  const b = new Browser();
  const a = new Browser();
  assert.ok(await s.login(secr.username!));
  assert.ok(await h.login(head.username!));
  assert.ok(await b.login(ipaB.username!));
  assert.ok(await a.login(agent.username!));

  await check("curseur de changements : session exigée ; renvoie seulement un curseur", async () => {
    assert.equal((await fetch(`${BASE}/api/presence/v1/changes`)).status, 401);
    const r = await s.get("/api/presence/v1/changes");
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(JSON.parse(r.text)), ["cursor"]);
  });

  await check("secrétaire (vue globale) : tous les agents ; 8 h 20 retard signalé ; 45 min proposées ; multiples non calculés ; non associé signalé", async () => {
    const r = await s.get(`/presence/aujourdhui?date=${D}`);
    assert.equal(r.status, 200);
    for (const u of [expA, expB, agent]) assert.ok(shows(r.text, u.name), u.name);
    assert.ok(shows(r.text, "Retard signalé"));
    assert.ok(shows(r.text, "Durée non calculée"));
    assert.ok(r.text.includes("45<!-- --> min") || r.text.includes("45 min"));
    assert.ok(shows(r.text, "Plusieurs entrées ou sorties"));
    const sync = await s.get("/presence/synchronisation");
    assert.ok(sync.text.includes(">77<"));
  });

  await check("autre IPA : seulement sa cellule ; filtre forcé vers une autre cellule ou un autre agent → rien", async () => {
    const r = await b.get(`/presence/aujourdhui?date=${D}`);
    assert.ok(shows(r.text, expB.name));
    assert.equal(shows(r.text, expA.name), false);
    const forced = await b.get(`/presence/aujourdhui?date=${D}&cellId=${pers.id}`);
    assert.equal(shows(forced.text, expA.name), false);
    const period = await b.get(`/presence/periode?from=${D}&to=${D}&userId=${expA.id}`);
    assert.equal(shows(period.text, expA.name), false);
  });

  await check("agent : renvoyé vers « Ma présence » ; ne voit que lui ; ni appareils ni paramètres", async () => {
    assert.ok(redirectedTo(await a.get("/presence/aujourdhui"), "/presence/moi"));
    assert.ok(redirectedTo(await a.get("/presence/appareils"), "/presence/moi"));
    assert.ok(redirectedTo(await a.get("/presence/parametres"), "/presence/moi"));
    const me = await a.get(`/presence/moi?from=${D}&to=${D}`);
    assert.ok(shows(me.text, "Ma présence"));
    assert.ok(shows(me.text, "Plusieurs entrées ou sorties"));
    assert.equal(shows(me.text, expA.name), false);
  });

  await check("horaires : la secrétaire consulte sans pouvoir modifier ; le responsable du personnel modifie", async () => {
    const sec = await s.get("/presence/parametres");
    assert.equal(sec.status, 200);
    assert.equal(shows(sec.text, "Enregistrer l'horaire"), false);
    const resp = await h.get("/presence/parametres");
    assert.ok(shows(resp.text, "Enregistrer l'horaire"));
    assert.ok(shows(resp.text, "Ajouter au calendrier"));
  });

  await check("simulateur : page disponible (base locale) pour la secrétaire, refusée à l'agent", async () => {
    assert.equal((await s.get("/presence/simulateur")).status, 200);
    assert.ok(redirectedTo(await a.get("/presence/simulateur"), "/presence/moi"));
  });

  await check("responsable retiré pendant sa session : vue globale retirée à la requête suivante", async () => {
    assert.equal((await h.get(`/presence/aujourdhui?date=${D}`)).status, 200);
    await setCellIpa(as(secr), { cellId: pers.id, ipaId: null, via: "cellules" });
    const after = await h.get(`/presence/aujourdhui?date=${D}`);
    assert.equal(after.status === 200 && shows(after.text, expB.name), false);
    if (process.env.KEEP === "1") await setCellIpa(as(secr), { cellId: pers.id, ipaId: head.id, via: "cellules" });
  });

  console.log(`\n${passed} vérifications HTTP réussies.`);
  if (process.env.KEEP === "1") {
    console.log(`SCENARIO ${JSON.stringify({ D, password: PASSWORD, secr: secr.username, head: head.username, ipaB: ipaB.username, agent: agent.username })}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (createdCells.length && process.env.KEEP !== "1") await prisma.cell.updateMany({ where: { id: { in: createdCells } }, data: { active: false, ipaId: null } });
    await prisma.$disconnect();
  });
