// Partie rédigée du rapport de synthèse : sections génériques, décrites ici
// et versionnées (Synthesis.formatVersion). Quand les modèles officiels
// fixeront la structure, ajouter un format 2 sans toucher au format 1 : les
// synthèses déjà rédigées gardent le leur.

export type SectionDef = { key: string; title: string; help: string; required: boolean };

export const SYNTHESIS_FORMATS: Record<number, SectionDef[]> = {
  1: [
    { key: "objet", title: "Objet et périmètre", help: "Ce que couvre la synthèse : période, écoles, types de fiches.", required: false },
    { key: "analyse", title: "Analyse des rapports", help: "Lecture d'ensemble des rapports retenus.", required: true },
    { key: "constats", title: "Principaux constats", help: "Points forts, difficultés et tendances observés.", required: true },
    { key: "recommandations", title: "Recommandations", help: "Mesures proposées aux écoles, aux inspecteurs ou au bureau IPP.", required: false },
    { key: "conclusion", title: "Conclusion", help: "Appréciation finale de l'exploitant.", required: true },
  ],
};

export const CURRENT_FORMAT_VERSION = 1;
export const SECTION_MAX_LENGTH = 20_000;

export type SynthesisContent = { sections: Record<string, string> };

export function formatOf(version: number): SectionDef[] {
  return SYNTHESIS_FORMATS[version] ?? SYNTHESIS_FORMATS[CURRENT_FORMAT_VERSION];
}

/** Lit le contenu stocké (JSON) en ne gardant que des textes. */
export function readContent(raw: unknown): SynthesisContent {
  const sections = (raw as { sections?: unknown } | null)?.sections;
  const out: Record<string, string> = {};
  if (sections && typeof sections === "object") {
    for (const [k, v] of Object.entries(sections as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  }
  return { sections: out };
}

/**
 * Contenu saisi → contenu enregistré : seules les sections du format sont
 * gardées, en texte brut, longueur bornée (l'affichage échappe toujours le texte).
 */
export function sanitizeContent(version: number, input: Record<string, unknown>): SynthesisContent {
  const sections: Record<string, string> = {};
  for (const s of formatOf(version)) {
    const v = input[s.key];
    sections[s.key] = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, SECTION_MAX_LENGTH) : "";
  }
  return { sections };
}

/** Sections obligatoires encore vides (bloquent la soumission). */
export function missingSections(version: number, content: SynthesisContent): SectionDef[] {
  return formatOf(version).filter((s) => s.required && !(content.sections[s.key] ?? "").trim());
}
