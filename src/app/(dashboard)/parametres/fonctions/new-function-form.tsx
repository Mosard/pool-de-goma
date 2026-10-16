"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, Select, Textarea, FieldError, PageHeader } from "@/components/ui";
import { createFunctionAction, type FunctionFormState } from "../actions";
import { PermissionPicker } from "./permission-picker";

const initialState: FunctionFormState = {};

export function NewFunctionForm({
  permissionCatalog,
}: {
  permissionCatalog: { key: string; label: string; category: string }[];
}) {
  const [state, formAction, pending] = useActionState(createFunctionAction, initialState);

  return (
    <div>
      <PageHeader title="Nouvelle fonction" description="Créer une fonction (rôle) et lui attribuer des droits" />
      <Card>
        <form action={formAction} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="label">Nom de la fonction</Label>
              <Input id="label" name="label" required />
              <FieldError message={state.errors?.label} />
            </div>
            <div>
              <Label htmlFor="scope">Portée</Label>
              <Select id="scope" name="scope" required defaultValue="POOL">
                <option value="POOL">Pool</option>
                <option value="PROVINCE">Provincial (bureau IPP)</option>
              </Select>
              <FieldError message={state.errors?.scope} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Permissions</h3>
            <PermissionPicker catalog={permissionCatalog} />
          </div>

          {state.formError && <FieldError message={state.formError} />}
          <Button type="submit" disabled={pending}>
            {pending ? "Création..." : "Créer la fonction"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
