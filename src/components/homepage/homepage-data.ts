import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  MessagesSquare,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

// Contenu éditorial de la page d'accueil publique.
// La trilogie, le chiffre IA (discours RAP2026) et les attributions IPPA
// connues sont désormais du contenu réel fourni par l'Inspection. Ce qui
// reste un espace réservé (noms/contacts nominatifs, 4 IPPA restants) est
// signalé au cas par cas — voir MASTER_INSPECTION_NORD_KIVU_1.md §24.

export type MissionItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const MISSION_ITEMS: MissionItem[] = [
  {
    title: "Contrôler",
    description: "Vérifier que les établissements scolaires respectent les normes et procédures en vigueur.",
    icon: ShieldCheck,
  },
  {
    title: "Évaluer",
    description: "Mesurer la qualité de l'enseignement et le niveau d'apprentissage des élèves.",
    icon: ClipboardCheck,
  },
  {
    title: "Encadrer",
    description: "Accompagner les enseignants et les directions d'école dans l'amélioration de leurs pratiques.",
    icon: Users,
  },
  {
    title: "Accompagner",
    description: "Soutenir la transformation numérique et pédagogique de l'enseignement, jusqu'à l'élève.",
    icon: HeartHandshake,
  },
];

export type TrilogyPillar = {
  number: string;
  title: string;
  body: string;
};

// Formulation officielle de la « trilogie de l'Inspection » (fournie par
// l'Inspection). Le contrôle administratif est volontairement distinct de
// ces trois piliers — voir ADMINISTRATIVE_CONTROL plus bas.
export const TRILOGY_PILLARS: TrilogyPillar[] = [
  {
    number: "01",
    title: "Contrôle pédagogique",
    body: "Qualité de l'enseignement, suivi des programmes et accompagnement des enseignants.",
  },
  {
    number: "02",
    title: "Contrôle financier",
    body: "Transparence, traçabilité et gouvernance des ressources de l'enseignement.",
  },
  {
    number: "03",
    title: "Contrôle de la formation",
    body: "Renforcement des capacités et amélioration continue des équipes.",
  },
];

// Bloc distinct, volontairement présenté à part de la trilogie (ce n'est pas
// un quatrième pilier).
export const ADMINISTRATIVE_CONTROL = {
  title: "Contrôle administratif",
  body: "Vérification du fonctionnement administratif des établissements et des services de l'Inspection.",
};

export type AiStat = {
  value: string;
  label: string;
  source: string;
};

// Chiffre cité publiquement par l'Inspection (discours RAP2026) — à mettre à
// jour si l'Inspection communique une donnée plus précise ou plus récente.
export const AI_STAT: AiStat = {
  value: "+ 80 %",
  label: "des téléphones confisqués pendant les épreuves auraient servi à interroger l'intelligence artificielle.",
  source: "Discours RAP2026",
};

export type AiObservation = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export const AI_OBSERVATIONS: AiObservation[] = [
  {
    icon: Smartphone,
    title: "Des élèves déjà utilisateurs",
    body: "Sur le terrain, l'usage de l'intelligence artificielle par les élèves — y compris pendant les évaluations — est une réalité déjà installée.",
  },
  {
    icon: BookOpenCheck,
    title: "Des enseignants parfois sans méthode",
    body: "Certains enseignants y recourent également, souvent sans méthode ni cadre pédagogique établi.",
  },
  {
    icon: ShieldAlert,
    title: "Des risques réels",
    body: "Mal maîtrisée, l'intelligence artificielle expose à des erreurs factuelles et à la diffusion de contenus falsifiés (deepfakes).",
  },
  {
    icon: GraduationCap,
    title: "Préparer les métiers de demain",
    body: "Au-delà du risque, l'enjeu est aussi de préparer dès à présent les élèves aux métiers que l'intelligence artificielle transforme déjà.",
  },
];

export type ProgramStep = {
  step: string;
  title: string;
  body: string;
};

