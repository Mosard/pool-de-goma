// Module II — Contrôle de l'enseignement (C). Définitions v1, libellés repris
// mot pour mot des fiches du dossier « Document itinerant » (voir
// docs/inventaire-fiches-inspection.md, § 5.7 à 5.14).

import type { FicheDef, TableDef } from "@/lib/fiches/types";
import {
  DEST_C,
  ETABLISSEMENT,
  MENTION_PRISE_CONNAISSANCE,
  NOM_CE,
  SIG_INSPECTEUR,
  choice,
  date,
  number,
  poste,
  signature,
  text,
  textarea,
} from "@/lib/fiches/defs/commun";

const APPRECIATION = (id: string, label: string) => ({ kind: "field" as const, id, label, type: "appreciation" as const, required: true });
const NOTES_FINALES = ["ELITE", "TRES BON", "BON", "ASSEZ BON", "MEDIOCRE"];
const SIG_CE = signature("sig.ce", "Signature du Chef d'Etablissement", { mention: MENTION_PRISE_CONNAISSANCE, required: true, allowRefusal: true });

// ---------------------------------------------------------------------------
// C1 — Première visite
// ---------------------------------------------------------------------------

const C1_POSTES = [
  "1.1. PARCELLE",
  "1.2. BATIMENTS",
  "1.3. EQUIPEMENTS",
  "1.4. MOYENS D'ENSEIGNEMENT",
  "1.5. PERSONNEL",
  "1.6. APPRENANTS",
  "1.7. ADMINISTRATION",
  "1.8. ORGANISATION PEDAGOGIQUE",
  "1.9. FINANCES",
  "1.10. INTERNAT",
];

export const C1: FicheDef = {
  format: 2,
  code: "C1",
  version: 1,
  title: "PREMIERE VISITE",
  module: "C",
  scope: "visite",
  source: "C1 REVUE_021218.pdf (= C1 REVUE-1.docx)",
  levels: true,
  destinataires: DEST_C,
  header: [ETABLISSEMENT, NOM_CE],
  sections: [
    {
      id: "I",
      title: "I. POSTES",
      blocks: [
        {
          kind: "text",
          style: "note",
          text: "Toutes les rubriques doivent être traitées. Neutraliser par un trait (-) si la rubrique n'engage pas la responsabilité du chef d'établissement ; mentionner S.O. (sans objet) si le poste existe sans être opérationnel. RAS, rien, absent, néant ne sont pas autorisés.",
        },
        ...C1_POSTES.flatMap((label, i) => [
          textarea(`I.${i + 1}.constats`, `${label} — Constats – Problèmes`, { required: true, noRas: true }),
          textarea(`I.${i + 1}.solutions`, `${label} — Solutions proposées`, { required: true, noRas: true }),
        ]),
      ],
    },
    {
      id: "II",
      title: "II. RAPPORT CIRCONSTANCIE POUR COMPLEMENT D'INFORMATIONS",
      blocks: [choice("II.rapportCirconstancie", "Rapport circonstancié pour complément d'informations", ["Oui", "Non"], { required: true })],
    },
    { id: "sig", title: "Signatures", blocks: [SIG_CE, SIG_INSPECTEUR] },
  ],
};

// ---------------------------------------------------------------------------
// C2 — Inspection administrative (version « ancienne », seule disponible)
// ---------------------------------------------------------------------------

const C2_PATRIMOINE = [
  "Enseigne de l'établissement", "Mise en valeur de la parcelle", "Entretien de la parcelle", "Mise en valeur des bâtiments",
  "Utilisation des bâtiments", "Mesures de sécurité", "Entretien des mobiliers", "Entretien des équipements",
  "Gestion des moyens d'enseign. et de formation", "Gestion des moyens de production", "Gestion de l'infirmerie",
  "Gestion des sanitaires", "Gestion de l'internat",
];
const C2_PEDAGOGIE = [
  "Programmes / Curricula", "Instructions officielles", "Revue de l'inspecteur", "Activités de la rentrée scolaire",
  "Prévision des matières", "Attributions des enseignants", "Sujets devoirs/interrogations", "Copies devoirs/interrogations",
  "Questions d'examens", "Copies examens", "Horaire", "Liste des manuels utilisés", "Liste des matériels",
  "Activités parascolaires", "Inspection pédagogique", "Cellule de base", "Réseau des écoles de proximité",
  "Réunions pédagogiques", "Conseils des enseignants", "Contrôle des documents pédag.", "Visites de classes",
  "Leçons de démonstration", "Encadrement des sous-qualifiés", "Formation continue des enseignants",
  "Outils et modules de formation", "Inspection de la formation (C2B)", "Discipline de travail", "Esprit de collégialité",
  "Imagination pédagogique", "Valeur pédagogique des sanctions", "Objectivité de l'évaluation", "Bien-fondé de la remédiation",
  "Adéquation de l'orientation", "Qualité des apprentissages", "Rendement interne", "Rayonnement externe",
  "Développement communautaire",
];
const C2_ADMINISTRATION = [
  "Loi-Cadre n°14 / 004", "Instructions officielles", "Calendrier scolaire", "Règlement intérieur", "Dossier SERNIE",
  "Actes juridiques", "Remise-reprise", "Inventaires", "Notes de service", "Affichages", "Courrier (IND./CLAS./C.T.)",
  "Rapports administratifs", "Rapports des réunions administratives", "Palmarès", "Assurance scolaire", "Dossier médical",
  "Inspections administratives", "Mise en place du personnel", "Dossiers individuels du personnel", "Attributions du personnel",
  "Absences du personnel", "Stagiaires", "Registre d'inscription", "Registre matricule", "Gouvernement des apprenants",
  "Dossiers individuels des apprenants", "Fichier", "Listes des apprenants par classe", "Registres d'appel",
  "Discipline des apprenants", "Dossier discipline", "Retenues / Exclusion", "P.V. de délibération", "Copies des bulletins",
  "Registre des titres scolaires", "Registre des pièces scolaires", "Prévisions budgétaires", "Perception des contributions",
  "Autres recettes", "Versements imposés", "Payement du personnel", "Rapports comptables", "Gestion financière",
  "Gestion comptable", "Autofinancement", "Plan d'opérations", "Agenda", "Ordre et classement", "Esprit de collaboration",
  "Assiduité du personnel", "Port de l'uniforme", "Redevabilité", "Accès et équité", "Bonne gouvernance",
  "Relations avec l'autorité pol.-adm.", "Relations avec les collègues", "Relation avec les parents",
  "Conseil de gestion (COGES)", "Comité des parents (COPA)", "Comité de l'établissement", "Accueil des visiteurs",
  "Personnalité", "Ponctualité", "Disponibilité", "Sens de responsabilité", "Esprit d'initiative", "Sens du commandement",
];

