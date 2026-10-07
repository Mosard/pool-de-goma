// Module I — Administration interne (A). Définitions v1, libellés repris
// mot pour mot des fiches (docs/inventaire-fiches-inspection.md, § 5.1 à 5.6).

import type { ColumnDef, FicheDef, SectionDef, TableDef } from "@/lib/fiches/types";
import {
  DEST_A,
  MOIS,
  OFFICIAL_CODES,
  SIG_INSPECTEUR,
  checks,
  choice,
  date,
  signature,
  text,
  textarea,
} from "@/lib/fiches/defs/commun";

// ---------------------------------------------------------------------------
// Période (A2, A3)
// ---------------------------------------------------------------------------

const PERIODE: SectionDef = {
  id: "1",
  title: "1. PERIODE",
  blocks: [
    text("1.1", "1.1. Année (20.. / 20..)", { prefill: "schoolYear", required: true }),
    choice("1.2", "1.2. Trimestre", ["1", "2", "3", "4"], {
      required: true,
      hint: "1 : septembre à décembre ; 2 : janvier à mars ; 3 : avril à juin ; 4 : juillet et août.",
    }),
    checks("1.3", "1.3. Série des mois", MOIS, { required: true }),
  ],
};

// ---------------------------------------------------------------------------
// A2 — Plan trimestriel d'activités
// ---------------------------------------------------------------------------

export const A2: FicheDef = {
  format: 2,
  code: "A2",
  version: 1,
  title: "PLAN TRIMESTRIEL D'ACTIVITES",
  module: "A",
  scope: "periode",
  source: "A2  REVUE_021135.pdf",
  levels: true,
  destinataires: DEST_A,
  header: [text("entete.province", "Province", { prefill: "province" })],
  instanceLabel: "1.2",
  sections: [
    PERIODE,
    {
      id: "2",
      title: "2. ACTIVITES A REALISER",
      blocks: [
        {
          kind: "table",
          id: "2",
          label: "Activités à réaliser (sous-total par mois, total général)",
          columns: [
            { id: "mois", label: "Nom du mois", type: "choice", options: MOIS },
            { id: "du", label: "Date(s) du …", type: "date" },
            { id: "au", label: "… au …", type: "date" },
            { id: "lieu", label: "Lieux / Etablissements", type: "text" },
            { id: "classes", label: "Nombre de classes / Unités", type: "number" },
            { id: "code", label: "Type d'activités codées", type: "choice", options: OFFICIAL_CODES },
            { id: "jours", label: "Nombre de jours prévus", type: "number" },
          ],
          sumColumns: ["classes", "jours"],
          groupBy: "mois",
        },
      ],
    },
    { id: "sig", title: "Signature", blocks: [SIG_INSPECTEUR] },
  ],
};

// ---------------------------------------------------------------------------
// A3 — Relevé trimestriel d'activités
// ---------------------------------------------------------------------------

/** Codes du tableau statistique de A3, avec colonnes P / R / % (true) ou R seul (false). */
const A3_CODES: [string, boolean][] = [
  ["A1", true], ["A2", false], ["A3", false], ["A4", false], ["A5", false], ["A6", false], ["A7", false], ["A8", false], ["A11", false], ["A12", false],
  ["C1", true], ["C2", true], ["C2B", true], ["C3", true], ["C3B", true], ["C3M", true], ["C4", false], ["C5A", true], ["C5B", true],
  ["C6A", false], ["C6B", false], ["C7", true], ["C8", false],
  ["F1", true], ["F2", true], ["F3", true], ["F4", false],
  ["T1", true], ["T2", false],
];
const MESURES = [
  { id: "ecoles", label: "Ecoles / Services" },
  { id: "personnes", label: "Personnes" },
  { id: "documents", label: "Documents" },
  { id: "jours", label: "Nombre de jours" },
];

const A3_PRODUCTION: TableDef = {
  kind: "table",
  id: "2",
  label: "2. TABLEAU STATISTIQUE DE LA PRODUCTION DU TRIMESTRE (P = Prévu, R = Réalisé, % = Pourcentage ; P vide pour les codes en R seul)",
  fixedRows: A3_CODES.map(([code, pr]) => ({ id: code, label: pr ? code : `${code} (R)` })),
  columns: MESURES.flatMap((m): ColumnDef[] => [
    { id: `${m.id}P`, label: `${m.label} P`, type: "number" },
    { id: `${m.id}R`, label: `${m.label} R`, type: "number" },
    { id: `${m.id}Pct`, label: `${m.label} %`, type: "number", percentOf: { num: `${m.id}R`, den: `${m.id}P` } },
  ]),
  sumColumns: ["joursP", "joursR"],
};

