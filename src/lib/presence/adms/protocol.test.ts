// Protocole ADMS (ZKTeco) : lecture ATTLOG, identifiants stables, lots,
// configuration « pointages seulement », compteurs INFO, quarantaine d'horloge.
// Les corps reproduisent la forme des envois réels de l'UA300 (valeurs fictives).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  admsEndpoint,
  admsIdempotencyKey,
  cleanPathSecret,
  cleanSn,
  directionFromStatus,
  handshakeOptions,
  hashPathSecret,
  parseAttlog,
  parseInfo,
  toBatches,
  transFlagFor,
} from "@/lib/presence/adms/protocol";
import { parseEvents } from "@/lib/presence/ingest";

test("ATTLOG réel (tabulations, champs réservés) → format canonique, valeurs brutes conservées", () => {
  const body = "1\t2026-10-15 00:02:17\t4\t1\t0\t0\t0\t0\t0\t0\t\n2\t2026-10-15 12:52:33\t0\t1\t7\t0\r\n";
  const { lines, rejected, lineCount } = parseAttlog(body);
  assert.equal(lineCount, 2);
  assert.deepEqual(rejected, []);
  assert.deepEqual(lines[0].event, { externalEventId: "adms:1:2026-10-15T00:02:17:4:1", deviceUserId: "1", localTime: "2026-10-15T00:02:17", direction: "UNKNOWN", verifyMode: "1" });
  assert.equal(lines[0].rawStatus, "4");
  assert.equal(lines[0].workCode, null, "code de travail 0 = aucun");
  assert.equal(lines[1].event.direction, "IN");
  assert.equal(lines[1].workCode, "7");
});

test("sens : seuls 0 et 1 sont déduits (Q-PUNCH-1), le reste reste inconnu", () => {
  assert.equal(directionFromStatus("0"), "IN");
  assert.equal(directionFromStatus("1"), "OUT");
  for (const s of ["2", "3", "4", "5", "255", ""]) assert.equal(directionFromStatus(s), "UNKNOWN");
});

test("lignes illisibles : numéro et motif seulement, jamais recopiées", () => {
  const { lines, rejected, lineCount } = parseAttlog("\n1001\tpas-une-date\t0\t1\nnom avec espace\t2026-10-15 07:00:00\t0\t1\n");
  assert.equal(lines.length, 0);
  assert.equal(lineCount, 2);
  assert.deepEqual(rejected, [
    { line: 2, code: "HEURE_INVALIDE" },
    { line: 3, code: "PIN_INVALIDE" },
  ]);
});

test("doublons : identifiant stable ; lot renvoyé = même clé ; clé propre à l'appareil", () => {
  const body = "1001\t2026-10-15 07:58:12\t0\t1\n";
  assert.equal(parseAttlog(body).lines[0].event.externalEventId, parseAttlog(body).lines[0].event.externalEventId);
  assert.equal(admsIdempotencyKey("SN1", "ATTLOG", "9999", body), admsIdempotencyKey("SN1", "ATTLOG", "9999", body));
  assert.notEqual(admsIdempotencyKey("SN1", "ATTLOG", "9999", body), admsIdempotencyKey("SN2", "ATTLOG", "9999", body));
  assert.match(admsIdempotencyKey("SN1", "ATTLOG", null, body), /^[A-Za-z0-9_.:-]{8,100}$/);
});

test("gros rattrapage : lots de 500 au plus, chacun avec sa clé", () => {
  const body = Array.from({ length: 1201 }, (_, i) => `${i + 1}\t2026-10-15 07:00:00\t0\t1`).join("\n");
  const batches = toBatches("SN1", "1", body, parseAttlog(body).lines);
  assert.deepEqual(batches.map((b) => b.lines.length), [500, 500, 201]);
  assert.equal(new Set(batches.map((b) => b.idempotencyKey)).size, 3);
});

test("configuration : pointages seulement, aucune donnée biométrique demandée", () => {
  assert.equal(transFlagFor("2.4.1"), "TransData AttLog");
  assert.equal(transFlagFor(null), "1000000000");
  const text = handshakeOptions("QQD0000000000", "2.4.1");
  assert.match(text, /^GET OPTION FROM: QQD0000000000\n/);
  assert.match(text, /\nTransFlag=TransData AttLog\n/);
  assert.match(text, /\nRealtime=1\n/);
  assert.match(text, /\nDelay=60\n/);
  assert.match(text, /\nTimeZone=2\n/);
  assert.doesNotMatch(text, /EnrollFP|ChgFP|FPImag|Face|EnrollUser|ChgUser|UserPic|BioData/);
});

test("INFO : nombres seulement (micrologiciel, utilisateurs, empreintes, pointages, IP locale)", () => {
  assert.deepEqual(parseInfo("Ver 8.0.4.6-20220616,2,1,4,192.168.0.89,10,7,12,0,111"), {
    firmware: "Ver 8.0.4.6-20220616",
    users: 2,
    fingerprints: 1,
    attLogs: 4,
    localIp: "192.168.0.89",
  });
  assert.equal(parseInfo("abc"), null);
  assert.equal(parseInfo(null), null);
});

test("routage et identifiants : points d'entrée, numéro de série, chemin secret", () => {
  assert.equal(admsEndpoint("cdata"), "cdata");
  assert.equal(admsEndpoint("CDATA.aspx"), "cdata");
  assert.equal(admsEndpoint("getrequest"), "getrequest");
  assert.equal(admsEndpoint("registry"), "other");
  assert.equal(cleanSn("QQD4242900000"), "QQD4242900000");
  assert.equal(cleanSn("QQD 42"), null);
  assert.equal(cleanSn("../etc"), null);
  assert.equal(cleanPathSecret("court"), null);
  assert.equal(cleanPathSecret("A".repeat(32)), "A".repeat(32));
  assert.notEqual(hashPathSecret("A".repeat(32)), "A".repeat(32));
});

test("horloge : ADMS met en quarantaine au-delà de 5 min d'avance (rien n'est rejeté) ; l'API garde son rejet à 24 h", () => {
  const now = new Date("2026-10-15T10:00:00Z"); // 12:00 à Goma
  const events = [
    { deviceUserId: "1", localTime: "2026-10-15T12:04:00", direction: "IN" }, // +4 min : toléré
    { deviceUserId: "1", localTime: "2026-10-15T12:10:00", direction: "IN" }, // +10 min : quarantaine
    { deviceUserId: "1", localTime: "2026-10-16T09:08:32", direction: "UNKNOWN" }, // +21 h (cas observé)
    { deviceUserId: "1", localTime: "2026-10-18T09:00:00", direction: "IN" }, // +3 jours
  ];
  const adms = parseEvents("d1", events, now, { kind: "quarantine", toleranceSec: 300 });
  assert.deepEqual(adms.rejected, []);
  assert.deepEqual(adms.ok.map((e) => e.clockSuspect), [false, true, true, true]);
  const api = parseEvents("d1", events, now);
  assert.deepEqual(api.rejected.map((r) => [r.index, r.code]), [[3, "HEURE_FUTURE"]]);
  assert.ok(api.ok.every((e) => !e.clockSuspect), "comportement de l'API inchangé");
});
