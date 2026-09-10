"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, FieldError, Alert } from "@/components/ui";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.success) {
    return (
      <Card>
        <Alert variant="success">Mot de passe mis à jour. Vous pouvez maintenant vous connecter.</Alert>
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
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input id="password" name="password" type="password" required />
          <FieldError message={state.errors?.password} />
        </div>
        {state.formError && <Alert variant="error">{state.formError}</Alert>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enregistrement..." : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </Card>
  );
}
