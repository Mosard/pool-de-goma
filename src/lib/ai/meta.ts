// Libellés et repères visuels de la fonctionnalité IA, sans accès à la base :
// importables par les composants client.

export const AI_GRAVITY_ORDER = ["CRITIQUE", "ELEVEE", "MODEREE", "FAIBLE"] as const;
export type AiGravityKey = (typeof AI_GRAVITY_ORDER)[number];

export const AI_GRAVITY_LABELS: Record<AiGravityKey, string> = {
  CRITIQUE: "Critique",
  ELEVEE: "Élevée",
  MODEREE: "Modérée",
  FAIBLE: "Faible",
};

/** Bandeau de gravité : couleur pleine + texte, jamais la couleur seule. */
export const AI_GRAVITY_STYLES: Record<AiGravityKey, { badge: string; edge: string }> = {
  CRITIQUE: { badge: "bg-red-600 text-white", edge: "border-l-red-600" },
  ELEVEE: { badge: "bg-orange-500 text-white", edge: "border-l-orange-500" },
  MODEREE: { badge: "bg-amber-300 text-amber-950", edge: "border-l-amber-400" },
  FAIBLE: { badge: "bg-slate-200 text-slate-700", edge: "border-l-slate-300" },
};

export type AiDecisionStatusKey = "PROPOSEE" | "VALIDEE" | "REJETEE" | "AJUSTEE";

export const AI_STATUS_LABELS: Record<AiDecisionStatusKey, string> = {
  PROPOSEE: "Proposée",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
  AJUSTEE: "Ajustée et validée",
};

export const AI_STATUS_COLORS: Record<AiDecisionStatusKey, "gray" | "green" | "red" | "blue"> = {
  PROPOSEE: "gray",
  VALIDEE: "green",
  REJETEE: "red",
  AJUSTEE: "blue",
};

export const AI_REACTION_LABELS: Record<string, string> = {
  VALIDATION: "a validé la décision",
  REJET: "a rejeté la décision",
  AJUSTEMENT: "a ajusté puis validé la décision",
  COMMENTAIRE: "a commenté",
  SERVICE_DESIGNE: "a désigné le service responsable",
};

/** Source citée par l'analyse (champ `sources` d'un problème). */
export type AiSource = {
  rapport_id: string;
  date: string;
  site: string;
  extrait: string;
  traduction: string;
};

export const AI_LIMITS = {
  /** Rapports envoyés au modèle par analyse (coût et durée maîtrisés). */
  maxReports: 300,
  comment: 2000,
  motif: 1000,
  decision: 2000,
} as const;
