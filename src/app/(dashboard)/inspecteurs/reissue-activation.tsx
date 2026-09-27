"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { ActivationNotice } from "../comptes/activation-notice";
import { reissueActivationAction, type ReissueState } from "./actions";

const initialState: ReissueState = {};

/**
 * Compte en attente : nouveau lien d'activation. Compte actif : lien de
 * réinitialisation (mot de passe oublié, tant que l'e-mail n'est pas branché).
 * Les liens précédents sont révoqués.
 */
export function ReissueActivation({ userId, status }: { userId: string; status: string }) {
  const [state, action, pending] = useActionState(reissueActivationAction.bind(null, userId), initialState);

  if (state.email) {
    return (
      <div className="text-left">
        <ActivationNotice
          kind={state.kind}
          email={state.email}
          emailed={state.emailed}
          isDemo={state.isDemo}
          activationUrl={state.activationUrl}
          expiresAt={state.expiresAt}
        />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="secondary" className="!min-h-0 px-3 py-1.5 text-xs" disabled={pending}>
        {pending ? "Génération…" : status === "PENDING" ? "Nouveau lien d'activation" : "Lien de réinitialisation"}
      </Button>
      {state.error && (
        <div className="text-left">
          <Alert variant="error">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
