"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label, FieldError, Alert } from "@/components/ui";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.success) {
    return (
      <Card>
        <Alert variant="success">
          Si un compte actif correspond à cet email, un lien de réinitialisation vient d&apos;être envoyé.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
          <FieldError message={state.errors?.email} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Envoi..." : "Envoyer le lien de réinitialisation"}
        </Button>
      </form>
    </Card>
  );
}
