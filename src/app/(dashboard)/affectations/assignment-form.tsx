"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, FieldError } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";
import { createAssignmentAction, type AssignmentFormState } from "./actions";

const initialState: AssignmentFormState = {};

export function AssignmentForm({
  schools,
  inspectors,
}: {
  schools: { id: string; name: string }[];
  inspectors: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createAssignmentAction, initialState);

  return (
    <Card>
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
        <div>
          <Label htmlFor="schoolId">École</Label>
          <SearchSelect id="schoolId" name="schoolId" required placeholder="Rechercher une école…" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
          <FieldError message={state.errors?.schoolId} />
        </div>
        <div>
          <Label htmlFor="inspectorId">Inspecteur</Label>
          <SearchSelect id="inspectorId" name="inspectorId" required placeholder="Rechercher un inspecteur…" options={inspectors.map((i) => ({ value: i.id, label: i.name }))} />
          <FieldError message={state.errors?.inspectorId} />
        </div>
        <div>
          <Label htmlFor="effectiveFrom">Date d&apos;effet</Label>
          <Input id="effectiveFrom" name="effectiveFrom" type="date" />
          <p className="mt-1 text-xs text-gray-500">Vide : à partir d&apos;aujourd&apos;hui.</p>
          <FieldError message={state.errors?.effectiveFrom} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Attribution..." : "Attribuer"}
        </Button>
      </form>
      {state.formError && <p className="mt-3 text-xs text-red-600">{state.formError}</p>}
    </Card>
  );
}
