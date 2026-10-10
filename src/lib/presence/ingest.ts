// Réception des pointages (lot 3) — format CANONIQUE, indépendant du
// fabricant : un adaptateur propre au matériel (à écrire APRÈS vérification de
// l'appareil acheté) ou une passerelle locale traduit vers ce format.
//
// Fiabilité :
//  - idempotence : (appareil, clé d'idempotence) unique ; un lot rejoué à
//    l'identique renvoie le même résultat ; même clé, contenu différent → refus ;
//  - déduplication de chaque pointage (dedupKey unique en base) :
//      identifiant d'événement fourni → appareil + identifiant ;
//      sinon → appareil + identifiant utilisateur + heure locale + sens + mode ;
//    renvoyer tout le journal d'un appareil après une coupure est sans effet ;
//  - heure du pointage (appareil, heure de Goma) distincte de l'heure de réception ;
//  - pointages bruts jamais modifiés ; désordre et retard : recalcul des jours touchés ;
//  - identifiant non associé : conservé et signalé, jamais rapproché par le nom.

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recomputeForPunches } from "@/lib/presence/daily";
import { gomaLocalToUtc } from "@/lib/presence/time";

export const MAX_EVENTS_PER_BATCH = 500;

const eventSchema = z.object({
  externalEventId: z.string().trim().min(1).max(120).optional(),
  deviceUserId: z.string().trim().min(1).max(64),
  localTime: z.string().trim().max(25),
  direction: z.enum(["IN", "OUT", "UNKNOWN"]).default("UNKNOWN"),
  verifyMode: z.string().trim().max(32).optional(),
});

export const batchSchema = z.object({
  sentAt: z.string().max(40).optional(),
  events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_BATCH),
});

export type CanonicalEvent = z.infer<typeof eventSchema>;
export type RejectedEvent = { index: number; code: "FORMAT" | "HEURE_INVALIDE" | "HEURE_FUTURE" };

export type ParsedEvent = CanonicalEvent & { punchedAt: Date; dedupKey: string };

/** Clé de déduplication (fonction pure, documentée ci-dessus). */
export function dedupKey(deviceId: string, e: Pick<CanonicalEvent, "externalEventId" | "deviceUserId" | "localTime" | "direction" | "verifyMode">): string {
  if (e.externalEventId) return `dev:${deviceId}:ev:${e.externalEventId}`;
  return `dev:${deviceId}:u:${e.deviceUserId}:t:${e.localTime}:d:${e.direction}:m:${e.verifyMode ?? ""}`;
}

export function payloadHash(events: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(events)).digest("hex");
}

/**
 * Validation pure d'un lot : événements acceptés et rejetés (avec leur index).
 * Une heure plus de 24 h dans le futur par rapport au serveur est rejetée
 * (horloge manifestement fausse) ; le décalage d'horloge reste suivi par appareil.
 */
export function parseEvents(deviceId: string, events: unknown[], now: Date): { ok: ParsedEvent[]; rejected: RejectedEvent[] } {
  const ok: ParsedEvent[] = [];
  const rejected: RejectedEvent[] = [];
  events.forEach((raw, index) => {
    const r = eventSchema.safeParse(raw);
    if (!r.success) return rejected.push({ index, code: "FORMAT" });
    const punchedAt = gomaLocalToUtc(r.data.localTime);
    if (!punchedAt) return rejected.push({ index, code: "HEURE_INVALIDE" });
    if (punchedAt.getTime() > now.getTime() + 24 * 3600_000) return rejected.push({ index, code: "HEURE_FUTURE" });
    ok.push({ ...r.data, punchedAt, dedupKey: dedupKey(deviceId, r.data) });
  });
  return { ok, rejected };
}

export type IngestResult = {
  batchId: string;
  accepted: number;
  duplicates: number;
  rejected: RejectedEvent[];
  replayed: boolean;
  serverTime: string;
};

export class IngestConflictError extends Error {
  constructor() {
    super("Clé d'idempotence déjà utilisée avec un contenu différent.");
    this.name = "IngestConflictError";
  }
}

/** Enregistre un lot pour un appareil déjà authentifié (ou le simulateur). */
export async function ingestBatch(
  device: { id: string; organizationId: string; isSimulator: boolean },
  p: { idempotencyKey: string; events: unknown[]; source: "DEVICE" | "SIMULATOR" }
): Promise<IngestResult> {
  const now = new Date();
  const hash = payloadHash(p.events);
  const previous = await prisma.ingestBatch.findUnique({ where: { deviceId_idempotencyKey: { deviceId: device.id, idempotencyKey: p.idempotencyKey } } });
  if (previous) {
    if (previous.payloadHash !== hash) throw new IngestConflictError();
    return { batchId: previous.id, accepted: previous.accepted, duplicates: previous.duplicates, rejected: [], replayed: true, serverTime: now.toISOString() };
  }
  // Un appareil de simulation ne produit que des pointages SIMULATOR, et inversement.
  if ((p.source === "SIMULATOR") !== device.isSimulator) throw new Error("Source incompatible avec l'appareil.");

  const { ok, rejected } = parseEvents(device.id, p.events, now);
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.ingestBatch.create({
      data: { deviceId: device.id, idempotencyKey: p.idempotencyKey, payloadHash: hash, source: p.source, accepted: 0, duplicates: 0, rejected: rejected.length },
    });
    const created = await tx.rawPunch.createMany({
      data: ok.map((e) => ({
        organizationId: device.organizationId,
        deviceId: device.id,
        deviceUserId: e.deviceUserId,
        punchedAt: e.punchedAt,
        deviceLocalTime: e.localTime,
        receivedAt: now,
        batchId: batch.id,
        externalEventId: e.externalEventId ?? null,
        direction: e.direction,
        verifyMode: e.verifyMode ?? null,
        source: p.source,
        dedupKey: e.dedupKey,
      })),
      skipDuplicates: true,
    });
    const duplicates = ok.length - created.count;
    await tx.ingestBatch.update({ where: { id: batch.id }, data: { accepted: created.count, duplicates } });
    await tx.attendanceDevice.update({
      where: { id: device.id },
      data: { lastContactAt: now, ...(created.count > 0 ? { lastEventReceivedAt: now } : {}) },
    });
    return { batchId: batch.id, accepted: created.count, duplicates };
  });
  // Recalcul des jours touchés (y compris un pointage arrivé en retard ou dans le désordre).
  await recomputeForPunches(
    device.organizationId,
    ok.map((e) => ({ deviceId: device.id, deviceUserId: e.deviceUserId, punchedAt: e.punchedAt }))
  );
  return { ...result, rejected, replayed: false, serverTime: now.toISOString() };
}

/** Contact d'un appareil : horloge de l'appareil comparée à celle du serveur (aucun seuil d'alerte décidé). */
export async function recordHeartbeat(device: { id: string }, deviceTimeLocal: string | null) {
  const now = new Date();
  const deviceTime = deviceTimeLocal ? gomaLocalToUtc(deviceTimeLocal) : null;
  const offset = deviceTime ? Math.round((deviceTime.getTime() - now.getTime()) / 1000) : null;
  await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { lastContactAt: now, ...(offset !== null ? { lastClockOffsetSec: offset, lastClockCheckAt: now } : {}) },
  });
  return { serverTime: now.toISOString(), clockOffsetSec: offset };
}
