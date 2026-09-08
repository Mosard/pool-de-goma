"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validations";
import { assertRole } from "@/lib/permissions";

export type UserFormState = {
  errors?: Record<string, string>;
  formError?: string;
};

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["CHEF_POOL"]);

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        phone: parsed.data.phone || null,
        passwordHash,
      },
    });
  } catch {
    return { formError: "Cet email est déjà utilisé." };
  }

  revalidatePath("/utilisateurs");
  redirect("/utilisateurs");
}

export async function toggleUserActiveAction(userId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["CHEF_POOL"]);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });

  revalidatePath("/utilisateurs");
}
