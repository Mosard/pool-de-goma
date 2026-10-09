// Requêtes des tableaux de bord. Chaque fonction reçoit un DashboardScope
// (src/lib/dashboard/scope.ts, calculé côté serveur depuis la session) et
// ne lit QUE ce périmètre : organisation de la section, son POOL s'il
// s'agit d'une vue de POOL, et le compte lui-même pour l'itinérant et le
// chargé des médias. Aucun paramètre venu du navigateur n'élargit ce
// périmètre : un POOL ou un inspecteur demandé dans l'URL est vérifié ici.
//
// Pas de mise en cache : ces données dépendent du compte et de sa fonction.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { REPORT_SCOPE_INCLUDE, reportScope, reportsOfAuthor, reportsOfOrganization, reportsOfPool } from "@/lib/fiches/report-scope";
import { type DashboardKind, type DashboardScope, isProvincialKind, scopeCoversPool } from "@/lib/dashboard/scope";
import { listSyntheses, type SynthesisActor } from "@/lib/synthese/server";
import { demoWhere } from "@/lib/exports/scope";
import { CELL_VISIBLE_STAGES } from "@/lib/cells/rules";
import {
  PILOTAGE_BUCKETS,
  POOL_EXPLOITATION_BUCKETS,
  PROVINCIAL_EXPLOITATION_BUCKETS,
  countByBucket,
  isReceived,
  lastMonths,
  monthlyCounts,
} from "@/lib/dashboard/indicators";

/** Inspections réalisées : statuts de visite déjà en vigueur (src/lib/workflow.ts, refreshInspectionStatus). */
const REALIZED_INSPECTION_STATUSES = ["TERMINEE", "RAPPORT_SOUMIS", "VALIDEE"] as const;

function assertKind(scope: DashboardScope, ...kinds: DashboardKind[]) {
  if (!kinds.includes(scope.kind)) throw new Error(`Section ${scope.kind} : requête non autorisée pour ce périmètre.`);
}

/**
 * Rapports du périmètre de la section : son POOL, ou toute son organisation
 * pour une vue provinciale ; démonstration et officiel jamais mélangés (même
 * règle que /rapports et /exploitation, src/lib/exports/scope.ts).
 */
export function reportsInScope(scope: DashboardScope): Prisma.ReportWhereInput {
  if (!scope.poolId && !isProvincialKind(scope.kind)) throw new Error("Section de POOL sans POOL.");
  let area: Prisma.ReportWhereInput;
  if (scope.kind === "exploitation_cellule") {
    // Cellule : uniquement les rapports que le secrétariat lui a affectés (jamais un autre périmètre).
    if (!scope.cellId) throw new Error("Section de cellule sans cellule.");
    area = { ippTrack: { is: { organizationId: scope.organizationId, cellId: scope.cellId, stage: { in: [...CELL_VISIBLE_STAGES] } } } };
  } else if (scope.kind === "secretariat_ipp") {
    area = { AND: [reportsOfOrganization(scope.organizationId), { ippTrack: { isNot: null } }] };
  } else {
    area = scope.poolId ? reportsOfPool(scope.poolId) : reportsOfOrganization(scope.organizationId);
  }
  return { AND: [area, demoWhere(scope.isDemo)] };
}

