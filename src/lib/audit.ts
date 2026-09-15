import { prisma } from "@/lib/prisma";

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
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue === undefined ? undefined : (params.oldValue as object),
      newValue: params.newValue === undefined ? undefined : (params.newValue as object),
      metadata: params.metadata === undefined ? undefined : (params.metadata as object),
    },
  });
}