const DESCRIPTION_ENTITE = [
  textarea("1.1", "1.1. Implantation (environnement physique, social et pédagogique)", { required: true }),
  APPRECIATION("1.1.app", "1.1. Implantation — appréciation (E/TB/B/AB/M)"),
  textarea("1.2.conformite", "1.2. Structure : Conformité à l'arrêté", { required: true }),
  APPRECIATION("1.2.app", "1.2. Conformité à l'arrêté — appréciation (E/TB/B/AB/M)"),
  textarea("1.2.viabilite", "1.2. Structure : Viabilité de l'école", { required: true }),
];

export const C2: FicheDef = {
  format: 2,
  code: "C2",
  version: 1,
  title: "INSPECTION ADMINISTRATIVE",
  module: "C",
  scope: "visite",
  source: "C2_EDU_NC_ANCIENNE.pdf",
  levels: true,
  destinataires: DEST_C,
  header: [ETABLISSEMENT, NOM_CE],
  conversionTable: "PERCENT",
  sections: [
    { id: "1", title: "1. DESCRIPTION DE L'ENTITE ET APPRECIATION", blocks: DESCRIPTION_ENTITE },
    {
      id: "2",
      title: "2. GESTION DU PATRIMOINE",
      blocks: [
        textarea("2.1", "2.1. Description du patrimoine (Cf. annexe)", { required: true }),
        poste("2.2", "2.2. Gestion du patrimoine", C2_PATRIMOINE, { method: "percent" }, { conseilsLabel: "2.3. Conseils" }),
      ],
    },
    {
      id: "3",
      title: "3. GESTION PEDAGOGIQUE",
      blocks: [
        textarea("3.1", "3.1. Description du personnel pédagogique", { required: true }),
        poste("3.2", "3.2. Gestion pédagogique", C2_PEDAGOGIE, { method: "percent" }, { conseilsLabel: "3.3. Conseils" }),
      ],
    },
    {
      id: "4",
      title: "4. GESTION ADMINISTRATIVE",
      blocks: [poste("4.1", "4.1. Gestion administrative", C2_ADMINISTRATION, { method: "percent" }, { conseilsLabel: "4.2. Conseils" })],
    },
    {
      id: "annexes",
      title: "Annexes",
      blocks: [
        {
          kind: "text",
          style: "note",
          text: "Le C2 n'est réputé complet et acceptable par l'administration que s'il comprend en bonne forme ces quatre annexes : 1. plan de la parcelle de l'école ; 2. relevé du patrimoine ; 3. tableau synoptique de la population scolaire ; 4. liste nominale du personnel.",
        },
      ],
    },
    { id: "sig", title: "Signatures", blocks: [SIG_CE, SIG_INSPECTEUR] },
  ],
  synthese: {
    label: "5. EVALUATION SYNTHETIQUE INTERMEDIAIRE (0 A 4)",
    parts: [
      { id: "5.1", label: "5.1. Patrimoine", source: "2.2" },
      { id: "5.2", label: "5.2. Pédagogie", source: "3.2" },
      { id: "5.3", label: "5.3. Administration", source: "4.1" },
    ],
    // Total converti à la ligne 3 du tableau de C3 [module § C2, décision Q1].
    table: "C3",
    row: 3,
    finalLabel: "6. APPRECIATION FINALE",
  },
};

// ---------------------------------------------------------------------------
// C2B — Inspection de la formation
// ---------------------------------------------------------------------------

const UP_ROWS = ["UP1", "UP2", "UP3", "UP4", "UP5", "UP6"].map((id) => ({ id, label: id }));
const PARTIE_MP = "Maternel / Primaire";
const PARTIE_S = "Secondaire";

const UP_MP: TableDef = {
  kind: "table",
  id: "1.3.mp",
  label: "1.3. Définition des UP — Maternel / Primaire",
  fixedRows: UP_ROWS,
  columns: [
    { id: "degre", label: "Degré / Classe", type: "text" },
    { id: "chef", label: "Nom du Chef de l'U.P.", type: "text" },
    { id: "titre", label: "Titre en sigle", type: "text" },
    { id: "q", label: "En nombre Q", type: "number" },
    { id: "sq", label: "En nombre SQ", type: "number" },
  ],
  sumColumns: ["q", "sq"],
  showIf: { field: "1.3.partie", equals: PARTIE_MP },
};

const UP_S: TableDef = {
  kind: "table",
  id: "1.3.s",
  label: "1.3. Définition des UP — Secondaire",
  fixedRows: UP_ROWS,
  columns: [
    { id: "code", label: "Code", type: "text" },
    { id: "discipline", label: "Discipline", type: "text" },
    { id: "chef", label: "Nom du Chef de l'U.P.", type: "text" },
    { id: "titre", label: "Titre en sigle + option", type: "text" },
    { id: "q", label: "En nombre Q", type: "number" },
    { id: "sq", label: "En nombre SQ", type: "number" },
  ],
  sumColumns: ["q", "sq"],
  showIf: { field: "1.3.partie", equals: PARTIE_S },
};

