"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema, transitionSchema } from "@/lib/validations";
import { ForbiddenError, demoRefusal } from "@/lib/permissions";
import { applyTransition } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { REPORT_SCOPE_INCLUDE, reportScope, reportTrack } from "@/lib/fiches/report-scope";
import { canWorkOnReport, TRACK_ACTIONS, type TrackAction } from "@/lib/cells/rules";
import { applyTrackAction, loadCellActor } from "@/lib/cells/server";

export type IppTrackState = { error?: string; done?: string };

/**
 * Étape de la branche IPP (secrétariat, cellule, IPA). L'action, la cellule
 * et le motif viennent du formulaire ; TOUT le contrôle (droit, stade,
 * cellule active de l'organisation) est fait par applyTrackAction, sur les
 * droits relus en base.
 */
export async function ippTrackAction(reportId: string, _prev: IppTrackState, formData: FormData): Promise<IppTrackState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const action = String(formData.get("action") ?? "") as TrackAction;
  if (!Object.hasOwn(TRACK_ACTIONS, action)) return { error: "Étape inconnue." };
  try {
    await applyTrackAction(session.user.id, reportId, {
      action,
      cellId: String(formData.get("cellId") ?? "") || null,
      comment: String(formData.get("comment") ?? ""),
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/rapports/${reportId}`);
  revalidatePath("/secretariat");
  return { done: TRACK_ACTIONS[action].label };
}

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

  const report = await prisma.report.findUnique({ where: { id: reportId }, include: REPORT_SCOPE_INCLUDE });
  if (!report) return { formError: "Rapport introuvable." };

  const scope = reportScope(report);
  // Droits relus en base : exploitants du POOL, ou de la cellule destinataire (jamais le secrétariat).
  const actor = await loadCellActor(session.user.id);
  if (!canWorkOnReport(actor, scope, reportTrack(report))) return { formError: "Action non autorisée." };
  const refusal = await demoRefusal(session.user.id, scope.isDemo);
  if (refusal) return { formError: refusal };

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
