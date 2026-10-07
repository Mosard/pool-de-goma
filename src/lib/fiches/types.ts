// Format de définition des fiches officielles de l'inspection itinérante
// (format 2). Une définition est écrite dans le code
// (src/lib/fiches/defs/*), puis inscrite en base comme FormTemplate
// (code, version) — jamais modifiée ensuite : toute évolution crée la
// version suivante, pour que les anciens rapports restent lisibles.
//
// Les libellés sont repris mot pour mot des fiches (voir
// docs/inventaire-fiches-inspection.md).

export const FICHE_FORMAT = 2;

export type FicheModule = "A" | "C" | "F" | "T";
/** « visite » : rattachée à l'inspection d'une école ; « periode » : à l'inspecteur et à une période (A2, A3, A4, A6). */
export type FicheScope = "visite" | "periode";

export type ConversionTableId = "C3" | "C2C_C3B";

/** Conversion partielle d'un poste noté. */
export type ConversionMethod =
  | { method: "table"; table: ConversionTableId }
  | { method: "percent" };

/** Valeurs pré-remplies depuis le profil, le POOL ou l'école. */
export type PrefillKey =
  | "inspectorName"
  | "inspectorSex"
  | "inspectorPhone"
  | "inspectorEmail"
  | "poolName"
  | "schoolName"
  | "schoolDirector"
  | "schoolYear"
  | "province"
  | "today";

export type Condition = { field: string; equals: string };

export type InputType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "choice"
  | "checks"
  /** Note 0 à 4, ou « – » (neutralisé), ou « S.O. » (sans objet). */
  | "note"
  /** Appréciation E / TB / B / AB / M. */
  | "appreciation";

export type FieldDef = {
  kind: "field";
  id: string;
  label: string;
  type: InputType;
  options?: string[];
  required?: boolean;
  hint?: string;
  prefill?: PrefillKey;
  showIf?: Condition;
  /** Refuse une valeur réduite à « RAS », « rien », « absent » ou « néant » [module, C1/C2/C3]. */
  noRas?: boolean;
  /** Rempli par un autre service, jamais par l'auteur (ex. « Réservé à l'administration »). */
  notForAuthor?: boolean;
};

export type RatedItem = { id: string; label: string };

/** Poste noté : rubriques notées + observations, total, conversion, conseils. */
export type RatedPosteDef = {
  kind: "rated";
  id: string;
  label: string;
  /** "0-4" : notes chiffrées ; "M-E" : appréciations M, AB, B, TB, E (C2B, sans calcul). */
  scale: "0-4" | "M-E";
  items: RatedItem[];
  /** null : pas de conversion (C2B). */
  conversion: ConversionMethod | null;
  /** Rubriques laissées en blanc sur la fiche, que l'inspecteur peut intituler lui-même. */
  freeItems?: string[];
  conseils?: boolean;
  showIf?: Condition;
};

export type ColumnDef = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "choice";
  options?: string[];
  /** Colonne calculée : pourcentage arrondi = num × 100 / den [DOC A3]. */
  percentOf?: { num: string; den: string };
};

export type TableDef = {
  kind: "table";
  id: string;
  label: string;
  columns: ColumnDef[];
  /** Lignes imprimées sur la fiche (ex. codes A1 … T2, UP1 … UP6). Sans elles, lignes libres. */
  fixedRows?: { id: string; label: string }[];
  /** Colonnes additionnées en ligne « Total » (et sous-totaux par `groupBy`). */
  sumColumns?: string[];
  groupBy?: string;
  showIf?: Condition;
};

export type SignatureDef = {
  kind: "signature";
  id: string;
  label: string;
  /** Mention imprimée (« Pour prise de connaissance et réception »). */
  mention?: string;
  /** La signature (ou le refus de signer) est exigée pour soumettre. */
  required?: boolean;
  /** Le refus de signer est possible ; il est contresigné par deux témoins [module]. */
  allowRefusal?: boolean;
  /** Rempli par le service destinataire, pas par l'auteur (récépissé A6). */
  notForAuthor?: boolean;
  showIf?: Condition;
};

export type TextDef = { kind: "text"; text: string; style?: "legal" | "note" };

/** Valeur calculée déclarative (pas de fonction : la définition est stockée en JSON). */
export type ComputedDef = {
  kind: "computed";
  id: string;
  label: string;
  formula: { type: "addDays"; from: string; days: number; daysIf?: { field: string; equals: string; days: number } };
};

export type Block = FieldDef | RatedPosteDef | TableDef | SignatureDef | TextDef | ComputedDef;

export type SectionDef = {
  id: string;
  title: string;
  blocks: Block[];
  showIf?: Condition;
};

/** Évaluation synthétique : notes converties des postes → total → conversion à la ligne `row`. */
export type SyntheseDef = {
  label: string;
  parts: {
    id: string;
    label: string;
    /** Poste noté dont on reprend la conversion, ou champ « note » saisi à la main. */
    source: string;
    /** Postes alternatifs selon une condition (C5A : colonne CPP ou CPS). */
    sourceIf?: { field: string; equals: string; source: string }[];
  }[];
  table: ConversionTableId;
  row: number;
  finalLabel: string;
};

/** Contrôle croisé entre deux champs numériques (ex. présents ≤ inscrits). */
export type CheckDef = { type: "lte"; a: string; b: string; message: string };

export type FicheDef = {
  format: typeof FICHE_FORMAT;
  code: string;
  version: number;
  /** Intitulé exact de la fiche. */
  title: string;
  module: FicheModule;
  scope: FicheScope;
  /** Document d'origine (dossier « Document itinerant »). */
  source: string;
  /** Cases M / P / S présentes dans l'en-tête. */
  levels: boolean;
  /** Cases de ventilation (destinataires) imprimées dans l'en-tête. */
  destinataires: string[];
  /** Mentions d'en-tête propres à la fiche (après les postes communs 01 à 05). */
  header: FieldDef[];
  sections: SectionDef[];
  synthese?: SyntheseDef;
  /** Tableau de conversion imprimé sur la fiche (affiché pour référence). */
  conversionTable?: ConversionTableId | "PERCENT";
  checks?: CheckDef[];
  /** Champ qui distingue plusieurs exemplaires d'une visite (ex. nom de l'enseignant). */
  instanceLabel?: string;
};

// ---------------------------------------------------------------------------
// Données saisies
// ---------------------------------------------------------------------------

export type TableRow = Record<string, string> & { _id: string };

/** Valeurs : champ → texte ; cases → liste ; tableau → lignes ; rubrique notée → note. */
export type FicheValues = Record<string, string | string[] | TableRow[] | undefined>;

export type SignatureValue = {
  /** Image PNG (data URL) de la signature tracée à l'écran, absente en cas de refus. */
  image?: string;
  name: string;
  place?: string;
  date?: string;
  refused?: boolean;
  witnesses?: { name: string; image?: string }[];
  signedAt: string;
};

export type FicheData = {
  format: typeof FICHE_FORMAT;
  values: FicheValues;
  signatures: Record<string, SignatureValue>;
};

/** Clés internes des observations et conseils d'un poste noté. */
export const obsKey = (itemId: string) => `${itemId}#obs`;
export const conseilsKey = (posteId: string) => `${posteId}#conseils`;
export const freeLabelKey = (itemId: string) => `${itemId}#libelle`;
