"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolSchema } from "@/lib/validations";
import { requirePermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";

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

  await requirePermission(session.user.id, PERMISSIONS.SCHOOLS_MANAGE, { poolId: parsed.data.poolId });

  let school;
  try {
    school = await prisma.school.create({ data: parsed.data });
  } catch {
    return { formError: "Ce code d'école existe déjà." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "school.create",
    entityType: "School",
    entityId: school.id,
    newValue: parsed.data,
  });

  revalidatePath("/ecoles");
  redirect("/ecoles");
}

export async function updateSchoolAction(
  id: string,
  _prevState: SchoolFormState,
  formData: FormData
): Promise<SchoolFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const existing = await prisma.school.findUnique({ where: { id } });
  if (!existing) return { formError: "École introuvable." };

  const parsed = parseSchoolForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await requirePermission(session.user.id, PERMISSIONS.SCHOOLS_MANAGE, { poolId: existing.poolId });

  try {
    await prisma.school.update({ where: { id }, data: parsed.data });
  } catch {
    return { formError: "Ce code d'école existe déjà." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "school.update",
    entityType: "School",
    entityId: id,
    oldValue: existing,
    newValue: parsed.data,
  });

  revalidatePath("/ecoles");
  revalidatePath(`/ecoles/${id}`);
  redirect(`/ecoles/${id}`);
}
