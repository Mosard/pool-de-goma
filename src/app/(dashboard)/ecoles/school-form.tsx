"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Label, Select, Textarea, FieldError } from "@/components/ui";
import { isSecondaryType } from "@/lib/school-fields";
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
    approvalDecree?: string | null;
    classCount?: number | null;
    teacherCount?: number | null;
    options?: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // Les options organisées ne concernent que les écoles secondaires.
  const [type, setType] = useState(defaultValues?.type ?? "");

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
            <Input
              id="type"
              name="type"
              placeholder="Maternelle / Primaire / Secondaire"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
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
          <div>
            <Label htmlFor="approvalDecree">Arrêté d&apos;agrément</Label>
            <Input id="approvalDecree" name="approvalDecree" defaultValue={defaultValues?.approvalDecree ?? ""} />
            <FieldError message={state.errors?.approvalDecree} />
          </div>
          <div>
            <Label htmlFor="classCount">Nombre de classes</Label>
            <Input
              id="classCount"
              name="classCount"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={defaultValues?.classCount ?? ""}
            />
            <FieldError message={state.errors?.classCount} />
          </div>
          <div>
            <Label htmlFor="teacherCount">Nombre d&apos;enseignants</Label>
            <Input
              id="teacherCount"
              name="teacherCount"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={defaultValues?.teacherCount ?? ""}
            />
            <FieldError message={state.errors?.teacherCount} />
          </div>
          {isSecondaryType(type) && (
            <div className="sm:col-span-2">
              <Label htmlFor="options">Options organisées</Label>
              <Textarea
                id="options"
                name="options"
                rows={2}
                placeholder="Séparées par des virgules, ex. : Pédagogie générale, Commerciale et gestion, Scientifique"
                defaultValue={defaultValues?.options ?? ""}
              />
              <FieldError message={state.errors?.options} />
            </div>
          )}
        </div>
        {state.formError && <FieldError message={state.formError} />}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
