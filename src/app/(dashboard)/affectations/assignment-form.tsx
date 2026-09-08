"use client";

import { useActionState } from "react";
import { Button, Card, Label, Select, FieldError } from "@/components/ui";
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
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <div>
          <Label htmlFor="schoolId">École</Label>
          <Select id="schoolId" name="schoolId" required defaultValue="">
            <option value="" disabled>Choisir une école</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <FieldError message={state.errors?.schoolId} />
        </div>
        <div>
          <Label htmlFor="inspectorId">Inspecteur</Label>
          <Select id="inspectorId" name="inspectorId" required defaultValue="">
            <option value="" disabled>Choisir un inspecteur</option>
            {inspectors.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </Select>
          <FieldError message={state.errors?.inspectorId} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Attribution..." : "Attribuer"}
        </Button>
      </form>
      {state.formError && <p className="mt-3 text-xs text-red-600">{state.formError}</p>}
    </Card>
  );
}
