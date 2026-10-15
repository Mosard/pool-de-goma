// Réception ADMS directe : la pointeuse ZKTeco appelle elle-même /iclock/*
// (routes src/app/iclock/[endpoint] et src/app/p/[secret]/iclock/[endpoint]).
// Aucune session : l'appareil est identifié par son numéro de série
// enregistré (protocole ADMS), puis contrôlé par couches :
//   1. chemin secret, s'il est défini pour l'appareil ;
//   2. appairage : le premier contact n'est accepté que pendant une fenêtre
//      ouverte par un administrateur ; il fixe l'empreinte de l'appareil ;
//   3. empreinte (version du protocole, client HTTP) et IP publique surveillées :
//      tout écart est signalé (AttendanceDeviceAlert) ;
//   4. pointages en quarantaine si l'horloge est en avance ; identifiants non
//      associés conservés et signalés (jamais rapprochés par le nom).
//
// Fiabilité : « OK: n » n'est répondu qu'APRÈS l'enregistrement en base ; en
// cas d'erreur, la pointeuse garde ses pointages et les renvoie (renvoi sans
// effet grâce aux clés d'idempotence). Les tables autres qu'ATTLOG ne sont
// jamais conservées : seuls leur nom et leur taille sont signalés. Seule
// exception, la réponse à un inventaire DEMANDÉ par l'application (moins de
// 30 minutes) : elle est lue en mémoire et seuls le PIN et le privilège de
// chaque utilisateur sont retenus (ni nom, ni mot de passe, ni carte, ni empreinte).
//
// Gestion centralisée : les commandes de la file (src/lib/presence/adms/commands.ts)
// sont remises en réponse à getrequest ; leurs résultats arrivent par devicecmd.
//
// Coût : chaque appel à la base est facturé ; l'appareil est gardé en mémoire
// 60 s et le dernier contact n'est écrit qu'une fois toutes les 5 minutes.

import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ingestBatch } from "@/lib/presence/ingest";
import { gomaLocalToUtc } from "@/lib/presence/time";
import { mappingCovers } from "@/lib/presence/daily";
import { applyCommandResults, inventoryExpected, storeInventory, takeCommandsForDelivery } from "./commands";
import {
  type AdmsEndpoint,
  type DeviceUserEntry,
  cleanPathSecret,
  cleanSn,
  handshakeOptions,
  hashPathSecret,
  isDeviceAdmin,
  parseAttlog,
  parseInfo,
  parseUserInventory,
  toBatches,
} from "./protocol";

export const ADMS_DELAY_SEC = 60;
/** Avance d'horloge tolérée avant quarantaine (secondes). */
export const ADMS_CLOCK_TOLERANCE_SEC = 300;
const CONTACT_WRITE_EVERY_MS = 5 * 60_000;
// Un changement fait par un administrateur (désactivation, appairage) peut
// donc mettre jusqu'à 60 s à atteindre une autre instance (0 = sans mémoire, tests).
const DEVICE_CACHE_MS = Number(process.env.ADMS_DEVICE_CACHE_MS ?? 60_000);
const ALERT_WRITE_EVERY_MS = 60_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const deviceSelect = {
  id: true,
  organizationId: true,
  isSimulator: true,
  status: true,
  protocol: true,
  serialNumber: true,
  firmware: true,
  lastContactAt: true,
  admsPairingUntil: true,
  admsPairedAt: true,
  admsPushVersion: true,
  admsUserAgent: true,
  admsPublicIp: true,
  admsLocalIp: true,
  admsPathSecretHash: true,
  admsInfo: true,
  admsCommandsPending: true,
  admsUsers: true,
  admsUsersAt: true,
} satisfies Prisma.AttendanceDeviceSelect;
type AdmsDevice = Prisma.AttendanceDeviceGetPayload<{ select: typeof deviceSelect }>;

// Mémoire de l'instance (indicative : une autre instance repart de zéro).
type Memo = { devices: Map<string, { device: AdmsDevice | null; at: number }>; alerts: Map<string, { at: number; sig: string }> };
const g = globalThis as unknown as { __adms?: Memo };
const memo: Memo = g.__adms ?? (g.__adms = { devices: new Map(), alerts: new Map() });

