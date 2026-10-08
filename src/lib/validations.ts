import { z } from "zod";
import { USERNAME_PATTERN, USERNAME_RULE } from "@/lib/activation-token";
import { COUNT_INVALID, OPTIONS_SECONDARY_ONLY, isSecondaryType, normalizeOptions, parseCount } from "@/lib/school-fields";

const usernameField = z.string().trim().toLowerCase().regex(USERNAME_PATTERN, USERNAME_RULE);
const newPasswordField = z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum");

export const poolSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  code: z.string().min(2, "Code requis"),
});

// Fiche publique d'un POOL (Paramètres → POOL). Le slug fixe l'URL
// /pools/<slug> ; vide = POOL non publié sur le site. Coordonnées publiées :
// adresse officielle et e-mail institutionnel uniquement.
export const poolProfileSchema = z.object({
  name: z.string().trim().min(2, "Nom officiel requis").max(120),
  slug: z
    .string()
    .trim()
    .max(60, "60 caractères maximum")
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Minuscules, chiffres et tirets uniquement (ex. rutshuru-1)"),
  address: z.string().trim().max(300, "300 caractères maximum"),
  officialEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("E-mail invalide").max(120)]),
  officePhone: z.union([
    z.literal(""),
    z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Numéro invalide (chiffres, espaces, + ; 6 à 20 caractères)"),
  ]),
});

// Ce que le chef de POOL complète lui-même sur la fiche de SON POOL.
export const poolContactSchema = poolProfileSchema.pick({ address: true, officialEmail: true, officePhone: true });

export const functionSchema = z.object({
  label: z.string().min(2, "Nom requis"),
  description: z.string().optional().or(z.literal("")),
  scope: z.enum(["PROVINCE", "POOL"]),
});

// Nombre de classes / d'enseignants : vide = non renseigné (null).
const schoolCountField = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    const n = parseCount(v);
    if (n === "invalid") {
      ctx.addIssue({ code: "custom", message: COUNT_INVALID });
      return z.NEVER;
    }
    return n;
  });

export const schoolSchema = z
  .object({
    poolId: z.string().min(1, "Pool requis"),
    name: z.string().min(2, "Nom requis"),
    code: z.string().trim().min(2, "Code requis"),
    province: z.string().min(2, "Province requise"),
    territoire: z.string().min(2, "Territoire requis"),
    address: z.string().optional().or(z.literal("")),
    director: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    type: z.string().optional().or(z.literal("")),
    approvalDecree: z
      .string()
      .trim()
      .max(200, "200 caractères maximum")
      .nullish()
      .transform((v) => v || null),
    classCount: schoolCountField,
    teacherCount: schoolCountField,
    // Absent du formulaire quand l'école n'est pas secondaire.
    options: z
      .string()
      .max(1000, "1000 caractères maximum")
      .nullish()
      .transform((v) => normalizeOptions(v)),
  })
  .superRefine((v, ctx) => {
    if (v.options && !isSecondaryType(v.type)) ctx.addIssue({ code: "custom", path: ["options"], message: OPTIONS_SECONDARY_ONLY });
  });

export const userSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  username: z.union([z.literal(""), usernameField]).optional(),
  roleId: z.string().min(1, "Rôle requis"),
  poolId: z.string().optional().or(z.literal("")),
  sex: z.enum(["M", "F"]).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export const accountRequestSchema = z
  .object({
    name: z.string().trim().min(2, "Nom complet requis").max(120),
    email: z.string().trim().email("Email invalide"),
    username: usernameField,
    password: newPasswordField,
    confirmation: z.string(),
    phone: z.string().optional().or(z.literal("")),
    requestedRoleId: z.string().optional().or(z.literal("")),
    poolId: z.string().optional().or(z.literal("")),
    message: z.string().max(1000).optional().or(z.literal("")),
  })
  .refine((d) => d.password === d.confirmation, { message: "Les deux mots de passe diffèrent", path: ["confirmation"] })
  .refine((d) => d.password.toLowerCase() !== d.username, {
    message: "Le mot de passe ne doit pas être votre identifiant",
    path: ["password"],
  });

export const assignmentSchema = z.object({
  schoolId: z.string().min(1, "École requise"),
  inspectorId: z.string().min(1, "Inspecteur requis"),
  // Date d'effet (AAAA-MM-JJ), facultative : aujourd'hui par défaut.
  effectiveFrom: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide")
    .optional(),
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

// Identifiant de connexion OU adresse e-mail (comptes antérieurs).
export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Identifiant requis").max(254),
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Identifiant ou e-mail requis").max(254),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Jeton manquant"),
    password: newPasswordField,
    confirmation: z.string(),
  })
  .refine((d) => d.password === d.confirmation, { message: "Les deux mots de passe diffèrent", path: ["confirmation"] });
