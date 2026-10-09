"use client";

import { useActionState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Button, FieldError, Input, Label, Select } from "@/components/ui";
import {
  assignCellIpaAction,
  assignExploitantAction,
  createAttributionAction,
  updateAttributionAction,
  type DirectionFormState,
} from "./actions";

const initialState: DirectionFormState = {};

export function CreateAttributionForm({ nextPosition }: { nextPosition: number }) {
  const [state, formAction, pending] = useActionState(createAttributionAction, initialState);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
      <div>
        <Label htmlFor="new-label">Nouvelle attribution</Label>
        <Input id="new-label" name="label" placeholder="Ex. Formation" required maxLength={80} />
        <FieldError message={state.errors?.label} />
      </div>
      <div>
        <Label htmlFor="new-position">Ordre</Label>
        <Input id="new-position" name="position" type="number" min={0} max={99} defaultValue={nextPosition} />
        <FieldError message={state.errors?.position} />
      </div>
      <Button type="submit" disabled={pending} className="!min-h-0 px-4 py-2 text-sm">
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
        Ajouter
      </Button>
      {state.success && <p className="text-xs text-emerald-700 sm:col-span-3">Attribution ajoutée.</p>}
    </form>
  );
}

export function AttributionForm({
  attributionId,
  label,
  position,
  holderId,
  candidates,
  cellId,
  cells,
}: {
  attributionId: string;
  label: string;
  position: number;
  holderId: string | null;
  candidates: { id: string; name: string }[];
  cellId: string | null;
  cells: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateAttributionAction.bind(null, attributionId), initialState);
  const idp = `attr-${attributionId}`;
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5.5rem_1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor={`${idp}-label`}>Attribution</Label>
        <Input id={`${idp}-label`} name="label" defaultValue={label} required maxLength={80} />
        <FieldError message={state.errors?.label} />
      </div>
      <div>
        <Label htmlFor={`${idp}-position`}>Ordre</Label>
        <Input id={`${idp}-position`} name="position" type="number" min={0} max={99} defaultValue={position} />
        <FieldError message={state.errors?.position} />
      </div>
      <div>
        <Label htmlFor={`${idp}-cell`}>Cellule reliée</Label>
        <Select id={`${idp}-cell`} name="cellId" defaultValue={cellId ?? ""}>
          <option value="">— Aucune (affichage public seul) —</option>
          {cells.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <FieldError message={state.errors?.cellId} />
      </div>
      <div>
        <Label htmlFor={`${idp}-holder`}>IPP adjoint chargé</Label>
        <Select id={`${idp}-holder`} name="holderId" defaultValue={holderId ?? ""}>
          <option value="">— Place non attribuée —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError message={state.errors?.holderId} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="!min-h-0 px-4 py-2 text-sm">
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
        Enregistrer
      </Button>
      {(state.success || state.formError) && (
        <p className={state.success ? "text-xs text-emerald-700 sm:col-span-5" : "text-xs text-red-600 sm:col-span-5"}>
          {state.success ? "Enregistré." : state.formError}
        </p>
      )}
    </form>
  );
}

function AssignmentFeedback({ state }: { state: DirectionFormState }) {
  if (!state.success && !state.formError) return null;
  return (
    <p role={state.formError ? "alert" : "status"} className={state.success ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
      {state.success ? "Affectation enregistrée." : state.formError}
    </p>
  );
}

/**
 * IPA responsable d'une cellule : droits internes (Cell.ipaId), pas
 * seulement l'affichage public. Contrôles refaits côté serveur.
 */
export function CellIpaForm({
  cellId,
  ipaId,
  candidates,
}: {
  cellId: string;
  ipaId: string | null;
  candidates: { id: string; name: string; busyWith: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(assignCellIpaAction.bind(null, cellId), initialState);
  const idp = `cell-ipa-${cellId}`;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <form action={formAction} className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor={idp}>IPA responsable</Label>
            <Select id={idp} name="ipaId" defaultValue={ipaId ?? ""} required>
              <option value="" disabled>
                — Choisir un IPA —
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id} disabled={Boolean(c.busyWith)}>
                  {c.name}
                  {c.busyWith ? ` (déjà : ${c.busyWith})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" disabled={pending} className="!min-h-0 px-4 py-2 text-sm">
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
            Valider
          </Button>
        </form>
        {ipaId && (
          <form action={formAction}>
            <input type="hidden" name="ipaId" value="" />
            <Button type="submit" variant="danger" disabled={pending} className="!min-h-0 px-3 py-2 text-xs">
              Retirer
            </Button>
          </form>
        )}
      </div>
      <AssignmentFeedback state={state} />
    </div>
  );
}

/** Cellule d'un exploitant de l'IPP (une seule) ; « Retirer » le met en attente d'affectation. */
export function ExploitantCellForm({
  userId,
  cellId,
  cells,
}: {
  userId: string;
  cellId: string | null;
  cells: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignExploitantAction.bind(null, userId), initialState);
  const idp = `exploitant-${userId}`;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <form action={formAction} className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor={idp} className="sr-only">
              Cellule
            </Label>
            <Select id={idp} name="cellId" defaultValue={cellId ?? ""} required>
              <option value="" disabled>
                — Choisir une cellule active —
              </option>
              {cells.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" disabled={pending || cells.length === 0} className="!min-h-0 px-4 py-2 text-sm">
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
            {cellId ? "Modifier" : "Affecter"}
          </Button>
        </form>
        {cellId && (
          <form action={formAction}>
            <input type="hidden" name="cellId" value="" />
            <Button type="submit" variant="danger" disabled={pending} className="!min-h-0 px-3 py-2 text-xs">
              Retirer
            </Button>
          </form>
        )}
      </div>
      <AssignmentFeedback state={state} />
    </div>
  );
}
