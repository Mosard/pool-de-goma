// Branche IPP des rapports, côté serveur (docs/exploitants-ipp-cellules.md § 6) :
// arrivée au secrétariat dès la soumission, envoi à une cellule, réaffectation,
// fin d'exploitation et réouverture. La validation (IPA) et la signature (IPP)
// portent sur la synthèse collective (src/lib/synthese). Chaque étape est
// contrôlée sur les droits RELUS EN BASE (loadUserAccess), tracée
// (ReportIppEvent : rapport, auteur, date, cellule) et auditée.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, loadUserAccess, requireOfficialActorUnlessDemoTarget, usersHoldingPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications/dispatcher";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { REPORT_SCOPE_INCLUDE, reportScope, reportTrack } from "@/lib/fiches/report-scope";
import {
  IPP_STAGE_LABELS,
  TRACK_ACTIONS,
  canActOnTrack,
  canReadReport,
  withSynthesisFlags,
  type CellActor,
  type IppTrackInfo,
  type TrackAction,
} from "@/lib/cells/rules";

/**
 * Acteur relu en base (rôles et permissions effectifs, « Voir comme » compris).
 * `real` : droits réels, sans le mode simulé de la requête en cours — pour
 * juger un AUTRE compte (destinataire d'une notification).
 */
export async function loadCellActor(userId: string, opts: { real?: boolean } = {}): Promise<CellActor> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user) throw new ForbiddenError();
  const { roles, permissions } = await loadUserAccess(userId, opts.real ? { viewMode: null } : undefined);
  return { id: userId, organizationId: user.organizationId, roles, permissions };
}

/**
 * Branche IPP d'un rapport, avec ce qu'en disent les synthèses qui le citent
 * (`sources` : Report.synthesisSources chargé avec SYNTHESIS_LINKS_SELECT).
 */
export function trackInfo(
  t: { stage: string; cellId: string | null; legacy: boolean; organizationId: string } | null | undefined,
  sources: readonly { synthesis: { status: string; cellId: string | null } }[] | null | undefined
): IppTrackInfo | null {
  const base = t ? { stage: t.stage as IppTrackInfo["stage"], cellId: t.cellId, legacy: t.legacy, organizationId: t.organizationId } : null;
  return withSynthesisFlags(base, sources);
}

/** Lecture d'un rapport par l'acteur (règle centrale), relue en base. */
export async function canActorReadReport(actor: CellActor, reportId: string): Promise<boolean> {
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: REPORT_SCOPE_INCLUDE });
  if (!report) return false;
  return canReadReport(actor, reportScope(report), reportTrack(report));
}

/**
 * Arrivée au secrétariat de l'IPP, dans la transaction de la soumission
 * (décision D1 : pas de réceptionniste). Sans effet si la branche existe déjà
 * (resoumission après correction au POOL : la branche IPP continue).
 */
export async function openIppTrack(tx: Prisma.TransactionClient, p: { reportId: string; organizationId: string; actorId: string }) {
  const existing = await tx.reportIppTrack.findUnique({ where: { reportId: p.reportId } });
  if (existing) return existing;
  const track = await tx.reportIppTrack.create({ data: { reportId: p.reportId, organizationId: p.organizationId } });
  await tx.reportIppEvent.create({
    data: { reportId: p.reportId, toStage: "AU_SECRETARIAT", actorId: p.actorId, comment: "Arrivée au secrétariat à la soumission." },
  });
  return track;
}

/** Comptes à prévenir dans une cellule : ses exploitants (fonction rattachée) et son IPA. */
async function cellMembers(cellId: string, opts: { exploitants: boolean; ipa: boolean }): Promise<string[]> {
  const cell = await prisma.cell.findUnique({
    where: { id: cellId },
    select: {
      ipa: { select: { id: true, status: true } },
      userRoles: { where: { role: { key: ROLE_KEYS.EXPLOITANT_IPP } }, select: { user: { select: { id: true, status: true } } } },
    },
  });
  if (!cell) return [];
  const ids = new Set<string>();
  if (opts.exploitants) for (const ur of cell.userRoles) if (ur.user.status === "ACTIVE") ids.add(ur.user.id);
  if (opts.ipa && cell.ipa?.status === "ACTIVE") ids.add(cell.ipa.id);
  return [...ids];
}

/** Secrétaires de l'IPP (et tout détenteur effectif de reports.route_ipp). */
export async function secretariatHolders(organizationId: string, isDemo: boolean): Promise<string[]> {
  return usersHoldingPermission({ permissionKey: PERMISSIONS.REPORTS_ROUTE_IPP, organizationId, where: { isDemo } });
}

