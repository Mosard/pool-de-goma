// Colonnes du canevas Excel des écoles (docs/import-ecoles-excel.md, § 3.2) :
// source unique pour le canevas, la lecture du fichier et les messages.

import { foldText } from "@/lib/school-fields";

export type ImportField =
  | "poolCode"
  | "code"
  | "name"
  | "province"
  | "territoire"
  | "type"
  | "director"
  | "phone"
  | "address"
  | "approvalDecree"
  | "classCount"
  | "teacherCount"
  | "options";

export type ImportColumn = {
  field: ImportField;
  /** En-tête affiché dans le canevas (« * » = obligatoire). */
  header: string;
  /** Nom court utilisé dans les motifs de rejet. */
  label: string;
  required: boolean;
  kind: "text" | "count";
  maxLength: number;
  width: number;
};

export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { field: "poolCode", header: "Code du POOL *", label: "Code du POOL", required: true, kind: "text", maxLength: 50, width: 16 },
  { field: "code", header: "Code de l'école *", label: "Code de l'école", required: true, kind: "text", maxLength: 50, width: 18 },
  { field: "name", header: "Nom de l'école *", label: "Nom de l'école", required: true, kind: "text", maxLength: 200, width: 32 },
  { field: "province", header: "Province *", label: "Province", required: true, kind: "text", maxLength: 100, width: 14 },
  { field: "territoire", header: "Territoire *", label: "Territoire", required: true, kind: "text", maxLength: 100, width: 16 },
  { field: "type", header: "Type (Maternelle / Primaire / Secondaire)", label: "Type", required: false, kind: "text", maxLength: 100, width: 22 },
  { field: "director", header: "Directeur", label: "Directeur", required: false, kind: "text", maxLength: 200, width: 24 },
  { field: "phone", header: "Téléphone", label: "Téléphone", required: false, kind: "text", maxLength: 50, width: 16 },
  { field: "address", header: "Adresse", label: "Adresse", required: false, kind: "text", maxLength: 300, width: 32 },
  { field: "approvalDecree", header: "Arrêté d'agrément", label: "Arrêté d'agrément", required: false, kind: "text", maxLength: 200, width: 24 },
  { field: "classCount", header: "Nombre de classes", label: "Nombre de classes", required: false, kind: "count", maxLength: 10, width: 12 },
  { field: "teacherCount", header: "Nombre d'enseignants", label: "Nombre d'enseignants", required: false, kind: "count", maxLength: 10, width: 14 },
  {
    field: "options",
    header: "Options organisées (secondaire seulement, séparées par des virgules)",
    label: "Options organisées",
    required: false,
    kind: "text",
    maxLength: 1000,
    width: 44,
  },
];

export const SCHOOLS_SHEET_NAME = "Écoles";
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

/** En-tête comparé sans casse, accents, astérisque ni précision entre parenthèses ; apostrophe typographique tolérée. */
export function normalizeHeader(header: string): string {
  return foldText(header.replace(/\(.*?\)/g, "").replace(/\*/g, "").replace(/[’`]/g, "'"));
}

const BY_HEADER = new Map(IMPORT_COLUMNS.map((c) => [normalizeHeader(c.header), c.field]));

export function matchHeader(header: string): ImportField | null {
  return BY_HEADER.get(normalizeHeader(header)) ?? null;
}

export function columnOf(field: ImportField): ImportColumn {
  return IMPORT_COLUMNS.find((c) => c.field === field)!;
}
