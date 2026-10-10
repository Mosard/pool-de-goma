// Synthèses journalières (lot 4) : TOUJOURS recalculées depuis les pointages
// bruts, les associations d'identifiants, l'horaire et le calendrier. Une
// ligne n'existe que pour un jour avec au moins un pointage associé ; un jour
// sans pointage est calculé à la lecture (jamais « absent »). Rien ici ne
// modifie un pointage brut ni une décision.

import { prisma } from "@/lib/prisma";
import { loadCalendar, loadSchedule } from "@/lib/presence/config";
import { computeDay, type DayPunch, type DaySummary } from "@/lib/presence/rules";
import { addDays, dateKeyToDbDate, dbDateToKey, gomaDateKey, gomaDayStartUtc } from "@/lib/presence/time";

type MappingWindow = { deviceId: string; deviceUserId: string; validFrom: Date; validTo: Date | null };

/** Fonction pure : l'association couvre-t-elle cet instant ? (début inclus, fin exclue) */
export function mappingCovers(m: { validFrom: Date; validTo: Date | null }, at: Date): boolean {
  return m.validFrom.getTime() <= at.getTime() && (m.validTo === null || at.getTime() < m.validTo.getTime());
}

/** Fonction pure : l'association est-elle valide à un moment de ce jour civil ? */
export function mappingCoversDay(m: { validFrom: Date; validTo: Date | null }, dateKey: string): boolean {
  const start = gomaDayStartUtc(dateKey).getTime();
  const end = gomaDayStartUtc(addDays(dateKey, 1)).getTime();
  return m.validFrom.getTime() < end && (m.validTo === null || m.validTo.getTime() > start);
}

/** Recalcule les jours donnés d'un compte (création, mise à jour ou suppression de la synthèse). */
export async function recomputeUserDates(organizationId: string, userId: string, dateKeys: string[]): Promise<void> {
  const keys = [...new Set(dateKeys)].sort();
  if (keys.length === 0) return;
  const from = keys[0];
  const to = keys[keys.length - 1];
  const [{ schedule }, calendar, mappings] = await Promise.all([
    loadSchedule(organizationId),
    loadCalendar(organizationId, from, to),
    prisma.deviceUserMapping.findMany({
      where: { userId, device: { organizationId } },
      select: { deviceId: true, deviceUserId: true, validFrom: true, validTo: true },
    }),
  ]);
  const punches =
    mappings.length === 0
      ? []
      : await prisma.rawPunch.findMany({
          where: {
            organizationId,
            punchedAt: { gte: gomaDayStartUtc(from), lt: gomaDayStartUtc(addDays(to, 1)) },
            OR: mappings.map((m) => ({ deviceId: m.deviceId, deviceUserId: m.deviceUserId })),
          },
          select: { deviceId: true, deviceUserId: true, punchedAt: true, direction: true, source: true },
        });
  const todayKey = gomaDateKey(new Date());
  for (const dateKey of keys) {
    const dayPunches: DayPunch[] = punches
      .filter((p) => gomaDateKey(p.punchedAt) === dateKey)
      .filter((p) => mappings.some((m) => m.deviceId === p.deviceId && m.deviceUserId === p.deviceUserId && mappingCovers(m, p.punchedAt)))
      .map((p) => ({ at: p.punchedAt, direction: p.direction, simulated: p.source === "SIMULATOR" }));
    if (dayPunches.length === 0) {
      await prisma.dailyAttendance.deleteMany({ where: { userId, date: dateKeyToDbDate(dateKey) } });
      continue;
    }
    const summary = computeDay({
      dateKey,
      todayKey,
      punches: dayPunches,
      schedule,
      calendarNonWorked: calendar.get(dateKey) ?? null,
      hasMapping: true,
    });
    const data = { status: summary.status, summary: summary as unknown as object, simulated: summary.simulated, punchCount: dayPunches.length, computedAt: new Date() };
    await prisma.dailyAttendance.upsert({
      where: { userId_date: { userId, date: dateKeyToDbDate(dateKey) } },
      update: data,
      create: { organizationId, userId, date: dateKeyToDbDate(dateKey), ...data },
    });
  }
}

/** Après réception : recalcule les comptes et jours touchés par ces pointages (désordre et retard compris). */
export async function recomputeForPunches(organizationId: string, punches: { deviceId: string; deviceUserId: string; punchedAt: Date }[]): Promise<number> {
  if (punches.length === 0) return 0;
  const pairs = [...new Map(punches.map((p) => [`${p.deviceId}|${p.deviceUserId}`, p])).values()];
  const mappings = await prisma.deviceUserMapping.findMany({
    where: { OR: pairs.map((p) => ({ deviceId: p.deviceId, deviceUserId: p.deviceUserId })) },
    select: { userId: true, deviceId: true, deviceUserId: true, validFrom: true, validTo: true },
  });
  const byUser = new Map<string, Set<string>>();
  for (const p of punches) {
    for (const m of mappings) {
      if (m.deviceId === p.deviceId && m.deviceUserId === p.deviceUserId && mappingCovers(m, p.punchedAt)) {
        const set = byUser.get(m.userId) ?? new Set<string>();
        set.add(gomaDateKey(p.punchedAt));
        byUser.set(m.userId, set);
      }
    }
  }
  for (const [userId, dates] of byUser) await recomputeUserDates(organizationId, userId, [...dates]);
  return byUser.size;
}

/** Après une association créée ou terminée : jours de ce compte où l'identifiant a des pointages. */
export async function recomputeForMapping(organizationId: string, m: MappingWindow & { userId: string }): Promise<void> {
  const punches = await prisma.rawPunch.findMany({
    where: { organizationId, deviceId: m.deviceId, deviceUserId: m.deviceUserId },
    select: { punchedAt: true },
  });
  const dates = [...new Set(punches.map((p) => gomaDateKey(p.punchedAt)))];
  const existing = await prisma.dailyAttendance.findMany({ where: { userId: m.userId }, select: { date: true } });
  await recomputeUserDates(organizationId, m.userId, [...dates, ...existing.map((e) => dbDateToKey(e.date))]);
}

/** Après un changement du calendrier : ces jours, pour tous les comptes associés. */
export async function recomputeDates(organizationId: string, dateKeys: string[]): Promise<void> {
  const users = await prisma.deviceUserMapping.findMany({ where: { device: { organizationId } }, select: { userId: true }, distinct: ["userId"] });
  for (const u of users) await recomputeUserDates(organizationId, u.userId, dateKeys);
}

/** Après un changement d'horaire : toutes les synthèses existantes. */
export async function recomputeOrganization(organizationId: string): Promise<void> {
  const rows = await prisma.dailyAttendance.findMany({ where: { organizationId }, select: { userId: true, date: true } });
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), dbDateToKey(r.date)]);
  for (const [userId, dates] of byUser) await recomputeUserDates(organizationId, userId, dates);
}

/** Lit une synthèse enregistrée (JSON) ; null si absente. */
export function readSummary(raw: unknown): DaySummary | null {
  return raw && typeof raw === "object" && "status" in raw ? (raw as DaySummary) : null;
}
