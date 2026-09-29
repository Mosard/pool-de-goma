import { prisma } from "@/lib/prisma";
import { canUseViewMode } from "@/lib/permissions";
import { readViewMode } from "@/lib/view-mode";

export async function logAudit(params: {
  actorId: string | null;
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}) {
  // Action faite en mode « Voir comme » (Super Admin, IPP) : le mode est consigné.
  let metadata = params.metadata;
  const mode = params.actorId ? await readViewMode() : null;
  if (mode && params.actorId && (await canUseViewMode(params.actorId))) {
    metadata = { ...((params.metadata as object | undefined) ?? {}), viewMode: mode };
  }
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue === undefined ? undefined : (params.oldValue as object),
      newValue: params.newValue === undefined ? undefined : (params.newValue as object),
      metadata: metadata === undefined ? undefined : (metadata as object),
    },
  });
}
