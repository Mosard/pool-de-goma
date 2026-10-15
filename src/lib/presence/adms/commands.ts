// File des commandes envoyées aux pointeuses ADMS (gestion centralisée depuis
// l'application). Une commande est créée par une action d'administration
// (src/lib/presence/devices.ts), remise à la pointeuse lors de son
// interrogation (getrequest), puis close par le résultat qu'elle renvoie
// (devicecmd).
//
// Reprise : une commande remise sans résultat est renvoyée après 5 minutes si
// elle est sans effet en double (inscription, retrait, inventaire), jusqu'à
// 3 remises ; une capture d'empreinte n'est jamais renvoyée automatiquement.
// Au-delà de 30 minutes sans résultat, elle est classée « expirée ».

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type DeviceUserEntry, formatCommands, parseCommandResults } from "./protocol";

export type CommandKind = "USER_UPSERT" | "USER_DELETE" | "ENROLL_FP" | "USER_QUERY" | "INFO";

const RESEND_AFTER_MS = 5 * 60_000;
const EXPIRE_AFTER_MS = 30 * 60_000;
const MAX_ATTEMPTS = 3;
const MAX_PER_POLL = 10;
const IDEMPOTENT: CommandKind[] = ["USER_UPSERT", "USER_DELETE", "USER_QUERY", "INFO"];

type Tx = Prisma.TransactionClient;

/** Ajoute une commande à la file de l'appareil (dans la transaction de l'appelant si fournie). */
export async function enqueueCommand(
  p: { deviceId: string; kind: CommandKind; command: string; pin?: string | null; userId?: string | null; createdById?: string | null; notBefore?: Date | null },
  tx: Tx = prisma
) {
  const cmd = await tx.deviceCommand.create({
    data: {
      deviceId: p.deviceId,
      kind: p.kind,
      command: p.command,
      pin: p.pin ?? null,
      userId: p.userId ?? null,
      createdById: p.createdById ?? null,
      notBefore: p.notBefore ?? null,
    },
  });
  await tx.attendanceDevice.update({ where: { id: p.deviceId }, data: { admsCommandsPending: true } });
  return cmd;
}

/** Recalcule l'indicateur « commandes en attente » de l'appareil. */
async function refreshPendingFlag(deviceId: string): Promise<boolean> {
  const open = await prisma.deviceCommand.count({ where: { deviceId, status: { in: ["PENDING", "SENT"] } } });
  await prisma.attendanceDevice.update({ where: { id: deviceId }, data: { admsCommandsPending: open > 0 } });
  return open > 0;
}

/**
 * Commandes à remettre lors d'une interrogation : nouvelles, ou remises sans
 * résultat depuis 5 minutes (sans effet en double seulement). Corps de réponse prêt.
 */
export async function takeCommandsForDelivery(deviceId: string, now = new Date()): Promise<{ body: string; count: number }> {
  await prisma.deviceCommand.updateMany({
    where: { deviceId, status: "SENT", sentAt: { lt: new Date(now.getTime() - EXPIRE_AFTER_MS) } },
    data: { status: "EXPIRED", doneAt: now },
  });
  const due = await prisma.deviceCommand.findMany({
    where: {
      deviceId,
      OR: [
        // Suppression différée : remise seulement après son heure (annulable jusque-là).
        { status: "PENDING", OR: [{ notBefore: null }, { notBefore: { lte: now } }] },
        { status: "SENT", kind: { in: IDEMPOTENT }, attempts: { lt: MAX_ATTEMPTS }, sentAt: { lt: new Date(now.getTime() - RESEND_AFTER_MS) } },
      ],
    },
    orderBy: { seq: "asc" },
    take: MAX_PER_POLL,
  });
  if (due.length === 0) {
    await refreshPendingFlag(deviceId);
    return { body: "OK", count: 0 };
  }
  await prisma.deviceCommand.updateMany({ where: { id: { in: due.map((c) => c.id) } }, data: { status: "SENT", sentAt: now, attempts: { increment: 1 } } });
  return { body: formatCommands(due), count: due.length };
}

/** Résultats renvoyés par la pointeuse : 0 ou plus = réussite, négatif = échec (code conservé). */
export async function applyCommandResults(deviceId: string, body: string, now = new Date()) {
  const results = parseCommandResults(body);
  let applied = 0;
  for (const r of results) {
    const done = await prisma.deviceCommand.updateMany({
      where: { deviceId, seq: r.seq, status: { in: ["SENT", "PENDING", "EXPIRED"] } },
      data: { status: r.returnCode >= 0 ? "OK" : "ERROR", returnCode: r.returnCode, doneAt: now },
    });
    applied += done.count;
  }
  await refreshPendingFlag(deviceId);
  return { received: results.length, applied };
}

/** Un inventaire a-t-il été demandé récemment (réponse attendue) ? */
export async function inventoryExpected(deviceId: string, now = new Date()): Promise<boolean> {
  const recent = await prisma.deviceCommand.findFirst({
    where: { deviceId, kind: "USER_QUERY", status: { in: ["SENT", "OK"] }, sentAt: { gte: new Date(now.getTime() - EXPIRE_AFTER_MS) } },
    select: { id: true },
  });
  return Boolean(recent);
}

/**
 * Enregistre l'inventaire reçu (PIN et privilège seulement). Une réponse peut
 * arriver en plusieurs envois : ceux qui suivent la même demande sont cumulés.
 */
export async function storeInventory(device: { id: string; admsUsers: unknown; admsUsersAt: Date | null }, entries: DeviceUserEntry[], now = new Date()) {
  const query = await prisma.deviceCommand.findFirst({ where: { deviceId: device.id, kind: "USER_QUERY" }, orderBy: { seq: "desc" }, select: { sentAt: true } });
  const sameRequest = device.admsUsersAt && query?.sentAt && device.admsUsersAt >= query.sentAt;
  const merged = new Map<string, number>(sameRequest ? ((device.admsUsers as DeviceUserEntry[] | null) ?? []).map((u) => [u.pin, u.privilege]) : []);
  for (const e of entries) merged.set(e.pin, e.privilege);
  const list = [...merged].map(([pin, privilege]) => ({ pin, privilege })).sort((a, b) => a.pin.localeCompare(b.pin, "fr", { numeric: true }));
  await prisma.attendanceDevice.update({ where: { id: device.id }, data: { admsUsers: list as unknown as Prisma.InputJsonValue, admsUsersAt: now } });
  return list;
}
