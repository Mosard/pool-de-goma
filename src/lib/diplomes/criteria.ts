import { z } from "zod";
import type { DiplomaSearchCriteria } from "./types";

// Critères de recherche PROVISOIRES : le format réel du fichier Excel du
// service des titres n'est pas encore connu. Ils sont définis ici seulement
// (formulaire, validation serveur, tests) pour pouvoir être adaptés sans
// toucher aux composants.
//
// Confidentialité : un nom seul ne suffit jamais. Nom, prénom, année de
// réussite et établissement sont exigés ; le post-nom reste facultatif tant
// que l'on ne sait pas s'il figure dans le fichier.

/** Première année de réussite proposée (provisoire). */
export const FIRST_DIPLOMA_YEAR = 1970;

export function diplomaYears(now = new Date()): number[] {
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= FIRST_DIPLOMA_YEAR; y--) years.push(y);
  return years;
}

const namePart = (label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(2, `${label} : au moins 2 caractères.`)
    .max(60, `${label} : 60 caractères au maximum.`)
    .regex(/^[\p{L}][\p{L}' .-]*$/u, `${label} : lettres, espaces, apostrophes et tirets seulement.`);

export const diplomaSearchSchema = z.object({
  nom: namePart("Le nom"),
  postNom: z
    .string()
    .trim()
    .max(60, "Le post-nom : 60 caractères au maximum.")
    .regex(/^([\p{L}][\p{L}' .-]*)?$/u, "Le post-nom : lettres, espaces, apostrophes et tirets seulement.")
    .optional()
    .transform((v) => (v ? v : null)),
  prenom: namePart("Le prénom"),
  annee: z.coerce
    .number({ error: "Choisissez l'année de réussite." })
    .int("Choisissez l'année de réussite.")
    .refine((y) => y >= FIRST_DIPLOMA_YEAR && y <= new Date().getFullYear(), "Choisissez l'année de réussite."),
  etablissement: z
    .string({ error: "Indiquez l'établissement scolaire." })
    .trim()
    .min(3, "Indiquez l'établissement scolaire.")
    .max(150, "Le nom de l'établissement : 150 caractères au maximum."),
});

export type DiplomaFieldErrors = Partial<Record<keyof DiplomaSearchCriteria, string>>;

export function parseDiplomaCriteria(
  input: Record<string, unknown>
): { ok: true; criteria: DiplomaSearchCriteria } | { ok: false; errors: DiplomaFieldErrors } {
  const parsed = diplomaSearchSchema.safeParse(input);
  if (parsed.success) return { ok: true, criteria: parsed.data };
  const errors: DiplomaFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof DiplomaSearchCriteria;
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

/**
 * Forme de comparaison des noms (majuscules, sans accents ni ponctuation,
 * espaces réduits), pour une correspondance EXACTE avec le futur fichier.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
