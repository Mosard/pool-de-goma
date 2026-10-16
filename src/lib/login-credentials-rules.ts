import { z } from "zod";
import { USERNAME_PATTERN, USERNAME_RULE } from "@/lib/activation-token";

// Nom d'utilisateur et mot de passe changés par le titulaire depuis « Mon
// compte ». Règles pures, sans base de données : testables.
//
// Le nom d'utilisateur n'est qu'un moyen de connexion : toutes les données
// (journal, rapports, fiches, pointages…) sont liées à User.id, qui ne change
// jamais. En changer ne détache donc aucun historique.

/** Une connexion Google plus ancienne ne suffit plus pour remplacer le mot de passe actuel. */
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

const usernameField = z.string().trim().toLowerCase().regex(USERNAME_PATTERN, USERNAME_RULE);
const currentPasswordField = z.string().max(128);

export const usernameChangeSchema = z.object({
  username: usernameField,
  currentPassword: currentPasswordField,
});

export const passwordChangeSchema = z
  .object({
    password: z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum"),
    confirmation: z.string(),
    currentPassword: currentPasswordField,
  })
  .refine((d) => d.password === d.confirmation, { message: "Les deux mots de passe diffèrent", path: ["confirmation"] });

export type UsernameChangeInput = z.infer<typeof usernameChangeSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export type UsernameAvailability = "invalid" | "current" | "reserved" | "taken" | "available";

export const AVAILABILITY_MESSAGES: Record<UsernameAvailability, string> = {
  invalid: USERNAME_RULE,
  current: "C'est déjà votre nom d'utilisateur.",
  reserved: "Ce nom est réservé. Choisissez-en un autre.",
  taken: "Ce nom n'est pas disponible (déjà utilisé ou abandonné récemment par un autre compte). Choisissez-en un autre.",
  available: "Ce nom est disponible.",
};

/** Validation de forme seule (sans base) : la suite est vérifiée par checkUsernameAvailability. */
export function usernameFormatOk(value: string): boolean {
  return usernameField.safeParse(value).success;
}

// ─── Historique de sécurité ─────────────────────────────────────────────────

/** Actions du journal affichées dans « Sécurité et identifiants » (compte du titulaire seulement). */
export const SECURITY_HISTORY_ACTIONS = [
  "user.username_change",
  "user.password_change",
  // Version précédente (identifiant et mot de passe dans un même formulaire).
  "user.login_credentials_update",
  "user.reset_link_issued",
  "user.password_reset",
  "user.activate",
] as const;

export type SecurityEvent = { at: Date; label: string; detail: string | null };

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Libellé lisible d'une ligne du journal ; jamais de mot de passe (aucun n'y figure). */
export function describeSecurityEvent(row: {
  action: string;
  createdAt: Date;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
}): SecurityEvent {
  const oldV = (row.oldValue ?? {}) as Record<string, unknown>;
  const newV = (row.newValue ?? {}) as Record<string, unknown>;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  switch (row.action) {
    case "user.username_change": {
      const from = str(oldV.username);
      const to = str(newV.username);
      return {
        at: row.createdAt,
        label: "Nom d'utilisateur modifié",
        detail: from ? `${from} → ${to ?? "?"}` : to ? `défini : ${to}` : null,
      };
    }
    case "user.password_change":
      return { at: row.createdAt, label: "Mot de passe modifié", detail: null };
    case "user.login_credentials_update": {
      const parts = [meta.usernameChanged ? "nom d'utilisateur" : null, meta.passwordChanged ? "mot de passe" : null].filter(Boolean);
      return { at: row.createdAt, label: "Identifiants de connexion modifiés", detail: parts.length ? parts.join(" et ") : null };
    }
    case "user.reset_link_issued":
      return { at: row.createdAt, label: "Lien de réinitialisation remis par un administrateur", detail: null };
    case "user.password_reset":
      return { at: row.createdAt, label: "Mot de passe réinitialisé par lien", detail: null };
    case "user.activate":
      return { at: row.createdAt, label: "Compte activé", detail: null };
    default:
      return { at: row.createdAt, label: row.action, detail: null };
  }
}
