import { z } from "zod";

export const poolSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  code: z.string().min(2, "Code requis"),
});

// Fiche publique d'un POOL (Paramètres → POOL). Le slug fixe l'URL
// /pools/<slug> ; vide = POOL non publié sur le site.
export const POOL_PHONES_MAX = 3;

export const poolProfileSchema = z.object({
  name: z.string().trim().min(2, "Nom officiel requis").max(120),
  slug: z
    .string()
    .trim()
    .max(60, "60 caractères maximum")
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Minuscules, chiffres et tirets uniquement (ex. rutshuru-1)"),
  address: z.string().trim().max(300, "300 caractères maximum"),
  phones: z
    .array(z.string().trim().regex(/^\+?[0-9][0-9 .()-]{5,19}$/, "Numéro invalide (ex. +243 81 234 5678)"))
    .max(POOL_PHONES_MAX, `${POOL_PHONES_MAX} numéros maximum`),
});

export const functionSchema = z.object({
  label: z.string().min(2, "Nom requis"),
  description: z.string().optional().or(z.literal("")),
  scope: z.enum(["PROVINCE", "POOL"]),
});

export const schoolSchema = z.object({
  poolId: z.string().min(1, "Pool requis"),
  name: z.string().min(2, "Nom requis"),
  code: z.string().min(2, "Code requis"),
  province: z.string().min(2, "Province requise"),
  territoire: z.string().min(2, "Territoire requis"),
  address: z.string().optional().or(z.literal("")),
  director: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  type: z.string().optional().or(z.literal("")),
});

export const userSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  roleId: z.string().min(1, "Rôle requis"),
  poolId: z.string().optional().or(z.literal("")),
  sex: z.enum(["M", "F"]).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export const accountRequestSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional().or(z.literal("")),
  requestedRoleId: z.string().optional().or(z.literal("")),
  poolId: z.string().optional().or(z.literal("")),
  message: z.string().optional().or(z.literal("")),
});

export const assignmentSchema = z.object({
  schoolId: z.string().min(1, "École requise"),
  inspectorId: z.string().min(1, "Inspecteur requis"),
});

export const inspectionSchema = z.object({
  schoolId: z.string().min(1, "École requise"),
  inspectorId: z.string().min(1, "Inspecteur requis"),
  scheduledDate: z.string().optional().or(z.literal("")),
});

export const reportSchema = z.object({
  summary: z.string().min(1, "Résumé requis"),
  recommendations: z.string().optional().or(z.literal("")),
});

export const commentSchema = z.object({
  content: z.string().min(1, "Commentaire vide"),
});

export const profileSchema = z.object({
  prenom: z.string().optional().or(z.literal("")),
  postnom: z.string().optional().or(z.literal("")),
  sex: z.enum(["M", "F"]).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  dateNaissance: z.string().optional().or(z.literal("")),
  nombreEnfants: z.string().optional().or(z.literal("")),
});

export const transitionSchema = z.object({
  toStatusKey: z.string().min(1, "Statut requis"),
  comment: z.string().optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Jeton manquant"),
  password: z.string().min(8, "8 caractères minimum"),
});
