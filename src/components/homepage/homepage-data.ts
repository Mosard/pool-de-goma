// Contenu éditorial de la page d'accueil publique.
// Tout ce fichier est volontairement provisoire (voir MASTER_INSPECTION_NORD_KIVU_1.md
// §24 « Éléments encore à fournir ») : noms, attributions, contacts et chiffre
// clé sont des espaces réservés destinés à être remplacés par les données
// officielles de l'Inspection, sans toucher aux composants qui les affichent.

export type MissionItem = {
  title: string;
  description: string;
};

export const MISSION_ITEMS: MissionItem[] = [
  {
    title: "Contrôler",
    description: "Vérifier que les établissements scolaires respectent les normes et procédures en vigueur.",
  },
  {
    title: "Évaluer",
    description: "Mesurer la qualité de l'enseignement et le niveau d'apprentissage des élèves.",
  },
  {
    title: "Encadrer",
    description: "Accompagner les enseignants et les directions d'école dans l'amélioration de leurs pratiques.",
  },
  {
    title: "Accompagner",
    description: "Soutenir la transformation numérique et pédagogique de l'enseignement, jusqu'à l'élève.",
  },
];

export type TrilogyPillar = {
  title: string;
  body: string;
};

// Structure prête à recevoir la formulation officielle de la « trilogie de
// l'Inspection » (MASTER_INSPECTION_NORD_KIVU_1.md §3 et §24) — ne pas
// inventer de contenu définitif ici.
export const TRILOGY_PILLARS: TrilogyPillar[] = [
  { title: "Pilier I", body: "Formulation officielle à venir." },
  { title: "Pilier II", body: "Formulation officielle à venir." },
  { title: "Pilier III", body: "Formulation officielle à venir." },
];

export type AiStat = {
  value: string;
  label: string;
};

// "XX %" est un espace réservé assumé : ne jamais le remplacer par un chiffre
// inventé. Seule l'Inspection peut fournir la donnée réelle.
export const AI_STAT: AiStat = {
  value: "XX %",
  label: "Constat à confirmer par l'Inspection — part des élèves et enseignants utilisant déjà l'intelligence artificielle sans encadrement.",
};

export type ProgramStep = {
  step: string;
  title: string;
  body: string;
};

export const PROGRAM_STEPS: ProgramStep[] = [
  {
    step: "1",
    title: "Inspecteurs",
    body: "Former les inspecteurs itinérants à la réalité et aux usages de l'intelligence artificielle en milieu scolaire.",
  },
  {
    step: "2",
    title: "Enseignants",
    body: "Accompagner les enseignants dans une intégration raisonnée de ces outils dans leurs pratiques pédagogiques.",
  },
  {
    step: "3",
    title: "Établissements",
    body: "Doter les établissements de repères clairs, cohérents avec les programmes officiels.",
  },
  {
    step: "4",
    title: "Élèves",
    body: "Sensibiliser les élèves à un usage éthique, critique et responsable de l'intelligence artificielle.",
  },
];

export type LeadershipContact = {
  phone?: string;
  whatsapp?: string;
  email?: string;
};

export type LeadershipMember = {
  id: string;
  name: string;
  role: string;
  attribution?: string;
  contact: LeadershipContact;
};

// Nom, photo et contacts réels à fournir par l'Inspection — voir
// MASTER_INSPECTION_NORD_KIVU_1.md §13 et §24 (liste des dix IPPA et de
// leurs attributions non encore confirmée).
export const IPP_LEADER: LeadershipMember = {
  id: "ipp",
  name: "Nom de l'Inspecteur Principal Provincial",
  role: "Inspecteur Principal Provincial — Nord-Kivu 1",
  contact: {},
};

export const IPPA_MEMBERS: LeadershipMember[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ippa-${i + 1}`,
  name: `IPPA ${i + 1}`,
  role: "Inspecteur Principal Adjoint",
  attribution: "Attribution à préciser",
  contact: {},
}));

export type Activity = {
  title: string;
  body: string;
};

// Contenu de démonstration — remplacé par de vraies actions/reportages une
// fois le back-office éditorial et les médias disponibles.
export const ACTIVITIES: Activity[] = [
  {
    title: "Formation des inspecteurs itinérants",
    body: "Sessions de formation numérique organisées à l'attention des inspecteurs itinérants.",
  },
  {
    title: "Rentrée scolaire 2026-2027",
    body: "Lancement de la rentrée sous le signe de la rigueur numérique, à l'Institut de Goma (INSTIGO).",
  },
  {
    title: "Missions sur le terrain",
    body: "Contrôle et évaluation des établissements scolaires à travers les différents POOL de la province.",
  },
];
