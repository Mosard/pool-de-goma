"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";

export type FormState = { error?: string; ok?: string; token?: string; secretPath?: string };

/** Formulaire générique d'action serveur : erreur ou réussite ; un jeton n'est affiché qu'UNE fois. */
export function ActionForm({
  action,
  submit,
  children,
  className = "flex flex-wrap items-end gap-3",
  variant = "primary",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <Button type="submit" variant={variant} disabled={pending} className="!min-h-0 !px-3 !py-2 text-xs">
        {pending ? "…" : submit}
      </Button>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      {state.token && (
        <div className="w-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Jeton de l&apos;appareil — affiché une seule fois, copiez-le maintenant :</p>
          <code className="mt-1 block break-all font-mono">{state.token}</code>
          <p className="mt-1">Il n&apos;est conservé que sous forme hachée : il ne pourra plus être affiché.</p>
        </div>
      )}
      {state.secretPath && (
        <div className="w-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Chemin secret de la pointeuse — affiché une seule fois :</p>
          <code className="mt-1 block break-all font-mono">{state.secretPath}</code>
          <p className="mt-1">
            À saisir dans l&apos;adresse du serveur de la pointeuse (avant /iclock). L&apos;ancien chemin cesse immédiatement ; la pointeuse est refusée tant
            qu&apos;elle n&apos;utilise pas celui-ci.
          </p>
        </div>
      )}
    </form>
  );
}
