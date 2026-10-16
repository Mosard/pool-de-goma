"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Alert, Button, type ButtonSize, type ButtonVariant } from "@/components/ui";

export type FormState = { error?: string; ok?: string; token?: string; secretPath?: string };

/** Copie une valeur affichée une seule fois (jeton, chemin secret) ; repli silencieux si le presse-papiers est refusé. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

function OneTimeValue({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="status">
      <p className="font-semibold">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-[13px] text-gray-900">{value}</code>
        <CopyButton value={value} />
      </div>
      <p className="mt-2 text-pretty">{children}</p>
    </div>
  );
}

/** Formulaire générique d'action serveur : erreur ou réussite ; un jeton n'est affiché qu'UNE fois. */
export function ActionForm({
  action,
  submit,
  children,
  className = "flex flex-wrap items-end gap-3",
  variant = "primary",
  size = "sm",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      {children}
      <Button type="submit" variant={variant} size={size} disabled={pending} className="min-h-[42px] whitespace-nowrap">
        {pending && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
        {submit}
      </Button>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && (
        <span role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
          <Check size={16} aria-hidden />
          {state.ok}
        </span>
      )}
      {state.token && (
        <OneTimeValue title="Jeton de l'appareil — affiché une seule fois, copiez-le maintenant" value={state.token}>
          Il n&apos;est conservé que sous forme hachée : il ne pourra plus être affiché.
        </OneTimeValue>
      )}
      {state.secretPath && (
        <OneTimeValue title="Chemin secret de la pointeuse — affiché une seule fois" value={state.secretPath}>
          À saisir dans l&apos;adresse du serveur de la pointeuse (avant /iclock). L&apos;ancien chemin cesse immédiatement ; la pointeuse est refusée tant
          qu&apos;elle n&apos;utilise pas celui-ci.
        </OneTimeValue>
      )}
    </form>
  );
}
