"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, FieldError, Alert } from "@/components/ui";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.success && state.assisted) {
    return (
      <Card className="space-y-3">
        <Alert variant="info">
          L&apos;envoi automatique de lien par e-mail n&apos;est pas encore disponible.
        </Alert>
        <p className="text-sm text-gray-700">
          Adressez-vous à l&apos;informaticien de l&apos;Inspection. Après avoir vérifié votre identité, il vous
          remettra un lien de réinitialisation à usage unique, valable 24 heures. Vous y choisirez vous-même votre
          nouveau mot de passe : personne d&apos;autre ne le connaîtra.
        </p>
      </Card>
    );
  }

  if (state.success) {
    return (
      <Card>
        <Alert variant="success">
          Si un compte actif correspond à cet identifiant, un lien de réinitialisation vient d&apos;être envoyé à
          son adresse e-mail.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="identifier">Identifiant ou e-mail</Label>
          <Input id="identifier" name="identifier" autoComplete="username" autoCapitalize="none" required />
          <FieldError message={state.errors?.identifier} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Envoi..." : "Continuer"}
        </Button>
      </form>
    </Card>
  );
}
