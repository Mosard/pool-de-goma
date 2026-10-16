"use client";

// Une rubrique à valeurs uniques : consultation, puis « Modifier » pour la
// saisir (enregistrée seule, sans toucher aux autres rubriques). La version
// envoyée empêche d'écraser une modification faite entre-temps.

import { useActionState, useState } from "react";
import { Check, Loader2, MessageSquareText, Pencil } from "lucide-react";
import { Alert, Button, Textarea } from "@/components/ui";
import { findFieldsGroup } from "@/lib/personnel-file/defs";
import { saveGroupAction, saveObservationAction, type FicheFormState } from "@/app/(dashboard)/personnel/fiche-actions";
import { FieldInput } from "./field-input";
import { formatValue, inputValue, type Cell } from "./format";

export type GroupCardProps = {
  targetId: string;
  groupKey: string;
  values: Record<string, Cell>;
  version: number;
  canEdit: boolean;
  canObserve: boolean;
  observation: string | null;
  /** Adresse du compte, proposée pour l'e-mail (1) tant qu'il est vide. */
  accountEmail: string | null;
};

export function GroupCard(p: GroupCardProps) {
  const group = findFieldsGroup(p.groupKey);
  const [editing, setEditing] = useState(false);
  // Le formulaire se referme dès que l'enregistrement réussit.
  const [state, action, pending] = useActionState<FicheFormState, FormData>(async (prev, fd) => {
    const r = await saveGroupAction(p.targetId, p.groupKey, prev, fd);
    if (r.ok) setEditing(false);
    return r;
  }, {});
  if (!group) return null;

  const filled = group.fields.filter((f) => formatValue(f, p.values[f.key]) !== null).length;
  const headingId = `rubrique-${group.key}`;

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
            {filled} / {group.fields.length} renseigné{filled > 1 ? "s" : ""}
          </span>
          {p.canEdit && !editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden /> Modifier
            </Button>
          )}
        </div>
      </header>

      <div className="px-5 py-4">
        {group.hint && <p className="mb-3 max-w-3xl text-pretty text-xs text-gray-500">{group.hint}</p>}

        {editing ? (
          <form action={action} className="space-y-4" aria-busy={pending}>
            <input type="hidden" name="_version" value={p.version} />
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((f) => {
                const v = p.values[f.key];
                const initial = f.prefill === "accountEmail" && (v === null || v === undefined) ? (p.accountEmail ?? "") : inputValue(f, v);
                return <FieldInput key={f.key} field={f} value={initial} error={state.errors?.[f.key]} idPrefix={group.key} />;
              })}
            </div>
            {state.error && <Alert variant="error">{state.error}</Alert>}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              <Button type="submit" size="sm" className="min-h-10" disabled={pending}>
                {pending && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
                Enregistrer la rubrique
              </Button>
              <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setEditing(false)} disabled={pending}>
                Annuler
              </Button>
              <span className="text-xs text-gray-500">Tous les champs sont facultatifs.</span>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((f) => {
                const shown = formatValue(f, p.values[f.key]);
                return (
                  <div key={f.key} className={f.kind === "list" || f.label.length > 60 ? "sm:col-span-2" : undefined}>
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
            {state.ok && (
              <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700">
                <Check size={16} aria-hidden /> {state.ok}
              </p>
            )}
          </>
        )}

        <Observation targetId={p.targetId} groupKey={p.groupKey} text={p.observation} canObserve={p.canObserve} />
      </div>
    </section>
  );
}

/** Colonne « OBS. » du formulaire : lue par l'agent, écrite par les gestionnaires du personnel. */
export function Observation({ targetId, groupKey, text, canObserve }: { targetId: string; groupKey: string; text: string | null; canObserve: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<FicheFormState, FormData>(async (prev, fd) => {
    const r = await saveObservationAction(targetId, groupKey, prev, fd);
    if (r.ok) setEditing(false);
    return r;
  }, {});
  if (!text && !canObserve) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
          <MessageSquareText size={14} aria-hidden /> Observation de l&apos;inspecteur contrôleur
        </p>
        {canObserve && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">
            {text ? "Modifier l'observation" : "Ajouter une observation"}
          </button>
        )}
      </div>
      {editing ? (
        <form action={action} className="mt-2 space-y-2">
          <Textarea name="observation" defaultValue={text ?? ""} rows={2} aria-label="Observation" maxLength={2000} />
          {state.error && <Alert variant="error">{state.error}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Enregistrer l&apos;observation
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : text ? (
        <p className="mt-1 whitespace-pre-line text-pretty text-amber-950">{text}</p>
      ) : (
        <p className="mt-1 text-xs text-amber-800">Aucune observation.</p>
      )}
    </div>
  );
}
