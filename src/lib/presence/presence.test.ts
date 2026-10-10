// Présence (lots 3 à 5), règles pures : déduplication, validation des lots,
// associations datées, périmètres de consultation, période bornée,
// historique de cellule, compteurs sans absence, simulateur hors production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "@/lib/rbac-data";
import { dedupKey, parseEvents } from "@/lib/presence/ingest";
import { generateDeviceToken, hashToken, periodsOverlap, presenceSimulatorEnabled } from "@/lib/presence/devices";
import { mappingCovers, mappingCoversDay } from "@/lib/presence/daily";
import { countDay, normalizePeriod, resolvePresenceScope, termCoversDay, type PresenceRow } from "@/lib/presence/views";
import { computeDay } from "@/lib/presence/rules";
import { VALIDATED_SCHEDULE_DEFAULTS } from "@/lib/presence/settings";
import { gomaDayStartUtc, gomaLocalToUtc } from "@/lib/presence/time";
import { PRESENCE_TABS, visibleTabs } from "@/components/nav-items";

const ORG = "org";
const NOW = new Date("2026-10-12T10:00:00Z");

test("déduplication : identifiant d'événement prioritaire ; sinon empreinte stable du pointage", () => {
  assert.equal(dedupKey("d1", { externalEventId: "E9", deviceUserId: "7", localTime: "x", direction: "IN" }), "dev:d1:ev:E9");
  const a = dedupKey("d1", { deviceUserId: "7", localTime: "2026-10-12T08:00:00", direction: "IN" });
  const b = dedupKey("d1", { deviceUserId: "7", localTime: "2026-10-12T08:00:00", direction: "IN" });
  assert.equal(a, b);
  assert.notEqual(a, dedupKey("d2", { deviceUserId: "7", localTime: "2026-10-12T08:00:00", direction: "IN" }), "propre à l'appareil");
  assert.notEqual(a, dedupKey("d1", { deviceUserId: "7", localTime: "2026-10-12T08:00:00", direction: "OUT" }));
});

test("lot : événements invalides rejetés avec leur index, valides conservés ; heure du pointage ≠ heure de réception", () => {
  const { ok, rejected } = parseEvents(
    "d1",
    [
      { deviceUserId: "7", localTime: "2026-10-12T08:20:00", direction: "IN" },
      { deviceUserId: "", localTime: "2026-10-12T08:20:00" },
      { deviceUserId: "7", localTime: "2026-13-40T08:20:00" },
      { deviceUserId: "7", localTime: "2026-10-20T08:00:00" },
      { deviceUserId: "8", localTime: "2026-10-12T07:00:00" },
    ],
    NOW
  );
  assert.equal(ok.length, 2);
  assert.deepEqual(rejected.map((r) => [r.index, r.code]), [[1, "FORMAT"], [2, "HEURE_INVALIDE"], [3, "HEURE_FUTURE"]]);
  assert.equal(ok[0].punchedAt.toISOString(), "2026-10-12T06:20:00.000Z");
  assert.equal(ok[1].direction, "UNKNOWN", "sens absent : jamais deviné");
});

test("jetons techniques : aléatoires, vérifiés par empreinte, jamais stockés en clair", () => {
  const t = generateDeviceToken();
  assert.match(t.token, /^ppt_[0-9a-f]{8}_[A-Za-z0-9_-]{40,}$/);
  assert.equal(t.hash, hashToken(t.token));
  assert.notEqual(t.hash, t.token);
  assert.notEqual(generateDeviceToken().token, t.token);
});

test("associations : périodes [début, fin) ; chevauchement refusé ; couverture d'un jour", () => {
  const d = (k: string) => gomaDayStartUtc(k);
  assert.equal(periodsOverlap({ validFrom: d("2026-10-01"), validTo: d("2026-10-10") }, { validFrom: d("2026-10-10"), validTo: null }), false);
  assert.equal(periodsOverlap({ validFrom: d("2026-10-01"), validTo: null }, { validFrom: d("2026-10-10"), validTo: null }), true);
  const m = { validFrom: d("2026-10-05"), validTo: d("2026-10-10") };
  assert.equal(mappingCovers(m, gomaLocalToUtc("2026-10-09T23:59:59")!), true);
  assert.equal(mappingCovers(m, gomaLocalToUtc("2026-10-10T00:00:00")!), false);
  assert.equal(mappingCoversDay(m, "2026-10-05"), true);
  assert.equal(mappingCoversDay(m, "2026-10-10"), false);
});

