// Rapport de synthèse : opérations en base. Chaque fonction reçoit l'acteur
// construit côté serveur (loadActor : session relue en base) et applique les
// règles de rules.ts AVANT toute écriture. Toute étape est tracée : historique
// des statuts (SynthesisStatusHistory) et journal d'audit.

import { Prisma, type SynthesisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess, requireOfficialActorUnlessDemoTarget, usersHoldingPermission } from "@/lib/permissions";
import { notify } from "@/lib/notifications/dispatcher";
import { PERMISSIONS } from "@/lib/rbac-data";
import { REPORT_SCOPE_INCLUDE, reportScope, reportsOfOrganization, reportsOfPool, type ReportWithScope } from "@/lib/fiches/report-scope";
import type { ViewMode } from "@/lib/view-mode";
import { CURRENT_FORMAT_VERSION, missingSections, readContent, sanitizeContent } from "@/lib/synthese/format";
import {
  EXPLOITED_REPORT_STATUSES,
  SYNTHESIS_STATUS_LABELS,
  SYNTHESIS_VALIDATOR_ROLE_KEYS,
  auditActionFor,
  canAuthorIn,
  canEdit,
  canIncludeReport,
  canRead,
  findTransition,
  formatSynthesisNumber,
  numberScopeCode,
  synthesisReference,
  type Actor,
  type SynthesisMeta,
  type SynthesisStatusKey,
} from "@/lib/synthese/rules";

export type SynthesisActor = Actor & { isDemo: boolean };

/** Acteur relu en base : compte actif, fonctions et permissions effectives (mode « Voir comme » compris). */
export async function loadActor(userId: string, opts?: { viewMode?: ViewMode | null }): Promise<SynthesisActor> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, isDemo: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new ForbiddenError("Compte inactif.");
  const { roles, permissions } = await loadUserAccess(userId, opts);
  return { id: userId, organizationId: user.organizationId, isDemo: user.isDemo, roles, permissions };
}

function meta(s: { authorId: string; organizationId: string; poolId: string | null; status: SynthesisStatus }): SynthesisMeta {
  return { authorId: s.authorId, organizationId: s.organizationId, poolId: s.poolId, status: s.status as SynthesisStatusKey };
}

// ─── Informations reprises des rapports d'origine ─────────────────────────

export type SourceSnapshot = {
  reportId: string;
  title: string;
  code: string | null;
  number: string | null;
  schoolName: string | null;
  poolName: string | null;
  authorName: string;
  statusKey: string;
  statusLabel: string;
  submittedAt: string | null;
  /** Date de la visite (inspection terminée ou prévue), si le rapport en a une. */
  inspectionDate: string | null;
};

export function snapshotOf(r: ReportWithScope): SourceSnapshot {
  const s = reportScope(r);
  const inspection = r.inspection ?? r.form?.inspection ?? null;
  const pool = inspection?.school.pool ?? r.form?.pool ?? null;
  return {
    reportId: r.id,
    title: s.title,
    code: s.code,
    number: s.number,
    schoolName: s.schoolName,
    poolName: pool?.name ?? null,
    authorName: s.authorName,
    statusKey: r.status.key,
    statusLabel: r.status.label,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    inspectionDate: (inspection?.completedAt ?? inspection?.scheduledDate)?.toISOString() ?? null,
  };
}

function includeCheck(actor: SynthesisActor, s: { organizationId: string; poolId: string | null; isDemo: boolean }, r: ReportWithScope) {
  const sc = reportScope(r);
  return canIncludeReport(actor, s, { poolId: sc.poolId, organizationId: sc.organizationId, statusKey: r.status.key, isDemo: sc.isDemo });
}

/** Rapports que l'acteur peut inclure dans une synthèse de ce périmètre. */
export async function eligibleReports(actor: SynthesisActor, target: { poolId: string | null }) {
  if (!canAuthorIn(actor, target.poolId, actor.organizationId)) throw new ForbiddenError();
  const reports = await prisma.report.findMany({
    where: {
      AND: [target.poolId ? reportsOfPool(target.poolId) : reportsOfOrganization(actor.organizationId)],
      status: { key: { in: [...EXPLOITED_REPORT_STATUSES] } },
    },
    include: REPORT_SCOPE_INCLUDE,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });
  const s = { organizationId: actor.organizationId, poolId: target.poolId, isDemo: actor.isDemo };
  return reports.filter((r) => includeCheck(actor, s, r));
}