/** Vide la mémoire de l'instance (tests, et après une modification de l'appareil). */
export function forgetAdmsDevice(sn?: string | null) {
  if (sn) memo.devices.delete(sn);
  else {
    memo.devices.clear();
    memo.alerts.clear();
  }
}

async function findDevice(sn: string): Promise<AdmsDevice | null> {
  const hit = memo.devices.get(sn);
  if (hit && Date.now() - hit.at < DEVICE_CACHE_MS) return hit.device;
  const device = await prisma.attendanceDevice.findUnique({ where: { serialNumber: sn }, select: deviceSelect });
  memo.devices.set(sn, { device, at: Date.now() });
  return device;
}

async function updateDevice(device: AdmsDevice, data: Prisma.AttendanceDeviceUpdateInput) {
  const updated = await prisma.attendanceDevice.update({ where: { id: device.id }, data, select: deviceSelect });
  if (updated.serialNumber) memo.devices.set(updated.serialNumber, { device: updated, at: Date.now() });
  return updated;
}

export type AlertKind =
  | "SERIE_INCONNUE"
  | "APPAREIL_REFUSE"
  | "APPAIRAGE_REQUIS"
  | "CHEMIN_SECRET_INVALIDE"
  | "EMPREINTE_MODIFIEE"
  | "IP_PUBLIQUE_CHANGEE"
  | "TABLE_NON_ATTENDUE"
  | "LIGNES_ILLISIBLES"
  | "HORLOGE_EN_AVANCE"
  | "POINTAGE_NON_AUTORISE"
  | "UTILISATEUR_NON_ASSOCIE_SUR_APPAREIL"
  | "ADMINISTRATEUR_SUR_APPAREIL"
  | "MENU_NON_PROTEGE"
  | "COMMANDE_EN_ECHEC";

/** Signalement regroupé (une ligne par appareil ou série et par nature) ; rouvert s'il était traité. */
export async function raiseAlert(p: { kind: AlertKind; device?: { id: string; organizationId: string } | null; serialNumber?: string | null; detail?: Record<string, unknown> }) {
  const dedupKey = `${p.device ? p.device.id : `sn:${p.serialNumber ?? "?"}`}|${p.kind}`;
  // Une même alerte au détail identique n'est réécrite qu'une fois par minute ;
  // un détail nouveau (autre PIN, autre IP…) est toujours enregistré.
  const detail = (p.detail ?? {}) as Prisma.InputJsonValue;
  const sig = JSON.stringify(detail);
  const last = memo.alerts.get(dedupKey);
  if (last && last.sig === sig && Date.now() - last.at < ALERT_WRITE_EVERY_MS) return;
  memo.alerts.set(dedupKey, { at: Date.now(), sig });
  await prisma.attendanceDeviceAlert.upsert({
    where: { dedupKey },
    create: { dedupKey, kind: p.kind, organizationId: p.device?.organizationId ?? null, deviceId: p.device?.id ?? null, serialNumber: p.serialNumber ?? null, detail },
    update: { count: { increment: 1 }, lastSeenAt: new Date(), detail, resolvedAt: null, resolvedById: null },
  });
}

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });

function clientIp(request: Request): string | null {
  const h = request.headers;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  return ip ? ip.slice(0, 64) : null;
}

