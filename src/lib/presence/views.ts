// Vues des présences (lot 5) : périmètre résolu CÔTÉ SERVEUR à chaque requête
// (droits relus en base), appliqué aux filtres et aux accès directs :
//  - presence.read_all (IPP, Super Admins, IPA chargé du personnel,
//    secrétaires de l'IPP, informaticien) : tout le personnel associé ;
//  - presence.read_cell (autre IPA) : les personnes de SA cellule, seulement
//    les jours où elles en sont membres (historique daté ; date inconnue :
//    jamais avant la reprise) ;
//  - chacun : sa propre présence.
// Champs renvoyés : identification et heures seulement — aucune coordonnée,
// aucune donnée familiale, aucun secret.

import { prisma } from "@/lib/prisma";
import { loadUserAccess } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { cellsWithPermission, type SessionPermission } from "@/lib/permission-checks";
import { holdsOrgPermission, loadCalendar, loadSchedule } from "@/lib/presence/config";
import { mappingCoversDay, readSummary } from "@/lib/presence/daily";
import { computeDay, type DayStatus, type DaySummary } from "@/lib/presence/rules";
import { addDays, dateKeyToDbDate, dateRange, dbDateToKey, gomaDateKey, gomaDayStartUtc, isDateKey } from "@/lib/presence/time";

export const MAX_PERIOD_DAYS = 31;

export type PresenceScope = { kind: "all" } | { kind: "cells"; cellIds: string[] } | { kind: "self" };

/** Fonction pure : périmètre de consultation d'après les droits effectifs. */
export function resolvePresenceScope(permissions: readonly SessionPermission[], organizationId: string): PresenceScope {
  if (holdsOrgPermission(permissions, PERMISSIONS.PRESENCE_READ_ALL, organizationId)) return { kind: "all" };
  const cellIds = cellsWithPermission([...permissions], PERMISSIONS.PRESENCE_READ_CELL);
  return cellIds.length > 0 ? { kind: "cells", cellIds } : { kind: "self" };
}

export type PresenceViewer = { id: string; organizationId: string; isDemo: boolean; scope: PresenceScope; permissions: SessionPermission[] };

export async function loadPresenceViewer(userId: string): Promise<PresenceViewer | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, organizationId: true, isDemo: true, status: true } });
  if (!user || user.status !== "ACTIVE") return null;
  const { permissions } = await loadUserAccess(userId);
  return { id: user.id, organizationId: user.organizationId, isDemo: user.isDemo, permissions, scope: resolvePresenceScope(permissions, user.organizationId) };
}

export type PresenceFilters = { from: string; to: string; cellId?: string; poolId?: string; site?: string; userId?: string };

/** Fonction pure : période valide, bornée à MAX_PERIOD_DAYS jours. */
export function normalizePeriod(from: string | undefined, to: string | undefined, today: string): { from: string; to: string } {
  const t = isDateKey(to) ? to : today;
  const f = isDateKey(from) ? from : t;
  if (f > t) return { from: t, to: t };
  const range = dateRange(f, t);
  return range.length > MAX_PERIOD_DAYS ? { from: addDays(t, -(MAX_PERIOD_DAYS - 1)), to: t } : { from: f, to: t };
}

type Term = { cellId: string; startedAt: Date | null; observedAt: Date; endedAt: Date | null };

/** Fonction pure : appartenance à la cellule ce jour-là (date inconnue : à partir de la reprise seulement). */
export function termCoversDay(t: Term, dateKey: string): boolean {
  const start = (t.startedAt ?? t.observedAt).getTime();
  const dayStart = gomaDayStartUtc(dateKey).getTime();
  const dayEnd = gomaDayStartUtc(addDays(dateKey, 1)).getTime();
  return start < dayEnd && (t.endedAt === null || t.endedAt.getTime() > dayStart);
}

export type PresenceRow = {
  userId: string;
  name: string;
  functions: string[];
  cells: string[];
  sites: string[];
  dateKey: string;
  summary: DaySummary;
};

type Person = {
  id: string;
  name: string;
  functions: string[];
  terms: (Term & { cellName: string })[];
  mappings: { validFrom: Date; validTo: Date | null; site: string }[];
};

