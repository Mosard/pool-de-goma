"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema, transitionSchema } from "@/lib/validations";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermission } from "@/lib/permissions";
import { applyTransition } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";

export type CommentState = {
  errors?: Record<string, string>;
  formError?: string;
};

export async function addCommentAction(
  reportId: string,
  _prevState: CommentState,
  formData: FormData
): Promise<CommentState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { inspection: { include: { school: { include: { pool: true } } } } },
  });
  if (!report) return { formError: "Rapport introuvable." };

  const poolId = report.inspection.school.poolId;
  const organizationId = report.inspection.school.pool.organizationId;
  const canComment =
    hasPermission(session.user.permissions, PERMISSIONS.REPORTS_REVIEW_POOL, { poolId, organizationId }) ||
    hasPermission(session.user.permissions, PERMISSIONS.REPORTS_REVIEW_PROVINCE, { poolId, organizationId }) ||
    hasPermission(session.user.permissions, PERMISSIONS.REPORTS_VALIDATE, { poolId, organizationId });
  if (!canComment) return { formError: "Action non autorisée." };

  const parsed = commentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await prisma.comment.create({
    data: { reportId, authorId: session.user.id, content: parsed.data.content },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "report.comment",
    entityType: "Report",
    entityId: reportId,
  });

  revalidatePath(`/rapports/${reportId}`);
  return {};
}

export async function transitionReportAction(reportId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = transitionSchema.safeParse({
    toStatusKey: formData.get("toStatusKey"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) return;

  await applyTransition({
    reportId,
    toStatusKey: parsed.data.toStatusKey,
    actorId: session.user.id,
    actorPermissions: session.user.permissions,
    actorPoolId: session.user.poolId,
    actorOrganizationId: session.user.organizationId,
    comment: parsed.data.comment || undefined,
  });

  revalidatePath(`/rapports/${reportId}`);
  revalidatePath("/rapports");
}