function sameSecret(device: AdmsDevice, given: string | null): boolean {
  if (!device.admsPathSecretHash) return true; // pas de chemin secret défini pour cet appareil
  const secret = cleanPathSecret(given);
  if (!secret) return false;
  const a = Buffer.from(device.admsPathSecretHash, "hex");
  const b = Buffer.from(hashPathSecret(secret), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Identification et contrôles communs à tous les appels. Renvoie l'appareil
 * accepté, ou la réponse de refus (401 : la pointeuse garde ses données).
 */
async function admit(request: Request, sn: string, pathSecret: string | null, q: URLSearchParams): Promise<AdmsDevice | Response> {
  const ip = clientIp(request);
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 120) || null;
  let device = await findDevice(sn);
  if (!device) {
    await raiseAlert({ kind: "SERIE_INCONNUE", serialNumber: sn, detail: { ip, userAgent: ua } });
    return text("Unknown device", 401);
  }
  if (device.protocol !== "ADMS" || device.status === "DESACTIVE" || device.isSimulator) {
    await raiseAlert({ kind: "APPAREIL_REFUSE", device, serialNumber: sn, detail: { ip, status: device.status, protocol: device.protocol } });
    return text("Device not accepted", 401);
  }
  if (!sameSecret(device, pathSecret)) {
    await raiseAlert({ kind: "CHEMIN_SECRET_INVALIDE", device, serialNumber: sn, detail: { ip, userAgent: ua, secretGiven: Boolean(pathSecret) } });
    return text("Device not accepted", 401);
  }
  const pushver = (q.get("pushver") ?? "").slice(0, 16) || null;
  const now = new Date();
  if (!device.admsPairedAt) {
    if (!device.admsPairingUntil || device.admsPairingUntil.getTime() < now.getTime()) {
      await raiseAlert({ kind: "APPAIRAGE_REQUIS", device, serialNumber: sn, detail: { ip, userAgent: ua } });
      return text("Pairing required", 401);
    }
    // Premier contact pendant la fenêtre d'appairage : empreinte de l'appareil.
    device = await updateDevice(device, {
      admsPairedAt: now,
      admsPairingUntil: null,
      admsPushVersion: pushver,
      admsUserAgent: ua,
      admsPublicIp: ip,
      lastContactAt: now,
    });
    await logAudit({
      actorId: null,
      organizationId: device.organizationId,
      action: "presence.adms_paired",
      entityType: "AttendanceDevice",
      entityId: device.id,
      newValue: { serialNumber: sn, pushVersion: pushver, userAgent: ua, publicIp: ip },
    });
    return device;
  }
  // Empreinte : la version du protocole n'est annoncée qu'à la poignée de main ;
  // si elle manquait à l'appairage, elle est complétée au premier envoi.
  const changed: Record<string, unknown> = {};
  if (pushver && device.admsPushVersion && pushver !== device.admsPushVersion) changed.pushVersion = { attendu: device.admsPushVersion, recu: pushver };
  if (ua && device.admsUserAgent && ua !== device.admsUserAgent) changed.userAgent = { attendu: device.admsUserAgent, recu: ua };
  if (Object.keys(changed).length) await raiseAlert({ kind: "EMPREINTE_MODIFIEE", device, serialNumber: sn, detail: { ip, ...changed } });
  else if (pushver && !device.admsPushVersion) device = await updateDevice(device, { admsPushVersion: pushver });
  if (ip && device.admsPublicIp && ip !== device.admsPublicIp) await raiseAlert({ kind: "IP_PUBLIQUE_CHANGEE", device, serialNumber: sn, detail: { attendue: device.admsPublicIp, recue: ip } });
  return device;
}

/** Dernier contact : écrit au plus une fois toutes les 5 minutes (opérations facturées). */
async function touchContact(device: AdmsDevice, extra: Prisma.AttendanceDeviceUpdateInput = {}) {
  const stale = !device.lastContactAt || Date.now() - device.lastContactAt.getTime() > CONTACT_WRITE_EVERY_MS;
  if (!stale && Object.keys(extra).length === 0) return device;
  return updateDevice(device, { ...(stale ? { lastContactAt: new Date() } : {}), ...extra });
}

async function receiveAttlog(request: Request, device: AdmsDevice, sn: string, q: URLSearchParams): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return text("Payload too large", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_BODY_BYTES) return text("Payload too large", 413);
  const body = Buffer.from(bytes).toString("utf8");
  const stamp = (q.get("Stamp") ?? q.get("stamp") ?? "").slice(0, 32) || null;
  const { lines, rejected, lineCount } = parseAttlog(body);
  const unreadable = rejected.length;

  // Décalage d'horloge mesuré sur un envoi en temps réel : le pointage le plus
  // récent, s'il est arrivé dans les 2 minutes (un rattrapage ne mesure rien).
  const now = Date.now();
  const aheads = lines.map((l) => gomaLocalToUtc(l.event.localTime)).filter((d): d is Date => Boolean(d)).map((d) => d.getTime() - now);
  const newest = aheads.length ? Math.max(...aheads) : null;
  const clockOffsetSec = newest !== null && newest > -120_000 ? Math.round(newest / 1000) : null;

  let suspect = 0;
  let invalid = 0;
  for (const b of toBatches(sn, stamp, body, lines)) {
    const r = await ingestBatch(device, {
      idempotencyKey: b.idempotencyKey,
      events: b.lines.map((l) => l.event),
      extras: b.lines.map((l) => ({ rawStatus: l.rawStatus, workCode: l.workCode })),
      source: "DEVICE",
      clockPolicy: { kind: "quarantine", toleranceSec: ADMS_CLOCK_TOLERANCE_SEC },
      clockOffsetSec,
    });
    suspect += r.clockSuspect;
    invalid += r.rejected.length; // date impossible (31 février…)
  }
  if (unreadable + invalid) await raiseAlert({ kind: "LIGNES_ILLISIBLES", device, serialNumber: sn, detail: { lignes: unreadable + invalid } });
  if (suspect) await raiseAlert({ kind: "HORLOGE_EN_AVANCE", device, serialNumber: sn, detail: { pointages: suspect, avanceMaxSec: newest !== null ? Math.round(newest / 1000) : null } });
  await flagUnauthorized(device, sn, lines);
  // Tout est enregistré : la pointeuse peut marquer ces lignes comme transmises.
  return text(`OK: ${lineCount}`);
}