// Programme « Former pour maîtriser ».
export const PROGRAM_STEPS: ProgramStep[] = [
  {
    step: "1",
    title: "Comprendre l'IA",
    body: "Connaître ce qu'est l'intelligence artificielle, ce qu'elle permet et ses limites réelles.",
  },
  {
    step: "2",
    title: "Utiliser l'IA avec éthique",
    body: "Adopter un usage responsable, transparent et conforme aux règles de l'enseignement.",
  },
  {
    step: "3",
    title: "Créer avec l'IA",
    body: "Exploiter ces outils pour préparer, enrichir et différencier les activités pédagogiques.",
  },
  {
    step: "4",
    title: "Évaluation certifiante",
    body: "Vérifier et certifier la maîtrise acquise, plutôt que de simplement l'exiger.",
  },
];

// Diffusion du programme de formation à travers la chaîne hiérarchique.
export const DIFFUSION_CHAIN: string[] = ["IPP", "Inspecteurs", "Enseignants", "Élèves"];

export type LeadershipContact = {
  phone?: string;
  whatsapp?: string;
  email?: string;
};

export type LeadershipMember = {
  id: string;
  name: string;
  role: string;
  // Chemin public vers la photo réelle. Absent => avatar générique. Le
  // champ correspondra directement à une colonne "photoUrl" le jour où la
  // direction sera gérée depuis l'admin plutôt que depuis ce fichier.
  photo?: string;
  // Vignette déjà dimensionnée servie par une route (ex. photo du Chef de
  // POOL) : affichée telle quelle, sans passer par l'optimiseur d'images.
  photoUnoptimized?: boolean;
  attribution?: string;
  contact: LeadershipContact;
};

// Nom et contacts réels à fournir par l'Inspection — voir
// MASTER_INSPECTION_NORD_KIVU_1.md §13 et §24 (liste des dix IPPA et de
// leurs attributions non encore confirmée).
export const IPP_LEADER: LeadershipMember = {
  id: "ipp",
  name: "Nom de l'Inspecteur Principal Provincial",
  role: "Inspecteur Principal Provincial — Nord-Kivu 1",
  photo: "/scrollytelling/ipp.png",
  contact: {},
};

// Fonctions confirmées à ce stade (MASTER_INSPECTION_NORD_KIVU_1.md §13 +
// précisions reçues) : formation, évaluation, titres, administration et
// finances, exploitation, personnel. Ne pas en inventer d'autres — les 4
// IPPA restants gardent une attribution à préciser tant qu'elle n'est pas
// confirmée.
const KNOWN_IPPA_ATTRIBUTIONS = [
  "Formation",
  "Évaluation",
  "Titres",
  "Administration et finances",
  "Exploitation",
  "Personnel",
];

