import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AccountError, isReservedUsername, isUsernameTaken } from "@/lib/accounts";
import type { OwnCredentialsInput } from "@/lib/login-credentials-rules";

/**
 * Le titulaire définit ou change SON identifiant et/ou SON mot de passe, pour
 * se connecter sans Google. Preuve exigée : le mot de passe actuel, ou une
 * connexion Google récente (comptes reliés à Google qui n'ont jamais eu de
 * mot de passe utilisable). Aucun administrateur ne passe par ici.
 */
export async function setOwnLoginCredentials(params: {
  userId: string;
  organizationId: string;
  input: OwnCredentialsInput;
  recentGoogle: boolean;
  /** Super Admin réel : peut prendre un identifiant réservé (admin, ipp…). */
  mayUseReservedUsername: boolean;
}): Promise<{ username: string; usernameChanged: boolean; passwordChanged: boolean }> {
  const { input } = params;
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, status: true, username: true, passwordHash: true },
  });
  if (!user || user.status !== "ACTIVE") throw new AccountError("Compte introuvable ou inactif.");

  const usernameChanged = input.username !== user.username;
  const passwordChanged = input.password !== "";
  if (!usernameChanged && !passwordChanged) throw new AccountError("Aucune modification à enregistrer.");

  const currentPasswordOk = input.currentPassword !== "" && (await bcrypt.compare(input.currentPassword, user.passwordHash));
  if (!currentPasswordOk && !params.recentGoogle) {
    throw new AccountError(
      input.currentPassword
        ? "Mot de passe actuel incorrect."
        : "Par sécurité, saisissez votre mot de passe actuel, ou reconnectez-vous avec Google puis revenez ici dans les 15 minutes."
    );
  }

  if (usernameChanged) {
    if (!params.mayUseReservedUsername && isReservedUsername(input.username)) {
      throw new AccountError(`L'identifiant « ${input.username} » est réservé. Choisissez-en un autre.`);
    }
    if (await isUsernameTaken(input.username)) {
      throw new AccountError(`L'identifiant « ${input.username} » est déjà utilisé. Choisissez-en un autre.`);
    }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(usernameChanged && { username: input.username }),
        ...(passwordChanged && { passwordHash: await bcrypt.hash(input.password, 10) }),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AccountError(`L'identifiant « ${input.username} » est déjà utilisé. Choisissez-en un autre.`);
    }
    throw e;
  }

  // Journal : ce qui a changé et la preuve utilisée, jamais les valeurs.
  await logAudit({
    actorId: user.id,
    organizationId: params.organizationId,
    action: "user.login_credentials_update",
    entityType: "User",
    entityId: user.id,
    metadata: { usernameChanged, passwordChanged, proof: currentPasswordOk ? "password" : "google_recent" },
  });

  return { username: input.username, usernameChanged, passwordChanged };
}
