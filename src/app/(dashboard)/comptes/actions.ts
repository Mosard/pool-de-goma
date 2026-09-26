"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOfficialActorUnlessDemoTarget, requirePermission } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { emailChannel } from "@/lib/notifications/channels/email";

export async function approveAccountRequestAction(requestId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.ACCOUNTS_MANAGE);

  const request = await prisma.accountRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING" || request.organizationId !== session.user.organizationId) return;

  // Seules les demandes de test (adresse en .test) peuvent être traitées par
  // un compte de démonstration ; le compte créé est alors lui-même de démo.
  const isDemo = request.email.toLowerCase().endsWith(".test");
  await requireOfficialActorUnlessDemoTarget(session.user.id, isDemo);

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const requestedRole = request.requestedRoleId
    ? await prisma.roleDefinition.findUnique({ where: { id: request.requestedRoleId } })
    : null;
  // La fonction de chef ne s'attribue que par nomination (un seul chef par
  // POOL, inspecteur du POOL) : elle n'est pas accordée à l'approbation.
  const role = requestedRole?.key === ROLE_KEYS.CHEF_POOL ? null : requestedRole;

  const user = await prisma.user.create({
    data: {
      name: request.name,
      email: request.email.toLowerCase(),
      passwordHash,
      phone: request.phone,
      status: "ACTIVE",
      isDemo,
      organizationId: request.organizationId,
      poolId: request.poolId,
      roles: role
        ? { create: { roleId: role.id, poolId: role.scope === "POOL" ? request.poolId : null } }
        : undefined,
    },
  });

  await prisma.accountRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "account_request.approve",
    entityType: "AccountRequest",
    entityId: requestId,
    newValue: { userId: user.id },
  });

  await emailChannel.send(`guest-${requestId}`, {
    userId: user.id,
    event: "account.approved",
    title: "Compte approuvé — IPP Nord-Kivu 1",
    body: `Votre compte a été créé. Email : ${user.email}. Mot de passe temporaire : ${tempPassword}. Merci de le changer dès votre première connexion.`,
  });

  revalidatePath("/comptes");
}

export async function rejectAccountRequestAction(requestId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.ACCOUNTS_MANAGE);

  const request = await prisma.accountRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING" || request.organizationId !== session.user.organizationId) return;

  await prisma.accountRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "account_request.reject",
    entityType: "AccountRequest",
    entityId: requestId,
  });

  await emailChannel.send(`guest-${requestId}`, {
    userId: "guest",
    event: "account.rejected",
    title: "Demande de compte refusée — IPP Nord-Kivu 1",
    body: `Votre demande de compte (${request.email}) n'a pas été approuvée. Contactez l'informaticien de l'Inspection pour plus d'informations.`,
  });

  revalidatePath("/comptes");
}
