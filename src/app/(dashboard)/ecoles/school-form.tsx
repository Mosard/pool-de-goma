"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, Select, FieldError } from "@/components/ui";
import type { SchoolFormState } from "./actions";

const initialState: SchoolFormState = {};

export function SchoolForm({
  action,
  pools,
  defaultValues,
}: {
  action: (state: SchoolFormState, formData: FormData) => Promise<SchoolFormState>;
  pools: { id: string; name: string }[];
  defaultValues?: {
    poolId?: string;
    name?: string;
    code?: string;
    province?: string;
    territoire?: string;
    address?: string | null;
    director?: string | null;
    phone?: string | null;
    type?: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="poolId">Pool de rattachement</Label>
            <Select id="poolId" name="poolId" required defaultValue={defaultValues?.poolId ?? ""}>
              <option value="" disabled>Choisir un pool</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <FieldError message={state.errors?.poolId} />
          </div>
          <div>
            <Label htmlFor="name">Nom de l&apos;école</Label>
            <Input id="name" name="name" defaultValue={defaultValues?.name} required />
            <FieldError message={state.errors?.name} />
          </div>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" defaultValue={defaultValues?.code} required />
            <FieldError message={state.errors?.code} />
          </div>
          <div>
            <Label htmlFor="province">Province</Label>
            <Input id="province" name="province" defaultValue={defaultValues?.province ?? "Nord-Kivu"} required />
            <FieldError message={state.errors?.province} />
          </div>
          <div>
            <Label htmlFor="territoire">Territoire (pool)</Label>
            <Input id="territoire" name="territoire" defaultValue={defaultValues?.territoire} required />
            <FieldError message={state.errors?.territoire} />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Input id="type" name="type" placeholder="Primaire / Secondaire" defaultValue={defaultValues?.type ?? ""} />
          </div>
          <div>
            <Label htmlFor="director">Directeur</Label>
            <Input id="director" name="director" defaultValue={defaultValues?.director ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
          </div>
          <div>
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" defaultValue={defaultValues?.address ?? ""} />
          </div>
        </div>
        {state.formError && <FieldError message={state.formError} />}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
