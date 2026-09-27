"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";

/**
 * Lien d'activation affiché UNE fois à l'administrateur, faute de
 * fournisseur e-mail branché. Ce n'est pas un mot de passe : le titulaire y
 * choisit lui-même le sien ; le lien expire et ne sert qu'une fois.
 */
export function ActivationNotice({
  email,
  emailed,
  isDemo,
  activationUrl,
  expiresAt,
  onDone,
  kind = "activation",
}: {
  kind?: "activation" | "reset";
  email: string;
  emailed?: boolean;
  isDemo?: boolean;
  activationUrl?: string;
  expiresAt?: string;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (emailed || !activationUrl) {
    return (
      <Alert variant="success">
        {kind === "reset"
          ? `Le lien de réinitialisation a été envoyé par e-mail à ${email}.`
          : `Compte créé pour ${email}. Le lien d'activation lui a été envoyé par e-mail.`}
        {onDone && (
          <Button type="button" variant="ghost" className="ml-2 !min-h-0 !px-2 !py-1 text-xs" onClick={onDone}>
            Terminé
          </Button>
        )}
      </Alert>
    );
  }

  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lubumbashi" })
    : null;

  return (
    <Alert variant="success">
      <p className="font-medium">
        {kind === "reset"
          ? `Lien de réinitialisation du mot de passe de ${email}.`
          : `Compte ${isDemo ? "de démonstration " : ""}créé pour ${email}, en attente d'activation.`}
      </p>
      <p className="mt-1">
        {kind === "reset" ? "Après avoir vérifié l'identité de la personne, t" : "T"}ransmettez ce lien à son seul
        titulaire, par un canal sûr. Il y choisira lui-même son mot de passe. Le lien
        n&apos;est affiché qu&apos;ici, sert une seule fois{expiry ? ` et expire le ${expiry}` : ""}.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={activationUrl}
          aria-label="Lien d'activation"
          className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 font-mono text-xs text-gray-800"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="secondary"
          className="!min-h-0 !px-3 !py-1.5 text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(activationUrl);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copié" : "Copier"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" className="!min-h-0 !px-3 !py-1.5 text-xs" onClick={onDone}>
            Terminé
          </Button>
        )}
      </div>
    </Alert>
  );
}
