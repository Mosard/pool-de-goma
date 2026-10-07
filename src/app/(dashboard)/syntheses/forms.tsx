"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Input, Label, Textarea } from "@/components/ui";
import type { SectionDef } from "@/lib/synthese/format";
import {
  createSynthesisAction,
  saveSynthesisAction,
  setSourcesAction,
  transitionSynthesisAction,
  type SynthesisFormState,
} from "./actions";

const initial: SynthesisFormState = {};

export type ReportOption = {
  id: string;
  title: string;
  number: string | null;
  poolName: string | null;
  authorName: string;
  statusLabel: string;
  submittedAt: string | null;
};

function Feedback({ state }: { state: SynthesisFormState }) {
  if (state.error) return <Alert variant="error">{state.error}</Alert>;
  if (state.ok) return <Alert variant="success">{state.ok}</Alert>;
  return null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");

function ReportChecklist({ reports, selected }: { reports: ReportOption[]; selected: Set<string> }) {
  if (reports.length === 0) {
    return <p className="text-sm text-gray-500">Aucun rapport exploité dans ce périmètre pour le moment.</p>;
  }
  return (
    <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
      {reports.map((r) => (
        <li key={r.id}>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 px-4 py-3 text-sm hover:bg-blue-50/40">
            <input type="checkbox" name="reportIds" value={r.id} defaultChecked={selected.has(r.id)} className="mt-1 h-4 w-4" />
            <span>
              <span className="font-medium text-gray-900">{r.title}</span>
              {r.number && <span className="ml-2 text-xs text-gray-500">{r.number}</span>}
              <span className="block text-xs text-gray-500">
                {r.authorName} · {r.poolName ?? "—"} · {r.statusLabel} · soumis le {fmt(r.submittedAt)}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function CreateSynthesisForm({ perimetre, reports }: { perimetre: string; reports: ReportOption[] }) {
  const [state, action, pending] = useActionState(createSynthesisAction, initial);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="perimetre" value={perimetre} />
      <div>
        <Label htmlFor="title">Titre de la synthèse</Label>
        <Input id="title" name="title" required minLength={3} maxLength={200} placeholder="Ex. Synthèse des inspections du 1er trimestre" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="periodFrom">Période du (facultatif)</Label>
          <Input id="periodFrom" name="periodFrom" type="date" />
        </div>
        <div>
          <Label htmlFor="periodTo">au</Label>
          <Input id="periodTo" name="periodTo" type="date" />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Rapports d&apos;inspection exploités à reprendre</legend>
        <ReportChecklist reports={reports} selected={new Set()} />
      </fieldset>
      <Feedback state={state} />
      <Button type="submit" disabled={pending || reports.length === 0}>
        {pending ? "Création..." : "Créer le brouillon"}
      </Button>
    </form>
  );
}

export function SynthesisEditor({
  id,
  formatVersion,
  sections,
  values,
  title,
  periodFrom,
  periodTo,
}: {
  id: string;
  formatVersion: number;
  sections: SectionDef[];
  values: Record<string, string>;
  title: string;
  periodFrom: string;
  periodTo: string;
}) {
  const [state, action, pending] = useActionState(saveSynthesisAction.bind(null, id, formatVersion), initial);
  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" defaultValue={title} required minLength={3} maxLength={200} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="periodFrom">Période du</Label>
          <Input id="periodFrom" name="periodFrom" type="date" defaultValue={periodFrom} />
        </div>
        <div>
          <Label htmlFor="periodTo">au</Label>
          <Input id="periodTo" name="periodTo" type="date" defaultValue={periodTo} />
        </div>
      </div>
      {sections.map((s) => (
        <div key={s.key}>
          <Label htmlFor={`section.${s.key}`}>
            {s.title} {s.required ? <span className="text-red-600">*</span> : <span className="text-xs text-gray-400">(facultatif)</span>}
          </Label>
          <p className="mb-1 text-xs text-gray-500">{s.help}</p>
          <Textarea id={`section.${s.key}`} name={`section.${s.key}`} rows={6} defaultValue={values[s.key] ?? ""} maxLength={20000} />
        </div>
      ))}
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}

export function SourcesForm({ id, reports, selectedIds }: { id: string; reports: ReportOption[]; selectedIds: string[] }) {
  const [state, action, pending] = useActionState(setSourcesAction.bind(null, id), initial);
  return (
    <form action={action} className="space-y-3">
      <ReportChecklist reports={reports} selected={new Set(selectedIds)} />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Mise à jour..." : "Mettre à jour les rapports retenus"}
      </Button>
    </form>
  );
}

export function SynthesisTransitions({ id, transitions }: { id: string; transitions: { to: string; label: string; commentRequired: boolean }[] }) {
  const [state, action, pending] = useActionState(transitionSynthesisAction.bind(null, id), initial);
  const [to, setTo] = useState(transitions[0]?.to ?? "");
  const [confirming, setConfirming] = useState(false);
  const current = transitions.find((t) => t.to === to);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Étape du circuit">
        {transitions.map((t) => (
          <label key={t.to} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-4 text-sm">
            <input
              type="radio"
              name="toStatus"
              value={t.to}
              checked={to === t.to}
              onChange={() => {
                setTo(t.to);
                setConfirming(false);
              }}
            />
            {t.label}
          </label>
        ))}
      </div>
      <Textarea
        name="comment"
        rows={3}
        required={current?.commentRequired}
        placeholder={current?.commentRequired ? "Motif du renvoi (obligatoire)" : "Commentaire (facultatif)"}
      />
      <Feedback state={state} />
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Confirmer « {current?.label} » ?</span>
          <Button type="submit" disabled={pending}>
            {pending ? "Envoi..." : "Confirmer"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
            Annuler
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setConfirming(true)} disabled={!current}>
          {current?.label ?? "Choisir une étape"}
        </Button>
      )}
    </form>
  );
}