/**
 * Pointages non autorisés : PIN sans association valide à l'heure du pointage
 * (inconnu, association terminée ou pas encore commencée). Ils sont conservés
 * (preuve) mais n'entrent dans aucune journée ; signalés pour action
 * (associer, ou retirer l'utilisateur de la pointeuse).
 */
async function flagUnauthorized(device: AdmsDevice, sn: string, lines: ReturnType<typeof parseAttlog>["lines"]) {
  if (lines.length === 0) return;
  const pins = [...new Set(lines.map((l) => l.event.deviceUserId))];
  const mappings = await prisma.deviceUserMapping.findMany({ where: { deviceId: device.id, deviceUserId: { in: pins } }, select: { deviceUserId: true, validFrom: true, validTo: true } });
  const refused = new Map<string, number>();
  for (const l of lines) {
    const at = gomaLocalToUtc(l.event.localTime);
    if (!at) continue;
    const ok = mappings.some((m) => m.deviceUserId === l.event.deviceUserId && mappingCovers(m, at));
    if (!ok) refused.set(l.event.deviceUserId, (refused.get(l.event.deviceUserId) ?? 0) + 1);
  }
  if (refused.size) {
    await raiseAlert({ kind: "POINTAGE_NON_AUTORISE", device, serialNumber: sn, detail: { pins: [...refused.keys()].slice(0, 20), pointages: [...refused.values()].reduce((a, b) => a + b, 0) } });
  }
}

/** Contrôle de l'inventaire : PIN présents sur l'appareil sans association, administrateurs de l'appareil. */
async function checkInventory(device: AdmsDevice, sn: string, users: DeviceUserEntry[]) {
  const active = await prisma.deviceUserMapping.findMany({ where: { deviceId: device.id, validTo: null }, select: { deviceUserId: true } });
  const known = new Set(active.map((m) => m.deviceUserId));
  const stray = users.filter((u) => !known.has(u.pin)).map((u) => u.pin);
  const admins = users.filter((u) => isDeviceAdmin(u.privilege));
  if (stray.length) await raiseAlert({ kind: "UTILISATEUR_NON_ASSOCIE_SUR_APPAREIL", device, serialNumber: sn, detail: { pins: stray.slice(0, 50), total: stray.length } });
  // Sans administrateur, le menu de la pointeuse est ouvert à tous (enrôlement, réglages).
  if (users.length && admins.length === 0) await raiseAlert({ kind: "MENU_NON_PROTEGE", device, serialNumber: sn, detail: { utilisateurs: users.length } });
  if (admins.length) await raiseAlert({ kind: "ADMINISTRATEUR_SUR_APPAREIL", device, serialNumber: sn, detail: { pins: admins.map((a) => a.pin).slice(0, 20) } });
}

