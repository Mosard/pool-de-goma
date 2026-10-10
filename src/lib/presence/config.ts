// Horaire et calendrier (lot 2) : lecture pour les vues, écriture réservée à
// presence.schedule.manage (IPP principal par sa fonction, IPA chargé du
// personnel par son affectation) — jamais par le Super Admin, l'informaticien
// ou les secrétaires, ni par ajustement individuel ou « Voir comme ». Droits
// relus en base, compte officiel, audit avant / après. Chaque changement
// recalcule les synthèses concernées.

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess, requireOfficialActor } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import type { SessionPermission } from "@/lib/permission-checks";
import { SCHEDULE_SETTING_KEY, readSchedule, validateSchedule, type ValidatedSchedule } from "@/lib/presence/settings";
import { dateKeyToDbDate, dbDateToKey, isDateKey } from "@/lib/presence/time";

type Actor = { id: string; organizationId: string };

export function holdsOrgPermission(permissions: readonly SessionPermission[], key: string, organizationId: string): boolean {
  return permissions.some((p) => p.permissionKey === key && p.poolId === null && !p.cellId && p.organizationId === organizationId);
}

async function requireScheduleManager(actor: Actor) {
  const { permissions } = await loadUserAccess(actor.id);
  if (!holdsOrgPermission(permissions, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, actor.organizationId)) {
    throw new ForbiddenError("Seuls l'IPP principal et l'IPA chargé du personnel modifient les horaires et le calendrier.");
  }
  await requireOfficialActor(actor.id);
}

/** Horaire courant (null : absent ou invalide → calculs bloqués) et sa dernière modification. */
export async function loadSchedule(organizationId: string): Promise<{ schedule: ValidatedSchedule | null; setAt: Date | null; setById: string | null }> {
  const row = await prisma.attendanceSetting.findFirst({
    where: { organizationId, key: SCHEDULE_SETTING_KEY },
    orderBy: { createdAt: "desc" },
  });
  return { schedule: row ? readSchedule(row.value) : null, setAt: row?.createdAt ?? null, setById: row?.setById ?? null };
}

/** Jours non travaillés du calendrier sur une période, par date civile. */
export async function loadCalendar(organizationId: string, from: string, to: string): Promise<Map<string, string>> {
  const rows = await prisma.calendarDay.findMany({
    where: { organizationId, date: { gte: dateKeyToDbDate(from), lte: dateKeyToDbDate(to) } },
    select: { date: true, label: true },
  });
  return new Map(rows.map((r) => [dbDateToKey(r.date), r.label]));
}

export async function saveSchedule(actor: Actor, input: ValidatedSchedule) {
  await requireScheduleManager(actor);
  const v = validateSchedule(input);
  if (!v.ok) throw new ForbiddenError(v.error);
  const before = await loadSchedule(actor.organizationId);
  if (before.schedule && JSON.stringify(before.schedule) === JSON.stringify(v.value)) return;
  await prisma.attendanceSetting.create({ data: { organizationId: actor.organizationId, key: SCHEDULE_SETTING_KEY, value: v.value, setById: actor.id } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.schedule_update",
    entityType: "AttendanceSetting",
    entityId: SCHEDULE_SETTING_KEY,
    oldValue: before.schedule ?? undefined,
    newValue: v.value,
  });
  const { recomputeOrganization } = await import("@/lib/presence/daily");
  await recomputeOrganization(actor.organizationId);
}

export async function addCalendarDay(actor: Actor, p: { dateKey: string; label: string }) {
  await requireScheduleManager(actor);
  const label = p.label.trim().slice(0, 120);
  if (!isDateKey(p.dateKey)) throw new ForbiddenError("Date invalide.");
  if (label.length < 3) throw new ForbiddenError("Motif : au moins 3 caractères.");
  const date = dateKeyToDbDate(p.dateKey);
  const existing = await prisma.calendarDay.findUnique({ where: { organizationId_date: { organizationId: actor.organizationId, date } } });
  if (existing) throw new ForbiddenError("Ce jour figure déjà au calendrier.");
  const row = await prisma.calendarDay.create({ data: { organizationId: actor.organizationId, date, label, createdById: actor.id } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.calendar_add",
    entityType: "CalendarDay",
    entityId: row.id,
    newValue: { date: p.dateKey, kind: row.kind, label },
  });
  const { recomputeDates } = await import("@/lib/presence/daily");
  await recomputeDates(actor.organizationId, [p.dateKey]);
}

export async function removeCalendarDay(actor: Actor, id: string) {
  await requireScheduleManager(actor);
  const row = await prisma.calendarDay.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!row) throw new ForbiddenError("Jour introuvable.");
  await prisma.calendarDay.delete({ where: { id: row.id } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.calendar_remove",
    entityType: "CalendarDay",
    entityId: row.id,
    oldValue: { date: dbDateToKey(row.date), kind: row.kind, label: row.label },
  });
  const { recomputeDates } = await import("@/lib/presence/daily");
  await recomputeDates(actor.organizationId, [dbDateToKey(row.date)]);
}
