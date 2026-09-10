"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validations";
import { requirePermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";

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
  await requirePermission(session.user.id, PERMISSIONS.USERS_MANAGE);

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
    poolId: formData.get("poolId"),
    sex: formData.get("sex"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const role = await prisma.roleDefinition.findUnique({ where: { id: parsed.data.roleId } });
  if (!role) return { formError: "Rôle introuvable." };
  if (role.scope === "POOL" && !parsed.data.poolId) {
    return { errors: { poolId: "Ce rôle nécessite un pool." } };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        phone: parsed.data.phone || null,
        sex: parsed.data.sex || null,
        status: "ACTIVE",
        poolId: parsed.data.poolId || null,
        roles: {
          create: { roleId: role.id, poolId: role.scope === "POOL" ? parsed.data.poolId || null : null },
        },
      },
    });
  } catch {
    return { formError: "Cet email est déjà utilisé." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, roleId: role.id },
  });

  revalidatePath("/utilisateurs");
  redirect("/utilisateurs");
}

export async function toggleUserStatusAction(userId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.USERS_MANAGE);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const nextStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });

  await logAudit({
    actorId: session.user.id,
    action: "user.status_change",
    entityType: "User",
    entityId: userId,
    oldValue: { status: user.status },
    newValue: { status: nextStatus },
  });

  revalidatePath("/utilisateurs");
}
