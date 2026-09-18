"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, FieldError, PageHeader } from "@/components/ui";
import { createPoolAction, type PoolFormState } from "./actions";

const initialState: PoolFormState = {};

export function NewPoolForm() {
  const [state, formAction, pending] = useActionState(createPoolAction, initialState);

  return (
    <div>
      <PageHeader title="Nouveau pool" description="Créer un pool au sein de l'organisation provinciale" />
      <Card>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom du pool</Label>
            <Input id="name" name="name" required />
            <FieldError message={state.errors?.name} />
          </div>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required />
            <FieldError message={state.errors?.code} />
          </div>
          {state.formError && <FieldError message={state.formError} />}
          <Button type="submit" disabled={pending}>
            {pending ? "Création..." : "Créer le pool"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
