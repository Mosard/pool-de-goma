// Contrôles d'une fiche avant soumission (docs/inventaire-fiches-inspection.md,
// § 8). Les erreurs bloquent la soumission ; les avertissements non.

import { APPRECIATION_VALUES, NEUTRAL_VALUES, NOTE_VALUES, computeFiche, isVisible, toNumber, visibleBlocks } from "@/lib/fiches/calculs";
import { commonHeaderFields } from "@/lib/fiches/defs/index";
import type { FicheData, FicheDef, FieldDef, SignatureDef } from "@/lib/fiches/types";
import { freeLabelKey, obsKey } from "@/lib/fiches/types";

export type Issue = { id: string; message: string; level: "error" | "warning" };

/** Mots refusés comme seule réponse [module, C1/C2/C3 : « RAS, rien, absent, néant ne sont pas autorisés »]. */
const FORBIDDEN = ["ras", "r.a.s", "r.a.s.", "rien", "absent", "absente", "neant"];

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function isForbiddenAnswer(value: string): boolean {
  return FORBIDDEN.includes(normalize(value));
}

function isEmpty(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  return typeof v !== "string" || v.trim() === "";
}

function checkField(f: FieldDef, data: FicheData, issues: Issue[]) {
  if (f.notForAuthor || !isVisible(f.showIf, data.values)) return;
  const v = data.values[f.id];
  if (f.required && isEmpty(v)) {
    issues.push({ id: f.id, level: "error", message: `« ${f.label} » est à remplir.` });
    return;
  }
  if (typeof v !== "string" || v.trim() === "") return;
  if (f.noRas && isForbiddenAnswer(v)) {
    issues.push({ id: f.id, level: "error", message: `« ${f.label} » : RAS, rien, absent ou néant ne sont pas autorisés (écrire « - » ou « S.O. »).` });
  }
  if (f.type === "number" && toNumber(v) === null) issues.push({ id: f.id, level: "error", message: `« ${f.label} » doit être un nombre.` });
  if (f.type === "note" && ![...NOTE_VALUES, ...NEUTRAL_VALUES].includes(v as never)) {
    issues.push({ id: f.id, level: "error", message: `« ${f.label} » : note de 0 à 4, « - » ou « S.O. ».` });
  }
  if (f.type === "appreciation" && !(APPRECIATION_VALUES as readonly string[]).includes(v)) {
    issues.push({ id: f.id, level: "error", message: `« ${f.label} » : E, TB, B, AB ou M.` });
  }
}

function checkSignature(s: SignatureDef, data: FicheData, issues: Issue[]) {
  if (s.notForAuthor || !s.required || !isVisible(s.showIf, data.values)) return;
  const sig = data.signatures[s.id];
  if (!sig) {
    issues.push({ id: s.id, level: "error", message: `Signature manquante : ${s.label}.` });
    return;
  }
  if (sig.refused) {
    const witnesses = (sig.witnesses ?? []).filter((w) => w.name.trim() !== "" && w.image);
    if (witnesses.length < 2) {
      issues.push({ id: s.id, level: "error", message: `${s.label} : le refus de signer doit être contresigné par deux témoins.` });
    }
  } else if (!sig.image || sig.name.trim() === "") {
    issues.push({ id: s.id, level: "error", message: `${s.label} : nom et signature requis.` });
  }
}

export function validateFiche(def: FicheDef, data: FicheData): Issue[] {
  const issues: Issue[] = [];
  const values = data.values;

  for (const f of [...commonHeaderFields(def), ...def.header]) checkField(f, data, issues);

  for (const { block } of visibleBlocks(def, values)) {
    if (block.kind === "field") checkField(block, data, issues);
    else if (block.kind === "signature") checkSignature(block, data, issues);
    else if (block.kind === "rated") {
      for (const item of block.items) {
        const v = typeof values[item.id] === "string" ? (values[item.id] as string).trim() : "";
        const isFree = block.freeItems?.includes(item.id);
        const freeLabel = isFree ? String(values[freeLabelKey(item.id)] ?? "").trim() : "";
        if (isFree && freeLabel === "" && v === "") continue;
        const num = item.num ?? item.id;
        if (v === "") {
          // « Toutes les rubriques doivent être traitées » [module § C1, C2].
          issues.push({ id: item.id, level: "error", message: `Rubrique ${num} ${item.label || freeLabel} : note, « - » ou « S.O. » à indiquer.` });
          continue;
        }
        if (isFree && freeLabel === "") {
          issues.push({ id: freeLabelKey(item.id), level: "error", message: `Rubrique ${num} : intitulé à préciser.` });
        }
        const obs = String(values[obsKey(item.id)] ?? "").trim();
        if (obs !== "" && isForbiddenAnswer(obs)) {
          issues.push({ id: obsKey(item.id), level: "error", message: `Rubrique ${num} : RAS, rien, absent ou néant ne sont pas autorisés.` });
        }
        const low = block.scale === "0-4" ? ["0", "1"].includes(v) : ["M", "AB"].includes(v);
        if (low && obs === "") {
          // « En général, ne formuler les observations que là où la note est inférieure à 2 (BON) » : avertissement seulement.
          issues.push({ id: obsKey(item.id), level: "warning", message: `Rubrique ${num} ${item.label || freeLabel} : note inférieure à « Bon » sans observation.` });
        }
      }
    }
  }

  const computed = computeFiche(def, values);
  for (const c of def.checks ?? []) {
    if (c.type === "lte") {
      const a = toNumber(values[c.a]);
      const b = toNumber(values[c.b]);
      if (a !== null && b !== null && a > b) issues.push({ id: c.a, level: "error", message: c.message });
    } else if (c.type === "includesIf") {
      const list = values[c.field];
      if (isVisible(c.when, values) && !(Array.isArray(list) && (list as string[]).includes(c.value))) {
        issues.push({ id: c.field, level: "error", message: c.message });
      }
    } else if (c.type === "totalsEqual") {
      const a = computed.tables[c.a.table]?.totals[c.a.column];
      const b = computed.tables[c.b.table]?.totals[c.b.column];
      if (a !== undefined && b !== undefined && a !== b) issues.push({ id: c.a.table, level: "error", message: `${c.message} (${a} ≠ ${b})` });
    }
  }

  if (def.synthese && computed.synthese && computed.synthese.note === null) {
    issues.push({ id: "synthese", level: "error", message: `${def.synthese.finalLabel} : non calculable (un poste n'a aucune rubrique notée).` });
  }

  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === "error");
