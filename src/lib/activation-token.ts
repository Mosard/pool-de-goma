import crypto from "node:crypto";
import bcrypt from "bcryptjs";

// Utilitaires purs (aucun import applicatif) : partagés entre l'application
// et les scripts serveur de prisma/scripts, qui n'utilisent pas les alias @/.

/** Durée de validité d'un lien d'activation de compte. */
export const ACTIVATION_TTL_HOURS = 48;
/** Durée de validité d'un lien de réinitialisation remis par un administrateur. */
export const ASSISTED_RESET_TTL_HOURS = 24;

/**
 * Identifiant de connexion : 3 à 32 caractères, minuscules, chiffres, point,
 * tiret, soulignement ; commence par une lettre. Jamais de « @ », ce qui le
 * distingue d'une adresse e-mail à la connexion.
 */
export const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,31}$/;
export const USERNAME_RULE =
  "3 à 32 caractères : lettres minuscules sans accent, chiffres, point, tiret ou soulignement, en commençant par une lettre.";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Jeton brut (à transmettre au titulaire) et son empreinte (seule stockée en base). */
export function generateToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return { rawToken, tokenHash: hashToken(rawToken) };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Empreinte d'un secret aléatoire jamais conservé ni affiché : le compte n'a
 * aucun mot de passe utilisable tant que son titulaire ne l'a pas défini
 * lui-même via son lien d'activation.
 */
export async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
}

export function activationUrl(baseUrl: string, rawToken: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/activer-compte?token=${rawToken}`;
}

export function passwordResetUrl(baseUrl: string, rawToken: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/reinitialiser-mot-de-passe?token=${rawToken}`;
}
