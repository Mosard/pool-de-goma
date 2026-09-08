"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, Select, FieldError } from "@/components/ui";
import { createInspectionAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function NewInspectionForm({
  schools,
}: {
  schools: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createInspectionAction, initialState);

  if (schools.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500">
          Aucune école ne vous est assignée pour le moment. Contactez le chef de POOL.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <div>
          <Label htmlFor="schoolId">École à inspecter</Label>
          <Select id="schoolId" name="schoolId" required defaultValue="">
            <option value="" disabled>Choisir une école</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <FieldError message={state.errors?.schoolId} />
        </div>
        <div>
          <Label htmlFor="scheduledDate">Date prévue</Label>
          <Input id="scheduledDate" name="scheduledDate" type="date" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Démarrer une inspection"}
        </Button>
      </form>
      {state.formError && <p className="mt-3 text-xs text-red-600">{state.formError}</p>}
    </Card>
  );
}
