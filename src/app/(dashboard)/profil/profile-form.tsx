"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, Select, Alert } from "@/components/ui";
import { updateProfileAction, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = {};

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: {
    prenom?: string | null;
    postnom?: string | null;
    sex?: string | null;
    phone?: string | null;
    dateNaissance?: string | null;
    nombreEnfants?: number | null;
  };
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Identité</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" name="prenom" defaultValue={defaultValues.prenom ?? ""} />
            </div>
            <div>
              <Label htmlFor="postnom">Postnom</Label>
              <Input id="postnom" name="postnom" defaultValue={defaultValues.postnom ?? ""} />
            </div>
            <div>
              <Label htmlFor="sex">Sexe</Label>
              <Select id="sex" name="sex" defaultValue={defaultValues.sex ?? ""}>
                <option value="">Non précisé</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateNaissance">Date de naissance</Label>
              <Input id="dateNaissance" name="dateNaissance" type="date" defaultValue={defaultValues.dateNaissance ?? ""} />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" defaultValue={defaultValues.phone ?? ""} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Situation familiale</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nombreEnfants">Nombre d&apos;enfants</Label>
              <Input
                id="nombreEnfants"
                name="nombreEnfants"
                type="number"
                min={0}
                defaultValue={defaultValues.nombreEnfants ?? ""}
              />
            </div>
          </div>
        </div>

        {state.success && <Alert variant="success">Profil mis à jour avec succès.</Alert>}
        {state.formError && <Alert variant="error">{state.formError}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
