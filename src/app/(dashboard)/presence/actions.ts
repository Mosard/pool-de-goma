"use server";

// Actions de l'espace « Présence du personnel ». Chaque action relit la
// session ; les fonctions appelées revérifient les droits en base (jamais ce
// que l'écran affiche) et journalisent sous l'identité réelle de l'auteur.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, loadUserAccess } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { addCalendarDay, holdsOrgPermission, removeCalendarDay, saveSchedule } from "@/lib/presence/config";
import { createDevice, createMapping, endMapping, issueDeviceToken, presenceSimulatorEnabled, revokeDeviceToken, setDeviceDisabled } from "@/lib/presence/devices";
import { IngestConflictError, ingestBatch } from "@/lib/presence/ingest";
import { isDateKey, parseClock } from "@/lib/presence/time";
import type { FormState } from "./action-form";

async function actor() {
  const session = await auth();
  if (!session?.user || session.user.awaitingCell) throw new ForbiddenError("Connexion requise.");
  return { id: session.user.id, organizationId: session.user.organizationId };
}

async function run(fn: () => Promise<FormState | void>): Promise<FormState> {
  try {
    const r = await fn();
    revalidatePath("/presence", "layout");
    return r ?? { ok: "Enregistré." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ─── Horaires et calendrier (IPP principal, IPA chargé du personnel) ───────

export async function saveScheduleAction(_p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    await saveSchedule(await actor(), {
      workdays: fd.getAll("workdays").map((d) => Number(d)),
      start: str(fd, "start"),
      lateAfter: str(fd, "lateAfter"),
      end: str(fd, "end"),
      normalDepartureUntil: str(fd, "normalDepartureUntil"),
      overtimeFrom: str(fd, "overtimeFrom"),
    });
    return { ok: "Horaire enregistré ; synthèses recalculées." };
  });
}

export async function addCalendarDayAction(_p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    await addCalendarDay(await actor(), { dateKey: str(fd, "date"), label: str(fd, "label") });
    return { ok: "Jour ajouté au calendrier." };
  });
}

export async function removeCalendarDayAction(id: string): Promise<FormState> {
  return run(async () => {
    await removeCalendarDay(await actor(), id);
    return { ok: "Jour retiré." };
  });
}

// ─── Appareils et jetons ───────────────────────────────────────────────────

export async function createDeviceAction(_p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    await createDevice(await actor(), { label: str(fd, "label"), siteLabel: str(fd, "siteLabel"), vendor: str(fd, "vendor"), model: str(fd, "model"), serialNumber: str(fd, "serialNumber") });
    return { ok: "Appareil enregistré (non vérifié)." };
  });
}

export async function issueTokenAction(deviceId: string): Promise<FormState> {
  return run(async () => ({ token: await issueDeviceToken(await actor(), deviceId) }));
}

export async function revokeTokenAction(credentialId: string): Promise<FormState> {
  return run(async () => {
    await revokeDeviceToken(await actor(), credentialId);
    return { ok: "Jeton révoqué." };
  });
}

export async function toggleDeviceAction(deviceId: string, disabled: boolean): Promise<FormState> {
  return run(async () => {
    await setDeviceDisabled(await actor(), deviceId, disabled);
    return { ok: disabled ? "Appareil désactivé." : "Appareil réactivé (non vérifié)." };
  });
}

// ─── Associations d'identifiants ───────────────────────────────────────────

export async function createMappingAction(_p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    await createMapping(await actor(), { deviceId: str(fd, "deviceId"), deviceUserId: str(fd, "deviceUserId"), userId: str(fd, "userId"), fromDateKey: str(fd, "from") });
    return { ok: "Association enregistrée ; synthèses recalculées." };
  });
}

export async function endMappingAction(mappingId: string, _p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    await endMapping(await actor(), { mappingId, endDateKey: str(fd, "end"), reason: str(fd, "reason") });
    return { ok: "Association terminée ; synthèses recalculées." };
  });
}

// ─── Simulateur (développement local uniquement) ───────────────────────────

async function requireSimulator() {
  if (!presenceSimulatorEnabled()) throw new ForbiddenError("Simulateur indisponible dans cet environnement.");
  const a = await actor();
  const { permissions } = await loadUserAccess(a.id);
  if (!holdsOrgPermission(permissions, PERMISSIONS.PRESENCE_DEVICES_MANAGE, a.organizationId)) throw new ForbiddenError("Simulateur réservé aux administrateurs des appareils.");
  return a;
}

export async function createSimulatorDeviceAction(_p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await requireSimulator();
    await createDevice(a, { label: str(fd, "label") || "Pointeuse simulée", siteLabel: str(fd, "siteLabel") || "Bureau simulé", simulator: true });
    return { ok: "Appareil de simulation créé." };
  });
}

/**
 * Envoie un lot simulé par le même circuit que les appareils (déduplication,
 * recalcul). Le sens est TRANSMIS explicitement par le simulateur, comme le
 * ferait un appareil ; le moteur n'en déduit jamais aucun.
 */
export async function simulatePunchAction(_p: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await requireSimulator();
    const device = await prisma.attendanceDevice.findFirst({ where: { id: str(fd, "deviceId"), organizationId: a.organizationId, isSimulator: true } });
    if (!device) throw new ForbiddenError("Choisissez un appareil de simulation.");
    const date = str(fd, "date");
    const times = str(fd, "times").split(/[\s,;]+/).filter(Boolean);
    if (!isDateKey(date) || times.length === 0 || times.length > 20) throw new ForbiddenError("Date et heures (HH:MM ou HH:MM:SS, séparées par des virgules) requises.");
    const direction = str(fd, "direction");
    const events = times.map((t, i) => {
      if (parseClock(t) === null) throw new ForbiddenError(`Heure invalide : ${t}`);
      const dir = direction === "ALTERNE" ? (i % 2 === 0 ? "IN" : "OUT") : direction;
      return { deviceUserId: str(fd, "deviceUserId"), localTime: `${date}T${t.length === 5 ? `${t}:00` : t}`, direction: dir };
    });
    const key = str(fd, "replayKey") || `sim-${randomUUID()}`;
    const r = await ingestBatch(device, { idempotencyKey: key, events, source: "SIMULATOR" }).catch((e) => {
      if (e instanceof IngestConflictError) throw new ForbiddenError(e.message);
      throw e;
    });
    return { ok: `Lot ${r.replayed ? "rejoué (déjà reçu)" : "reçu"} : ${r.accepted} accepté(s), ${r.duplicates} doublon(s), ${r.rejected.length} rejeté(s). Clé : ${key}` };
  });
}
