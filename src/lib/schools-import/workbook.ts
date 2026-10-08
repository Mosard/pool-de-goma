// Fichiers Excel des écoles (exceljs) : canevas vierge à télécharger et
// lecture du canevas rempli. Aucune base ici ; le contrôle d'accès et
// l'écriture sont dans server.ts.

import type { CellValue, Workbook, Worksheet } from "exceljs";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, SCHOOLS_SHEET_NAME, matchHeader, type ImportField } from "@/lib/schools-import/columns";
import type { RawRow } from "@/lib/schools-import/validate";

/** Fichier refusé en bloc (illisible, pas le canevas, trop de lignes) : rien n'est importé. */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

async function newWorkbook(): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "IPP Nord-Kivu 1";
  return wb;
}

/** Canevas vierge : une colonne par champ de la fiche école, codes du POOL et de l'école en tête. */
export async function buildSchoolTemplate(pools: { code: string; name: string }[]): Promise<Buffer> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet(SCHOOLS_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  // Format texte sur les colonnes de texte : les codes et numéros gardent leurs zéros en tête.
  ws.columns = IMPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.field,
    width: c.width,
    style: c.kind === "text" ? { numFmt: "@" } : {},
  }));
  const header = ws.getRow(1);
  header.height = 36;
  IMPORT_COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? "FF1E3A8A" : "FF475569" } };
  });

  // Aides à la saisie (le serveur revérifie tout).
  const codes = pools.map((p) => p.code).join(",");
  const poolList = codes.length > 0 && codes.length <= 250 ? `"${codes}"` : null;
  for (let r = 2; r <= MAX_IMPORT_ROWS + 1; r++) {
    const row = ws.getRow(r);
    IMPORT_COLUMNS.forEach((c, i) => {
      if (c.kind === "count") {
        row.getCell(i + 1).dataValidation = {
          type: "whole",
          operator: "greaterThanOrEqual",
          formulae: [0],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: c.label,
          error: "Nombre entier positif attendu.",
        };
      } else if (c.field === "poolCode" && poolList) {
        row.getCell(i + 1).dataValidation = {
          type: "list",
          formulae: [poolList],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: c.label,
          error: "Code de POOL inconnu : voir la feuille « Mode d'emploi ».",
        };
      }
    });
  }

  const help = wb.addWorksheet("Mode d'emploi");
  help.getColumn(1).width = 110;
  const lines = [
    "Import des écoles — mode d'emploi",
    "",
    "1. Remplissez une ligne par école dans la feuille « Écoles », sans modifier la ligne d'en-tête.",
    "2. Une école est identifiée par « code du POOL + code de l'école », jamais par son nom.",
    "   • Code absent du POOL : l'école est créée.  • Code déjà enregistré dans ce POOL : la fiche est mise à jour.",
    "3. Colonnes marquées * : obligatoires. Une cellule facultative laissée vide ne modifie pas la valeur déjà enregistrée.",
    "4. Le code du POOL de chaque ligne doit être celui du POOL choisi à l'écran d'import ; sinon la ligne est rejetée.",
    "5. Nombre de classes et nombre d'enseignants : nombres entiers (0 ou plus).",
    "6. Options organisées : écoles secondaires seulement (type « Secondaire »), séparées par des virgules.",
    "   Exemple : Pédagogie générale, Commerciale et gestion, Scientifique",
    `7. ${MAX_IMPORT_ROWS} écoles au plus par fichier. Les lignes correctes sont importées ; les autres sont listées avec leur motif.`,
    "",
    "Codes des POOL que vous pouvez utiliser :",
    ...pools.map((p) => `   ${p.code} — ${p.name}`),
  ];
  lines.forEach((text, i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Texte d'une cellule, quel que soit son type Excel (nombre, formule, lien, texte enrichi). */
export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if ("richText" in value) return value.richText.map((t) => t.text).join("");
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("result" in value) return cellText((value.result ?? null) as CellValue);
  return "";
}

function headerMap(ws: Worksheet): Map<number, ImportField> {
  const map = new Map<number, ImportField>();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const field = matchHeader(cellText(cell.value));
    if (field && ![...map.values()].includes(field)) map.set(col, field);
  });
  return map;
}

/** Lignes non vides de la feuille des écoles, avec leur numéro de ligne Excel. */
export async function readSchoolRows(data: ArrayBuffer | Uint8Array): Promise<RawRow[]> {
  const wb = await newWorkbook();
  try {
    await wb.xlsx.load(data as unknown as Parameters<Workbook["xlsx"]["load"]>[0]);
  } catch {
    throw new ImportFileError("Fichier illisible : enregistrez-le au format Excel (.xlsx), à partir du canevas.");
  }

  const named = wb.getWorksheet(SCHOOLS_SHEET_NAME);
  const candidates = named ? [named, ...wb.worksheets.filter((w) => w !== named)] : wb.worksheets;
  const required = IMPORT_COLUMNS.filter((c) => c.required);
  let sheet: { ws: Worksheet; columns: Map<number, ImportField> } | null = null;
  let bestMissing: string[] = required.map((c) => c.label);
  for (const ws of candidates) {
    const columns = headerMap(ws);
    const found = new Set(columns.values());
    const missing = required.filter((c) => !found.has(c.field)).map((c) => c.label);
    if (missing.length === 0) {
      sheet = { ws, columns };
      break;
    }
    if (missing.length < bestMissing.length) bestMissing = missing;
  }
  if (!sheet) {
    throw new ImportFileError(
      `Ce fichier n'est pas le canevas des écoles : colonne(s) obligatoire(s) introuvable(s) en ligne 1 — ${bestMissing.join(", ")}. Téléchargez le canevas et gardez sa ligne d'en-tête.`
    );
  }

  const rows: RawRow[] = [];
  for (let r = 2; r <= sheet.ws.rowCount; r++) {
    const row = sheet.ws.getRow(r);
    const cells: RawRow["cells"] = {};
    let empty = true;
    for (const [col, field] of sheet.columns) {
      const text = cellText(row.getCell(col).value).trim();
      if (text) empty = false;
      cells[field] = text;
    }
    if (empty) continue;
    if (rows.length >= MAX_IMPORT_ROWS) {
      throw new ImportFileError(`Plus de ${MAX_IMPORT_ROWS} écoles dans le fichier : découpez-le en plusieurs fichiers.`);
    }
    rows.push({ line: r, cells });
  }
  return rows;
}
