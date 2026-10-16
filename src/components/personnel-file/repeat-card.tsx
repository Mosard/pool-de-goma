"use client";

// Entrées répétables de la fiche : promotions (II.C), diplômes (IV), enfants
// (III.E). Ajout, modification sur place et retrait confirmé ; aucune limite.

import { useActionState, useState } from "react";
import { Check, Loader2, Pencil, Plus } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ALL_GROUPS, REPEAT_FIELDS, STUDY_LEVELS, type FieldDef } from "@/lib/personnel-file/defs";
import { deleteEntryAction, saveEntryAction, type FicheFormState } from "@/app/(dashboard)/personnel/fiche-actions";
import type { RepeatKind } from "@/lib/personnel-file/server";
import { FieldInput } from "./field-input";
import { formatValue, inputValue, type Cell } from "./format";
import { Observation } from "./group-card";

export type RepeatRow = { id: string; values: Record<string, Cell> };

const NOUN: Record<RepeatKind, { add: string; empty: string }> = {
  promotions: { add: "Ajouter une promotion", empty: "Aucune promotion enregistrée." },
  diplomas: { add: "Ajouter un titre ou diplôme", empty: "Aucun titre ni diplôme enregistré." },
  children: { add: "Ajouter un enfant", empty: "Aucun enfant enregistré." },
};

function entryTitle(kind: RepeatKind, row: RepeatRow, index: number): string {
  if (kind === "promotions") return `Grade promotion ${index + 1}${row.values.grade ? ` — ${row.values.grade}` : ""}`;
  if (kind === "diplomas") {
    const level = STUDY_LEVELS.find((l) => l.value === row.values.level)?.label ?? "Niveau non précisé";
    return row.values.year ? `${level} — ${row.values.year}` : level;
  }
  const name = [row.values.nom, row.values.postnom, row.values.prenom].filter(Boolean).join(" ");
  return `${index + 1}. ${name || "Enfant"}`;
}

function EntryForm({ targetId, kind, row, onDone }: { targetId: string; kind: RepeatKind; row: RepeatRow | null; onDone: () => void }) {
  const [state, action, pending] = useActionState<FicheFormState, FormData>(async (prev, fd) => {
    const r = await saveEntryAction(targetId, kind, row?.id ?? null, prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  const fields: readonly FieldDef[] = REPEAT_FIELDS[kind];
  return (
    <form action={action} className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4" aria-busy={pending}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <FieldInput key={f.key} field={f} value={inputValue(f, row?.values[f.key])} error={state.errors?.[f.key]} idPrefix={`${kind}-${row?.id ?? "nouveau"}`} />
        ))}
      </div>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="min-h-10" disabled={pending}>
          {pending && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
          {row ? "Enregistrer l'entrée" : "Ajouter"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function RepeatCard({
  targetId,
  kind,
  rows,
  canEdit,
  canObserve,
  observation,
}: {
  targetId: string;
  kind: RepeatKind;
  rows: RepeatRow[];
  canEdit: boolean;
  canObserve: boolean;
  observation: string | null;
}) {
  const group = ALL_GROUPS.find((g) => g.kind === kind)!;
  const [editing, setEditing] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const fields: readonly FieldDef[] = REPEAT_FIELDS[kind];
  const headingId = `rubrique-${group.key}`;
  const close = () => setEditing(null);

  return (
    <section id={group.key} aria-labelledby={headingId} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700">{group.code}</span>
          <h3 id={headingId} className="text-balance text-sm font-semibold text-gray-900">
            {group.title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-gray-500">
            {rows.length} entrée{rows.length > 1 ? "s" : ""}
          </span>
          {canEdit && editing !== "nouveau" && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing("nouveau")}>
              <Plus size={14} aria-hidden /> {NOUN[kind].add}
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-3 px-5 py-4">
        {group.hint && <p className="max-w-3xl text-pretty text-xs text-gray-500">{group.hint}</p>}
        {editing === "nouveau" && <EntryForm targetId={targetId} kind={kind} row={null} onDone={close} />}
        {rows.length === 0 && editing !== "nouveau" && <p className="text-sm text-gray-500">{NOUN[kind].empty}</p>}
        {removed && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <Check size={16} aria-hidden /> {removed}
          </p>
        )}

        <ol className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.id} className="rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
                <p className="text-sm font-medium text-gray-900">{entryTitle(kind, row, i)}</p>
                {canEdit && editing !== row.id && (
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(row.id)}>
                      <Pencil size={14} aria-hidden /> Modifier
                    </Button>
                    <ConfirmButton
                      label="Retirer"
                      confirmLabel="Retirer l'entrée"
                      variant="danger"
                      className="!min-h-9 !px-3 !py-1.5 text-xs"
                      formAction={async () => {
                        const r = await deleteEntryAction(targetId, kind, row.id);
                        setRemoved(r.ok ?? r.error ?? null);
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="px-4 py-3">
                {editing === row.id ? (
                  <EntryForm targetId={targetId} kind={kind} row={row} onDone={close} />
                ) : (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((f) => {
                      const shown = formatValue(f, row.values[f.key]);
                      return (
                        <div key={f.key}>
                          <dt className="text-xs text-gray-500">{f.label}</dt>
                          <dd className="mt-0.5 break-words text-sm">
                            {shown ? (
                              <span className="font-medium text-gray-900">{shown}</span>
                            ) : (
                              <span className="text-gray-400" aria-label="Non renseigné">
                                —
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </div>
            </li>
          ))}
        </ol>

        <Observation targetId={targetId} groupKey={group.key} text={observation} canObserve={canObserve} />
      </div>
    </section>
  );
}
