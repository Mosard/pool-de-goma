import { prisma } from "@/lib/prisma";
import { PERMISSIONS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { hasPermission, ForbiddenError, requireOfficialActorUnlessDemoTarget, type SessionPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { notify, notifyUsersWithPermission } from "@/lib/notifications/dispatcher";
import { REPORT_SCOPE_INCLUDE, reportScope } from "@/lib/fiches/report-scope";

export async function getWorkflowStatusByKey(key: string) {
  return prisma.workflowStatus.findUniqueOrThrow({ where: { key } });
}

/** Transitions possibles depuis le statut courant d'un rapport, filtrées par les permissions de l'acteur. */
export async function getAvailableTransitions(
  reportId: string,
  permissions: SessionPermission[],
  poolId: string | null,
  organizationId: string | null
) {
  const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId }, select: { statusId: true } });
  const transitions = await prisma.workflowTransition.findMany({
    where: { fromStatusId: report.statusId },
    include: { toStatus: true },
    orderBy: { toStatus: { order: "asc" } },
  });
  return transitions.filter((t) => hasPermission(permissions, t.allowedPermissionKey, { poolId, organizationId }));
}

// Qui prévenir lorsqu'un rapport atteint un statut donné (le palier suivant
// du circuit décrit au §12). A_CORRIGER n'est pas ici : on notifie
// directement l'inspecteur concerné, pas tout un palier.
const NEXT_ACTOR_PERMISSION: Partial<Record<string, string>> = {
  [WORKFLOW_STATUS_KEYS.SOUMIS]: PERMISSIONS.REPORTS_REVIEW_POOL,
  [WORKFLOW_STATUS_KEYS.RECU]: PERMISSIONS.REPORTS_REVIEW_POOL,
  [WORKFLOW_STATUS_KEYS.TRANSMIS]: PERMISSIONS.REPORTS_REVIEW_PROVINCE,
  [WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION]: PERMISSIONS.REPORTS_VALIDATE,
};

export async function applyTransition(params: {
  reportId: string;
  toStatusKey: string;
  actorId: string;
  actorPermissions: SessionPermission[];
  actorPoolId: string | null;
  actorOrganizationId: string;
  comment?: string;
}) {
  const report = await prisma.report.findUnique({ where: { id: params.reportId }, include: REPORT_SCOPE_INCLUDE });
  if (!report) throw new Error("Rapport introuvable.");
  const scope = reportScope(report);

  const toStatus = await prisma.workflowStatus.findUnique({ where: { key: params.toStatusKey } });
  if (!toStatus) throw new Error("Statut cible inconnu.");

  const transition = await prisma.workflowTransition.findUnique({
    where: { fromStatusId_toStatusId: { fromStatusId: report.statusId, toStatusId: toStatus.id } },
  });
  if (!transition) throw new Error("Transition non autorisée depuis ce statut.");

  const reportPoolId = scope.poolId;
  const reportOrganizationId = scope.organizationId;
  if (
    !reportOrganizationId ||
    !hasPermission(params.actorPermissions, transition.allowedPermissionKey, {
      poolId: reportPoolId,
      organizationId: reportOrganizationId,
    })
  ) {
    throw new ForbiddenError();
  }
  // Resoumettre (droit de l'inspecteur) : seulement l'auteur du rapport, pas
  // un autre inspecteur du même POOL.
  if (transition.allowedPermissionKey === PERMISSIONS.INSPECTIONS_CONDUCT && scope.authorId !== params.actorId) {
    throw new ForbiddenError("Seul l'auteur du rapport peut le resoumettre.");
  }
  // Un rapport sur une école réelle ne se fait avancer que par un compte officiel.
  await requireOfficialActorUnlessDemoTarget(params.actorId, scope.isDemo);

  await prisma.report.update({
    where: { id: params.reportId },
    data: {
      statusId: toStatus.id,
      validatedAt: toStatus.key === WORKFLOW_STATUS_KEYS.VALIDE ? new Date() : report.validatedAt,
      ...(toStatus.key === WORKFLOW_STATUS_KEYS.SOUMIS ? { submittedAt: new Date() } : {}),
    },
  });

  await prisma.reportStatusHistory.create({
    data: {
      reportId: report.id,
      fromStatusId: report.statusId,
      toStatusId: toStatus.id,
      changedById: params.actorId,
      comment: params.comment,
    },
  });

  if (report.form) {
    if (report.form.inspectionId) await refreshInspectionStatus(report.form.inspectionId);
  } else if (toStatus.key === WORKFLOW_STATUS_KEYS.VALIDE && report.inspectionId) {
    await prisma.inspection.update({ where: { id: report.inspectionId }, data: { status: "VALIDEE" } });
  }

  await logAudit({
    actorId: params.actorId,
    organizationId: params.actorOrganizationId,
    action: "report.transition",
    entityType: "Report",
    entityId: report.id,
    oldValue: { status: report.status.key },
    newValue: { status: toStatus.key },
    metadata: params.comment ? { comment: params.comment } : undefined,
  });

  if (scope.authorId && scope.authorId !== params.actorId) {
    if (toStatus.key === WORKFLOW_STATUS_KEYS.A_CORRIGER) {
      await notify({
        userId: scope.authorId,
        event: "report.needs_correction",
        title: `Correction demandée — ${scope.title}`,
        body: params.comment ?? "Le rapport doit être corrigé et resoumis.",
      });
    } else {
      await notify({
        userId: scope.authorId,
        event: "report.status_changed",
        title: `Rapport ${scope.title}`,
        body: `Statut mis à jour : ${toStatus.label}.`,
      });
    }
  }

  const nextPermission = NEXT_ACTOR_PERMISSION[toStatus.key];
  if (nextPermission && reportOrganizationId) {
    await notifyUsersWithPermission({
      permissionKey: nextPermission,
      poolId: reportPoolId,
      organizationId: reportOrganizationId,
      event: "report.awaiting_action",
      title: `Rapport à traiter — ${scope.title}`,
      body: `Le rapport est au statut "${toStatus.label}".`,
    });
  }

  return toStatus;
}

/**
 * Statut d'une inspection dont les fiches suivent chacune leur circuit
 * (décision Q3) : en cours tant qu'une fiche reste à soumettre ou à
 * corriger ; « rapport soumis » quand toutes sont soumises ; « validée »
 * quand toutes sont validées. Les inspections de l'ancien circuit (rapport
 * global) ne sont pas concernées.
 */
export async function refreshInspectionStatus(inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { report: { select: { id: true } }, forms: { include: { report: { include: { status: true } } } } },
  });
  if (!inspection || inspection.report || inspection.forms.length === 0) return;
  const keys = inspection.forms.map((f) => f.report?.status.key ?? null);
  const done: string[] = [WORKFLOW_STATUS_KEYS.VALIDE, WORKFLOW_STATUS_KEYS.CLOTURE];
  const open: (string | null)[] = [null, WORKFLOW_STATUS_KEYS.BROUILLON, WORKFLOW_STATUS_KEYS.A_CORRIGER];
  const status = keys.every((k) => k !== null && done.includes(k))
    ? "VALIDEE"
    : keys.some((k) => open.includes(k))
      ? "EN_COURS"
      : "RAPPORT_SOUMIS";
  if (status === inspection.status) return;
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status, ...(status === "RAPPORT_SOUMIS" && !inspection.completedAt ? { completedAt: new Date() } : {}) },
  });
}
