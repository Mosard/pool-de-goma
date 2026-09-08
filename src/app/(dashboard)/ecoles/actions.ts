"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolSchema } from "@/lib/validations";
import { assertRole } from "@/lib/permissions";

export type SchoolFormState = {
  errors?: Record<string, string>;
  formError?: string;
};

function parseSchoolForm(formData: FormData) {
  return schoolSchema.safeParse({
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
  assertRole(session.user.role, ["CHEF_POOL"]);

  const parsed = parseSchoolForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  try {
    await prisma.school.create({ data: parsed.data });
  } catch {
    return { formError: "Ce code d'école existe déjà." };
  }

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
  assertRole(session.user.role, ["CHEF_POOL"]);

  const parsed = parseSchoolForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  try {
    await prisma.school.update({ where: { id }, data: parsed.data });
  } catch {
    return { formError: "Ce code d'école existe déjà." };
  }

  revalidatePath("/ecoles");
  revalidatePath(`/ecoles/${id}`);
  redirect(`/ecoles/${id}`);
}