const NOTATION: TableDef = {
  kind: "table",
  id: "4",
  label: "TABLEAU SYNOPTIQUE DE LA NOTATION (nombre de personnes par note ; balance carrée)",
  fixedRows: [
    { id: "C2", label: "Chefs d'établissement — C2" },
    { id: "C2B", label: "Chefs d'établissement — C2B" },
    { id: "C5A", label: "Adjoints du C.E. — C5A" },
    { id: "C5B", label: "Adjoints du C.E. — C5B" },
    { id: "C3q", label: "Enseignants qualifiés — C3" },
    { id: "C3sq", label: "Enseignants sous-qualifiés — C3" },
  ],
  columns: [
    { id: "n4", label: "4", type: "number" },
    { id: "n3", label: "3", type: "number" },
    { id: "n2", label: "2", type: "number" },
    { id: "n1", label: "1", type: "number" },
    { id: "n0", label: "0", type: "number" },
    { id: "total", label: "TOTAUX", type: "number", sumOf: ["n4", "n3", "n2", "n1", "n0"] },
  ],
  sumColumns: ["n4", "n3", "n2", "n1", "n0", "total"],
  percentRow: { of: "total" },
};

export const A3: FicheDef = {
  format: 2,
  code: "A3",
  version: 1,
  title: "RELEVE TRIMESTRIEL D'ACTIVITES",
  module: "A",
  scope: "periode",
  source: "A3 REVUE_021140.pdf",
  levels: true,
  destinataires: DEST_A,
  header: [],
  instanceLabel: "1.2",
  checks: [
    {
      type: "totalsEqual",
      a: { table: "3", column: "jours" },
      b: { table: "2", column: "joursR" },
      message: "Le nombre de jours du tableau analytique doit être égal à la somme des jours réalisés du tableau statistique.",
    },
  ],
  sections: [
    PERIODE,
    { id: "2", title: "2. TABLEAU STATISTIQUE DE LA PRODUCTION DU TRIMESTRE", blocks: [A3_PRODUCTION] },
    {
      id: "3",
      title: "3. TABLEAU ANALYTIQUE DE LA PRODUCTION DU TRIMESTRE (A établir parallèlement au plan trimestriel d'activités)",
      blocks: [
        {
          kind: "table",
          id: "3",
          label: "Tableau analytique",
          columns: [
            { id: "mois", label: "Mois", type: "choice", options: MOIS },
            { id: "dates", label: "Dates", type: "text" },
            { id: "lieux", label: "Lieux", type: "text" },
            { id: "classes", label: "Nombre de classes / Unités", type: "number" },
            { id: "numeros", label: "Numéros thématiques des rapports", type: "text" },
            { id: "jours", label: "Nombre de jours", type: "number" },
          ],
          sumColumns: ["classes", "jours"],
        },
      ],
    },
    { id: "4", title: "4. TABLEAU SYNOPTIQUE DE LA NOTATION", blocks: [NOTATION] },
    {
      id: "5",
      title: "5. TABLEAU DES JOURS DE MISSION",
      blocks: [
        {
          kind: "table",
          id: "5",
          label: "Jours de mission",
          columns: [
            { id: "jours", label: "Jours accomplis", type: "number" },
            { id: "montants", label: "Montants reçus", type: "number" },
            { id: "references", label: "Références des ordres de mission", type: "text" },
          ],
          sumColumns: ["jours", "montants"],
        },
      ],
    },
    { id: "6", title: "6. DIFFICULTES RENCONTREES DANS LES TOURNEES INSPECTORALES SUR LE PLAN :", blocks: [textarea("6", "6. Difficultés rencontrées")] },
    { id: "7", title: "7. SUGGESTIONS POUR L'AMELIORATION DE L'INSPECTION", blocks: [textarea("7", "7. Suggestions")] },
    { id: "sig", title: "Signature", blocks: [signature("sig.inspecteur", "Signature de l'Inspecteur Itinérant", { required: true })] },
  ],
};

// ---------------------------------------------------------------------------
// A4 — Relevé annuel d'activités
// ---------------------------------------------------------------------------

const A4_CODES = [
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A10", "A11", "A12",
  "C1", "C2", "C2B", "C3", "C3B", "C3M", "C4", "C5A", "C5B", "C6A", "C6B", "C7",
  "F1", "F2", "F3", "F4", "T1", "T2",
];
const TRIMESTRES = ["1", "2", "3", "4"];

