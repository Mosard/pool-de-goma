import { z } from "zod";

export const schoolSchema = z.object({
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
  role: z.enum(["CHEF_POOL", "INSPECTEUR", "EXPLOITANT"]),
  phone: z.string().optional().or(z.literal("")),
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

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