async function loadPeople(viewer: PresenceViewer, f: PresenceFilters): Promise<Person[]> {
  const fromUtc = gomaDayStartUtc(f.from);
  const toUtc = gomaDayStartUtc(addDays(f.to, 1));
  const org = viewer.organizationId;
  // Population : comptes associés à un identifiant sur la période ; pour une
  // vue de cellule, aussi les membres sans identifiant (signalés comme tels).
  const mappingWindow = { validFrom: { lt: toUtc }, OR: [{ validTo: null }, { validTo: { gt: fromUtc } }], device: { organizationId: org } };
  const cellFilterIds =
    viewer.scope.kind === "cells" ? viewer.scope.cellIds.filter((c) => !f.cellId || c === f.cellId) : f.cellId ? [f.cellId] : null;
  const and: object[] = [{ organizationId: org, isDemo: viewer.isDemo }];
  if (viewer.scope.kind === "self") and.push({ id: viewer.id });
  if (f.userId) and.push({ id: f.userId });
  if (f.poolId) and.push({ OR: [{ poolId: f.poolId }, { roles: { some: { poolId: f.poolId } } }] });
  // Sa propre présence : même sans identifiant (état « aucun identifiant associé » explicite).
  if (viewer.scope.kind !== "self") {
    and.push(
      cellFilterIds
        ? { staffCellTerms: { some: { cellId: { in: cellFilterIds }, roleKey: ROLE_KEYS.EXPLOITANT_IPP } } }
        : { presenceMappings: { some: mappingWindow } }
    );
  }
  const users = await prisma.user.findMany({
    where: { AND: and },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 500,
    select: {
      id: true,
      name: true,
      roles: { select: { role: { select: { label: true } } } },
      staffCellTerms: {
        where: { roleKey: ROLE_KEYS.EXPLOITANT_IPP },
        select: { cellId: true, startedAt: true, observedAt: true, endedAt: true, cell: { select: { name: true } } },
      },
      presenceMappings: { where: mappingWindow, select: { validFrom: true, validTo: true, device: { select: { siteLabel: true } } } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    functions: [...new Set(u.roles.map((r) => r.role.label))],
    terms: u.staffCellTerms.map((t) => ({ cellId: t.cellId, startedAt: t.startedAt, observedAt: t.observedAt, endedAt: t.endedAt, cellName: t.cell.name })),
    mappings: u.presenceMappings.map((m) => ({ validFrom: m.validFrom, validTo: m.validTo, site: m.device.siteLabel })),
  }));
}

/** Lignes (personne × jour) visibles par ce lecteur, filtres contrôlés côté serveur. */
export async function loadPresenceRows(viewer: PresenceViewer, filters: PresenceFilters): Promise<PresenceRow[]> {
  const period = normalizePeriod(filters.from, filters.to, gomaDateKey(new Date()));
  const f = { ...filters, ...period };
  // Une cellule hors de son périmètre ne donne rien (accès direct par l'adresse compris).
  if (viewer.scope.kind === "cells" && f.cellId && !viewer.scope.cellIds.includes(f.cellId)) return [];
  if (viewer.scope.kind === "self" && f.userId && f.userId !== viewer.id) return [];
  const people = await loadPeople(viewer, f);
  if (people.length === 0) return [];
  const [{ schedule }, calendar, stored] = await Promise.all([
    loadSchedule(viewer.organizationId),
    loadCalendar(viewer.organizationId, f.from, f.to),
    prisma.dailyAttendance.findMany({
      where: { organizationId: viewer.organizationId, userId: { in: people.map((p) => p.id) }, date: { gte: dateKeyToDbDate(f.from), lte: dateKeyToDbDate(f.to) } },
      select: { userId: true, date: true, summary: true },
    }),
  ]);
  const byKey = new Map(stored.map((s) => [`${s.userId}|${dbDateToKey(s.date)}`, readSummary(s.summary)]));
  const today = gomaDateKey(new Date());
  const cellScope = viewer.scope.kind === "cells" ? viewer.scope.cellIds : f.cellId ? [f.cellId] : null;
  const rows: PresenceRow[] = [];
  for (const dateKey of dateRange(f.from, f.to)) {
    for (const p of people) {
      const termsToday = p.terms.filter((t) => termCoversDay(t, dateKey));
      // Vue de cellule (ou filtre par cellule) : seulement les jours d'appartenance.
      if (cellScope && viewer.scope.kind !== "self" && !termsToday.some((t) => cellScope.includes(t.cellId))) continue;
      const mappingsToday = p.mappings.filter((m) => mappingCoversDay(m, dateKey));
      if (f.site && !mappingsToday.some((m) => m.site === f.site)) continue;
      const summary =
        byKey.get(`${p.id}|${dateKey}`) ??
        computeDay({ dateKey, todayKey: today, punches: [], schedule, calendarNonWorked: calendar.get(dateKey) ?? null, hasMapping: mappingsToday.length > 0 });
      rows.push({
        userId: p.id,
        name: p.name,
        functions: p.functions,
        cells: [...new Set(termsToday.map((t) => t.cellName))],
        sites: [...new Set(mappingsToday.map((m) => m.site))],
        dateKey,
        summary,
      });
    }
  }
  return rows;
}

/** Sa propre présence : toujours permise, quels que soient ses autres droits. */
export async function loadOwnRows(viewer: PresenceViewer, from: string, to: string): Promise<PresenceRow[]> {
  return loadPresenceRows({ ...viewer, scope: { kind: "self" } }, { from, to });
}

export type DayCounts = Record<"total" | "withPunches" | "late" | "early" | "overtime" | "noPunch" | "unmapped" | "nonWorked" | "pending" | "simulated", number>;

/** Fonction pure : compteurs d'une journée (aucune absence comptée : la règle n'est pas décidée). */
export function countDay(rows: PresenceRow[]): DayCounts {
  const c: DayCounts = { total: 0, withPunches: 0, late: 0, early: 0, overtime: 0, noPunch: 0, unmapped: 0, nonWorked: 0, pending: 0, simulated: 0 };
  const withPunch: DayStatus[] = ["ENTREE_SEULE", "SORTIE_SEULE", "ENTREE_SORTIE", "POINTAGES_MULTIPLES", "SENS_INCONNU"];
  for (const r of rows) {
    const s = r.summary;
    c.total++;
    if (withPunch.includes(s.status)) c.withPunches++;
    if (s.status === "AUCUN_POINTAGE") c.noPunch++;
    if (s.status === "SANS_IDENTIFIANT") c.unmapped++;
    if (s.status === "JOUR_NON_TRAVAILLE") c.nonWorked++;
    if (s.late === true) c.late++;
    if (s.earlyDeparture === true) c.early++;
    if (s.overtimeProposedMin !== null || s.overtimePending) c.overtime++;
    if (s.pending.some((k) => k !== "SYNC" && k !== "ABSENCE")) c.pending++;
    if (s.simulated) c.simulated++;
  }
  return c;
}

/** Options de filtres limitées au périmètre du lecteur. */
export async function loadFilterOptions(viewer: PresenceViewer) {
  const org = viewer.organizationId;
  if (viewer.scope.kind === "self") return { cells: [], pools: [], sites: [] as string[] };
  const [cells, pools, sites] = await Promise.all([
    prisma.cell.findMany({
      where: { organizationId: org, active: true, ...(viewer.scope.kind === "cells" ? { id: { in: viewer.scope.cellIds } } : {}) },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    viewer.scope.kind === "all" ? prisma.pool.findMany({ where: { organizationId: org }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    prisma.attendanceDevice.findMany({ where: { organizationId: org }, distinct: ["siteLabel"], select: { siteLabel: true }, orderBy: { siteLabel: "asc" } }),
  ]);
  return { cells, pools, sites: sites.map((s) => s.siteLabel) };
}

/** État de synchronisation : appareils, contacts, décalage d'horloge brut, identifiants non associés. */
export async function loadSyncState(organizationId: string) {
  const devices = await prisma.attendanceDevice.findMany({
    where: { organizationId },
    orderBy: [{ isSimulator: "asc" }, { siteLabel: "asc" }, { label: "asc" }],
    select: {
      id: true,
      label: true,
      siteLabel: true,
      status: true,
      isSimulator: true,
      vendor: true,
      model: true,
      lastContactAt: true,
      lastEventReceivedAt: true,
      lastClockOffsetSec: true,
      lastClockCheckAt: true,
      _count: { select: { punches: true, batches: true } },
    },
  });
  const unmapped = await loadUnmappedIdentifiers(organizationId);
  return { devices, unmapped };
}

/** Identifiants ayant pointé hors de toute association valide : signalés, jamais rapprochés par le nom. */
export async function loadUnmappedIdentifiers(organizationId: string) {
  const [groups, mappings] = await Promise.all([
    prisma.rawPunch.groupBy({
      by: ["deviceId", "deviceUserId"],
      where: { organizationId },
      _count: { _all: true },
      _min: { punchedAt: true },
      _max: { punchedAt: true },
    }),
    prisma.deviceUserMapping.findMany({ where: { device: { organizationId } }, select: { deviceId: true, deviceUserId: true, validFrom: true, validTo: true } }),
  ]);
  const out: { deviceId: string; deviceUserId: string; count: number; first: Date | null; last: Date | null; partly: boolean }[] = [];
  for (const g of groups) {
    const ms = mappings.filter((m) => m.deviceId === g.deviceId && m.deviceUserId === g.deviceUserId);
    const first = g._min.punchedAt;
    const last = g._max.punchedAt;
    const coversAll = first && last && ms.some((m) => m.validFrom <= first && (m.validTo === null || m.validTo > last));
    if (coversAll) continue;
    out.push({ deviceId: g.deviceId, deviceUserId: g.deviceUserId, count: g._count._all, first, last, partly: ms.length > 0 });
  }
  return out;
}

/** Curseur de changements (rafraîchissement léger des vues ouvertes). */
export async function loadChangeCursor(organizationId: string): Promise<string> {
  const [d, p, dev] = await Promise.all([
    prisma.dailyAttendance.aggregate({ where: { organizationId }, _max: { computedAt: true } }),
    prisma.rawPunch.aggregate({ where: { organizationId }, _max: { receivedAt: true } }),
    prisma.attendanceDevice.aggregate({ where: { organizationId }, _max: { updatedAt: true, lastContactAt: true } }),
  ]);
  const times = [d._max.computedAt, p._max.receivedAt, dev._max.updatedAt, dev._max.lastContactAt].filter((x): x is Date => Boolean(x)).map((x) => x.getTime());
  return String(times.length ? Math.max(...times) : 0);
}
