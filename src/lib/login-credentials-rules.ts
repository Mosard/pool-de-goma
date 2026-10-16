import { z } from "zod";
import { USERNAME_PATTERN, USERNAME_RULE } from "@/lib/activation-token";

// Identifiant et mot de passe choisis par le titulaire depuis « Mon profil »
// (connexion sans Google). Règles pures, sans base de données : testables.

/** Une connexion Google plus ancienne ne suffit plus pour définir un mot de passe sans l'actuel. */
export const RECENT_GOOGLE_LOGIN_MINUTES = 15;

/**
 * Preuve d'identité de remplacement pour un compte qui n'a jamais eu de mot
 * de passe utilisable : une connexion Google RÉCENTE. Une session ancienne,
 * restée ouverte sur un appareil, ne permet donc pas de s'approprier le compte.
 */
export function isRecentGoogleLogin(authMethod: unknown, authAt: unknown, now = Date.now()): boolean {
  if (authMethod !== "google" || typeof authAt !== "number") return false;
  const age = now - authAt;
  return age >= 0 && age <= RECENT_GOOGLE_LOGIN_MINUTES * 60 * 1000;
}

/** Minutes restantes avant que la connexion Google ne soit plus « récente » (0 si elle ne l'est pas). */
export function recentGoogleMinutesLeft(authMethod: unknown, authAt: unknown, now = Date.now()): number {
  if (!isRecentGoogleLogin(authMethod, authAt, now)) return 0;
  return Math.max(1, Math.ceil((RECENT_GOOGLE_LOGIN_MINUTES * 60 * 1000 - (now - (authAt as number))) / 60000));
}

export const ownCredentialsSchema = z
  .object({
    username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN, USERNAME_RULE),
    password: z.union([z.literal(""), z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum")]),
    confirmation: z.string(),
    currentPassword: z.string().max(128),
  })
  .refine((d) => d.password === d.confirmation, { message: "Les deux mots de passe diffèrent", path: ["confirmation"] })
  .refine((d) => !d.password || d.password.toLowerCase() !== d.username, {
    message: "Le mot de passe ne doit pas être votre identifiant",
    path: ["password"],
  });

export type OwnCredentialsInput = z.infer<typeof ownCredentialsSchema>;
