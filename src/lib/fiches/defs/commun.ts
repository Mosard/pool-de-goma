// Éléments communs aux définitions des fiches : cases de ventilation,
// mentions d'en-tête, postes notés et signatures. Libellés repris des fiches.

import type { ConversionMethod, FieldDef, RatedPosteDef, SignatureDef } from "@/lib/fiches/types";

/** Ventilation de l'en-tête, telle qu'imprimée sur la plupart des fiches du module C. */
export const DEST_C = ["Intéressé", "Etablissement", "IGE", "IPP", "Pool", "Proved", "Gestionnaire", "A.T./Bourgm.", "Secteur", "Classement"];
/** Ventilation des fiches du module A (A2, A3, A4, A11, A12). */
export const DEST_A = ["Intéressé", "Etablissement", "IGE", "IPP", "Pool", "Proved", "Gestionnaire", "A.T./Bourg.", "Secteur", "Classement"];

/** Codes officiels de l'inspection itinérante (tableau synoptique A0 du module). */
export const OFFICIAL_CODES = [
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A11", "A12",
  "C1", "C2", "C2B", "C3", "C3B", "C3M", "C4", "C5A", "C5B", "C6A", "C6B", "C7", "C8",
  "F1", "F2", "F3", "F4",
  "T1", "T2",
];

export const MOIS = ["Septembre", "Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août"];

export const ETABLISSEMENT: FieldDef = { kind: "field", id: "entete.etablissement", label: "06. Etablissement", type: "text", prefill: "schoolName", required: true };
export const NOM_CE: FieldDef = { kind: "field", id: "entete.nomCE", label: "07. Nom du Chef d'Etablissement", type: "text", prefill: "schoolDirector" };

/** Poste noté dont les rubriques sont numérotées `<id>.1`, `<id>.2`, … dans l'ordre de la fiche. */
export function poste(
  id: string,
  label: string,
  labels: string[],
  conversion: ConversionMethod | null,
  opts: Partial<Pick<RatedPosteDef, "scale" | "conseils" | "conseilsLabel" | "freeItems" | "showIf">> & { nums?: Record<number, string> } = {}
): RatedPosteDef {
  return {
    kind: "rated",
    id,
    label,
    scale: opts.scale ?? "0-4",
    conversion,
    items: labels.map((l, i) => ({ id: `${id}.${i + 1}`, label: l, ...(opts.nums?.[i + 1] ? { num: opts.nums[i + 1] } : {}) })),
    conseils: opts.conseils ?? true,
    ...(opts.conseilsLabel ? { conseilsLabel: opts.conseilsLabel } : {}),
    ...(opts.freeItems ? { freeItems: opts.freeItems } : {}),
    ...(opts.showIf ? { showIf: opts.showIf } : {}),
  };
}

export function signature(id: string, label: string, opts: Partial<Omit<SignatureDef, "kind" | "id" | "label">> = {}): SignatureDef {
  return { kind: "signature", id, label, ...opts };
}

export const SIG_INSPECTEUR = signature("sig.inspecteur", "Signature de l'Inspecteur", { required: true });

export const MENTION_PRISE_CONNAISSANCE = "Pour prise de connaissance et réception";

export function text(id: string, label: string, opts: Partial<Omit<FieldDef, "kind" | "id" | "label" | "type">> = {}): FieldDef {
  return { kind: "field", id, label, type: "text", ...opts };
}
export function textarea(id: string, label: string, opts: Partial<Omit<FieldDef, "kind" | "id" | "label" | "type">> = {}): FieldDef {
  return { kind: "field", id, label, type: "textarea", ...opts };
}
export function number(id: string, label: string, opts: Partial<Omit<FieldDef, "kind" | "id" | "label" | "type">> = {}): FieldDef {
  return { kind: "field", id, label, type: "number", ...opts };
}
export function date(id: string, label: string, opts: Partial<Omit<FieldDef, "kind" | "id" | "label" | "type">> = {}): FieldDef {
  return { kind: "field", id, label, type: "date", ...opts };
}
export function choice(id: string, label: string, options: string[], opts: Partial<Omit<FieldDef, "kind" | "id" | "label" | "type" | "options">> = {}): FieldDef {
  return { kind: "field", id, label, type: "choice", options, ...opts };
}
export function checks(id: string, label: string, options: string[], opts: Partial<Omit<FieldDef, "kind" | "id" | "label" | "type" | "options">> = {}): FieldDef {
  return { kind: "field", id, label, type: "checks", options, ...opts };
}
