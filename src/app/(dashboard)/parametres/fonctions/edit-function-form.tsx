"use client";

import { useActionState } from "react";
import { Button, Card, FieldError, Input, Label, Textarea } from "@/components/ui";
import { updateFunctionAction, type FunctionFormState } from "../actions";

const initialState: FunctionFormState = {};

/** Modifier une fonction personnalisée : ses titulaires héritent des nouvelles permissions à leur requête suivante. */
export function EditFunctionForm({
  role,
  permissionCatalog,
}: {
  role: { id: string; label: string; description: string | null; permissionKeys: string[]; holders: number };
  permissionCatalog: { key: string; label: string; category: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateFunctionAction.bind(null, role.id), initialState);
  const categories = Array.from(new Set(permissionCatalog.map((p) => p.category)));

  return (
    <Card>
      <form action={formAction} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="label">Nom de la fonction</Label>
            <Input id="label" name="label" required defaultValue={role.label} />
            <FieldError message={state.errors?.label} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={role.description ?? ""} />
          </div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Permissions</h3>
          <p className="mb-3 text-xs text-gray-500">
            {role.holders} titulaire(s) : ils recevront ou perdront ces permissions dès leur prochaine action. Seules les permissions que vous détenez vous-même
            peuvent être données.
          </p>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">{category}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissionCatalog
                    .filter((p) => p.category === category)
                    .map((p) => (
                      <label key={p.key} className="flex items-start gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="permissionKeys" value={p.key} defaultChecked={role.permissionKeys.includes(p.key)} className="mt-1" />
                        {p.label}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {state.formError && <FieldError message={state.formError} />}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </form>
    </Card>
  );
}