/** Charge et contrôle les rapports demandés : tous doivent être admissibles, sinon rien n'est écrit. */
async function checkedReports(actor: SynthesisActor, s: { organizationId: string; poolId: string | null; isDemo: boolean }, reportIds: string[]) {
  const ids = [...new Set(reportIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) throw new ForbiddenError("Choisissez au moins un rapport d'inspection.");
  if (ids.length > 200) throw new ForbiddenError("Trop de rapports pour une seule synthèse (200 au plus).");
  const reports = await prisma.report.findMany({ where: { id: { in: ids } }, include: REPORT_SCOPE_INCLUDE });
  if (reports.length !== ids.length || !reports.every((r) => includeCheck(actor, s, r))) {
    throw new ForbiddenError("Un des rapports choisis est introuvable ou hors de votre périmètre.");
  }
  return reports;
}

// ─── Création et modification (auteur) ────────────────────────────────────

export async function createSynthesis(
  actor: SynthesisActor,
  input: { title: string; poolId: string | null; reportIds: string[]; periodFrom?: Date | null; periodTo?: Date | null }
): Promise<string> {
  const title = input.title.trim().slice(0, 200);
  if (title.length < 3) throw new ForbiddenError("Donnez un titre à la synthèse (3 caractères au moins).");
  if (!canAuthorIn(actor, input.poolId, actor.organizationId)) throw new ForbiddenError("Vous ne pouvez pas rédiger de synthèse pour ce périmètre.");
  if (input.poolId) {
    const pool = await prisma.pool.findFirst({ where: { id: input.poolId, organizationId: actor.organizationId, active: true } });
    if (!pool) throw new ForbiddenError("POOL introuvable.");
  }
  const scope = { organizationId: actor.organizationId, poolId: input.poolId, isDemo: actor.isDemo };
  const reports = await checkedReports(actor, scope, input.reportIds);

  const synthesis = await prisma.$transaction(async (tx) => {
    const created = await tx.synthesis.create({
      data: {
        organizationId: actor.organizationId,
        poolId: input.poolId,
        authorId: actor.id,
        isDemo: actor.isDemo,
        title,
        periodFrom: input.periodFrom ?? null,
        periodTo: input.periodTo ?? null,
        formatVersion: CURRENT_FORMAT_VERSION,
        content: sanitizeContent(CURRENT_FORMAT_VERSION, {}),
        sources: { create: reports.map((r) => ({ reportId: r.id, snapshot: snapshotOf(r) as unknown as Prisma.InputJsonValue })) },
      },
    });
    await tx.synthesisStatusHistory.create({ data: { synthesisId: created.id, toStatus: "BROUILLON", changedById: actor.id } });
    return created;
  });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "synthesis.create",
    entityType: "Synthesis",
    entityId: synthesis.id,
    newValue: { title, poolId: input.poolId, reportIds: reports.map((r) => r.id) },
  });
  return synthesis.id;
}

async function editableSynthesis(actor: SynthesisActor, id: string) {
  const s = await prisma.synthesis.findUnique({ where: { id } });
  if (!s || !canRead(actor, meta(s))) throw new ForbiddenError("Synthèse introuvable.");
  if (!canEdit(actor, meta(s))) throw new ForbiddenError("Seul l'auteur modifie sa synthèse, en brouillon ou renvoyée pour correction.");
  return s;
}

export async function updateSynthesis(
  actor: SynthesisActor,
  id: string,
  input: { title: string; periodFrom?: Date | null; periodTo?: Date | null; sections: Record<string, unknown> }
) {
  const s = await editableSynthesis(actor, id);
  const title = input.title.trim().slice(0, 200);
  if (title.length < 3) throw new ForbiddenError("Donnez un titre à la synthèse (3 caractères au moins).");
  const content = sanitizeContent(s.formatVersion, input.sections);
  await prisma.synthesis.update({
    where: { id },
    data: { title, periodFrom: input.periodFrom ?? null, periodTo: input.periodTo ?? null, content },
  });
  await logAudit({
    actorId: actor.id,
    organizationId: s.organizationId,
    action: "synthesis.update",
    entityType: "Synthesis",
    entityId: id,
    metadata: { status: s.status },
  });
}

