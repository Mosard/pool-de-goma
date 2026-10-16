import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AccountError, isReservedUsername, isUsernameTaken } from "@/lib/accounts";
import { normalizeUsername } from "@/lib/activation-token";
import {
  describeSecurityEvent,
  SECURITY_HISTORY_ACTIONS,
  usernameFormatOk,
  type PasswordChangeInput,
  type SecurityEvent,
  type UsernameAvailability,
  type UsernameChangeInput,
} from "@/lib/login-credentials-rules";

// Le titulaire change SON nom d'utilisateur ou SON mot de passe (« Mon
// compte »). Preuve exigée : le mot de passe actuel, ou une connexion Google
// récente (comptes reliés à Google sans mot de passe utilisable). Aucun
// administrateur ne passe par ici. User.id n'est jamais modifié : toutes les
// données et tout le journal restent rattachés au même compte.

type Actor = {
  userId: string;
  organizationId: string;
  recentGoogle: boolean;
  /** Super Admin réel : peut prendre un nom réservé (admin, ipp…). */
  mayUseReservedUsername: boolean;
};

async function loadActiveUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, username: true, passwordHash: true },
  });
  if (!user || user.status !== "ACTIVE") throw new AccountError("Compte introuvable ou inactif.");
  return user;
}

/** Vérifie la preuve d'identité ; renvoie le moyen utilisé (consigné au journal). */
async function requireProof(passwordHash: string, currentPassword: string, recentGoogle: boolean): Promise<"password" | "google_recent"> {
  if (currentPassword && (await bcrypt.compare(currentPassword, passwordHash))) return "password";
  if (recentGoogle) return "google_recent";
  throw new AccountError(
    currentPassword
      ? "Mot de passe actuel incorrect."
      : "Par sécurité, saisissez votre mot de passe actuel, ou reconnectez-vous avec Google puis revenez ici dans les 15 minutes."
  );
}

export async function checkUsernameAvailability(
  userId: string,
  raw: string,
  mayUseReservedUsername: boolean
): Promise<UsernameAvailability> {
  const username = normalizeUsername(raw);
  if (!usernameFormatOk(username)) return "invalid";
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (user?.username === username) return "current";
  if (!mayUseReservedUsername && isReservedUsername(username)) return "reserved";
  return (await isUsernameTaken(username)) ? "taken" : "available";
}

export async function changeOwnUsername(actor: Actor, input: UsernameChangeInput): Promise<{ username: string; previous: string | null }> {
  const user = await loadActiveUser(actor.userId);
  if (input.username === user.username) throw new AccountError("C'est déjà votre nom d'utilisateur.");
  const proof = await requireProof(user.passwordHash, input.currentPassword, actor.recentGoogle);

  const availability = await checkUsernameAvailability(user.id, input.username, actor.mayUseReservedUsername);
  if (availability === "reserved") throw new AccountError(`Le nom « ${input.username} » est réservé. Choisissez-en un autre.`);
  if (availability === "taken") throw new AccountError(`Le nom « ${input.username} » est déjà utilisé. Choisissez-en un autre.`);

  try {
    // Seul le champ username change : l'identifiant interne (User.id) reste le même.
    await prisma.user.update({ where: { id: user.id }, data: { username: input.username } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AccountError(`Le nom « ${input.username} » est déjà utilisé. Choisissez-en un autre.`);
    }
    throw e;
  }

  // Historique de sécurité : l'ancien et le nouveau nom sont conservés.
  await logAudit({
    actorId: user.id,
    organizationId: actor.organizationId,
    action: "user.username_change",
    entityType: "User",
    entityId: user.id,
    oldValue: { username: user.username },
    newValue: { username: input.username },
    metadata: { proof },
  });

  return { username: input.username, previous: user.username };
}

export async function changeOwnPassword(actor: Actor, input: PasswordChangeInput): Promise<void> {
  const user = await loadActiveUser(actor.userId);
  if (user.username && input.password.toLowerCase() === user.username) {
    throw new AccountError("Le mot de passe ne doit pas être votre nom d'utilisateur.");
  }
  const proof = await requireProof(user.passwordHash, input.currentPassword, actor.recentGoogle);

  // Seule l'empreinte est enregistrée ; le mot de passe n'est jamais conservé ni journalisé.
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.password, 10) } });

  await logAudit({
    actorId: user.id,
    organizationId: actor.organizationId,
    action: "user.password_change",
    entityType: "User",
    entityId: user.id,
    metadata: { proof },
  });
}

/** Derniers événements de sécurité du compte du titulaire (lui seul les voit ici). */
export async function loadSecurityHistory(userId: string, take = 8): Promise<SecurityEvent[]> {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "User", entityId: userId, action: { in: [...SECURITY_HISTORY_ACTIONS] } },
    orderBy: { createdAt: "desc" },
    take,
    select: { action: true, createdAt: true, oldValue: true, newValue: true, metadata: true },
  });
  return rows.map(describeSecurityEvent);
}
