"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, loadUserAccess, requireOfficialActorUnlessDemoTarget } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { analysisInScope, requireAiScope, resolveAiPool } from "@/lib/ai/scope";
import { canActOnAiProblem, canDesignateAiService } from "@/lib/ai/authority";
import { parseAiPeriod } from "@/lib/ai/period";
import { runAnalysis } from "@/lib/ai/analyze";
import { AI_LIMITS } from "@/lib/ai/meta";

// Fonctionnalité IA. Droits relus en base à chaque appel : permission
// ai.analyze et périmètre (l'Inspool reste dans son POOL), puis, pour réagir
// à une décision, la règle de canActOnAiProblem. Aucune décision ne
// s'applique d'elle-même : seules les réactions humaines changent un statut,
// et chacune est archivée (AiReaction) et tracée dans le journal d'audit.

export type AiActionState = { error?: string; errors?: Record<string, string>; success?: string };

async function actorId(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export async function launchAnalysisAction(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const userId = await actorId();
  let target: string;
  try {
    const scope = await requireAiScope(userId);
    const poolId = resolveAiPool(scope, text(formData, "pool"));
    const period = parseAiPeriod(text(formData, "du"), text(formData, "au"));
    if (!period) return { error: "Période invalide : vérifiez les dates (deux ans au plus)." };

    const result = await runAnalysis({ scope, poolId, from: period.from, to: period.to });
    if (!result.ok) {
      if (result.analysisId) revalidatePath("/ia");
      return { error: result.error };
    }
    const params = new URLSearchParams({ du: period.du, au: period.au, analyse: result.analysisId });
    if (poolId && scope.allPools) params.set("pool", poolId);
    target = `/ia?${params.toString()}`;
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath("/ia");
  redirect(target);
}

/** Charge la carte et vérifie que le compte peut la voir et y réagir. */
async function loadActionable(userId: string, problemId: string) {
  const scope = await requireAiScope(userId);
  const problem = await prisma.aiProblem.findUnique({
    where: { id: problemId },
    include: {
      analysis: { select: { id: true, organizationId: true, poolId: true, cellId: true, isDemo: true } },
      attribution: { select: { id: true, label: true, holderId: true } },
    },
  });
  if (!problem || !analysisInScope(scope, problem.analysis) || problem.analysis.isDemo !== scope.isDemo) {
    throw new ForbiddenError("Cette proposition est introuvable ou hors de votre périmètre.");
  }
  await requireOfficialActorUnlessDemoTarget(userId, problem.analysis.isDemo);
  const { roles } = await loadUserAccess(userId);
  return { scope, problem, roles };
}

const KINDS = ["VALIDATION", "REJET", "AJUSTEMENT", "COMMENTAIRE"] as const;
type Kind = (typeof KINDS)[number];

export async function reactToProblemAction(problemId: string, _prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const userId = await actorId();
  const kind = text(formData, "kind") as Kind;
  if (!KINDS.includes(kind)) return { error: "Geste inconnu." };

  const comment = text(formData, "comment");
  const motif = text(formData, "motif");
  const decision = text(formData, "decision");
  const errors: Record<string, string> = {};
  if (comment.length > AI_LIMITS.comment) errors.comment = `${AI_LIMITS.comment} caractères au plus.`;
  if (kind === "COMMENTAIRE" && !comment) errors.comment = "Écrivez votre commentaire.";
  if (kind === "REJET") {
    if (!motif) errors.motif = "Le motif du rejet est obligatoire.";
    else if (motif.length > AI_LIMITS.motif) errors.motif = `${AI_LIMITS.motif} caractères au plus.`;
  }
  if (kind === "AJUSTEMENT") {
    if (!decision) errors.decision = "Écrivez la décision ajustée.";
    else if (decision.length > AI_LIMITS.decision) errors.decision = `${AI_LIMITS.decision} caractères au plus.`;
  }
  if (Object.keys(errors).length) return { errors };

  try {
    const { scope, problem, roles } = await loadActionable(userId, problemId);
    if (!canActOnAiProblem({ userId, roles }, problem.analysis, problem)) {
      throw new ForbiddenError("Seul le responsable concerné (Inspool du POOL, IPP adjoint du service désigné ou IPP) peut réagir à cette proposition.");
    }

    const now = new Date();
    const status =
      kind === "VALIDATION" ? "VALIDEE" : kind === "REJET" ? "REJETEE" : kind === "AJUSTEMENT" ? "AJUSTEE" : problem.status;

    await prisma.$transaction([
      prisma.aiReaction.create({
        data: {
          problemId,
          authorId: userId,
          kind,
          comment: comment || null,
          motif: kind === "REJET" ? motif : null,
          decisionAjustee: kind === "AJUSTEMENT" ? decision : null,
        },
      }),
      ...(kind === "COMMENTAIRE"
        ? []
        : [
            prisma.aiProblem.update({
              where: { id: problemId },
              data: {
                status,
                decidedAt: now,
                // Le motif et la décision ajustée décrivent le statut en cours.
                motifRejet: kind === "REJET" ? motif : null,
                decisionAjustee: kind === "AJUSTEMENT" ? decision : null,
              },
            }),
          ]),
    ]);

    await logAudit({
      actorId: userId,
      organizationId: scope.organizationId,
      action: `ai.problem.${kind.toLowerCase()}`,
      entityType: "AiProblem",
      entityId: problemId,
      oldValue: { status: problem.status },
      newValue: { status, ...(motif && kind === "REJET" ? { motif } : {}), ...(kind === "AJUSTEMENT" ? { decision } : {}) },
      metadata: { analysisId: problem.analysis.id, comment: comment || undefined },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }

  revalidatePath("/ia");
  return {
    success:
      kind === "VALIDATION"
        ? "Décision validée."
        : kind === "REJET"
          ? "Décision rejetée, motif enregistré."
          : kind === "AJUSTEMENT"
            ? "Décision ajustée et validée."
            : "Commentaire enregistré.",
  };
}

export async function designateServiceAction(problemId: string, _prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const userId = await actorId();
  const attributionId = text(formData, "attributionId");
  try {
    const { scope, problem, roles } = await loadActionable(userId, problemId);
    if (!canDesignateAiService({ roles })) throw new ForbiddenError("Seul l'IPP désigne le service responsable.");
    const attribution = attributionId
      ? await prisma.directionAttribution.findFirst({
          where: { id: attributionId, organizationId: scope.organizationId },
          select: { id: true, label: true },
        })
      : null;
    if (attributionId && !attribution) return { error: "Service inconnu." };

    await prisma.$transaction([
      prisma.aiProblem.update({ where: { id: problemId }, data: { attributionId: attribution?.id ?? null } }),
      prisma.aiReaction.create({
        data: {
          problemId,
          authorId: userId,
          kind: "SERVICE_DESIGNE",
          attributionId: attribution?.id ?? null,
          comment: attribution ? attribution.label : "Service responsable à confirmer",
        },
      }),
    ]);
    await logAudit({
      actorId: userId,
      organizationId: scope.organizationId,
      action: "ai.problem.service",
      entityType: "AiProblem",
      entityId: problemId,
      oldValue: { attributionId: problem.attributionId },
      newValue: { attributionId: attribution?.id ?? null },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath("/ia");
  return { success: "Service responsable enregistré." };
}