/** Remplace la liste des rapports retenus (contrôle de chaque rapport) et actualise les informations reprises. */
export async function setSynthesisSources(actor: SynthesisActor, id: string, reportIds: string[]) {
  const s = await editableSynthesis(actor, id);
  const reports = await checkedReports(actor, s, reportIds);
  const before = await prisma.synthesisSource.findMany({ where: { synthesisId: id }, select: { reportId: true } });
  const keep = new Set(reports.map((r) => r.id));
  const removed = before.filter((b) => !keep.has(b.reportId)).map((b) => b.reportId);
  const added = reports.filter((r) => !before.some((b) => b.reportId === r.id)).map((r) => r.id);
  await prisma.$transaction([
    prisma.synthesisSource.deleteMany({ where: { synthesisId: id, reportId: { in: removed } } }),
    ...reports.map((r) =>
      prisma.synthesisSource.upsert({
        where: { synthesisId_reportId: { synthesisId: id, reportId: r.id } },
        create: { synthesisId: id, reportId: r.id, snapshot: snapshotOf(r) as unknown as Prisma.InputJsonValue },
        update: { snapshot: snapshotOf(r) as unknown as Prisma.InputJsonValue },
      })
    ),
  ]);
  await logAudit({
    actorId: actor.id,
    organizationId: s.organizationId,
    action: "synthesis.sources_change",
    entityType: "Synthesis",
    entityId: id,
    newValue: { added, removed },
  });
}

// ─── Circuit ──────────────────────────────────────────────────────────────

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function transitionSynthesis(actor: SynthesisActor, id: string, toStatus: SynthesisStatusKey, comment?: string | null) {
  const s = await prisma.synthesis.findUnique({ where: { id }, include: { pool: true } });
  if (!s || !canRead(actor, meta(s))) throw new ForbiddenError("Synthèse introuvable.");
  const from = s.status as SynthesisStatusKey;
  const transition = findTransition(from, toStatus);
  if (!transition) throw new ForbiddenError("Transition non autorisée depuis ce statut.");
  if (!transition.allowed(actor, meta(s))) throw new ForbiddenError("Vous n'êtes pas habilité à faire cette étape.");
  const note = (comment ?? "").trim().slice(0, 2000) || null;
  if (transition.commentRequired && !note) throw new ForbiddenError("Indiquez le motif du renvoi pour correction.");
  // Une synthèse réelle n'avance que par un compte officiel.
  await requireOfficialActorUnlessDemoTarget(actor.id, s.isDemo);

  const now = new Date();
  let version = s.version;
  let number = s.number;

  if (toStatus === "SOUMIS") {
    const content = readContent(s.content);
    const missing = missingSections(s.formatVersion, content);
    if (missing.length) throw new ForbiddenError(`Sections à remplir avant la soumission : ${missing.map((m) => m.title).join(", ")}.`);
    const sources = await prisma.synthesisSource.findMany({
      where: { synthesisId: id },
      include: { report: { include: REPORT_SCOPE_INCLUDE } },
      orderBy: { addedAt: "asc" },
    });
    if (sources.length === 0) throw new ForbiddenError("La synthèse doit reposer sur au moins un rapport d'inspection.");
    const snapshots = sources.map((src) => snapshotOf(src.report));
    version = s.version + 1;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        number = await prisma.$transaction(async (tx) => {
          let numbering = {};
          let assigned = s.number;
          if (!s.number) {
            const scope = numberScopeCode(s.pool?.code ?? null);
            const year = now.getFullYear();
            const max = await tx.synthesis.aggregate({
              where: { organizationId: s.organizationId, numberScope: scope, numberYear: year },
              _max: { numberSeq: true },
            });
            const seq = (max._max.numberSeq ?? 0) + 1;
            assigned = formatSynthesisNumber({ scope, seq, year });
            numbering = { number: assigned, numberScope: scope, numberYear: year, numberSeq: seq };
          }
          await tx.synthesis.update({ where: { id }, data: { status: "SOUMIS", version, submittedAt: now, ...numbering } });
          for (const snap of snapshots) {
            await tx.synthesisSource.update({
              where: { synthesisId_reportId: { synthesisId: id, reportId: snap.reportId } },
              data: { snapshot: snap as unknown as Prisma.InputJsonValue },
            });
          }
          await tx.synthesisVersion.create({
            data: {
              synthesisId: id,
              number: version,
              title: s.title,
              content: content as unknown as Prisma.InputJsonValue,
              sources: snapshots as unknown as Prisma.InputJsonValue,
              submittedById: actor.id,
            },
          });
          await tx.synthesisStatusHistory.create({
            data: { synthesisId: id, fromStatus: from, toStatus, changedById: actor.id, comment: note, version },
          });
          return assigned;
        });
        break;
      } catch (e) {
        // Numéro pris par une soumission simultanée : nouvel essai.
        if (isUniqueViolation(e) && attempt < 2) continue;
        throw e;
      }
    }
  } else {
    await prisma.$transaction([
      prisma.synthesis.update({
        where: { id },
        data: { status: toStatus, ...(toStatus === "VALIDE" ? { validatedAt: now } : {}) },
      }),
      prisma.synthesisStatusHistory.create({
        data: { synthesisId: id, fromStatus: from, toStatus, changedById: actor.id, comment: note, version },
      }),
    ]);
  }

  const reference = synthesisReference(number, version);
  await logAudit({
    actorId: actor.id,
    organizationId: s.organizationId,
    action: auditActionFor(from, toStatus),
    entityType: "Synthesis",
    entityId: id,
    oldValue: { status: from },
    newValue: { status: toStatus, number, version },
    metadata: note ? { comment: note } : undefined,
  });

  // Notifications : à la soumission, le niveau provincial ; ensuite, l'auteur.
  const label = `${s.title}${reference ? ` (${reference})` : ""}`;
  if (toStatus === "SOUMIS") {
    const reviewers = await provincialReviewers(s, actor.id);
    await Promise.all(
      reviewers.map((userId) =>
        notify({
          userId,
          event: "synthesis.submitted",
          title: `Synthèse à examiner — ${label}`,
          body: from === "A_CORRIGER" ? "Une synthèse corrigée a été resoumise." : "Un rapport de synthèse a été soumis.",
          data: { synthesisId: id },
        })
      )
    );
  } else if (s.authorId !== actor.id) {
    await notify({
      userId: s.authorId,
      event: toStatus === "A_CORRIGER" ? "synthesis.needs_correction" : "synthesis.status_changed",
      title: toStatus === "A_CORRIGER" ? `Correction demandée — ${label}` : `Synthèse validée — ${label}`,
      body: note ?? `Statut : ${SYNTHESIS_STATUS_LABELS[toStatus]}.`,
      data: { synthesisId: id },
    });
  }
  return { status: toStatus, number, version };
}

