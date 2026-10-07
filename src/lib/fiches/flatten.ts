// Aplatissement d'une fiche officielle (format 2) en indicateurs simples
// (texte, nombre, choix) pour l'analyse IA des rapports (src/lib/ai/reports.ts).

import { MENTIONS, computeFiche, visibleBlocks } from "@/lib/fiches/calculs";
import { commonHeaderFields } from "@/lib/fiches/defs/index";
import type { FicheData, FicheDef } from "@/lib/fiches/types";
import { obsKey } from "@/lib/fiches/types";

export type FlatField = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  options?: string[];
  value: string | number | null;
};

export function toFicheData(raw: unknown): FicheData {
  const d = (raw ?? {}) as Partial<FicheData>;
  return { format: 2, values: d.values ?? {}, signatures: d.signatures ?? {} };
}

export function flattenFiche(def: FicheDef, data: FicheData): FlatField[] {
  const out: FlatField[] = [];
  const v = data.values;
  const k = (id: string) => `${def.code}.${id}`;
  const str = (x: unknown) => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);

  for (const f of commonHeaderFields(def).filter((f) => f.id === "entete.niveau")) {
    out.push({ key: k(f.id), label: `${def.code} — ${f.label}`, type: "select", options: f.options, value: str(v[f.id]) });
  }

  const computed = computeFiche(def, v);
  for (const { block } of visibleBlocks(def, v)) {
    if (block.kind === "field") {
      if (block.type === "checks") {
        const list = Array.isArray(v[block.id]) ? (v[block.id] as string[]) : [];
        out.push({ key: k(block.id), label: `${def.code} — ${block.label}`, type: "text", value: list.length ? list.join(" ; ") : null });
        continue;
      }
      const raw = str(v[block.id]);
      const type: FlatField["type"] =
        block.type === "number" ? "number" : block.type === "textarea" ? "textarea" : block.type === "choice" ? "select" : "text";
      const n = type === "number" && raw !== null ? Number(raw.replace(",", ".")) : NaN;
      out.push({
        key: k(block.id),
        label: `${def.code} — ${block.label}`,
        type,
        options: block.options,
        value: type === "number" ? (Number.isFinite(n) ? n : null) : raw,
      });
    } else if (block.kind === "rated") {
      const res = computed.postes[block.id];
      if (block.conversion) {
        out.push({ key: k(`${block.id}.note`), label: `${def.code} — ${block.label} (note convertie 0 à 4)`, type: "number", value: res?.note ?? null });
      }
      const obs = block.items
        .map((i) => ({ i, o: str(v[obsKey(i.id)]) }))
        .filter((x) => x.o !== null)
        .map((x) => `${x.i.num ?? x.i.id} ${x.i.label} : ${x.o}`);
      if (obs.length) out.push({ key: k(`${block.id}.observations`), label: `${def.code} — ${block.label} (observations)`, type: "textarea", value: obs.join("\n") });
      const conseils = str(v[`${block.id}#conseils`]);
      if (conseils) out.push({ key: k(`${block.id}.conseils`), label: `${def.code} — ${block.conseilsLabel ?? `${block.label} — Conseils`}`, type: "textarea", value: conseils });
    }
  }

  if (def.synthese && computed.synthese) {
    out.push({ key: k("noteFinale"), label: `${def.code} — ${def.synthese.finalLabel} (0 à 4)`, type: "number", value: computed.synthese.note });
    out.push({ key: k("mention"), label: `${def.code} — ${def.synthese.finalLabel} (mention)`, type: "select", options: [...MENTIONS], value: computed.synthese.mention });
  }
  return out;
}
