"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input, Label, Select, Textarea, FieldError } from "@/components/ui";
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
      <Card className="space-y-3">
        <Alert variant="success">Votre demande a bien été envoyée.</Alert>
        <p className="text-sm text-gray-700">
          Elle doit maintenant être validée par l&apos;informaticien de l&apos;Inspection. Vous ne pouvez pas encore
          vous connecter. Une fois la demande validée, connectez-vous avec votre identifiant{" "}
          <strong className="font-mono">{state.username}</strong> et le mot de passe que vous venez de choisir.
        </p>
        <Link href="/login" className="block text-sm font-medium text-blue-600 hover:underline">
          Aller à la page de connexion
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" name="name" autoComplete="name" required />
          <FieldError message={state.errors?.name} />
        </div>
        <div>
          <Label htmlFor="username">Identifiant de connexion</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ex. jean.kambale"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Unique et distinct de votre nom : 3 à 32 caractères (lettres sans accent, chiffres, point, tiret), en
            commençant par une lettre.
          </p>
          <FieldError message={state.errors?.username} />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <p className="mt-1 text-xs text-gray-500">8 caractères minimum. Vous seul le connaissez.</p>
          <FieldError message={state.errors?.password} />
        </div>
        <div>
          <Label htmlFor="confirmation">Confirmez le mot de passe</Label>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
          <FieldError message={state.errors?.confirmation} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError message={state.errors?.email} />
        </div>
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" autoComplete="tel" />
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