/** Qui reçoit une synthèse soumise : niveau provincial (POOL) ou IPP, IPA et Super Admin (provinciale). Jamais l'auteur. */
async function provincialReviewers(s: { organizationId: string; poolId: string | null; isDemo: boolean }, authorId: string) {
  const validators = await prisma.user.findMany({
    where: {
      organizationId: s.organizationId,
      status: "ACTIVE",
      isDemo: s.isDemo,
      id: { not: authorId },
      roles: { some: { role: { key: { in: [...SYNTHESIS_VALIDATOR_ROLE_KEYS] } } } },
    },
    select: { id: true },
  });
  const ids = new Set(validators.map((v) => v.id));
  if (s.poolId) {
    const holders = await usersHoldingPermission({
      permissionKey: PERMISSIONS.REPORTS_REVIEW_PROVINCE,
      organizationId: s.organizationId,
      poolId: s.poolId,
      where: { isDemo: s.isDemo, excludeUserId: authorId },
    });
    holders.forEach((h) => ids.add(h));
  }
  return [...ids];
}

// ─── Lecture ──────────────────────────────────────────────────────────────

/** Synthèses visibles par l'acteur (contrôle canRead sur chacune). */
export async function listSyntheses(actor: SynthesisActor) {
  const rows = await prisma.synthesis.findMany({
    where: { organizationId: actor.organizationId, OR: [{ authorId: actor.id }, { status: { not: "BROUILLON" } }] },
    include: { pool: { select: { name: true } }, author: { select: { name: true } }, _count: { select: { sources: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.filter((s) => canRead(actor, meta(s))).map((s) => ({ ...s, reference: synthesisReference(s.number, s.version) }));
}

export async function getSynthesis(actor: SynthesisActor, id: string) {
  const s = await prisma.synthesis.findUnique({
    where: { id },
    include: {
      pool: { select: { id: true, name: true, code: true } },
      author: { select: { id: true, name: true } },
      sources: { orderBy: { addedAt: "asc" }, include: { report: { select: { id: true, status: { select: { key: true, label: true } } } } } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      versions: { orderBy: { number: "asc" }, include: { submittedBy: { select: { name: true } } } },
    },
  });
  if (!s || !canRead(actor, meta(s))) return null;
  return { ...s, meta: meta(s), parsedContent: readContent(s.content), reference: synthesisReference(s.number, s.version) };
}

/** Synthèses (lisibles par l'acteur) qui reprennent ce rapport d'inspection. */
export async function synthesesIncludingReport(actor: SynthesisActor, reportId: string) {
  const rows = await prisma.synthesisSource.findMany({ where: { reportId }, include: { synthesis: true }, orderBy: { addedAt: "asc" } });
  return rows
    .map((r) => r.synthesis)
    .filter((s) => canRead(actor, meta(s)))
    .map((s) => ({ id: s.id, title: s.title, status: s.status as SynthesisStatusKey, reference: synthesisReference(s.number, s.version) }));
}