export const IPPA_MEMBERS: LeadershipMember[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ippa-${i + 1}`,
  name: `IPPA ${i + 1}`,
  role: "Inspecteur Principal Adjoint",
  attribution: KNOWN_IPPA_ATTRIBUTIONS[i] ?? "Attribution à préciser",
  contact: {},
}));

// Groupes de personnel affichés sur chaque page POOL. Leurs listes ne sont
// pas encore publiées : seuls le Chef de POOL et la fiche du POOL
// proviennent aujourd'hui du back-office (src/lib/public-pools.ts).
export const POOL_STAFF_GROUPS: { key: string; label: string }[] = [
  { key: "inspecteursItinerants", label: "Inspecteurs itinérants" },
  { key: "inspecteursExploitants", label: "Inspecteurs exploitants" },
  { key: "agentsBureau", label: "Agents des bureaux" },
];

// URL publiques déjà en ligne (et indexées) avant la liaison au back-office.
// Elles NE sont PAS une source de données : un POOL n'est présenté comme
// confirmé que lorsqu'un POOL actif de la base porte ce slug (attribué depuis
// Paramètres). Tant que ce n'est pas le cas, l'URL reste accessible avec une
// page neutre « fiche en cours de confirmation », pour ne casser aucun lien.
// Aucune correspondance n'est supposée entre ces libellés et les POOL de la
// base (notamment Karisimbi / Karisimbi 1 / Karisimbi 2).
export const LEGACY_POOL_PAGES: { slug: string; name: string }[] = [
  { slug: "goma", name: "Goma" },
  { slug: "karisimbi-1", name: "Karisimbi 1" },
  { slug: "karisimbi-2", name: "Karisimbi 2" },
  { slug: "nyiragongo", name: "Nyiragongo" },
  { slug: "rutshuru-1", name: "Rutshuru 1" },
  { slug: "rutshuru-2", name: "Rutshuru 2" },
  { slug: "rutshuru-3", name: "Rutshuru 3" },
  { slug: "rutshuru-4", name: "Rutshuru 4" },
  { slug: "rutshuru-5", name: "Rutshuru 5" },
];

export type PoolRole = {
  title: string;
  description: string;
};

// Contenu commun aux pages POOL, repris des rôles et du circuit décrits dans
// la spécification de l'Inspection (§6, §9, §12). Les données propres à
// chaque POOL (écoles, territoires, contacts) restent à fournir.
export const POOL_ROLES: PoolRole[] = [
  {
    title: "Chef de POOL",
    description:
      "Responsable du POOL, il suit les écoles rattachées, organise l'affectation des inspecteurs et supervise l'exploitation des rapports.",
  },
  {
    title: "Inspecteurs itinérants",
    description: "Rattachés au POOL, ils réalisent les inspections dans les écoles qui leur sont affectées.",
  },
  {
    title: "Exploitant du POOL",
    description: "Il analyse les rapports d'inspection reçus au niveau du POOL.",
  },
  {
    title: "Secrétariat du POOL",
    description: "Il assure la gestion administrative des fiches des écoles.",
  },
];

export const POOL_REPORT_STEPS: string[] = [
  "L'inspecteur itinérant effectue l'inspection et soumet son rapport.",
  "Le rapport est reçu et exploité au niveau du POOL.",
  "Les éléments nécessaires sont transmis au Bureau d'exploitation de l'IPP, qui formule ses observations et recommandations.",
  "Après validation par l'autorité compétente, le résultat revient vers l'inspecteur concerné et les acteurs autorisés.",
];

export type SoftwareFeature = {
  icon: LucideIcon;
  title: string;
};

// 6 des 10 fonctionnalités citées par l'Inspection, retenues pour éviter la
// surcharge visuelle de la vitrine — les autres (inscriptions, frais
// scolaires, archivage, traçabilité) restent réelles mais non affichées ici.
export const SOFTWARE_FEATURES: SoftwareFeature[] = [
  { icon: Users, title: "Gestion des élèves" },
  { icon: BookOpen, title: "Gestion des classes" },
  { icon: UserCog, title: "Gestion des enseignants" },
  { icon: CalendarCheck, title: "Suivi des présences" },
  { icon: BarChart3, title: "Rapports et statistiques" },
  { icon: MessagesSquare, title: "Communication école – administration" },
];

export const SOFTWARE_BADGES: string[] = ["100 % Gratuit", "Conforme aux normes", "Adapté aux écoles"];

export type Activity = {
  title: string;
  body: string;
  image?: string;
  videoId?: string;
  videoCaption?: string;
  skills?: string[];
};

export const ACTIVITIES: Activity[] = [
  {
    title: "Transformation numérique du corps inspectoral",
    body: "La montée en compétence des inspecteurs suit une progression claire, de l'informatique de base jusqu'à l'accompagnement des élèves.",
    videoId: "nXDotxUYpHU",
    videoCaption: "Formation numérique des responsables, agents et inspecteurs itinérants de l'Inspection.",
    skills: [
      "Informatique de base",
      "Windows",
      "Excel",
      "Internet",
      "Formation des inspecteurs",
      "Formation des enseignants",
      "Préparation des élèves",
    ],
  },
  {
    title: "Rentrée scolaire 2026-2027",
    body: "Lancement de la rentrée sous le signe de la rigueur numérique, à l'Institut de Goma (INSTIGO).",
    videoId: "SufOnpVGKtk",
    videoCaption:
      "Lancement de la rentrée scolaire 2026-2027 à l'INSTIGO : rigueur numérique et formation des enseignants aux outils numériques.",
  },
  {
    title: "Missions sur le terrain",
    body: "Contrôle et évaluation des établissements scolaires à travers les différents POOL de la province.",
    image: "/homepage/bureau-ippnk1.jpg",
  },
];
