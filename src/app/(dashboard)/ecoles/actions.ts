"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolSchema } from "@/lib/validations";
import {
  hasPermission,
  isDemoActor,
  loadUserAccess,
  requireOfficialActorUnlessDemoTarget,
  requirePermission,
} from "@/lib/permissions";
import { ASSIGNMENT_END_REASONS, PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";

export type SchoolFormState = {
  errors?: Record<string, string>;
  formError?: string;
};

function parseSchoolForm(formData: FormData) {
  return schoolSchema.safeParse({
    poolId: formData.get("poolId"),
    name: formData.get("name"),
    code: formData.get("code"),
    province: formData.get("province"),
    territoire: formData.get("territoire"),
    address: formData.get("address"),
    director: formData.get("director"),
    phone: formData.get("phone"),
    type: formData.get("type"),
  });
}

export async function createSchoolAction(
  _prevState: SchoolFormState,
  formData: FormData
): Promise<SchoolFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = parseSchoolForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const targetPool = await prisma.pool.findUnique({ where: { id: parsed.data.poolId } });
  if (!targetPool) return { errors: { poolId: "Pool introuvable." } };

  await requirePermission(session.user.id, PERMISSIONS.SCHOOLS_MANAGE, {
    poolId: parsed.data.poolId,
    organizationId: targetPool.organizationId,
  });

  let school;
  try {
    // École créée depuis un compte de démonstration : démo (jamais publiée).
    school = await prisma.school.create({ data: { ...parsed.data, isDemo: await isDemoActor(session.user.id) } });
  } catch {
    return { formError: "Ce code d'école existe déjà." };
  }

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "school.create",
    entityType: "School",
    entityId: school.id,
    newValue: parsed.data,
  });

  revalidatePath("/ecoles");
  revalidatePublicPools();
  redirect("/ecoles");
}

export async function updateSchoolAction(
  id: string,
  _prevState: SchoolFormState,
  formData: FormData
): Promise<SchoolFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const existing = await prisma.school.findUnique({ where: { id }, include: { pool: true } });
  if (!existing) return { formError: "École introuvable." };

  const parsed = parseSchoolForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await requirePermission(session.user.id, PERMISSIONS.SCHOOLS_MANAGE, {
    poolId: existing.poolId,
    organizationId: existing.pool.organizationId,
  });
  // Nom et adresse d'une école réelle sont publiés : pas de modification
  // depuis un compte de démonstration.
  await requireOfficialActorUnlessDemoTarget(session.user.id, existing.isDemo);

  const poolChanged = parsed.data.poolId !== existing.poolId;
  if (poolChanged) {
    const targetPool = await prisma.pool.findUnique({ where: { id: parsed.data.poolId } });
    if (!targetPool || targetPool.organizationId !== existing.pool.organizationId) {
      return { errors: { poolId: "Pool introuvable." } };
    }
    // Déplacer une école engage aussi le POOL de destination : il faut y
    // détenir le même droit (un chef de POOL ne peut pas « pousser » une
    // école vers un POOL qu'il ne gère pas).
    const access = await loadUserAccess(session.user.id);
    if (
      !hasPermission(access.permissions, PERMISSIONS.SCHOOLS_MANAGE, {
        poolId: targetPool.id,
        organizationId: targetPool.organizationId,
      })
    ) {
      return { errors: { poolId: "Vous n'avez pas le droit de rattacher une école à ce POOL." } };
    }
  }

  // Changer de POOL met fin aux affectations en cours : les inspecteurs de
  // l'ancien POOL ne sont plus habilités dans cette école.
  let endedAssignments = 0;
  try {
    if (poolChanged) {
      const [, ended] = await prisma.$transaction([
        prisma.school.update({ where: { id }, data: parsed.data }),
        prisma.assignment.updateMany({
          where: { schoolId: id, active: true },
          data: {
            active: false,
            endedAt: new Date(),
            endReason: ASSIGNMENT_END_REASONS.SCHOOL_POOL_CHANGED,
            endedById: session.user.id,
          },
        }),
      ]);
      endedAssignments = ended.count;
    } else {
      await prisma.school.update({ where: { id }, data: parsed.data });
    }
  } catch {
    return { formError: "Ce code d'école existe déjà." };
  }

  await logAudit({
    actorId: session.user.id,
    organizationId: existing.pool.organizationId,
    action: "school.update",
    entityType: "School",
    entityId: id,
    oldValue: existing,
    newValue: parsed.data,
    metadata: endedAssignments > 0 ? { endedAssignments } : undefined,
  });

  revalidatePath("/ecoles");
  revalidatePath("/affectations");
  revalidatePublicPools();
  revalidatePath(`/ecoles/${id}`);
  redirect(`/ecoles/${id}`);
}
