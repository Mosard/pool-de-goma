import {
  Archive,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  CalendarCheck,
  CircuitBoard,
  ClipboardList,
  Cpu,
  Database,
  Globe,
  GraduationCap,
  HeartHandshake,
  Layers,
  LifeBuoy,
  RefreshCw,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  UserCog,
  Users,
  Video,
  Wallet,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// Contenu de la page INUKA TECH. Structuré en entités réutilisables
// (formations, modules, outils, partenaires) pour pouvoir être alimenté
// plus tard par une base de données/CMS sans changer les composants qui
// les affichent.

export const COMPANY = {
  name: "INUKA TECH",
  location: "Goma · Nord-Kivu",
  heroTitle: "La technologie au service de l'éducation",
  heroSubtitle:
    "INUKA TECH conçoit, déploie et accompagne des solutions numériques pour les institutions, les écoles et les organisations éducatives du Nord-Kivu — en collaboration avec l'Inspection Principale Provinciale Nord-Kivu 1 pour la conception, le déploiement et l'appropriation des outils destinés aux inspecteurs, aux enseignants et aux établissements scolaires.",
  heroBadges: ["Solutions numériques", "Formation & accompagnement", "Goma · Nord-Kivu"],
};

export type AboutCard = { icon: LucideIcon; title: string; body: string };

export const ABOUT_TEXT =
  "INUKA TECH est une structure de solutions numériques créée pour concevoir et déployer des technologies répondant à des besoins concrets. Dans le secteur éducatif, elle intervient dans la formation numérique, l'Intelligence Artificielle, le développement logiciel et l'accompagnement des institutions dans leurs projets de modernisation.";

export const ABOUT_CARDS: AboutCard[] = [
  {
    icon: Cpu,
    title: "Solutions numériques",
    body: "Conception de plateformes, logiciels et outils adaptés aux besoins des institutions.",
  },
  {
    icon: Brain,
    title: "Intelligence Artificielle",
    body: "Formation, sensibilisation et intégration responsable de l'IA dans les usages éducatifs.",
  },
  {
    icon: GraduationCap,
    title: "Formation",
    body: "Renforcement des capacités des inspecteurs, enseignants et personnels administratifs.",
  },
  {
    icon: LifeBuoy,
    title: "Accompagnement",
    body: "Installation, déploiement, assistance et suivi des solutions numériques.",
  },
];

export const PARTNERSHIP_FLOW = ["Inspection", "INUKA TECH", "Écoles"];
export const PARTNERSHIP_POINTS = [
  "L'Inspection définit les orientations institutionnelles et pédagogiques.",
  "INUKA TECH traduit ces orientations en solutions numériques, formations et outils.",
  "Les écoles utilisent et bénéficient de ces solutions.",
];

export const INSPECTOR_TRAINING_AXES = [
  "Informatique de base",
  "Outils numériques",
  "Internet et collaboration",
  "Intelligence Artificielle",
  "Utilisation responsable de l'IA",
  "Appropriation des nouveaux outils de gestion",
];

export const TEACHER_FLOW = ["Expert", "Enseignants", "École", "Élèves"];

export type AiModule = { number: string; title: string; body: string };

export const AI_PROGRAM_MODULES: AiModule[] = [
  {
    number: "01",
    title: "Comprendre l'IA",
    body: "Comprendre la technologie, son fonctionnement et ses limites.",
  },
  {
    number: "02",
    title: "Utiliser l'IA avec éthique",
    body: "Distinguer l'utilisation responsable de la triche, vérifier les informations et reconnaître la désinformation.",
  },
  {
    number: "03",
    title: "Créer avec l'IA",
    body: "Passer de consommateur passif à utilisateur capable de créer et résoudre des problèmes.",
  },
  {
    number: "04",
    title: "L'IA aujourd'hui et demain",
    body: "IA générative, IA agentique, codage assisté et évolution des compétences professionnelles.",
  },
  {
    number: "05",
    title: "Certification",
    body: "Évaluation pratique et reconnaissance des compétences acquises.",
  },
];

export type SoftwareRole = string;
export const SOFTWARE_ROLES: SoftwareRole[] = [
  "La conception technique",
  "Le développement",
  "Le déploiement",
  "L'installation",
  "La configuration",
  "La formation des utilisateurs",
  "L'assistance technique",
  "Les évolutions futures de l'application",
];

export type Feature = { icon: LucideIcon; title: string };
export const APP_FEATURES: Feature[] = [
  { icon: Users, title: "Élèves" },
  { icon: UserCog, title: "Enseignants" },
  { icon: BookOpen, title: "Classes" },
  { icon: CalendarCheck, title: "Présences" },
  { icon: ClipboardList, title: "Inscriptions" },
  { icon: Wallet, title: "Frais scolaires" },
  { icon: BarChart3, title: "Rapports" },
  { icon: BarChart3, title: "Statistiques" },
  { icon: Archive, title: "Archivage" },
  { icon: ShieldCheck, title: "Suivi administratif" },
];

export type DeploymentStep = { number: string; title: string; body: string };
export const DEPLOYMENT_STEPS: DeploymentStep[] = [
  { number: "01", title: "Préparation", body: "Analyse des besoins de l'établissement." },
  { number: "02", title: "Installation", body: "Déploiement et configuration du logiciel." },
  {
    number: "03",
    title: "Formation",
    body: "Formation du personnel administratif et des responsables de l'école.",
  },
  { number: "04", title: "Mise en service", body: "Accompagnement lors de la prise en main." },
  { number: "05", title: "Suivi", body: "Support, assistance et amélioration continue." },
];

export const VISION_FLOW = ["Former", "Déployer", "Accompagner", "Autonomiser"];
export const VISION_TEXT =
  "La transformation numérique ne se résume pas à installer des logiciels. Elle suppose que les personnes comprennent les outils, sachent les utiliser et puissent ensuite les transmettre à leur tour.";

export const EXPERTISE_AREAS = [
  "Génie logiciel",
  "Architecture d'applications",
  "Intelligence artificielle",
  "Développement de systèmes de gestion",
  "Transformation numérique",
  "Formation professionnelle",
  "Accompagnement institutionnel",
];

export const METHODOLOGY_FLOW = [
  "Diagnostiquer",
  "Former",
  "Concevoir",
  "Déployer",
  "Accompagner",
  "Évaluer",
];

export type Partner = {
  name: string;
  tags: string[];
};

export const PARTNERS: Partner[] = [
  {
    name: "Inspection Principale Provinciale Nord-Kivu 1",
    tags: [
      "Transformation numérique",
      "Formation des inspecteurs",
      "Formation des enseignants",
      "Intelligence Artificielle",
      "Site institutionnel",
      "Logiciel de gestion scolaire",
    ],
  },
  {
    name: "JRS — Jesuit Refugee Service",
    tags: [
      "Formation pilote en éducation numérique",
      "Accompagnement des écoles",
      "Réflexion sur la continuité après formation",
      "Proposition de plateforme pédagogique numérique locale",
      "Solutions adaptées aux faibles connexions",
    ],
  },
];

// --- JRS -----------------------------------------------------------------

export const JRS_TRAINING = {
  title: "Formation pilote en intégration numérique dans les écoles sous gestion JRS",
  place: "Mungunga — Collège Saint François d'Assise",
  period: "19 au 24 août 2026",
  facilitator: "Ingénieur Mosard Salama",
  assistant: "Inspecteur AKILI",
};

export const JRS_STATS = [
  { value: "15", label: "écoles" },
  { value: "≈ 37", label: "participants" },
  { value: "5", label: "jours" },
  { value: "7", label: "axes / modules pédagogiques" },
];

export const JRS_TOPICS = [
  "Le numérique démystifié",
  "Tendances de l'éducation numérique",
  "Gestion administrative numérique",
  "Outils de base : traitement de texte, tableur, email",
  "Intégration pédagogique du numérique",
  "École numérique progressive",
  "Citoyenneté numérique",
  "Élaboration d'un plan d'action",
];

export const JRS_NEEDS = [
  {
    title: "Besoin 1 — Mise à niveau numérique",
    body: "Une partie importante des enseignants avait encore besoin de renforcer la maîtrise des outils informatiques fondamentaux comme Word, Excel et l'utilisation quotidienne de l'ordinateur.",
  },
  {
    title: "Besoin 2 — Manque d'outils pédagogiques locaux",
    body: "Les enseignants ne disposaient pas d'une plateforme pédagogique locale leur permettant de retrouver facilement des fiches de cours, des exercices, des vidéos, des ressources contextualisées, des modèles réutilisables et un accompagnement après la formation.",
  },
];

export type PlatformModule = { icon: LucideIcon; title: string; body: string };
export const JRS_PLATFORM_MODULES: PlatformModule[] = [
  {
    icon: Layers,
    title: "Bibliothèque pédagogique",
    body: "Fiches de cours, supports PDF, présentations, guides et ressources classées par discipline et niveau.",
  },
  {
    icon: Video,
    title: "Vidéos pédagogiques",
    body: "Capsules courtes, produites localement ou sélectionnées puis contextualisées.",
  },
  {
    icon: ClipboardList,
    title: "Exercices interactifs",
    body: "Quiz, QCM, vrai/faux, associations et exercices autocorrigés.",
  },
  {
    icon: GraduationCap,
    title: "Espace enseignants",
    body: "Tutoriels, modèles, ressources numériques et outils pour prolonger la formation.",
  },
  {
    icon: BarChart3,
    title: "Suivi et rapports",
    body: "Statistiques sur l'utilisation des ressources, les écoles actives, les enseignants formés et les exercices réalisés.",
  },
  {
    icon: Wifi,
    title: "Mode hors ligne",
    body: "Utilisation en contexte de faible connectivité grâce à des solutions locales ou synchronisables.",
  },
];

export const JRS_OFFLINE_POINTS = [
  "Portail web central",
  "Serveur local dans une école ou un centre",
  "Fonctionnement sur réseau local",
  "Contenus accessibles hors ligne",
  "Synchronisation progressive",
  "Possibilité d'utiliser des technologies open source adaptées",
];

export type RoleStep = { icon: LucideIcon; title: string; body: string };
export const JRS_ROLE: RoleStep[] = [
  { icon: Search, title: "Concevoir", body: "Analyser les besoins et définir l'architecture de la solution." },
  { icon: CircuitBoard, title: "Développer / intégrer", body: "Construire ou adapter les outils numériques." },
  { icon: GraduationCap, title: "Former", body: "Renforcer les capacités des utilisateurs." },
  {
    icon: HeartHandshake,
    title: "Accompagner",
    body: "Aider les enseignants et équipes locales à produire et utiliser leurs propres contenus.",
  },
  { icon: Wrench, title: "Maintenir", body: "Assurer l'assistance et l'évolution technique." },
  { icon: RefreshCw, title: "Évaluer", body: "Mesurer l'usage et améliorer progressivement les solutions." },
];

export const JRS_STORY_FLOW = ["Formation", "Constats", "Solution", "Accompagnement"];

// Icônes utilisées par la section "technologie pensée pour les réalités
// locales" (illustratives, pas des cartes détaillées).
export const OFFLINE_ICONS: LucideIcon[] = [Globe, Server, Database, Building2, Wifi, Rocket];