export const C2B: FicheDef = {
  format: 2,
  code: "C2B",
  version: 1,
  title: "INSPECTION DE LA FORMATION",
  module: "C",
  scope: "visite",
  source: "C2B REVUE_021232.pdf",
  // Pas de case M / P / S sur la fiche.
  levels: false,
  destinataires: DEST_C,
  header: [
    ETABLISSEMENT,
    text("entete.identiteCE", "07. Identité du CE", { prefill: "schoolDirector" }),
    text("entete.ccb", "08. Identité du CCB"),
    choice("entete.ccbSexe", "08. Identité du CCB — Sexe", ["M", "F"]),
    text("entete.dernierC2B", "09. Dernier C2B", { hint: "Inspecteur, numéro, date et appréciation du dernier C2B." }),
  ],
  sections: [
    {
      id: "1",
      title: "1. CELLULE DE BASE",
      blocks: [
        textarea("1.1", "1.1. Description de la CB", { required: true }),
        text("1.2.nom", "1.2. Identité du CCB : Nom", { required: true }),
        text("1.2.qualification", "1.2. Identité du CCB : Qualification"),
        text("1.2.anciennete", "1.2. Identité du CCB : Ancienneté comme C.C.B."),
        choice("1.3.partie", "1.3. Définition des UP — partie du tableau", [PARTIE_MP, PARTIE_S], { required: true }),
        UP_MP,
        UP_S,
      ],
    },
    {
      id: "2",
      title: "2. TENUE DES DOSSIERS",
      blocks: [
        poste(
          "2",
          "2. TENUE DES DOSSIERS (M à E)",
          [
            "Instructions officielles en F.C.", "Inventaires des M.F.", "Exploitation des M.F.", "Participation aux séminaires en F.C.",
            "Notes de service en F.C.", "F.C. durant la semaine de la rentrée", "Visites d'encadrement", "Leçons de démonstration",
            "Rapports des réunions de formation", "Rapports administratifs en F.C.", "Registre de prêts/circulation des M-F",
            "Collaboration interscolaire en F.C.", "Correspondance en F.C.", "Classement des rapports de formation F1, F2, C2B",
            "Plan d'opérations",
          ],
          null,
          { scale: "M-E", conseilsLabel: "Conseils" }
        ),
      ],
    },
    {
      id: "3",
      title: "3. ETAT DE LA FORMATION CONTINUE",
      blocks: [
        {
          kind: "table",
          id: "3.1",
          label: "3.1. Planification hebdomadaire (heure de la réunion de l'UP, ex. 2-PM, 4-AM)",
          fixedRows: ["UP1", "UP2", "UP3", "UP4", "UP5", "UP6", "UP7", "UP8"].map((id) => ({ id, label: id })),
          columns: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((j) => ({ id: j.toLowerCase(), label: j, type: "text" as const })),
        },
        textarea("3.2.1", "3.2. Moyens de formation — 3.2.1. Quantité"),
        textarea("3.2.2", "3.2. Moyens de formation — 3.2.2. Conservation"),
        textarea("3.2.3", "3.2. Moyens de formation — 3.2.3. Circulation"),
        textarea("3.2.4", "3.2. Moyens de formation — 3.2.4. Exploitation"),
        textarea("3.2.5", "3.2. Moyens de formation — 3.2.5. Rendement"),
        textarea("3.3.1", "3.3. Réunions de formation — 3.3.1. Rythme"),
        textarea("3.3.2", "3.3. Réunions de formation — 3.3.2. Contenu"),
        textarea("3.3.3", "3.3. Réunions de formation — 3.3.3. Participation"),
        textarea("3.3.4", "3.3. Réunions de formation — 3.3.4. Suivi"),
      ],
    },
    {
      id: "4",
      title: "4. CONSEILS EN MATIERE DE FORMATION CONTINUE",
      blocks: [
        textarea("4.1", "4.1. FC des qualifiés"),
        textarea("4.2", "4.2. FC des sous-qualifiés"),
        textarea("4.3", "4.3. Conseils sur le fonctionnement de la CB"),
        textarea("4.4", "4.4. Besoins en moyen de formation"),
      ],
    },
    {
      id: "5",
      title: "5. APPRECIATION SYNTHETIQUE",
      blocks: [choice("5", "5. APPRECIATION SYNTHETIQUE", NOTES_FINALES, { required: true })],
    },
    {
      id: "6",
      title: "6. ADMINISTRATION",
      blocks: [
        signature("sig.ccb", "6.1. CHEF DE LA CELLULE DE BASE", {
          mention: "Pour prise de connaissance, pour réception, et pour transmission (seulement si le CCB est autre que le CE)",
          allowRefusal: true,
        }),
        signature("sig.ce", "6.2. CHEF D'ETABLISSEMENT", { mention: "Pour prise de connaissance et pour réception", required: true, allowRefusal: true }),
        signature("sig.inspecteur", "6.3. INSPECTEUR", { required: true }),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// C2C — Inspection de la bibliothèque et des archives scolaires
// ---------------------------------------------------------------------------

const T_C2C = { method: "table" as const, table: "C2C_C3B" as const };

export const C2C: FicheDef = {
  format: 2,
  code: "C2C",
  version: 1,
  title: "INSPECTION DE LA BIBLIOTHEQUE ET DES ARCHIVES SCOLAIRES",
  module: "C",
  scope: "visite",
  source: "C2C_EDU_NC_021237.pdf",
  levels: true,
  destinataires: DEST_C,
  header: [ETABLISSEMENT, NOM_CE],
  conversionTable: "C2C_C3B",
  sections: [
    { id: "1", title: "1. DESCRIPTION DE L'ENTITE ET APPRECIATION", blocks: DESCRIPTION_ENTITE },
    {
      id: "2",
      title: "2. DOMAINE DU CONTROLE",
      blocks: [textarea("2.1", "2.1. Bibliothèque", { required: true }), textarea("2.2", "2.2. Archives", { required: true })],
    },
    {
      id: "3",
      title: "3. RESSOURCES MATERIELLES",
      blocks: [
        poste("3.1", "3.1. Local", ["Existence", "Dimensions", "Aération", "Eclairage", "Température"], T_C2C, { conseilsLabel: "3.1. Conseils" }),
        poste("3.2", "3.2. Matériel informatique", ["Ordinateurs", "Vidéodisques", "CD (Disques compacts)", "Flash disc"], T_C2C, { conseilsLabel: "3.2. Conseils" }),
        poste(
          "3.3",
          "3.3. Matériel professionnel",
          ["Tabliers", "Cache-nez", "Gants", "Insecticides", "Savons", "Serviettes (ou essuie-mains)", "Brosses", ""],
          T_C2C,
          { conseilsLabel: "3.3. Conseils", freeItems: ["3.3.8"] }
        ),
        poste("3.4", "3.4. Précautions à prendre", ["Visites médicales", "Boîtes de lait fournies", "Insecticides utilisés", "Propreté"], T_C2C, { conseilsLabel: "3.4. Conseils" }),
        poste(
          "3.5",
          "3.5. Matériel bureautique",
          ["Fardes", "Classeurs", "Papiers bristol", "Ciseaux", "Colle", "Tables", "Stylos", "Feutres", "Ficelles", "Registres", "Fiches", "Tabourets", "Chaises", "Perforateurs", "Agrafeuses"],
          T_C2C,
          { conseilsLabel: "3.5. Conseils" }
        ),
        poste(
          "3.6",
          "3.6. Eléments d'archivage",
          [
            "Inventaires", "Ordre de classement", "Dossiers individuels du personnel", "Dossiers des apprenants", "Fichiers", "Inspection",
            "Actes juridiques", "Courrier (Ind. / Class. / C.T.)", "Rapports administratifs", "Rapports comptables", "Rapports des réunions",
            "P.V. de délibération", "Copies de bulletins", "Registre des titres",
          ],
          T_C2C,
          { conseilsLabel: "3.6. Conseils" }
        ),
      ],
    },
    {
      id: "4",
      title: "4. FONDS DOCUMENTAIRE",
      blocks: [
        poste(
          "4.1",
          "4.1. Situation de la bibliothèque",
          [
            "Nombre d'ouvrages", "Existence des usuels", "Adaptabilité des ouvrages aux besoins des apprenants",
            "Adaptabilité des ouvrages aux âges des apprenants", "Adaptabilité des ouvrages aux options organisées",
          ],
          T_C2C,
          { conseilsLabel: "4.1. Conseils" }
        ),
        poste(
          "4.2",
          "4.2. Classification des ouvrages",
          ["Littérature", "Sociale", "Histoire", "Romans", "Sciences", "Philosophie", "Religion", "Théâtre", "Fables", "Contes"],
          T_C2C,
          { conseilsLabel: "4.2. Conseils" }
        ),
        poste(
          "4.3",
          "4.3. Stratégies d'acquisition des ouvrages",
          [
            "Frais inclus dans les F.F.", "Apport des parents", "Collaboration / Ecoles", "Actions des partenaires", "Stratégies de diffusion",
            "Règlement Intérieur de la bibliothèque", "Emission des avis", "Equipement salle de lecture", "Estampillage", "Mise en circulation",
            "Fiches d'obtention", "Fiches d'emprunt", "Fiches d'inventaire", "Biblio-forum", "",
          ],
          T_C2C,
          { conseilsLabel: "4.3. Conseils", freeItems: ["4.3.15"] }
        ),
      ],
    },
    {
      id: "5",
      title: "5. SUGGESTIONS POUR L'AMELIORATION DU FONCTIONNEMENT ET LA GESTION DE LA BIBLIOTHEQUE ET DES ARCHIVES SCOLAIRES",
      blocks: [textarea("5", "5. Suggestions", { required: true })],
    },
    {
      id: "6",
      title: "6. EVALUATION SYNTHETIQUE",
      blocks: [
        {
          kind: "field",
          id: "6.1",
          label: "6.1. Domaine contrôlé (note 0 à 4)",
          type: "note",
          required: true,
          hint: "La fiche ne prévoit aucune rubrique notée pour le domaine du contrôle : note attribuée par l'inspecteur.",
        },
      ],
    },
    { id: "sig", title: "8. SIGNATURES", blocks: [SIG_CE, signature("sig.inspecteur", "INSPECTEUR", { required: true })] },
  ],
  synthese: {
    label: "6. EVALUATION SYNTHETIQUE",
    parts: [
      { id: "6.1", label: "6.1. Domaine contrôlé", source: "6.1" },
      { id: "6.2", label: "6.2. Local", source: "3.1" },
      { id: "6.3", label: "6.3. Matériel informatique", source: "3.2" },
      { id: "6.4", label: "6.4. Matériel professionnel", source: "3.3" },
      { id: "6.5", label: "6.5. Précautions à prendre", source: "3.4" },
      { id: "6.6", label: "6.6. Matériel bureautique", source: "3.5" },
      { id: "6.7", label: "6.7. Eléments d'archivage", source: "3.6" },
      { id: "6.8", label: "6.8. Situation de la bibliothèque", source: "4.1" },
      { id: "6.9", label: "6.9. Classification des ouvrages", source: "4.2" },
      { id: "6.10", label: "6.10. Stratégie d'acquisition des ouvrages", source: "4.3" },
    ],
    table: "C2C_C3B",
    row: 10,
    finalLabel: "4. NOTE FINALE",
  },
};

// ---------------------------------------------------------------------------
// C3 — Inspection pédagogique (séquence didactique) et C3B (leçon pratique)
// ---------------------------------------------------------------------------

const ENTETE_ENSEIGNANT = [
  ETABLISSEMENT,
  text("entete.enseignant", "07. Enseignant", { required: true }),
  text("entete.dernierC3.inspecteur", "08. Dernier C3 : Inspecteur"),
  date("entete.dernierC3.date", "08. Dernier C3 : Date"),
  text("entete.dernierC3.cote", "08. Dernier C3 : Cote"),
  text("entete.chargeHebdo", "09. Charge hebdomadaire", { hint: "Temps plein ou temps partiel ; au secondaire, nombre d'heures par semaine." }),
];

const PRESENTS_INSCRITS = [
  number("1.presents", "P (présents)", { required: true }),
  number("1.inscrits", "I (inscrits)", { required: true }),
];

const SIGNATURES_PEDAGOGIQUES = [
  signature("sig.enseignant", "ENSEIGNANT (E) INSPECTE (E)", { mention: MENTION_PRISE_CONNAISSANCE, required: true, allowRefusal: true }),
  signature("sig.ce", "CHEF D'ETABLISSEMENT", { mention: MENTION_PRISE_CONNAISSANCE, required: true, allowRefusal: true }),
  signature("sig.inspecteur", "INSPECTEUR", { required: true }),
];

const T_C3 = { method: "table" as const, table: "C3" as const };

export const C3: FicheDef = {
  format: 2,
  code: "C3",
  version: 1,
  title: "INSPECTION PEDAGOGIQUE (SEQUENCE DIDACTIQUE)",
  module: "C",
  scope: "visite",
  source: "C3.docx",
  levels: true,
  destinataires: DEST_C,
  header: ENTETE_ENSEIGNANT,
  instanceLabel: "entete.enseignant",
  conversionTable: "C3",
  checks: [{ type: "lte", a: "1.presents", b: "1.inscrits", message: "Le nombre de présents (P) ne peut dépasser le nombre d'inscrits (I)." }],
  sections: [
    {
      id: "1",
      title: "1. ACTIVITE(S) INSPECTEE(S)",
      blocks: [
        text("1.sousDomaine", "SOUS/DOMAINE"),
        text("1.discipline", "DISCIPLINE", { required: true }),
        text("1.codeMatr", "CODE MATR."),
        text("1.classe", "CLASSE", { required: true }),
        ...PRESENTS_INSCRITS,
        text("1.heure", "HEURE", { hint: "De … h à … h" }),
        textarea("1.savoirs", "SAVOIRS ESSENTIELS"),
      ],
    },
    {
      id: "2",
      title: "2. GRILLE D'EVALUATION",
      blocks: [
        poste("2.1", "2.1. Personnalité", ["Présentation", "Elocution", "Autorité", "Sens de responsabilité", "Assiduité", "Tenue de la classe", "Respect de l'autorité", "Tenue, atelier, laboratoire/Terr"], T_C3),
        poste("2.2", "2.2. Maîtrise de la matière", ["Exactitude", "Dosage", "Formulation", "Adaptation au niveau", "Réponses aux questions"], T_C3),
        poste("2.3", "2.3. Maîtrise du programme /curriculum", ["Connaissance", "Conformité", "Progression", "Contextualisation", "Décloisonnement"], T_C3),
        poste(
          "2.4",
          "2.4. Organisation des activités initiales",
          [
            "Prérequis", "Présentation de la situation contextualisée", "Lecture de la situation par les apprenants",
            "Explication de la situation par les apprenants", "Clarification de la situation par l'enseignant", "Motivation",
            "Découverte du savoir essentiel", "Inscription au journal de classe des apprenants",
          ],
          T_C3
        ),
        poste(
          "2.5",
          "2.5. Organisation des activités principales",
          [
            "Organisation de la classe et consignes", "Mise en activité de la classe", "Disponibilisation du matériel didactique",
            "Manipulation de matériel didactique par les apprenants", "Identification des objets, opérateurs et résultat",
            "Présentation de la production des apprenants", "Analyse mathétique",
          ],
          T_C3
        ),
        poste(
          "2.6",
          "2.6. Organisation de la synthèse",
          [
            "Questions de l'ens. Et réponse des appr.", "participation des appr à la production de la synthèse",
            "Elaboration de la synthèse (résumé) par les appr", "Ambiance du travail", "Interaction dans la classe",
          ],
          T_C3
        ),
        poste(
          "2.7",
          "2.7. Organisation de l'évaluation",
          [
            "Contrôle de la maitrise des savoirs essentiels", "Présentation de la situation similaire aux Apprenants",
            "Vérification du traitement de la situation similaire par l'Enseignant", "Atteinte de la compétence", "Evaluation inspectorale",
          ],
          T_C3
        ),
        // La fiche imprime deux fois « 2.8.6 » : numéros imprimés conservés, identifiants distincts.
        poste(
          "2.8",
          "2.8. Stratégies",
          ["Didactique générale", "Didactique de discipline", "Imagination pédagogique", "Facilitation", "Consignes", "Organisation du travail individuel", "Organisation du travail en groupe"],
          T_C3,
          { nums: { 7: "2.8.6" } }
        ),
        poste(
          "2.9",
          "2.9. Documents de l'enseignant",
          ["Prévisions de matières", "Journal de classe", "Fiche d'exploitation de la matrice", "Fichier du cours", "Cahier de cote", "Cahier de questions", "Livre de l'Enseignant", "Registre d'appel"],
          T_C3
        ),
        poste("2.10", "2.10. Evaluation de l'acquis", ["Evaluation progressive", "Brouillon", "Cahier de cours", "Manuel (s)", "Travaux scolaires/Devoirs", "Cahier de communication"], T_C3),
      ],
    },
    { id: "sig", title: "2.12. SIGNATURES", blocks: SIGNATURES_PEDAGOGIQUES },
  ],
  synthese: {
    label: "2.11. EVALUATION SYNTHETIQUE",
    parts: [
      { id: "2.11.1", label: "2.11.1. PERSONNALITE", source: "2.1" },
      { id: "2.11.2", label: "2.11.2. MAITRISE DE LA MATIERE", source: "2.2" },
      { id: "2.11.3", label: "2.11.3. MAITRISE DU PROGRAMME", source: "2.3" },
      { id: "2.11.4", label: "2.11.4. ORGANISATION DES ACTIVITES INITIALES", source: "2.4" },
      { id: "2.11.5", label: "2.11.5. ORGANISATION DES ACTIVITES PRINCIPALES", source: "2.5" },
      { id: "2.11.6", label: "2.11.6. ORGANISATION DE LA SYNTHESE", source: "2.6" },
      { id: "2.11.7", label: "2.11.7. ORGANISATION DE L'EVALUATION", source: "2.7" },
      { id: "2.11.8", label: "2.11.8. STRATEGIE", source: "2.8" },
      { id: "2.11.9", label: "2.11.9. DOCUMENTS DE L'ENSEIGNANT", source: "2.9" },
      // Libellé imprimé « Documents des apprenants » ; la note reprise est celle du poste 2.10 (§ 4.3-3).
      { id: "2.11.10", label: "2.11.10. DOCUMENTS DES APPRENANTS", source: "2.10" },
    ],
    table: "C3",
    row: 10,
    finalLabel: "4. Note finale",
  },
};

export const C3B: FicheDef = {
  format: 2,
  code: "C3B",
  version: 1,
  title: "INSPECTION PEDAGOGIQUE (LECON PRATIQUE)",
  module: "C",
  scope: "visite",
  source: "C3B REVUE-1.docx",
  levels: true,
  destinataires: DEST_C,
  header: ENTETE_ENSEIGNANT,
  instanceLabel: "entete.enseignant",
  conversionTable: "C2C_C3B",
  checks: [{ type: "lte", a: "1.presents", b: "1.inscrits", message: "L'effectif présent (P) ne peut dépasser l'effectif inscrit (I)." }],
  sections: [
    {
      id: "1",
      title: "1. ACTIVITE(S) INSPECTEE(S)",
      blocks: [
        text("1.branche", "BRANCHE", { required: true }),
        text("1.classe", "CLASSE", { required: true }),
        text("1.heure", "HEURE", { hint: "De … h à … h" }),
        ...PRESENTS_INSCRITS,
        textarea("1.sujet", "SUJET", { required: true }),
      ],
    },
    {
      id: "2",
      title: "2. GRILLE D'EVALUATION",
      blocks: [
        poste("2.1", "2.1. Personnalité", ["Présentation", "Elocution", "Autorité", "Sens de responsabilité", "Assiduité", "Tenue : atelier / laboratoire / terrain"], T_C2C),
        poste("2.2", "2.2. Maîtrise de la matière", ["Exactitude", "Dosage", "Formulation", "Adaptation au niveau", "Réponses aux questions"], T_C2C),
        poste("2.3", "2.3. Maîtrise du programme /curriculum", ["Connaissance", "Conformité", "Progression", "Contextualisation", "Décloisonnement"], T_C2C),
        poste(
          "2.4",
          "2.4. Structure de la leçon",
          ["Prérequis (mise en situation)", "Motivation", "Inscription au journal de classe", "Analyse", "Démonstration", "Exécution", "Synthèse", "Application"],
          T_C2C
        ),
        poste("2.5", "2.5. Stratégies", ["Consignes", "Organisation du travail individuel", "Organisation du travail en groupes", "Surveillance"], T_C2C),
        poste("2.6", "2.6. Moyens d'enseignement", ["Poste du travail", "Manuels", "Supports didactiques", "Matières d'œuvre"], T_C2C),
        poste(
          "2.7",
          "2.7. Participation des apprenants",
          ["Mesures de sécurité", "Hygiène", "Exécution individuelle", "Contribution dans le groupe", "Ambiance du travail", "Réponses aux questions de l'enseignant"],
          T_C2C
        ),
        poste("2.8", "2.8. Documents des apprenants", ["Journal de classe", "Cahier de pratique", "Fichier des travaux exécutés", "Cahier de communication", "Portfolio"], T_C2C),
        poste(
          "2.9",
          "2.9. Documents de l'enseignant",
          ["Prévisions des matières", "Journal de classe", "Fiche de la leçon", "Fichier de pratique", "Cahier des questions", "Cahier des points", "Présences"],
          T_C2C
        ),
        poste("2.10", "2.10. Evaluation de l'acquis", ["Evaluation progressive", "Evaluation finale", "Remédiation", "Evaluation inspectorale"], T_C2C),
      ],
    },
    { id: "sig", title: "5. SIGNATURES", blocks: SIGNATURES_PEDAGOGIQUES },
  ],
  synthese: {
    label: "3. EVALUATION SYNTHETIQUE",
    parts: [
      { id: "3.1", label: "3.1. PERSONNALITE", source: "2.1" },
      { id: "3.2", label: "3.2. MAITRISE DE LA MATIERE", source: "2.2" },
      { id: "3.3", label: "3.3. MAITRISE DU CURRICULUM", source: "2.3" },
      { id: "3.4", label: "3.4. STRUCTURE DE LA LECON", source: "2.4" },
      { id: "3.5", label: "3.5. STRATEGIES", source: "2.5" },
      { id: "3.6", label: "3.6. MOYENS D'ENSEIGNEMENT", source: "2.6" },
      { id: "3.7", label: "3.7. PARTICIPATION DES APPREN.", source: "2.7" },
      { id: "3.8", label: "3.8. DOCUMENTS DE L'APPRENANT", source: "2.8" },
      { id: "3.9", label: "3.9. DOCUMENTS DE L'ENSEIGNANT", source: "2.9" },
      { id: "3.10", label: "3.10. EVALUATION DE L'ACQUIS", source: "2.10" },
    ],
    table: "C2C_C3B",
    row: 10,
    finalLabel: "4. NOTE FINALE",
  },
};

// ---------------------------------------------------------------------------
// C5A — Inspection d'un adjoint (CPP, CPS)
// ---------------------------------------------------------------------------

const CPP = "1. CONSEILLER PEDAGOGIQUE DU PRIMAIRE";
const CPS = "2. CONSEILLER PEDAGOGIQUE DU SECONDAIRE";
const TACHES_ADMIN = [
  "Instructions officielles", "Calendrier scolaire", "Plan d'opérations", "Agenda", "Horaire général", "Horaire de surveillance",
  "Registre des absences", "Registre des congés", "Présence moyenne /classe", "Liste des apprenants /classe",
  "Fichier des classes/Sernie", "Notes de service",
];
const PCT = { method: "percent" as const };

export const C5A: FicheDef = {
  format: 2,
  code: "C5A",
  version: 1,
  title: "INSPECTION D'UN ADJOINT (CPP, CPS)",
  module: "C",
  scope: "visite",
  source: "C5A_EDU_NC.pdf",
  levels: true,
  destinataires: DEST_C,
  header: [
    ETABLISSEMENT,
    text("entete.adjoint", "07. Nom de l'Adjoint", { required: true }),
    text("entete.adjointTel", "07. Tél."),
    text("entete.dernierC5A.inspecteur", "08. Dernier C5A : Inspecteur"),
    date("entete.dernierC5A.date", "08. Dernier C5A : Date"),
    text("entete.dernierC5A.cote", "08. Dernier C5A : Cote"),
  ],
  instanceLabel: "entete.adjoint",
  conversionTable: "PERCENT",
  sections: [
    { id: "type", title: "Adjoint inspecté", blocks: [choice("typeAdjoint", "Colonne de la fiche", [CPP, CPS], { required: true })] },
    {
      id: "1",
      title: CPP,
      showIf: { field: "typeAdjoint", equals: CPP },
      blocks: [
        poste("1.1", "1.1. TACHES ADMINISTRATIVES", TACHES_ADMIN, PCT),
        poste(
          "1.2",
          "1.2. TACHES PEDAGOGIQUES",
          [
            "Gestion de moyens d'enseign.", "Organisation de l'examen", "Organisation de travaux man.", "Visite de classes",
            "Leçons de démonstration", "Réunions pédagogiques", "Contrôle des équipements", "Contrôle documents appren.",
            "Encadrement de la CB", "Activités parascolaires", "Discipline générale",
          ],
          PCT
        ),
        poste(
          "1.3",
          "1.3. PERSONNALITE",
          ["Ponctualité", "Respect de l'autorité", "Esprit de collaboration", "Sens du commandement", "Esprit d'initiative", "Intégrité", "Assiduité", "Disponibilité"],
          PCT
        ),
      ],
    },
    {
      id: "2",
      title: CPS,
      showIf: { field: "typeAdjoint", equals: CPS },
      blocks: [
        poste("2.1", "2.1. TACHES ADMINISTRATIVES", TACHES_ADMIN, PCT),
        poste(
          "2.2",
          "2.2. TACHES PEDAGOGIQUES",
          [
            "Sélection des apprenants", "Organisation des classes", "Attributions des cours", "Confection des horaires",
            "Organisation des examens", "Registre d'appel", "Contrôle prévisions des matières", "Contrôle documents enseignants",
            "Contrôle des apprenants", "Contrôle quest. + copies exam.", "Contrôle sujet + copies interro", "Contrôle bulletins",
            "Visite de classe", "Conseils de classe", "Réunions pédagogiques", "Activités culturelles", "Cellule de base",
            "Circulation des MF", "Exploitation des MF", "Critique des OF",
          ],
          PCT
        ),
        poste(
          "2.3",
          "2.3. PERSONNALITE",
          ["Ponctualité", "Respect de l'autorité", "Sens de collaboration", "Sens du commandement", "Intégrité", "Assiduité", "Disponibilité", "Relation publique", "Esprit d'initiative", "Amour du métier"],
          PCT
        ),
      ],
    },
    {
      id: "sig",
      title: "Signatures",
      blocks: [
        signature("sig.adjoint", "SIGNATURE DE L'ADJOINT", { mention: MENTION_PRISE_CONNAISSANCE, required: true, allowRefusal: true }),
        signature("sig.ce", "NOM ET SIGNATURE DU CHEF D'ETABLISSEMENT", { mention: MENTION_PRISE_CONNAISSANCE, required: true, allowRefusal: true }),
        signature("sig.inspecteur", "SIGNATURE DE L'INSPECTEUR", { required: true }),
      ],
    },
  ],
  synthese: {
    label: "EVALUATION SYNTHETIQUE INTERMEDIAIRE (0 A 4)",
    parts: [
      { id: "admin", label: "1.1. / 2.1. Tâches administratives", source: "1.1", sourceIf: [{ field: "typeAdjoint", equals: CPS, source: "2.1" }] },
      { id: "peda", label: "1.2. / 2.2. Tâches pédagogiques", source: "1.2", sourceIf: [{ field: "typeAdjoint", equals: CPS, source: "2.2" }] },
      { id: "perso", label: "1.3. / 2.3. Personnalité", source: "1.3", sourceIf: [{ field: "typeAdjoint", equals: CPS, source: "2.3" }] },
    ],
    // « Procédure identique » à C2 : ligne 3 du tableau de C3 [module § C5A].
    table: "C3",
    row: 3,
    finalLabel: "APPRECIATION FINALE",
  },
};

// ---------------------------------------------------------------------------
// C6B — Enquête de viabilité
// ---------------------------------------------------------------------------

export const C6B: FicheDef = {
  format: 2,
  code: "C6B",
  version: 1,
  title: "ENQUETE DE VIABILITE",
  module: "C",
  scope: "visite",
  source: "C6B  REVUE_021334.pdf",
  levels: true,
  destinataires: ["Intéressé", "Etablissement", "IGE", "IPP", "Pool", "Proved", "Coord. Prov.", "S/Proved", "A.T./Bourgm.", "Secteur", "Classement"],
  header: [ETABLISSEMENT, text("entete.nomCE", "07. Nom du CE", { prefill: "schoolDirector" }), text("entete.telCE", "08. Téléphone du C.E.")],
  conversionTable: "PERCENT",
  sections: [
    {
      id: "1",
      title: "1. DEMANDEUR OU DONNEUR D'ORDRE",
      blocks: [text("1.nom", "Nom", { required: true }), text("1.fonction", "Fonction"), date("1.date", "Date"), text("1.reference", "Référence")],
    },
    { id: "2", title: "2. PROMOTEUR", blocks: [text("2.nom", "Nom", { required: true }), text("2.tel", "Tél."), text("2.adresse", "Adresse")] },
    { id: "3", title: "3. BUT", blocks: [textarea("3", "3. BUT", { required: true })] },
    {
      id: "4",
      title: "4. ETABLISSEMENT",
      blocks: [
        text("4.pool", "POOL D'INSPECTION", { prefill: "poolName" }),
        text("4.sousDivision", "SOUS-DIVISION"),
        text("4.coordination", "COORDINATION SOUS-PROVINCIALE"),
        textarea("4.1.adresse", "4.1. Adresse (nom, rue/avenue, numéro, localité, territoire, district, province)", { required: true }),
        choice("4.1.vacation", "Vacation", ["DV", "VUAM", "VUPM", "VUALT", "DOA", "DOAM", "DOPM"]),
        text("4.1.telephone", "Téléphone"),
        text("4.2", "4.2. Propriété des lieux"),
        text("4.3", "4.3. Arrêté d'agrément (date et référence)"),
        text("4.4", "4.4. Nature de la Parcelle"),
        text("4.5", "4.5. Autorisation d'ouverture"),
        text("4.6", "4.6. Nature des bâtiments"),
        date("4.7", "4.7. Date d'ouverture réelle"),
        text("4.8.nom", "4.8. Nom du chef d'établissement", { prefill: "schoolDirector" }),
        text("4.8.titre", "Titre (Institution et Référence)"),
        number("4.8.anciennete", "Ancienneté à l'EPSP (ans)"),
        choice("4.8.sexe", "Sexe", ["M", "F"]),
        number("4.8.age", "Age (ans)"),
        text("4.9", "4.9. Identité du responsable pédagogique"),
        text("4.10", "4.10. Dépôt bancaire (date de versement et montant)"),
      ],
    },
    {
      id: "5",
      title: "5. EVALUATION ANALYTIQUE : de 0 à 4 : selon la formule : T x 100 / R x 4",
      blocks: [
        { kind: "text", style: "note", text: "Ne pas faire la moyenne des notes, chaque chapitre étant considéré séparément." },
        poste("5.1", "5.1. IMPLANTATION", ["Environnement physique", "Environnement social", "Environnement pédagogique", "Entraide interscolaire", "Développement commun.", "Relation avec les parents", "Relation avec les autorités politiques et administratives"], PCT, { conseils: false }),
        poste("5.2", "5.2. PATRIMOINE", ["Etat de la parcelle", "Etat des bâtiments", "Etat des mobiliers", "Etat des équipements", "Etat des sanitaires", "Entretien général", "Esthétique générale", "Documents cadastraux", "Bibliothèque"], PCT, { conseils: false }),
        poste("5.3", "5.3. STRUCTURE", ["Bien fondé des cycles/options", "Dispersion des classes", "Etat des classes", "Pyramide scolaire", "Peuplement des classes", "Nombre des bancs", "Validité dossiers des apprenants", "Uniforme des apprenants"], PCT, { conseils: false }),
        poste("5.4", "5.4. PERSONNEL", ["Qualification", "Assiduité", "Disponibilité", "Conduite", "Collaboration", "Autoformation", "Encadrement pédagog."], PCT, { conseils: false }),
        poste("5.5", "5.5. ADMINISTRATION", ["Etat des bureaux", "Documentation officielle", "Ordre et classement", "Division du travail", "Archives/Dossiers/Registres", "Conservation des archives", "Fonctionnement"], PCT, { conseils: false }),
        poste("5.6", "5.6. FINANCES", ["Montants des contributions", "Prévision budgétaire", "Pièces comptables", "Livre de caisse", "Paiement du personnel", "Assurance scolaire", "Esprit d'économie"], PCT, { conseils: false }),
        poste("5.7", "5.7. PEDAGOGIE", ["Programme suivi", "Calendrier scolaire", "Horaire journalier", "Equipement pédagogique", "Tableaux", "Assiduité des apprenants", "Evaluation scolaire"], PCT, { conseils: false }),
        poste("5.8", "5.8. INTERNAT", ["Installations hygiéniques", "Régularité des repas", "Qualité des repas", "Tenue des registres", "Organisation de l'étude", "Loisirs (culture, sport)", "Contrôle médical"], PCT, { conseils: false }),
      ],
    },
    { id: "6", title: "6. COMMENTAIRE CRITIQUE", blocks: [textarea("6", "6. COMMENTAIRE CRITIQUE", { required: true })] },
    { id: "7", title: "7. CONCLUSION", blocks: [choice("7", "7. CONCLUSION", ["VIABLE", "A PARFAIRE", "NON VIABLE"], { required: true })] },
    {
      id: "sig",
      title: "Signature",
      blocks: [
        SIG_INSPECTEUR,
        { kind: "text", style: "note", text: "ANNEXES (Joindre impérieusement les quatre annexes suivantes telles que définies en A1 et en C2)" },
      ],
    },
  ],
};
