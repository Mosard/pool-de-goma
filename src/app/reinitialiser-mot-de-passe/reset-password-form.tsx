"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, FieldError, Alert } from "@/components/ui";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token, mode = "reset" }: { token: string; mode?: "reset" | "activate" }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.success) {
    return (
      <Card>
        <Alert variant="success">
          {mode === "activate"
            ? "Compte activé. Vous pouvez maintenant vous connecter avec votre adresse e-mail et le mot de passe choisi."
            : "Mot de passe mis à jour. Vous pouvez maintenant vous connecter."}
        </Alert>
        <a href="/login" className="mt-4 block text-center text-sm font-medium text-blue-600 hover:underline">
          Aller à la connexion
        </a>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <Label htmlFor="password">{mode === "activate" ? "Choisissez votre mot de passe" : "Nouveau mot de passe"}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <FieldError message={state.errors?.password} />
        </div>
        <div>
          <Label htmlFor="confirmation">Confirmez le mot de passe</Label>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
          <FieldError message={state.errors?.confirmation} />
        </div>
        {state.formError && <Alert variant="error">{state.formError}</Alert>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enregistrement..." : mode === "activate" ? "Activer mon compte" : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </Card>
  );
}