test("périmètre : global, cellule(s), ou soi-même seulement", () => {
  assert.deepEqual(resolvePresenceScope([{ permissionKey: PERMISSIONS.PRESENCE_READ_ALL, poolId: null, organizationId: ORG }], ORG), { kind: "all" });
  assert.deepEqual(resolvePresenceScope([{ permissionKey: PERMISSIONS.PRESENCE_READ_CELL, poolId: null, organizationId: ORG, cellId: "c1" }], ORG), {
    kind: "cells",
    cellIds: ["c1"],
  });
  assert.deepEqual(resolvePresenceScope([], ORG), { kind: "self" });
  // Une permission globale d'une autre organisation ne donne rien.
  assert.deepEqual(resolvePresenceScope([{ permissionKey: PERMISSIONS.PRESENCE_READ_ALL, poolId: null, organizationId: "autre" }], ORG), { kind: "self" });
});

test("période : bornée à 31 jours, dates invalides remplacées, ordre corrigé", () => {
  assert.deepEqual(normalizePeriod("2026-01-01", "2026-10-12", "2026-10-12"), { from: "2026-09-12", to: "2026-10-12" });
  assert.deepEqual(normalizePeriod("n'importe", undefined, "2026-10-12"), { from: "2026-10-12", to: "2026-10-12" });
  assert.deepEqual(normalizePeriod("2026-10-20", "2026-10-12", "2026-10-12"), { from: "2026-10-12", to: "2026-10-12" });
});

test("historique de cellule : jours d'appartenance seulement ; date inconnue → à partir de la reprise, jamais avant", () => {
  const known = { cellId: "c", startedAt: gomaDayStartUtc("2026-10-05"), observedAt: gomaDayStartUtc("2026-10-11"), endedAt: gomaDayStartUtc("2026-10-08") };
  assert.equal(termCoversDay(known, "2026-10-04"), false);
  assert.equal(termCoversDay(known, "2026-10-05"), true);
  assert.equal(termCoversDay(known, "2026-10-08"), false);
  const unknown = { cellId: "c", startedAt: null, observedAt: gomaLocalToUtc("2026-10-11T09:00:00")!, endedAt: null };
  assert.equal(termCoversDay(unknown, "2026-10-10"), false);
  assert.equal(termCoversDay(unknown, "2026-10-11"), true);
});

test("compteurs du jour : aucun pointage ≠ absence ; données simulées comptées à part", () => {
  const mk = (summary: PresenceRow["summary"]): PresenceRow => ({ userId: "u", name: "n", functions: [], cells: [], sites: [], dateKey: "2026-10-12", summary });
  const base = { dateKey: "2026-10-12", todayKey: "2026-10-12", schedule: VALIDATED_SCHEDULE_DEFAULTS, calendarNonWorked: null, hasMapping: true };
  const c = countDay([
    mk(computeDay({ ...base, punches: [] })),
    mk(computeDay({ ...base, punches: [{ at: gomaLocalToUtc("2026-10-12T08:20:00")!, direction: "IN", simulated: true }] })),
    mk(computeDay({ ...base, punches: [], hasMapping: false })),
  ]);
  assert.equal(c.total, 3);
  assert.equal(c.noPunch, 1);
  assert.equal(c.unmapped, 1);
  assert.equal(c.late, 1);
  assert.equal(c.simulated, 1);
  assert.equal("absent" in c, false);
});

test("simulateur : seulement avec PRESENCE_SIMULATOR=1, hors Vercel, sur une base locale", () => {
  const local = "postgres://u:p@localhost:5432/db";
  assert.equal(presenceSimulatorEnabled({ PRESENCE_SIMULATOR: "1", POSTGRES_URL: local }), true);
  assert.equal(presenceSimulatorEnabled({ POSTGRES_URL: local }), false);
  assert.equal(presenceSimulatorEnabled({ PRESENCE_SIMULATOR: "1", POSTGRES_URL: local, VERCEL: "1" }), false);
  assert.equal(presenceSimulatorEnabled({ PRESENCE_SIMULATOR: "1", POSTGRES_URL: local, VERCEL_ENV: "preview" }), false);
  assert.equal(presenceSimulatorEnabled({ PRESENCE_SIMULATOR: "1", POSTGRES_URL: "postgres://u:p@db.prisma.io:5432/x" }), false);
});

test("onglets Présence : « Ma présence » pour tous ; les autres selon la permission", () => {
  const tabs = (keys: string[], cell = false) =>
    visibleTabs(PRESENCE_TABS, {
      roleKeys: [],
      permissions: keys.map((k) => ({ permissionKey: k, poolId: null, organizationId: ORG, ...(cell ? { cellId: "c" } : {}) })),
    }).map((t) => t.label);
  assert.deepEqual(tabs([]), ["Ma présence"]);
  assert.deepEqual(tabs([PERMISSIONS.PRESENCE_READ_CELL], true), ["Ma présence", "Aujourd'hui", "Période"]);
  assert.ok(tabs([PERMISSIONS.PRESENCE_READ_ALL]).includes("État de synchronisation"));
  assert.equal(tabs([PERMISSIONS.PRESENCE_READ_ALL]).includes("Appareils et associations"), false);
  assert.ok(tabs([PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE]).includes("Appareils et associations"));
});
