"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, Select, FieldError, PageHeader } from "@/components/ui";
import { createUserAction, type UserFormState } from "../actions";

const initialState: UserFormState = {};

export default function NouvelUtilisateurPage() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <div>
      <PageHeader title="Nouvel utilisateur" description="Créer un compte et attribuer un rôle" />
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
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" required />
            <FieldError message={state.errors?.password} />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" />
          </div>
          <div>
            <Label htmlFor="role">Rôle</Label>
            <Select id="role" name="role" required defaultValue="INSPECTEUR">
              <option value="CHEF_POOL">Chef de POOL</option>
              <option value="INSPECTEUR">Inspecteur itinérant</option>
              <option value="EXPLOITANT">Exploitant</option>
            </Select>
            <FieldError message={state.errors?.role} />
          </div>
          {state.formError && <FieldError message={state.formError} />}
          <Button type="submit" disabled={pending}>
            {pending ? "Création..." : "Créer le compte"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
