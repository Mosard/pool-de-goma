"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignmentSchema } from "@/lib/validations";
import { requirePermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";

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
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const school = await prisma.school.findUnique({ where: { id: parsed.data.schoolId } });
  if (!school) return { formError: "École introuvable." };

  await requirePermission(session.user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, { poolId: school.poolId });

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
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "assignment.create",
    entityType: "Assignment",
    entityId: assignment.id,
    newValue: parsed.data,
  });

  revalidatePath("/affectations");
  return {};
}

export async function revokeAssignmentAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { school: true },
  });
  if (!assignment) return;

  await requirePermission(session.user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, { poolId: assignment.school.poolId });

  await prisma.assignment.update({ where: { id: assignmentId }, data: { active: false } });

  await logAudit({
    actorId: session.user.id,
    action: "assignment.revoke",
    entityType: "Assignment",
    entityId: assignmentId,
  });

  revalidatePath("/affectations");
}
