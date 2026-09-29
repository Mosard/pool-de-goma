"use client";

import { useActionState, useId, useState } from "react";
import { clsx } from "clsx";
import { Check, CheckCircle2, Clock, ImageOff, Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui";

// Autorisation de publication d'un agent (nom et fonction, photo), commune
// aux fiches POOL et à la Direction de l'Inspection. L'action serveur est
// fournie déjà liée à la personne visée ; elle revérifie les droits.

export type AuthorizationFormState = { formError?: string; success?: boolean };

const initialState: AuthorizationFormState = {};

export function AuthorizationForm({
  action,
  consentIdentity,
  consentPhoto,
  authIdentity,
  authPhoto,
  hasPhoto,
}: {
  action: (state: AuthorizationFormState, formData: FormData) => Promise<AuthorizationFormState>;
  consentIdentity: boolean;
  consentPhoto: boolean;
  authIdentity: boolean;
  authPhoto: boolean;
  hasPhoto: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [identity, setIdentity] = useState(authIdentity);
  const [photo, setPhoto] = useState(authPhoto);
  // Même règle que le serveur (applyPublicationDecision) : pas de photo
  // autorisée sans le nom et la fonction, ni sans photo.
  const photoEnabled = hasPhoto && identity;
  const effectivePhoto = photoEnabled && photo;
  // Après enregistrement, la page est revalidée : les props reflètent la base.
  const dirty = identity !== authIdentity || effectivePhoto !== authPhoto;

  return (
    <form action={formAction} className="w-full min-w-[17rem] max-w-sm space-y-2">
      <AuthorizationRow
        label="Nom et fonction"
        consent={consentIdentity}
        name="authIdentity"
        checked={identity}
        onChange={setIdentity}
      />
      <AuthorizationRow
        label="Photo"
        consent={hasPhoto && consentPhoto}
        consentNote={!hasPhoto ? "Aucune photo de profil" : undefined}
        disabledNote={hasPhoto && !identity ? "Autorisez d'abord le nom et la fonction" : undefined}
        name="authPhoto"
        checked={effectivePhoto}
        disabled={!photoEnabled}
        onChange={setPhoto}
      />
      <div className="flex min-h-8 flex-wrap items-center gap-2 pt-0.5">
        <Button
          type="submit"
          disabled={!dirty || pending}
          className="!min-h-0 px-3.5 py-1.5 text-xs shadow-sm disabled:shadow-none"
        >
          {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {dirty && !pending && <span className="text-[11px] text-gray-500">Modification non enregistrée</span>}
        {state.success && !dirty && !pending && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700" role="status">
            <CheckCircle2 size={14} aria-hidden />
            Enregistré
          </span>
        )}
        {state.formError && <span className="text-[11px] text-red-600">{state.formError}</span>}
      </div>
    </form>
  );
}

/**
 * Une ligne d'autorisation : ce qui est publié, l'accord de l'agent (qu'il
 * donne lui-même depuis son profil) et l'interrupteur d'autorisation. Le
 * champ reste une case à cocher (name / "on") pour l'action serveur.
 */
function AuthorizationRow({
  label,
  consent,
  consentNote,
  disabledNote,
  name,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  consent: boolean;
  consentNote?: string;
  disabledNote?: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  const published = checked && consent;
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors",
        published ? "border-emerald-200 bg-emerald-50/60" : "border-gray-200 bg-white"
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className={clsx("block text-xs font-semibold", disabled ? "text-gray-400" : "text-gray-900")}>
          {label}
        </label>
        <p
          className={clsx(
            "mt-0.5 flex items-center gap-1 text-[11px]",
            consentNote ? "text-gray-400" : consent ? "text-emerald-700" : "text-amber-700"
          )}
        >
          {consentNote ? (
            <ImageOff size={12} aria-hidden />
          ) : consent ? (
            <UserCheck size={12} aria-hidden />
          ) : (
            <Clock size={12} aria-hidden />
          )}
          {consentNote ?? (consent ? "Accord de l'agent donné" : "En attente de l'accord de l'agent")}
        </p>
        {disabledNote && <p className="mt-0.5 text-[11px] text-gray-400">{disabledNote}</p>}
        {checked && !consent && !consentNote && (
          <p className="mt-0.5 text-[11px] text-gray-500">Autorisé : visible dès que l&apos;agent donne son accord.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={clsx("text-[11px] font-medium", checked ? "text-emerald-700" : "text-gray-400")} aria-hidden>
          {checked ? "Autorisé" : "Non autorisé"}
        </span>
        <span className="relative inline-flex">
          <input
            id={id}
            type="checkbox"
            role="switch"
            name={name}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span
            aria-hidden
            className="h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-40"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
          />
        </span>
      </div>
    </div>
  );
}
