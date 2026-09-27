"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validations";
import { requireOfficialActorUnlessDemoTarget, requirePermission } from "@/lib/permissions";
import { ASSIGNMENT_END_REASONS, PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";
import { createAccount, issueAccessLink, toUserMessage } from "@/lib/accounts";
import { getBaseUrl } from "@/lib/request-url";

export type UserFormState = {
  errors?: Record<string, string>;
  formError?: string;
  created?: { email: string; emailed: boolean; isDemo: boolean; activationUrl?: string; expiresAt?: string };
};

// Le compte est créé « en attente » : son titulaire choisit lui-même son mot
// de passe via le lien d'activation (aucun mot de passe saisi ici).
export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username") ?? "",
    roleId: formData.get("roleId"),
    poolId: formData.get("poolId"),
    sex: formData.get("sex"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  try {
    const result = await createAccount({
      actorId: session.user.id,
      organizationId: session.user.organizationId,
      name: parsed.data.name,
      email: parsed.data.email,
      username: parsed.data.username || null,
      phone: parsed.data.phone || null,
      sex: parsed.data.sex || null,
      roleId: parsed.data.roleId,
      poolId: parsed.data.poolId || null,
      baseUrl: await getBaseUrl(),
    });
    return {
      created: {
        email: result.email,
        emailed: result.emailed,
        isDemo: result.isDemo,
        activationUrl: result.activation?.url,
        expiresAt: result.activation?.expiresAt.toISOString(),
      },
    };
  } catch (e) {
    const message = toUserMessage(e);
    return message.startsWith("L'identifiant") ? { errors: { username: message } } : { formError: message };
  }
}

export type ReissueState = {
  error?: string;
  kind?: "activation" | "reset";
  email?: string;
  emailed?: boolean;
  isDemo?: boolean;
  activationUrl?: string;
  expiresAt?: string;
};

export async function reissueActivationAction(userId: string): Promise<ReissueState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  try {
    const result = await issueAccessLink({
      actorId: session.user.id,
      organizationId: session.user.organizationId,
      userId,
      baseUrl: await getBaseUrl(),
    });
    return {
      kind: result.kind,
      email: result.email,
      emailed: result.emailed,
      isDemo: result.isDemo,
      activationUrl: result.link?.url,
      expiresAt: result.link?.expiresAt.toISOString(),
    };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

export async function toggleUserStatusAction(userId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.USERS_MANAGE);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== session.user.organizationId) return;

  await requireOfficialActorUnlessDemoTarget(session.user.id, user.isDemo);
  // Un compte en attente s'active uniquement par son titulaire (lien
  // d'activation), jamais par un basculement administratif.
  if (user.status === "PENDING") return;

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
