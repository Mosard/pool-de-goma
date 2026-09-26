"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validations";
import { isDemoActor, requireOfficialActorUnlessDemoTarget, requirePermission } from "@/lib/permissions";
import { ASSIGNMENT_END_REASONS, PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";

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
  // Un seul chef par POOL, obligatoirement inspecteur du POOL : la fonction
  // s'attribue uniquement par la nomination (Paramètres → POOL).
  if (role.key === ROLE_KEYS.CHEF_POOL) {
    return { errors: { roleId: "Créez le compte comme inspecteur, puis nommez-le chef depuis la fiche du POOL." } };
  }
  if (role.scope === "POOL" && !parsed.data.poolId) {
    return { errors: { poolId: "Ce rôle nécessite un pool." } };
  }

  if (parsed.data.poolId) {
    const targetPool = await prisma.pool.findUnique({ where: { id: parsed.data.poolId } });
    if (!targetPool || targetPool.organizationId !== session.user.organizationId) {
      return { errors: { poolId: "Pool introuvable." } };
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const email = parsed.data.email.toLowerCase();
  // Compte créé par un compte de démonstration, ou adresse en .test : démo.
  const isDemo = email.endsWith(".test") || (await isDemoActor(session.user.id));

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        isDemo,
        phone: parsed.data.phone || null,
        sex: parsed.data.sex || null,
        status: "ACTIVE",
        organizationId: session.user.organizationId,
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
    organizationId: session.user.organizationId,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, roleId: role.id },
  });

  revalidatePath("/inspecteurs");
  redirect("/inspecteurs");
}

export async function toggleUserStatusAction(userId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.USERS_MANAGE);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== session.user.organizationId) return;

  await requireOfficialActorUnlessDemoTarget(session.user.id, user.isDemo);

  const nextStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  // Suspendre un compte met fin à ses affectations en cours : un compte
  // suspendu n'est plus habilité dans aucune école. Une réactivation ne les
  // rétablit pas — elles doivent être réattribuées explicitement.
  let endedAssignments = 0;
  if (nextStatus === "SUSPENDED") {
    const [, ended] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: nextStatus } }),
      prisma.assignment.updateMany({
        where: { inspectorId: userId, active: true },
        data: {
          active: false,
          endedAt: new Date(),
          endReason: ASSIGNMENT_END_REASONS.ACCOUNT_SUSPENDED,
          endedById: session.user.id,
        },
      }),
    ]);
    endedAssignments = ended.count;
  } else {
    await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });
  }

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "user.status_change",
    entityType: "User",
    entityId: userId,
    oldValue: { status: user.status },
    newValue: { status: nextStatus },
    metadata: endedAssignments > 0 ? { endedAssignments } : undefined,
  });

  revalidatePath("/inspecteurs");
  revalidatePath("/affectations");
  // Un compte suspendu disparaît du site public (chef de POOL compris).
  revalidatePublicPools();
}