export type TrackActionInput = { action: TrackAction; cellId?: string | null; comment?: string | null };

/**
 * Étape de la branche IPP. Toutes les vérifications sont faites ici, côté
 * serveur : droit de l'acteur (règle canActOnTrack), stade courant, cellule
 * destinataire active de la même organisation, motif obligatoire pour une
 * réaffectation ou un renvoi, démonstration jamais mêlée au réel.
 */
export async function applyTrackAction(actorId: string, reportId: string, input: TrackActionInput) {
  const actor = await loadCellActor(actorId);
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: REPORT_SCOPE_INCLUDE });
  if (!report?.ippTrack) throw new ForbiddenError("Rapport introuvable dans le circuit de l'IPP.");
  const scope = reportScope(report);
  const track = reportTrack(report)!;
  if (track.locked && input.action !== "assign") {
    throw new ForbiddenError("Ce rapport fait partie d'une synthèse soumise, validée ou signée : il ne change plus de cellule ni d'état.");
  }
  const rule = TRACK_ACTIONS[input.action];
  if (!rule || !canActOnTrack(actor, track, input.action)) throw new ForbiddenError("Étape non autorisée pour votre fonction ou pour ce stade.");
  await requireOfficialActorUnlessDemoTarget(actorId, scope.isDemo);

  const comment = input.comment?.trim().slice(0, 2000) || null;
  if (rule.commentRequired && !comment) throw new ForbiddenError("Le motif est obligatoire pour cette étape.");

  let cellId = track.cellId;
  if (input.action === "assign" || input.action === "reassign") {
    if (!input.cellId) throw new ForbiddenError("Choisissez la cellule destinataire.");
    const cell = await prisma.cell.findFirst({ where: { id: input.cellId, organizationId: track.organizationId, active: true } });
    if (!cell) throw new ForbiddenError("Cellule introuvable ou archivée.");
    if (input.action === "reassign" && cell.id === track.cellId) throw new ForbiddenError("Le rapport est déjà dans cette cellule.");
    cellId = cell.id;
  }

  const now = new Date();
  const data: Prisma.ReportIppTrackUncheckedUpdateManyInput = { stage: rule.to, updatedAt: now };
  if (input.action === "assign" || input.action === "reassign") Object.assign(data, { cellId, assignedAt: now, exploitedAt: null });
  if (input.action === "exploit") data.exploitedAt = now;
  if (input.action === "return") data.exploitedAt = null;

  await prisma.$transaction(async (tx) => {
    // Garde contre une action concurrente : le stade et la cellule n'ont pas changé depuis la lecture.
    const updated = await tx.reportIppTrack.updateMany({ where: { id: report.ippTrack!.id, stage: track.stage, cellId: track.cellId }, data });
    if (updated.count !== 1) throw new ForbiddenError("Le rapport a changé entre-temps : rechargez la page.");
    await tx.reportIppEvent.create({
      data: {
        reportId,
        fromStage: track.stage,
        toStage: rule.to,
        fromCellId: input.action === "reassign" ? track.cellId : null,
        cellId,
        actorId,
        comment,
      },
    });
  });

  await logAudit({
    actorId,
    organizationId: track.organizationId,
    action: rule.audit,
    entityType: "Report",
    entityId: reportId,
    oldValue: { stage: track.stage, cellId: track.cellId },
    newValue: { stage: rule.to, cellId },
    metadata: comment ? { comment } : undefined,
  });

  // Notifications limitées à la cellule concernée (jamais à toute la province).
  const title = `${scope.title} — ${IPP_STAGE_LABELS[rule.to]}`;
  let recipients: string[] = [];
  if (["assign", "reassign", "return"].includes(input.action)) recipients = await cellMembers(cellId!, { exploitants: true, ipa: true });
  if (input.action === "exploit") recipients = await cellMembers(cellId!, { exploitants: false, ipa: true });
  for (const userId of recipients) {
    if (userId === actorId) continue;
    await notify({ userId, event: rule.audit, title, body: comment ?? rule.label, data: { reportId } });
  }
  return rule.to;
}

/** Cellules actives de l'organisation (choix du secrétariat). */
export async function activeCells(organizationId: string) {
  return prisma.cell.findMany({
    where: { organizationId, active: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, ipa: { select: { name: true } } },
  });
}

/** Historique de la branche IPP d'un rapport, du plus ancien au plus récent. */
export async function ippHistory(reportId: string) {
  return prisma.reportIppEvent.findMany({
    where: { reportId },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true } }, cell: { select: { code: true } }, fromCell: { select: { code: true } } },
  });
}
