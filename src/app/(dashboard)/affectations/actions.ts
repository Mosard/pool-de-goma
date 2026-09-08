"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignmentSchema } from "@/lib/validations";
import { assertRole } from "@/lib/permissions";

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
  assertRole(session.user.role, ["CHEF_POOL"]);

  const parsed = assignmentSchema.safeParse({
    schoolId: formData.get("schoolId"),
    inspectorId: formData.get("inspectorId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const existing = await prisma.assignment.findFirst({
    where: { schoolId: parsed.data.schoolId, inspectorId: parsed.data.inspectorId, active: true },
  });
  if (existing) {
    return { formError: "Cette école est déjà assignée à cet inspecteur." };
  }

  await prisma.assignment.create({
    data: {
      schoolId: parsed.data.schoolId,
      inspectorId: parsed.data.inspectorId,
      assignedById: session.user.id,
    },
  });

  revalidatePath("/affectations");
  return {};
}

export async function revokeAssignmentAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["CHEF_POOL"]);

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { active: false },
  });

  revalidatePath("/affectations");
}