/** Inventaire reçu (POST cdata USERINFO/OPERLOG, ou querydata) ; corps lu en mémoire, seuls PIN et privilège retenus. */
async function receiveInventory(request: Request, device: AdmsDevice, sn: string, table: string): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return text("Payload too large", 413);
  const body = Buffer.from(await request.arrayBuffer()).toString("utf8");
  const entries = parseUserInventory(body);
  if (entries.length === 0) {
    await raiseAlert({ kind: "TABLE_NON_ATTENDUE", device, serialNumber: sn, detail: { table: table || null, octets: declared || null } });
    return text("OK");
  }
  const list = await storeInventory(device, entries);
  forgetAdmsDevice(sn);
  await checkInventory(device, sn, list);
  return text(`OK: ${entries.length}`);
}

/** Traite un appel ADMS (après le routage). */
export async function handleAdms(request: Request, endpoint: AdmsEndpoint, pathSecret: string | null): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const sn = cleanSn(q.get("SN") ?? q.get("sn"));
  if (!sn) return text("Bad request", 400);
  const admitted = await admit(request, sn, pathSecret, q);
  if (admitted instanceof Response) return admitted;
  const device = admitted;

  if (endpoint === "cdata" && request.method === "GET") {
    await touchContact(device);
    return text(handshakeOptions(sn, q.get("pushver"), ADMS_DELAY_SEC));
  }

  if (endpoint === "cdata" && request.method === "POST") {
    const table = (q.get("table") ?? "").toUpperCase().slice(0, 32);
    if (table === "ATTLOG") return receiveAttlog(request, device, sn, q);
    // Réponse à une demande d'inventaire (et seulement dans ce cas) : PIN et privilège.
    if ((table === "USERINFO" || table === "OPERLOG" || table === "USER") && (await inventoryExpected(device.id))) {
      return receiveInventory(request, device, sn, table);
    }
    // Jamais lu ni conservé : seuls le nom de la table et la taille annoncée sont signalés.
    await raiseAlert({ kind: "TABLE_NON_ATTENDUE", device, serialNumber: sn, detail: { table: table || null, octets: Number(request.headers.get("content-length") ?? 0) || null } });
    await touchContact(device);
    return text("OK");
  }

  if (endpoint === "getrequest") {
    const info = parseInfo(q.get("INFO") ?? q.get("info"));
    const changed = info && JSON.stringify(device.admsInfo ?? null) !== JSON.stringify(info);
    await touchContact(
      device,
      changed && info
        ? {
            admsInfo: info as unknown as Prisma.InputJsonValue,
            admsInfoAt: new Date(),
            ...(info.firmware ? { firmware: info.firmware } : {}),
            ...(info.localIp ? { admsLocalIp: info.localIp } : {}),
          }
        : {}
    );
    // Commandes de gestion en attente (inscription, retrait, inventaire…).
    if (device.admsCommandsPending) {
      const { body } = await takeCommandsForDelivery(device.id);
      forgetAdmsDevice(sn);
      return text(body);
    }
    return text("OK");
  }

  if (endpoint === "devicecmd" && request.method === "POST") {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > 64 * 1024) return text("Payload too large", 413);
    const body = Buffer.from(await request.arrayBuffer()).toString("utf8").slice(0, 64 * 1024);
    await applyCommandResults(device.id, body);
    forgetAdmsDevice(sn);
    const failed = await prisma.deviceCommand.findMany({ where: { deviceId: device.id, status: "ERROR", doneAt: { gte: new Date(Date.now() - 60_000) } }, select: { seq: true, kind: true, pin: true, returnCode: true } });
    if (failed.length) await raiseAlert({ kind: "COMMANDE_EN_ECHEC", device, serialNumber: sn, detail: { commandes: failed } });
    await touchContact(device);
    return text("OK");
  }

  if (endpoint === "querydata" && request.method === "POST" && (await inventoryExpected(device.id))) {
    return receiveInventory(request, device, sn, (q.get("tablename") ?? "").toUpperCase().slice(0, 32));
  }

  // Chemins propres à d'autres micrologiciels : accusé simple, corps ignoré.
  await touchContact(device);
  return text("OK");
}
