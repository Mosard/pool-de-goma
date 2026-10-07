// Registre des définitions officielles (format 2) et en-tête commun.

import type { FicheDef, FieldDef } from "@/lib/fiches/types";
import { FICHE_FORMAT } from "@/lib/fiches/types";
import { A2, A3, A4, A5, A6, A11, A12 } from "@/lib/fiches/defs/administration";
import { C1, C2, C2B, C2C, C3, C3B, C5A, C6B } from "@/lib/fiches/defs/controle";
import { F1 } from "@/lib/fiches/defs/formation";
import { choice, checks, text } from "@/lib/fiches/defs/commun";

/** Les 16 fiches du dossier « Document itinerant » (décision Q2). */
export const OFFICIAL_FICHES: readonly FicheDef[] = [C1, C2, C2B, C2C, C3, C3B, C5A, C6B, A5, A11, A12, F1, A2, A3, A4, A6];

export const MODULE_LABELS: Record<FicheDef["module"], string> = {
  A: "Module I — Administration interne",
  C: "Module II — Contrôle de l'enseignement",
  F: "Module III — Formation en cours d'emploi",
  T: "Module IV — Testing",
};

export function getFicheDef(code: string, version: number): FicheDef | null {
  return OFFICIAL_FICHES.find((d) => d.code === code && d.version === version) ?? null;
}

/** Une définition stockée en base (FormTemplate.fieldsSchema) au format 2. */
export function isFicheDef(value: unknown): value is FicheDef {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as FicheDef).format === FICHE_FORMAT;
}

/**
 * Définition à utiliser pour un FormTemplate : celle du code (calculs et
 * contrôles à jour) si la version existe dans le registre, sinon l'instantané
 * JSON enregistré en base (une version n'est jamais modifiée).
 */
export function resolveFicheDef(template: { code: string; version: number; fieldsSchema: unknown }): FicheDef | null {
  return getFicheDef(template.code, template.version) ?? (isFicheDef(template.fieldsSchema) ? template.fieldsSchema : null);
}

/** Postes 01 à 05, année scolaire, ventilation et niveau : communs à toutes les fiches. */
export function commonHeaderFields(def: FicheDef): FieldDef[] {
  const fields: FieldDef[] = [
    text("entete.inspecteur", "01. Inspecteur", { prefill: "inspectorName", required: true }),
    choice("entete.inspecteurSexe", "Sexe", ["M", "F"], { prefill: "inspectorSex" }),
    text("entete.niveauDiscipline", "02. Niveau / Discipline (s)", {
      required: true,
      hint: "Maternel ou primaire ; au secondaire, la (les) discipline (s).",
    }),
    text("entete.posteAttache", "03. Poste d'attache", { prefill: "poolName", required: true }),
    text("entete.bp", "04. B.P."),
    text("entete.bpLieu", "04. à"),
    text("entete.telephone", "05. Téléphone", { prefill: "inspectorPhone" }),
    text("entete.email", "05. E-mail", { prefill: "inspectorEmail" }),
    text("entete.anneeScolaire", "Année scolaire", { prefill: "schoolYear", required: true }),
    checks("entete.destinataires", "Ventilation (destinataires)", def.destinataires),
  ];
  if (def.levels) fields.push(choice("entete.niveau", "Niveau", ["M", "P", "S"], { required: true, hint: "M : maternel ; P : primaire ; S : secondaire." }));
  return fields;
}