export const A4: FicheDef = {
  format: 2,
  code: "A4",
  version: 1,
  title: "RELEVE ANNUEL D'ACTIVITES",
  module: "A",
  scope: "periode",
  source: "A4 REVUE1_021145.pdf",
  levels: true,
  destinataires: DEST_A,
  header: [],
  instanceLabel: "entete.anneeScolaire",
  sections: [
    { id: "1", title: "1. PERIODE COUVERTE", blocks: [date("1.du", "DU", { required: true }), date("1.au", "AU", { required: true })] },
    {
      id: "2",
      title: "2. TABLEAU STATISTIQUE DE LA PRODUCTION ANNUELLE",
      blocks: [
        {
          kind: "table",
          id: "2",
          label: "Production annuelle (total des quatre relevés trimestriels A3, sans pourcentage)",
          fixedRows: A4_CODES.map((c) => ({ id: c, label: c })),
          columns: [
            { id: "ecoles", label: "ECOLES / SERVICES", type: "number" },
            { id: "personnes", label: "PERSONNES", type: "number" },
            { id: "documents", label: "DOCUMENTS", type: "number" },
            { id: "jours", label: "JOURS", type: "number" },
          ],
          sumColumns: ["ecoles", "personnes", "documents", "jours"],
        },
      ],
    },
    {
      id: "3",
      title: "3. RELEVE MODULAIRE ET TRIMESTRIEL EN JOURS ET EN POURCENTAGES",
      blocks: [
        {
          kind: "table",
          id: "3",
          label: "Jours prévus (P), réalisés (R) et % par trimestre ; bilan",
          fixedRows: ["1", "2", "3", "4"].map((m) => ({ id: `M${m}`, label: `MODULE ${m}` })),
          columns: [
            ...TRIMESTRES.flatMap((t): ColumnDef[] => [
              { id: `t${t}P`, label: `Trimestre ${t} P`, type: "number" },
              { id: `t${t}R`, label: `Trimestre ${t} R`, type: "number" },
              { id: `t${t}Pct`, label: `Trimestre ${t} %`, type: "number", percentOf: { num: `t${t}R`, den: `t${t}P` } },
            ]),
            { id: "bilanP", label: "BILAN P", type: "number", sumOf: TRIMESTRES.map((t) => `t${t}P`) },
            { id: "bilanR", label: "BILAN R", type: "number", sumOf: TRIMESTRES.map((t) => `t${t}R`) },
            { id: "bilanPct", label: "BILAN %", type: "number", percentOf: { num: "bilanR", den: "bilanP" } },
          ],
          sumColumns: [...TRIMESTRES.flatMap((t) => [`t${t}P`, `t${t}R`]), "bilanP", "bilanR"],
        },
      ],
    },
    {
      id: "4",
      title: "4. TABLEAU STATISTIQUE DES EFFECTIFS DE LA JURIDICTION",
      blocks: [
        {
          kind: "table",
          id: "4",
          label: "Effectifs de la juridiction",
          fixedRows: [
            { id: "etablissements", label: "1. Etablissements" },
            { id: "ce", label: "2. Chefs d'établissement" },
            { id: "adjoints", label: "3. Adjoints du C.E." },
            { id: "enseignants", label: "4. Enseignants" },
          ],
          columns: [
            { id: "reelles", label: "UNITES REELLES", type: "number" },
            { id: "inspectees", label: "UNITES INSPECTEES", type: "number" },
            { id: "pct", label: "POURCENTAGE D'INSPECTES", type: "number", percentOf: { num: "inspectees", den: "reelles" } },
          ],
          sumColumns: ["reelles", "inspectees"],
        },
      ],
    },
    {
      id: "5",
      title: "5. TABLEAU STATISTIQUE DE LA QUALIFICATION",
      blocks: [
        text("5.discipline", "2. SECONDAIRE : discipline inspectée"),
        {
          kind: "table",
          id: "5",
          label: "Qualification des enseignants (effectifs réels au maternel et au primaire ; enseignants inspectés au secondaire)",
          fixedRows: [
            { id: "mp", label: "0 + 1 : MATERNEL ET PRIMAIRE : tous" },
            { id: "s", label: "2. SECONDAIRE : discipline inspectée" },
          ],
          columns: [
            { id: "q", label: "QUALIFIES", type: "number" },
            { id: "sq", label: "SOUS-QUALIFIES", type: "number" },
            { id: "total", label: "Total (calculé)", type: "number", sumOf: ["q", "sq"] },
            { id: "pct", label: "% QUALIFIES", type: "number", percentOf: { num: "q", den: "total" } },
          ],
          sumColumns: ["q", "sq", "total"],
        },
      ],
    },
    { id: "6", title: "6. TABLEAU SYNOPTIQUE DE LA NOTATION", blocks: [{ ...NOTATION, id: "6", label: "Total des quatre trimestres" }] },
    {
      id: "7",
      title: "7. TABLEAU DES JOURS DES MISSIONS",
      blocks: [
        {
          kind: "table",
          id: "7",
          label: "Jours de mission par trimestre",
          fixedRows: TRIMESTRES.map((t) => ({ id: `T${t}`, label: `Trimestre ${t}` })),
          columns: [
            { id: "jours", label: "Jours accomplis", type: "number" },
            { id: "montants", label: "Montants reçus", type: "number" },
            { id: "references", label: "Références des ordres de missions", type: "text" },
          ],
          sumColumns: ["jours", "montants"],
        },
      ],
    },
    {
      id: "8",
      title: "8. DIFFICULTES RENCONTREES DANS LES TOURNEES D'INSPECTION",
      blocks: [
        textarea("8.1", "8.1. Sur le plan pédagogique"),
        textarea("8.2", "8.2. Sur plan matériel"),
        textarea("8.3", "8.3. Sur le plan technique"),
        textarea("8.4", "8.4. Sur le plan structurel"),
        textarea("8.5", "8.5. Sur le plan financier"),
        textarea("8.6", "8.6. Autres"),
      ],
    },
    {
      id: "9",
      title: "9. RECOMMANDATIONS, SUGGESTIONS, CONSEILS POUR L'AMELIORATION DE L'INSPECTION",
      blocks: [textarea("9.1", "9.1. CONTROLE"), textarea("9.2", "9.2. FORMATION"), textarea("9.3", "9.3. EVALUATION")],
    },
    { id: "sig", title: "Signature", blocks: [signature("sig.inspecteur", "Signature de l'inspecteur", { required: true })] },
  ],
};

