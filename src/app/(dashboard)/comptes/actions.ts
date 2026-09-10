"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { emailChannel } from "@/lib/notifications/channels/email";

export async function approveAccountRequestAction(requestId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.ACCOUNTS_MANAGE);

  const request = await prisma.accountRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") return;

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const role = request.requestedRoleId
    ? await prisma.roleDefinition.findUnique({ where: { id: request.requestedRoleId } })
    : null;

  const user = await prisma.user.create({
    data: {
      name: request.name,
      email: request.email.toLowerCase(),
      passwordHash,
      phone: request.phone,
      status: "ACTIVE",
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
  if (!request || request.status !== "PENDING") return;

  await prisma.accountRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
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
