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

export type ParsedEvent = CanonicalEvent & { punchedAt: Date; dedupKey: string; clockSuspect: boolean; index: number };

/**
 * Contrôle de l'heure de l'appareil :
 *  - API (passerelle) : rejet au-delà de 24 h d'avance (comportement d'origine) ;
 *  - ADMS (pointeuse en direct) : rien n'est rejeté (la pointeuse effacerait
 *    son pointage après « OK ») ; au-delà de la tolérance, le pointage est
 *    CONSERVÉ mais mis en quarantaine (clockSuspect), exclu du calcul.
 */
export type ClockPolicy = { kind: "reject-far-future" } | { kind: "quarantine"; toleranceSec: number };
export const API_CLOCK_POLICY: ClockPolicy = { kind: "reject-far-future" };

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
export function parseEvents(deviceId: string, events: unknown[], now: Date, policy: ClockPolicy = API_CLOCK_POLICY): { ok: ParsedEvent[]; rejected: RejectedEvent[] } {
  const ok: ParsedEvent[] = [];
  const rejected: RejectedEvent[] = [];
  events.forEach((raw, index) => {
    const r = eventSchema.safeParse(raw);
    if (!r.success) return rejected.push({ index, code: "FORMAT" });
    const punchedAt = gomaLocalToUtc(r.data.localTime);
    if (!punchedAt) return rejected.push({ index, code: "HEURE_INVALIDE" });
    const ahead = punchedAt.getTime() - now.getTime();
    if (policy.kind === "reject-far-future" && ahead > 24 * 3600_000) return rejected.push({ index, code: "HEURE_FUTURE" });
    const clockSuspect = policy.kind === "quarantine" && ahead > policy.toleranceSec * 1000;
    ok.push({ ...r.data, punchedAt, dedupKey: dedupKey(deviceId, r.data), clockSuspect, index });
  });
  return { ok, rejected };
}

export type IngestResult = {
  batchId: string;
  accepted: number;
  duplicates: number;
  rejected: RejectedEvent[];
  /** Pointages conservés mais mis en quarantaine (horloge de l'appareil en avance). */
  clockSuspect: number;
  replayed: boolean;
  serverTime: string;
};

export class IngestConflictError extends Error {
  constructor() {
    super("Clé d'idempotence déjà utilisée avec un contenu différent.");
    this.name = "IngestConflictError";
  }
}

/** Valeurs brutes propres au protocole, par index d'événement (ADMS : état, code de travail). */
export type EventExtras = { rawStatus?: string | null; workCode?: string | null };

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * Recalcule les journées touchées par un lot, puis le marque recalculé.
 * Un échec laisse recomputedAt à null : le renvoi du même lot le relance.
 */
async function recomputeBatch(organizationId: string, batchId: string, punches: { deviceId: string; deviceUserId: string; punchedAt: Date }[]) {
  await recomputeForPunches(organizationId, punches);
  await prisma.ingestBatch.update({ where: { id: batchId }, data: { recomputedAt: new Date() } });
}

/** Enregistre un lot pour un appareil déjà authentifié (ou le simulateur). */
export async function ingestBatch(
  device: { id: string; organizationId: string; isSimulator: boolean },
  p: {
    idempotencyKey: string;
    events: unknown[];
    source: "DEVICE" | "SIMULATOR";
    clockPolicy?: ClockPolicy;
    extras?: (EventExtras | undefined)[];
    /** Décalage d'horloge mesuré par l'appelant (secondes), enregistré avec le lot. */
    clockOffsetSec?: number | null;
  }
): Promise<IngestResult> {
  const now = new Date();
  const hash = payloadHash(p.events);
  const replay = async (): Promise<IngestResult | null> => {
    const previous = await prisma.ingestBatch.findUnique({ where: { deviceId_idempotencyKey: { deviceId: device.id, idempotencyKey: p.idempotencyKey } } });
    if (!previous) return null;
    if (previous.payloadHash !== hash) throw new IngestConflictError();
    // Recalcul interrompu lors du premier envoi : on le refait maintenant.
    if (!previous.recomputedAt) {
      const punches = await prisma.rawPunch.findMany({ where: { batchId: previous.id, clockSuspect: false }, select: { deviceId: true, deviceUserId: true, punchedAt: true } });
      await recomputeBatch(device.organizationId, previous.id, punches);
    }
    return { batchId: previous.id, accepted: previous.accepted, duplicates: previous.duplicates, rejected: [], clockSuspect: 0, replayed: true, serverTime: now.toISOString() };
  };
  const previous = await replay();
  if (previous) return previous;
  // Un appareil de simulation ne produit que des pointages SIMULATOR, et inversement.
  if ((p.source === "SIMULATOR") !== device.isSimulator) throw new Error("Source incompatible avec l'appareil.");

  const { ok, rejected } = parseEvents(device.id, p.events, now, p.clockPolicy);
  let result: { batchId: string; accepted: number; duplicates: number };
  try {
    result = await prisma.$transaction(async (tx) => {
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
          rawStatus: p.extras?.[e.index]?.rawStatus ?? null,
          workCode: p.extras?.[e.index]?.workCode ?? null,
          clockSuspect: e.clockSuspect,
          source: p.source,
          dedupKey: e.dedupKey,
        })),
        skipDuplicates: true,
      });
      const duplicates = ok.length - created.count;
      await tx.ingestBatch.update({ where: { id: batch.id }, data: { accepted: created.count, duplicates } });
      await tx.attendanceDevice.update({
        where: { id: device.id },
        data: {
          lastContactAt: now,
          ...(created.count > 0 ? { lastEventReceivedAt: now } : {}),
          ...(p.clockOffsetSec != null ? { lastClockOffsetSec: p.clockOffsetSec, lastClockCheckAt: now } : {}),
        },
      });
      return { batchId: batch.id, accepted: created.count, duplicates };
    });
  } catch (e) {
    // Deux envois simultanés du même lot : le second est un simple renvoi.
    if (isUniqueViolation(e)) {
      const again = await replay();
      if (again) return again;
    }
    throw e;
  }
  // Recalcul des jours touchés (y compris un pointage arrivé en retard ou dans
  // le désordre) ; les pointages en quarantaine n'entrent pas dans le calcul.
  await recomputeBatch(
    device.organizationId,
    result.batchId,
    ok.filter((e) => !e.clockSuspect).map((e) => ({ deviceId: device.id, deviceUserId: e.deviceUserId, punchedAt: e.punchedAt }))
  );
  return { ...result, rejected, clockSuspect: ok.filter((e) => e.clockSuspect).length, replayed: false, serverTime: now.toISOString() };
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