// ---------------------------------------------------------------------------
// A5 — Constat d'absence
// ---------------------------------------------------------------------------

const ABSENT_CE = "D'UN CHEF D'ETABLISSEMENT";
const DEST_SOUS_DIVISION = "Au Chef de Sous-Division";

export const A5: FicheDef = {
  format: 2,
  code: "A5",
  version: 1,
  title: "CONSTAT D'ABSENCE",
  module: "A",
  scope: "visite",
  source: "A5 REVUE_021150.pdf",
  levels: true,
  destinataires: ["Intéressé", "IGE", "IPP", "Pool", "Proved", "Gestionnaire", "AT / Bourg.", "Secteur", "Classement"],
  header: [text("entete.province", "08. Province", { prefill: "province" })],
  instanceLabel: "2.nom",
  checks: [
    {
      type: "includesIf",
      when: { field: "typeAbsent", equals: ABSENT_CE },
      field: "4.destinataires",
      value: DEST_SOUS_DIVISION,
      message: "Le constat d'absence d'un chef d'établissement est adressé au chef de sous-division.",
    },
  ],
  sections: [
    {
      id: "type",
      title: "CONSTAT D'ABSENCE",
      blocks: [choice("typeAbsent", "Constat d'absence", [ABSENT_CE, "D'UN MEMBRE DU PERSONNEL"], { required: true })],
    },
    {
      id: "1",
      title: "1. IDENTITE DE L'ETABLISSEMENT",
      blocks: [
        text("1.nom", "NOM", { prefill: "schoolName", required: true }),
        text("1.matricule", "MATRICULE"),
        text("1.bp", "B.P. … à …"),
        textarea("1.adresse", "ADRESSE COMPLETE"),
        text("1.sousDivision", "SOUS-DIVISION"),
        text("1.pool", "POOL D'INSPECTION", { prefill: "poolName" }),
        text("1.gestion", "GESTION"),
        text("1.coordination", "COORDINATION SOUS-PROVINCIALE"),
      ],
    },
    {
      id: "2",
      title: "2. IDENTITE DE L'ABSENT",
      blocks: [
        text("2.nom", "NOM", { required: true }),
        text("2.matricule", "MATRICULE"),
        text("2.fonction", "FONCTION", { required: true }),
        date("2.date", "DATE DU CONSTAT", { required: true }),
        { kind: "field", id: "2.heure", label: "HEURE DU CONSTAT", type: "time", required: true },
        text("2.nomCE", "NOM DU CHEF D'ETABLISSEMENT (uniquement si différent de 2)"),
      ],
    },
    { id: "3", title: "3. OBSERVATION (S)", blocks: [textarea("3", "3. OBSERVATION (S)")] },
    {
      id: "admin",
      title: "RESERVE A L'ADMINISTRATION",
      blocks: [textarea("reserveAdministration", "RESERVE A L'ADMINISTRATION", { notForAuthor: true })],
    },
    {
      id: "4",
      title: "4. LETTRE",
      blocks: [
        checks("4.destinataires", "Destinataire", [DEST_SOUS_DIVISION, "Au Coordinateur Sous-Provincial", "Au Chef d'Etablissement"], { required: true }),
        { kind: "text", text: "En tournée d'inspection, j'ai constaté l'absence, identifiée sous rubrique," },
        choice("4.absenceDe", "Absence constatée", ["du Chef d'Etablissement", "de l'enseignant", "de (préciser)"], { required: true }),
        text("4.preciser", "de (préciser)", { showIf: { field: "4.absenceDe", equals: "de (préciser)" }, required: true }),
        {
          kind: "text",
          style: "legal",
          text: "Aucune autorisation, ni aucune explication n'ont pu être produites à son sujet. C'est pourquoi, je vous invite à demander à l'intéressé de fournir à son chef hiérarchique, dans de courts délais, la justification écrite de cette absence et en même temps de m'en faire tenir une copie pour information et contrôle du suivi (voir postes 01, 04 et 05 de l'en-tête).",
        },
        signature("sig.inspecteur", "Signature de l'Inspecteur", { required: true }),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// A6 — Bordereau de transmission
// ---------------------------------------------------------------------------

const A6_CODES = [
  "C1", "C2", "C2B", "C2C", "C3", "C3B", "C3M", "C4", "C5A", "C5B", "C6A", "C6B", "C7", "C8",
  "F1", "F2", "F3", "F4", "T1", "T2", "A1", "A7", "A2", "A8", "A3", "A11", "A4", "A12", "A5", "AUTRES",
];

export const A6: FicheDef = {
  format: 2,
  code: "A6",
  version: 1,
  title: "BORDEREAU DE TRANSMISSION",
  module: "A",
  scope: "periode",
  source: "A6_EDU_NC.pdf",
  levels: true,
  destinataires: ["Intéressé", "Etablissement", "IGE", "IPP", "Pool", "Proved", "Gestionnaire", "S/Proved", "Secteur", "Classement"],
  header: [],
  numberLabel: "07. Remise / Envoi N°",
  sections: [
    {
      id: "1",
      title: "BORDEREAU DE TRANSMISSION",
      blocks: [
        {
          kind: "table",
          id: "1",
          label: "1. CODE — 2. NOMBRE — 3. NUMERO DE CHAQUE DOCUMENT (entrée universelle, séparée par « ; »)",
          fixedRows: A6_CODES.map((c) => ({ id: c, label: c })),
          columns: [
            { id: "nombre", label: "2. NOMBRE", type: "number" },
            { id: "numeros", label: "3. NUMERO DE CHAQUE DOCUMENT", type: "text" },
          ],
          sumColumns: ["nombre"],
        },
        SIG_INSPECTEUR,
      ],
    },
    {
      id: "4",
      title: "4. RECEPISSE (Remettre ou renvoyer sans délai le récépissé au transmetteur)",
      blocks: [
        text("4.service", "Nom du service qui réceptionne", { notForAuthor: true }),
        choice("4.conformite", "Réception", ["RECEPTION CONFORME", "RECEPTION NON CONFORME"], { notForAuthor: true }),
        textarea("4.manquants", "Reprendre les numéros manquants ci-dessous en notant les codes dans l'ordre progressif", { notForAuthor: true }),
        signature("sig.reception", "Nom et signature du réceptionnaire", { notForAuthor: true }),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// A11 — PV de suspension préventive et A12 — PV d'ouverture d'action disciplinaire
// ---------------------------------------------------------------------------

function procesVerbal(intro: string): SectionDef[] {
  return [
    {
      id: "pv",
      title: "PROCES-VERBAL",
      blocks: [
        { kind: "text", style: "legal", text: intro },
        text("nous.nom", "Nous : Nom, Postnom, Prénom", { prefill: "inspectorName", required: true }),
        text("nous.grade", "Grade"),
        text("nous.fonction", "Fonction"),
        { kind: "text", text: "Avons constaté ce jour à charge de :" },
        choice("charge.civilite", "M., Mme, Mlle", ["M.", "Mme", "Mlle"]),
        text("charge.nom", "Nom", { required: true }),
        text("charge.grade", "Grade"),
        text("charge.matricule", "N° Matricule"),
        text("charge.fonction", "Fonction", { required: true }),
        text("charge.etablissement", "Nom de l'Etablissement", { prefill: "schoolName" }),
        text("charge.sousDivision", "Sous-Division"),
        text("charge.pool", "Pool d'Inspection", { prefill: "poolName" }),
        text("charge.gestion", "Gestion"),
        text("charge.coordination", "Coordination Sous-Provinciale"),
        textarea("fautes", "La (les) faute (s) disciplinaire (s) suivante (s) : (libellé concis, mais complet des fautes reprochées, de circonstance de temps, de lieu, etc.)", { required: true }),
      ],
    },
  ];
}

export const A11: FicheDef = {
  format: 2,
  code: "A11",
  version: 1,
  title: "PROCES-VERBAL DE SUSPENSION PREVENTIVE / MESURES CONSERVATOIRES",
  module: "A",
  scope: "visite",
  source: "A11 REVUE_021210.pdf",
  levels: true,
  destinataires: DEST_A,
  header: [],
  instanceLabel: "charge.nom",
  sections: [
    ...procesVerbal(
      "Conformément à l'article 2 de l'ordonnance N°91-231 du 15 août 1991 et de la circulaire ministérielle N° MINEPSP/CABMIN/001/02126/91 du 21 septembre 1991, spécialement en ses annexes A et B, relatives aux mesures conservatoires à prendre à l'encontre du personnel des établissements scolaires des niveaux maternel, primaire et secondaire ;"
    ),
    {
      id: "mesures",
      title: "Mesures conservatoires",
      blocks: [
        textarea("mesures", "En suite de quoi, nous avons pris la (les) mesure (s) conservatoire (s) suivante (s) à charge du (de la) prénommé (e).", { required: true }),
        { kind: "text", text: "En annexe, le procès-verbal d'ouverture d'action disciplinaire à charge de l'incriminé (e)." },
      ],
    },
    {
      id: "sig",
      title: "Signatures",
      blocks: [
        SIG_INSPECTEUR,
        signature("sig.incrimine", "Signature de l'agent incriminé", { mention: "Pour réception et prise de connaissance", required: true, allowRefusal: true }),
      ],
    },
  ],
};

export const A12: FicheDef = {
  format: 2,
  code: "A12",
  version: 1,
  title: "PROCES-VERBAL D'OUVERTURE D'ACTION DISCIPLINAIRE",
  module: "A",
  scope: "visite",
  source: "A12 REVUE_021213.pdf",
  levels: true,
  destinataires: ["Intéressé", "Etablissement", "IGE", "IPP", "Pool", "Proved", "Gestionnaire", "A.T./Bourgm.", "Secteur", "Classement"],
  header: [],
  instanceLabel: "charge.nom",
  sections: [
    ...procesVerbal("Conformément aux dispositions du Titre III, Chapitre IX du statut relatives au régime disciplinaire,"),
    {
      id: "suite",
      title: "Justifications",
      blocks: [
        { kind: "text", text: "En suite de quoi, il est invité à présenter ses justifications écrites dans le délai réglementaire." },
        { kind: "text", text: "Le présent procès-verbal ouvre d'office l'action disciplinaire à charge du prénommé en date de ce jour." },
        date("ouverture.date", "Date de l'ouverture de l'action disciplinaire (prise de connaissance)", { required: true }),
        choice("ouverture.memeLocalite", "L'agent se trouve-t-il dans la même localité que l'autorité ayant ouvert l'action ?", ["Oui", "Non"], { required: true }),
        {
          kind: "computed",
          id: "delai",
          label: "Date limite des justifications écrites (20 jours ; 30 jours hors de la localité)",
          formula: { type: "addDays", from: "ouverture.date", days: 20, daysIf: { field: "ouverture.memeLocalite", equals: "Non", days: 30 } },
        },
      ],
    },
    {
      id: "sig",
      title: "Signatures",
      blocks: [
        SIG_INSPECTEUR,
        signature("sig.incrimine", "Signature de l'Incriminé", { mention: "Pour réception et prise de connaissance", required: true, allowRefusal: true }),
      ],
    },
  ],
};
