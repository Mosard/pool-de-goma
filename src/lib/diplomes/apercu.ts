import type { DiplomaSearchOutcome } from "./types";

// Aperçu des états de résultat, pour concevoir et tester l'interface AVANT
// l'intégration des données provinciales. Données entièrement fictives,
// isolées ici, jamais enregistrées en base et jamais servies en production :
// chaque appelant vérifie isStatePreviewAllowed() côté serveur.

/** Développement local, tests et déploiements Preview de Vercel (base de démonstration) ; jamais la production. */
export function isStatePreviewAllowed(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "preview";
  return process.env.NODE_ENV !== "production";
}

const EXAMPLE_POOL = {
  name: "Exemple",
  address: "Adresse fictive — aperçu de l'interface",
  officialEmail: "pool.exemple@exemple.invalid",
  pickupInstructions: "Indications fictives : elles seront saisies par l'administration pour chaque bureau.",
};

export const PREVIEW_STATES: { key: string; label: string; outcome: DiplomaSearchOutcome }[] = [
  { key: "ipp", label: "Disponible à l'IPP", outcome: { kind: "TROUVE", result: { status: "DISPONIBLE_IPP" } } },
  {
    key: "pool",
    label: "Disponible dans un POOL",
    outcome: { kind: "TROUVE", result: { status: "DISPONIBLE_POOL", pool: EXAMPLE_POOL } },
  },
  { key: "transfert", label: "En cours de transfert", outcome: { kind: "TROUVE", result: { status: "EN_TRANSFERT" } } },
  { key: "retire", label: "Déjà retiré", outcome: { kind: "TROUVE", result: { status: "RETIRE" } } },
  {
    key: "retrait-declare",
    label: "Retrait en attente de confirmation",
    outcome: { kind: "TROUVE", result: { status: "RETRAIT_A_CONFIRMER" } },
  },
  { key: "aucun", label: "Aucun résultat", outcome: { kind: "AUCUN_RESULTAT" } },
  { key: "homonymes", label: "Plusieurs correspondances", outcome: { kind: "PLUSIEURS_CORRESPONDANCES" } },
  { key: "quota", label: "Trop de recherches", outcome: { kind: "TROP_DE_RECHERCHES" } },
  { key: "erreur", label: "Erreur technique", outcome: { kind: "ERREUR" } },
  { key: "indisponible", label: "Service non connecté", outcome: { kind: "SERVICE_INDISPONIBLE" } },
];

export function previewOutcome(key: unknown): DiplomaSearchOutcome | null {
  return PREVIEW_STATES.find((s) => s.key === key)?.outcome ?? null;
}
