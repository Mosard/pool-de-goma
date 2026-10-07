"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inspectionSchema } from "@/lib/validations";
import { demoRefusal, hasPermission, isSuperAdmin, requirePermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";

export type ActionState = {
  errors?: Record<string, string>;
  formError?: string;
};

export async function createInspectionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const isSelf = hasPermission(user.permissions, PERMISSIONS.INSPECTIONS_CONDUCT, {
    poolId: user.poolId,
    organizationId: user.organizationId,
  });

  const parsed = inspectionSchema.safeParse({
    schoolId: formData.get("schoolId"),
    inspectorId: isSelf ? user.id : formData.get("inspectorId"),
    scheduledDate: formData.get("scheduledDate"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const school = await prisma.school.findUnique({ where: { id: parsed.data.schoolId }, include: { pool: true } });
  if (!school) return { formError: "École introuvable." };
  const refusal = await demoRefusal(user.id, school.isDemo);
  if (refusal) return { formError: refusal };

  if (!isSelf) {
    await requirePermission(user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, {
      poolId: school.poolId,
      organizationId: school.pool.organizationId,
    });
  } else {
    const assigned = await prisma.assignment.findFirst({
      where: { schoolId: parsed.data.schoolId, inspectorId: user.id, active: true },
    });
    if (!assigned) {
      // Le Super Admin inspecte sans affectation (dépannage), mais seulement
      // dans la portée de ses droits effectifs (un seul POOL en mode itinérant).
      if (!(await isSuperAdmin(user.id))) return { formError: "Vous n'êtes pas assigné à cette école." };
      await requirePermission(user.id, PERMISSIONS.INSPECTIONS_CONDUCT, {
        poolId: school.poolId,
        organizationId: school.pool.organizationId,
      });
    }
  }

  const inspection = await prisma.inspection.create({
    data: {
      schoolId: parsed.data.schoolId,
      inspectorId: parsed.data.inspectorId,
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null,
    },
  });

  revalidatePath("/inspections");
  redirect(`/inspections/${inspection.id}`);
}
