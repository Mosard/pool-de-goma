export type FicheField = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  options?: string[];
};

export const FICHE_DEFINITIONS: Record<"A1" | "C101" | "T1", { title: string; fields: FicheField[] }> = {
  A1: {
    title: "Fiche A1 — Identification & administration",
    fields: [
      { name: "regime", label: "Régime", type: "select", options: ["Public", "Privé", "Conventionné"] },
      { name: "effectifGarcons", label: "Effectif garçons", type: "number" },
      { name: "effectifFilles", label: "Effectif filles", type: "number" },
      { name: "nombreEnseignants", label: "Nombre d'enseignants", type: "number" },
      { name: "nombreSalles", label: "Nombre de salles de classe", type: "number" },
      { name: "accesEau", label: "Accès à l'eau potable", type: "select", options: ["Oui", "Non"] },
      { name: "accesElectricite", label: "Accès à l'électricité", type: "select", options: ["Oui", "Non"] },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
  C101: {
    title: "Fiche C101 — Contrôle pédagogique",
    fields: [
      { name: "presenceEnseignant", label: "Présence de l'enseignant", type: "select", options: ["Oui", "Non"] },
      { name: "cahierPreparation", label: "Cahier de préparation à jour", type: "select", options: ["Oui", "Non", "Partiel"] },
      { name: "respectProgramme", label: "Respect du programme officiel", type: "select", options: ["Oui", "Non", "Partiel"] },
      { name: "qualitePedagogie", label: "Qualité pédagogique observée (1-5)", type: "number" },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
  T1: {
    title: "Fiche T1 — Évaluation des résultats",
    fields: [
      { name: "elevesPresentes", label: "Élèves présentés (examens)", type: "number" },
      { name: "elevesAdmis", label: "Élèves admis", type: "number" },
      { name: "tauxReussite", label: "Taux de réussite (%)", type: "number" },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
};

export type FicheType = keyof typeof FICHE_DEFINITIONS;
