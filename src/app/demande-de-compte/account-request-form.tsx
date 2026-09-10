"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, Select, Textarea, FieldError } from "@/components/ui";
import { submitAccountRequestAction, type AccountRequestState } from "./actions";

const initialState: AccountRequestState = {};

export function AccountRequestForm({
  roles,
  pools,
}: {
  roles: { id: string; label: string }[];
  pools: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(submitAccountRequestAction, initialState);

  if (state.success) {
    return (
      <Card>
        <p className="text-sm text-gray-700">
          Votre demande a bien été envoyée. Vous serez contacté après validation par l&apos;informaticien de
          l&apos;Inspection.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" name="name" required />
          <FieldError message={state.errors?.name} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
          <FieldError message={state.errors?.email} />
        </div>
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" />
        </div>
        <div>
          <Label htmlFor="requestedRoleId">Fonction</Label>
          <Select id="requestedRoleId" name="requestedRoleId" defaultValue="">
            <option value="">Non précisé</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="poolId">Pool concerné</Label>
          <Select id="poolId" name="poolId" defaultValue="">
            <option value="">Non applicable / niveau provincial</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="message">Message (optionnel)</Label>
          <Textarea id="message" name="message" rows={3} />
        </div>
        {state.formError && <FieldError message={state.formError} />}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Envoi..." : "Envoyer la demande"}
        </Button>
      </form>
    </Card>
  );
}