/** POOL actifs du périmètre (tous ceux de l'organisation, ou le seul POOL de la section). */
export async function poolsInScope(scope: DashboardScope) {
  return prisma.pool.findMany({
    where: { organizationId: scope.organizationId, active: true, ...(scope.poolId ? { id: scope.poolId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, organizationId: true },
  });
}

const REPORT_LIGHT = {
  status: { select: { key: true } },
  poolId: true,
  authorId: true,
  submittedAt: true,
  inspection: { select: { inspectorId: true, school: { select: { poolId: true } } } },
} satisfies Prisma.ReportSelect;

type LightReport = Prisma.ReportGetPayload<{ select: typeof REPORT_LIGHT }>;

function poolOf(r: LightReport): string | null {
  return r.inspection?.school.poolId ?? r.poolId ?? null;
}

/** Rapports reçus (hors brouillons, qui restent privés à leur auteur) du périmètre. */
async function receivedReports(scope: DashboardScope): Promise<LightReport[]> {
  const rows = await prisma.report.findMany({ where: reportsInScope(scope), select: REPORT_LIGHT });
  return rows.filter((r) => isReceived(r.status.key));
}

// ─── IPP : pilotage provincial ────────────────────────────────────────────

export async function loadPilotageProvincial(scope: DashboardScope, now = new Date()) {
  assertKind(scope, "pilotage_provincial");
  const org = scope.organizationId;
  const [pools, reports, schools, realizedInspections, activeUsers, schoolsByPool, toSign, signed] = await Promise.all([
    poolsInScope(scope),
    receivedReports(scope),
    prisma.school.count({ where: { active: true, pool: { organizationId: org } } }),
    prisma.inspection.count({
      where: { status: { in: [...REALIZED_INSPECTION_STATUSES] }, school: { pool: { organizationId: org } } },
    }),
    prisma.user.count({ where: { status: "ACTIVE", organizationId: org } }),
    prisma.school.groupBy({ by: ["poolId"], where: { active: true, pool: { organizationId: org } }, _count: { _all: true } }),
    // Branche IPP : synthèses de cellule validées par l'IPA et transmises à l'IPP (à signer), puis signées.
    prisma.synthesis.count({ where: { organizationId: org, cellId: { not: null }, status: "VALIDE", isDemo: scope.isDemo } }),
    prisma.synthesis.count({ where: { organizationId: org, cellId: { not: null }, status: "SIGNE", isDemo: scope.isDemo } }),
  ]);
  return {
    toSign,
    signed,
    schools,
    activeUsers,
    realizedInspections,
    received: reports.length,
    buckets: countByBucket(
      reports.map((r) => r.status.key),
      PILOTAGE_BUCKETS
    ),
    byPool: pools.map((pool) => {
      const keys = reports.filter((r) => poolOf(r) === pool.id).map((r) => r.status.key);
      return {
        pool,
        schools: schoolsByPool.find((s) => s.poolId === pool.id)?._count._all ?? 0,
        received: keys.length,
        buckets: countByBucket(keys, PILOTAGE_BUCKETS),
      };
    }),
    trend: monthlyCounts(
      reports.map((r) => r.submittedAt),
      lastMonths(now)
    ),
  };
}

// ─── Détail d'un POOL (IPP : tout POOL de l'organisation ; chef : le sien) ──

export async function loadPoolDetail(scope: DashboardScope, requestedPoolId: string | null, requestedInspectorId: string | null) {
  assertKind(scope, "pilotage_provincial", "pilotage_pool");
  // Le chef ne peut pas viser un autre POOL : son périmètre l'emporte sur l'URL.
  const poolId = scope.poolId ?? requestedPoolId;
  if (!poolId) return null;
  const pool = await prisma.pool.findUnique({ where: { id: poolId }, select: { id: true, name: true, organizationId: true } });
  if (!pool || !scopeCoversPool(scope, pool)) return null;

  const poolScope: DashboardScope = { ...scope, poolId: pool.id };
  const [schools, unassignedSchools, inspectors, reports] = await Promise.all([
    prisma.school.count({ where: { poolId: pool.id, active: true } }),
    prisma.school.count({ where: { poolId: pool.id, active: true, assignments: { none: { active: true } } } }),
    // Inspecteurs DE CE POOL : fonction d'inspecteur rattachée au POOL (UserRole.poolId).
    prisma.user.findMany({
      where: { organizationId: pool.organizationId, roles: { some: { poolId: pool.id, role: { key: ROLE_KEYS.INSPECTEUR } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    receivedReports(poolScope),
  ]);
  const authorOf = (r: LightReport) => r.inspection?.inspectorId ?? r.authorId;
  // Un inspecteur demandé dans l'URL n'est retenu que s'il est inspecteur de ce POOL.
  const selectedInspector = inspectors.find((i) => i.id === requestedInspectorId) ?? null;
  const selectedReports = selectedInspector
    ? await prisma.report.findMany({
        where: {
          AND: [reportsOfAuthor(selectedInspector.id), reportsInScope(poolScope)],
          status: { key: { not: WORKFLOW_STATUS_KEYS.BROUILLON } },
        },
        orderBy: { updatedAt: "desc" },
        include: REPORT_SCOPE_INCLUDE,
      })
    : [];
  return {
    pool,
    schools,
    unassignedSchools,
    received: reports.length,
    buckets: countByBucket(
      reports.map((r) => r.status.key),
      POOL_EXPLOITATION_BUCKETS
    ),
    // Rapports de chaque inspecteur DANS ce POOL uniquement.
    inspectors: inspectors.map((i) => ({ ...i, reportCount: reports.filter((r) => authorOf(r) === i.id).length })),
    selectedInspector,
    selectedReports: selectedReports.map((r) => ({ id: r.id, title: reportScope(r).title, status: r.status.label })),
  };
}

// ─── Exploitation (exploitant de POOL, exploitant IPP, IPP adjoint) ────────

export async function loadExploitation(scope: DashboardScope, now = new Date()) {
  assertKind(scope, "exploitation_pool", "exploitation_provinciale");
  const buckets = scope.poolId ? POOL_EXPLOITATION_BUCKETS : PROVINCIAL_EXPLOITATION_BUCKETS;
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [pools, reports, myActions, oldestPending] = await Promise.all([
    poolsInScope(scope),
    receivedReports(scope),
    // Activité personnelle : changements de statut faits par ce compte, dans ce périmètre, sur 30 jours.
    prisma.reportStatusHistory.count({
      where: { changedById: scope.userId, createdAt: { gte: since }, report: reportsInScope(scope) },
    }),
    prisma.report.findMany({
      where: {
        AND: [reportsInScope(scope)],
        status: { key: { in: [WORKFLOW_STATUS_KEYS.SOUMIS, WORKFLOW_STATUS_KEYS.RECU] } },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 5,
      include: REPORT_SCOPE_INCLUDE,
    }),
  ]);
  return {
    buckets,
    received: reports.length,
    receivedLast30: reports.filter((r) => r.submittedAt && r.submittedAt >= since).length,
    counts: countByBucket(
      reports.map((r) => r.status.key),
      buckets
    ),
    myActions,
    byPool: pools.map((pool) => {
      const keys = reports.filter((r) => poolOf(r) === pool.id).map((r) => r.status.key);
      return { pool, received: keys.length, counts: countByBucket(keys, buckets) };
    }),
    oldestPending: oldestPending.map((r) => {
      const s = reportScope(r);
      return { id: r.id, title: s.title, author: s.authorName, status: r.status.label, submittedAt: r.submittedAt };
    }),
  };
}

// ─── Rapports de synthèse (exploitation et pilotage) ──────────────────────

/**
 * Compteurs de synthèses de la section : uniquement celles que le compte peut
 * lire (règle canRead de src/lib/synthese, via listSyntheses), limitées au
 * POOL de la section pour une vue de POOL.
 */
export async function loadSynthesisCounts(scope: DashboardScope, actor: SynthesisActor) {
  assertKind(scope, "pilotage_provincial", "exploitation_cellule", "exploitation_provinciale", "pilotage_pool", "exploitation_pool");
  if (actor.id !== scope.userId || actor.organizationId !== scope.organizationId) throw new Error("Acteur différent du périmètre.");
  // Vue de cellule : les synthèses de SA cellule ; vue de POOL : celles de SON POOL.
  const rows = (await listSyntheses(actor)).filter((s) =>
    scope.kind === "exploitation_cellule" ? s.cellId === scope.cellId : scope.poolId === null || s.poolId === scope.poolId
  );
  const mine = rows.filter((s) => s.authorId === actor.id);
  return {
    total: rows.filter((s) => s.status !== "BROUILLON").length,
    myDrafts: mine.filter((s) => s.status === "BROUILLON").length,
    myToFix: mine.filter((s) => s.status === "A_CORRIGER").length,
    submitted: rows.filter((s) => s.status === "SOUMIS").length,
    toFix: rows.filter((s) => s.status === "A_CORRIGER").length,
    // Synthèses de cellule validées par l'IPA et transmises à l'IPP, en attente de sa signature.
    toSign: rows.filter((s) => s.cellId && s.status === "VALIDE").length,
    // Abouties : validées (POOL) ou signées par l'IPP (cellule).
    validated: rows.filter((s) => (!s.cellId && s.status === "VALIDE") || s.status === "SIGNE").length,
  };
}

// ─── Cellule de l'IPP : exploitants et IPA (décisions du 2026-10-08) ──────

/**
 * Activité de SA cellule : rapports affectés par le secrétariat, exploités
 * (prêts pour une synthèse), synthèses de la cellule transmises à l'IPP et
 * signées. Aucun indicateur de l'IPP principal, aucun autre périmètre.
 */
export async function loadCellule(scope: DashboardScope, now = new Date()) {
  assertKind(scope, "exploitation_cellule");
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const where = reportsInScope(scope);
  const [cell, byStage, toSign, latest, myActions, cellSyntheses] = await Promise.all([
    prisma.cell.findFirst({ where: { id: scope.cellId!, organizationId: scope.organizationId }, select: { code: true, name: true, ipa: { select: { name: true } } } }),
    prisma.reportIppTrack.groupBy({ by: ["stage"], where: { report: where }, _count: { _all: true } }),
    prisma.report.findMany({
      where: { AND: [where, { ippTrack: { is: { stage: "EXPLOITE" } } }] },
      orderBy: { updatedAt: "asc" },
      take: 5,
      include: REPORT_SCOPE_INCLUDE,
    }),
    prisma.report.findMany({
      where: { AND: [where, { ippTrack: { is: { stage: "AFFECTE" } } }] },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: REPORT_SCOPE_INCLUDE,
    }),
    // Étapes de la branche IPP faites par ce compte dans sa cellule sur 30 jours.
    prisma.reportIppEvent.count({ where: { actorId: scope.userId, createdAt: { gte: since }, cellId: scope.cellId } }),
    // Synthèses collectives de la cellule (la validation et la signature portent sur elles).
    prisma.synthesis.groupBy({
      by: ["status"],
      where: { organizationId: scope.organizationId, cellId: scope.cellId!, isDemo: scope.isDemo },
      _count: { _all: true },
    }),
  ]);
  const synth = (k: string) => cellSyntheses.find((s) => s.status === k)?._count._all ?? 0;
  const stage = (k: string) => byStage.find((s) => s.stage === k)?._count._all ?? 0;
  const brief = (r: (typeof latest)[number]) => ({ id: r.id, title: reportScope(r).title, author: reportScope(r).authorName });
  return {
    cell,
    affected: stage("AFFECTE"),
    exploited: stage("EXPLOITE"),
    synthesesToValidate: synth("SOUMIS"),
    transmitted: synth("VALIDE"),
    signed: synth("SIGNE"),
    myActions,
    exploitedList: toSign.map(brief),
    latestAffected: latest.map(brief),
  };
}

// ─── Secrétaire de l'IPP : rapports arrivés, envois aux cellules ──────────

export async function loadSecretariat(scope: DashboardScope) {
  assertKind(scope, "secretariat_ipp");
  const where = reportsInScope(scope);
  const [waiting, legacy, byCell, cells] = await Promise.all([
    prisma.reportIppTrack.count({ where: { stage: "AU_SECRETARIAT", report: where } }),
    prisma.reportIppTrack.count({ where: { stage: "AU_SECRETARIAT", legacy: true, report: where } }),
    prisma.reportIppTrack.groupBy({ by: ["cellId"], where: { cellId: { not: null }, stage: { in: ["AFFECTE", "EXPLOITE"] }, report: where }, _count: { _all: true } }),
    prisma.cell.findMany({ where: { organizationId: scope.organizationId, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return {
    waiting,
    legacy,
    activeCells: cells.length,
    byCell: cells.map((c) => ({ ...c, inProgress: byCell.find((b) => b.cellId === c.id)?._count._all ?? 0 })),
  };
}

// ─── Secrétaire de POOL : écoles ──────────────────────────────────────────

export async function loadEcolesPool(scope: DashboardScope) {
  assertKind(scope, "ecoles_pool");
  const poolId = scope.poolId!;
  const [pool, active, inactive, unassigned] = await Promise.all([
    prisma.pool.findFirst({ where: { id: poolId, organizationId: scope.organizationId }, select: { id: true, name: true } }),
    prisma.school.count({ where: { poolId, active: true } }),
    prisma.school.count({ where: { poolId, active: false } }),
    prisma.school.findMany({
      where: { poolId, active: true, assignments: { none: { active: true } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!pool) return null;
  return { pool, active, inactive, unassigned };
}

// ─── Inspecteur itinérant : uniquement ses propres données ─────────────────

export async function loadItinerant(scope: DashboardScope, now = new Date()) {
  assertKind(scope, "itinerant");
  const me = scope.userId;
  const [assignments, inspections, reports, statuses, recentComments] = await Promise.all([
    // Même règle que la création d'une inspection (inspections/actions.ts) : affectation active.
    prisma.assignment.findMany({
      where: { inspectorId: me, active: true, school: { pool: { organizationId: scope.organizationId } } },
      include: { school: { select: { name: true, pool: { select: { name: true } } } } },
      orderBy: { school: { name: "asc" } },
    }),
    // Historique conservé après un changement d'affectation : filtre par inspecteur, pas par affectation.
    prisma.inspection.findMany({
      where: { inspectorId: me },
      select: { id: true, status: true, scheduledDate: true, school: { select: { name: true } } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.report.findMany({
      where: reportsOfAuthor(me),
      include: {
        ...REPORT_SCOPE_INCLUDE,
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1, select: { comment: true, createdAt: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.workflowStatus.findMany({ orderBy: { order: "asc" }, select: { key: true, label: true } }),
    // Retours écrits par d'autres comptes sur SES rapports.
    prisma.comment.findMany({
      where: { authorId: { not: me }, report: reportsOfAuthor(me) },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, content: true, createdAt: true, reportId: true, author: { select: { name: true } } },
    }),
  ]);
  return {
    assignments: assignments.map((a) => ({
      id: a.id,
      schoolName: a.school.name,
      poolName: a.school.pool.name,
      effectiveFrom: a.effectiveFrom,
      upcoming: a.effectiveFrom > now,
    })),
    realized: inspections.filter((i) => (REALIZED_INSPECTION_STATUSES as readonly string[]).includes(i.status)).length,
    inProgress: inspections.filter((i) => i.status === "EN_COURS").length,
    // Seule programmation enregistrée aujourd'hui : les inspections créées « planifiées » (date prévue facultative).
    planned: inspections
      .filter((i) => i.status === "PLANIFIEE")
      .map((i) => ({ id: i.id, schoolName: i.school.name, scheduledDate: i.scheduledDate })),
    reportCount: reports.length,
    reportsByStatus: statuses
      .map((s) => ({ ...s, count: reports.filter((r) => r.status.key === s.key).length }))
      .filter((s) => s.count > 0),
    corrections: reports
      .filter((r) => r.status.key === WORKFLOW_STATUS_KEYS.A_CORRIGER)
      .map((r) => ({ id: r.id, title: reportScope(r).title, comment: r.statusHistory[0]?.comment ?? null })),
    recentComments,
  };
}

// ─── Informaticien : administration de la plateforme ───────────────────────

export async function loadAdministration(scope: DashboardScope) {
  assertKind(scope, "administration");
  const org = scope.organizationId;
  const [pendingRequests, usersByStatus, activePools] = await Promise.all([
    prisma.accountRequest.count({ where: { organizationId: org, status: "PENDING" } }),
    prisma.user.groupBy({ by: ["status"], where: { organizationId: org, isDemo: false }, _count: { _all: true } }),
    prisma.pool.count({ where: { organizationId: org, active: true } }),
  ]);
  const byStatus: Record<string, number> = Object.fromEntries(usersByStatus.map((u) => [u.status, u._count._all]));
  return {
    pendingRequests,
    activeUsers: byStatus.ACTIVE ?? 0,
    pendingActivation: byStatus.PENDING ?? 0,
    suspended: (byStatus.SUSPENDED ?? 0) + (byStatus.DISABLED ?? 0),
    activePools,
  };
}

// ─── Chargé des médias : ses contenus ──────────────────────────────────────

export async function loadContenus(scope: DashboardScope) {
  assertKind(scope, "contenus");
  const mine = { organizationId: scope.organizationId, authorId: scope.userId };
  const [byStatus, toFix] = await Promise.all([
    prisma.content.groupBy({ by: ["status"], where: mine, _count: { _all: true } }),
    prisma.content.findMany({
      where: { ...mine, status: "A_CORRIGER" },
      orderBy: { reviewedAt: "desc" },
      take: 5,
      select: { id: true, title: true, reviewNote: true },
    }),
  ]);
  const counts: Record<string, number> = Object.fromEntries(byStatus.map((c) => [c.status, c._count._all]));
  return { counts, toFix };
}
