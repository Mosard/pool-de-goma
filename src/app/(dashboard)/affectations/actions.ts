"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignmentSchema } from "@/lib/validations";
import { requirePermission } from "@/lib/permissions";
import { ASSIGNMENT_END_REASONS, PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";

export type AssignmentFormState = {
  errors?: Record<string, string>;
  formError?: string;
};

export async function createAssignmentAction(
  _prevState: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = assignmentSchema.safeParse({
    schoolId: formData.get("schoolId"),
    inspectorId: formData.get("inspectorId"),
    effectiveFrom: formData.get("effectiveFrom") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }
  // Date d'effet : celle saisie, sinon maintenant. Aucune date de fin
  // (décision de l'Inspection) : l'affectation vaut jusqu'à son retrait.
  const effectiveFrom = parsed.data.effectiveFrom ? new Date(`${parsed.data.effectiveFrom}T00:00:00Z`) : new Date();
  if (Number.isNaN(effectiveFrom.getTime())) return { errors: { effectiveFrom: "Date invalide" } };

  const school = await prisma.school.findUnique({ where: { id: parsed.data.schoolId }, include: { pool: true } });
  if (!school || !school.active) return { formError: "École introuvable ou inactive." };

  await requirePermission(session.user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, {
    poolId: school.poolId,
    organizationId: school.pool.organizationId,
  });

  // L'identifiant vient du formulaire : on revérifie côté serveur que c'est
  // bien un compte actif, de la même organisation, qui détient la fonction
  // d'inspecteur dans le POOL de l'école.
  const inspector = await prisma.user.findFirst({
    where: {
      id: parsed.data.inspectorId,
      organizationId: school.pool.organizationId,
      status: "ACTIVE",
      roles: { some: { poolId: school.poolId, role: { key: ROLE_KEYS.INSPECTEUR } } },
    },
    select: { id: true },
  });
  if (!inspector) {
    return { errors: { inspectorId: "Cet inspecteur n'est pas un inspecteur actif du POOL de cette école." } };
  }

  const existing = await prisma.assignment.findFirst({
    where: { schoolId: parsed.data.schoolId, inspectorId: parsed.data.inspectorId, active: true },
  });
  if (existing) {
    return { formError: "Cette école est déjà assignée à cet inspecteur." };
  }

  const assignment = await prisma.assignment.create({
    data: {
      schoolId: parsed.data.schoolId,
      inspectorId: parsed.data.inspectorId,
      assignedById: session.user.id,
      effectiveFrom,
    },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: school.pool.organizationId,
    action: "assignment.create",
    entityType: "Assignment",
    entityId: assignment.id,
    newValue: { ...parsed.data, effectiveFrom: effectiveFrom.toISOString() },
  });

  revalidatePath("/affectations");
  revalidatePublicPools();
  return {};
}

export async function revokeAssignmentAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { school: { include: { pool: true } } },
  });
  if (!assignment || !assignment.active) return;

  await requirePermission(session.user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, {
    poolId: assignment.school.poolId,
    organizationId: assignment.school.pool.organizationId,
  });

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      active: false,
      endedAt: new Date(),
      endReason: ASSIGNMENT_END_REASONS.REVOKED,
      endedById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: assignment.school.pool.organizationId,
    action: "assignment.revoke",
    entityType: "Assignment",
    entityId: assignmentId,
    oldValue: { active: true, schoolId: assignment.schoolId, inspectorId: assignment.inspectorId },
    newValue: { active: false, endReason: ASSIGNMENT_END_REASONS.REVOKED },
  });

  revalidatePath("/affectations");
  revalidatePublicPools();
}
