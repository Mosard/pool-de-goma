"use client";

import { useActionState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { updatePublicationConsentAction, type ConsentFormState } from "./actions";

const initialState: ConsentFormState = {};

export function ConsentForm({
  consentIdentity,
  consentPhoto,
  authIdentity,
  authPhoto,
  hasPhoto,
}: {
  consentIdentity: boolean;
  consentPhoto: boolean;
  authIdentity: boolean;
  authPhoto: boolean;
  hasPhoto: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePublicationConsentAction, initialState);

  const status = (consent: boolean, authorized: boolean) =>
    consent && authorized
      ? "publié (accord et autorisation)"
      : consent
        ? "en attente de l'autorisation de l'IPP ou de l'informaticien"
        : "non publié";

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900">Publication sur le site public</h3>
      <p className="mt-1 text-xs text-gray-500">
        Votre nom, votre fonction et votre photo n&apos;apparaissent sur la page publique de votre POOL qu&apos;avec
        votre accord ET l&apos;autorisation de l&apos;IPP ou de l&apos;informaticien. Vous pouvez retirer votre accord à tout
        moment : l&apos;information disparaît alors immédiatement du site.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="consentIdentity" defaultChecked={consentIdentity} className="mt-1" />
          <span>
            J&apos;accepte la publication de mon nom et de ma fonction
            <span className="block text-xs text-gray-500">État : {status(consentIdentity, authIdentity)}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="consentPhoto" defaultChecked={consentPhoto} disabled={!hasPhoto} className="mt-1" />
          <span>
            J&apos;accepte la publication de ma photo de profil (avec mon nom)
            <span className="block text-xs text-gray-500">
              {hasPhoto ? `État : ${status(consentPhoto && consentIdentity, authPhoto)}` : "Ajoutez d'abord une photo de profil."}
            </span>
          </span>
        </label>
        {state.formError && <Alert variant="error">{state.formError}</Alert>}
        {state.success && <Alert variant="success">Votre choix est enregistré.</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer mon choix"}
        </Button>
      </form>
    </Card>
  );
}
