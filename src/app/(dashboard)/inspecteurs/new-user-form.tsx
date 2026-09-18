"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Label, Select, FieldError, PageHeader } from "@/components/ui";
import { createUserAction, type UserFormState } from "./actions";

const initialState: UserFormState = {};

export function NewUserForm({
  roles,
  pools,
}: {
  roles: { id: string; key: string; label: string; scope: string }[];
  pools: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const selectedRole = roles.find((r) => r.id === roleId);

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
            <Label htmlFor="sex">Sexe</Label>
            <Select id="sex" name="sex" defaultValue="">
              <option value="">Non précisé</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="roleId">Rôle</Label>
            <Select id="roleId" name="roleId" required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
            <FieldError message={state.errors?.roleId} />
          </div>
          {selectedRole?.scope === "POOL" && (
            <div>
              <Label htmlFor="poolId">Pool</Label>
              <Select id="poolId" name="poolId" required defaultValue="">
                <option value="" disabled>Choisir un pool</option>
                {pools.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <FieldError message={state.errors?.poolId} />
            </div>
          )}
          {state.formError && <FieldError message={state.formError} />}
          <Button type="submit" disabled={pending}>
            {pending ? "Création..." : "Créer le compte"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
