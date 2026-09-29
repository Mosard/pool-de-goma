"use client";

import { useActionState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Button, FieldError, Input, Label, Select } from "@/components/ui";
import { createAttributionAction, updateAttributionAction, type DirectionFormState } from "./actions";

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
}: {
  attributionId: string;
  label: string;
  position: number;
  holderId: string | null;
  candidates: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateAttributionAction.bind(null, attributionId), initialState);
  const idp = `attr-${attributionId}`;
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5.5rem_1fr_auto] sm:items-end">
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
        <p className={state.success ? "text-xs text-emerald-700 sm:col-span-4" : "text-xs text-red-600 sm:col-span-4"}>
          {state.success ? "Enregistré." : state.formError}
        </p>
      )}
    </form>
  );
}
