import { prisma } from "@/lib/prisma";
import { PERMISSIONS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { hasPermission, ForbiddenError, type SessionPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { notify, notifyUsersWithPermission } from "@/lib/notifications/dispatcher";

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
  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: {
      status: true,
      inspection: { include: { school: { include: { pool: true } }, inspector: true } },
    },
  });
  if (!report) throw new Error("Rapport introuvable.");

  const toStatus = await prisma.workflowStatus.findUnique({ where: { key: params.toStatusKey } });
  if (!toStatus) throw new Error("Statut cible inconnu.");

  const transition = await prisma.workflowTransition.findUnique({
    where: { fromStatusId_toStatusId: { fromStatusId: report.statusId, toStatusId: toStatus.id } },
  });
  if (!transition) throw new Error("Transition non autorisée depuis ce statut.");

  const reportPoolId = report.inspection.school.poolId;
  const reportOrganizationId = report.inspection.school.pool.organizationId;
  if (
    !hasPermission(params.actorPermissions, transition.allowedPermissionKey, {
      poolId: reportPoolId,
      organizationId: reportOrganizationId,
    })
  ) {
    throw new ForbiddenError();
  }

  await prisma.report.update({
    where: { id: params.reportId },
    data: {
      statusId: toStatus.id,
      validatedAt: toStatus.key === WORKFLOW_STATUS_KEYS.VALIDE ? new Date() : report.validatedAt,
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

  if (toStatus.key === WORKFLOW_STATUS_KEYS.VALIDE) {
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

  if (toStatus.key === WORKFLOW_STATUS_KEYS.A_CORRIGER) {
    await notify({
      userId: report.inspection.inspectorId,
      event: "report.needs_correction",
      title: `Correction demandée — ${report.inspection.school.name}`,
      body: params.comment ?? "Le rapport doit être corrigé et resoumis.",
    });
  } else {
    await notify({
      userId: report.inspection.inspectorId,
      event: "report.status_changed",
      title: `Rapport ${report.inspection.school.name}`,
      body: `Statut mis à jour : ${toStatus.label}.`,
    });

    const nextPermission = NEXT_ACTOR_PERMISSION[toStatus.key];
    if (nextPermission) {
      await notifyUsersWithPermission({
        permissionKey: nextPermission,
        poolId: reportPoolId,
        organizationId: reportOrganizationId,
        event: "report.awaiting_action",
        title: `Rapport à traiter — ${report.inspection.school.name}`,
        body: `Le rapport est au statut "${toStatus.label}".`,
      });
    }
  }

  return toStatus;
}
