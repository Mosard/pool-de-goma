"use client";

import { useActionState, useId, useState } from "react";
import { clsx } from "clsx";
import { Check, CheckCircle2, Clock, ImageOff, Loader2, UserCheck } from "lucide-react";
import { Alert, Button, Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui";
import {
  addPoolRoleAction,
  designateChiefAction,
  updatePoolProfileAction,
  updatePublicationAuthorizationAction,
  type PoolAdminFormState,
} from "./actions";

const initialState: PoolAdminFormState = {};

export function PoolProfileForm({
  poolId,
  mode = "full",
  defaults,
  slugSuggestions,
}: {
  poolId: string;
  /** "contact" : chef de POOL — coordonnées du bureau seulement. */
  mode?: "full" | "contact";
  defaults: { name: string; slug: string; address: string; officialEmail: string; officePhone: string };
  slugSuggestions: string[];
}) {
  const [state, formAction, pending] = useActionState(updatePoolProfileAction.bind(null, poolId), initialState);

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900">Fiche officielle du POOL</h2>
      <p className="mt-1 text-xs text-gray-500">
        Publiée telle quelle sur la page du POOL. Coordonnées publiées : adresse officielle du bureau et e-mail
        institutionnel uniquement (ni WhatsApp, ni numéro personnel).
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        {mode === "contact" ? (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{defaults.name}</span>
            {defaults.slug ? ` — /pools/${defaults.slug}` : " — non publié"}. Le nom et l&apos;adresse publique sont
            fixés par l&apos;IPP ; complétez les coordonnées du bureau.
          </p>
        ) : (
        <>
        <div>
          <Label htmlFor="name">Nom officiel</Label>
          <Input id="name" name="name" defaultValue={defaults.name} required />
          <FieldError message={state.errors?.name} />
        </div>
        <div>
          <Label htmlFor="slug">Adresse publique (slug)</Label>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span className="shrink-0">/pools/</span>
            <Input id="slug" name="slug" defaultValue={defaults.slug} list="pool-slug-suggestions" placeholder="non publié" />
          </div>
          <datalist id="pool-slug-suggestions">
            {slugSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-gray-500">
            Laisser vide pour ne pas publier ce POOL. Pour conserver un lien déjà en ligne, reprenez exactement une
            des adresses existantes proposées. Changer l&apos;adresse d&apos;un POOL publié casse ses liens.
          </p>
          <FieldError message={state.errors?.slug} />
        </div>
        </>
        )}
        <div>
          <Label htmlFor="address">Adresse officielle du bureau</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={defaults.address} />
          <FieldError message={state.errors?.address} />
        </div>
        <div>
          <Label htmlFor="officialEmail">E-mail institutionnel du bureau</Label>
          <Input id="officialEmail" name="officialEmail" type="email" defaultValue={defaults.officialEmail} />
          <FieldError message={state.errors?.officialEmail} />
        </div>
        <div>
          <Label htmlFor="officePhone">Téléphone du bureau</Label>
          <Input id="officePhone" name="officePhone" type="tel" defaultValue={defaults.officePhone} placeholder="+243 …" />
          <p className="mt-1 text-xs text-gray-500">Visible dans l&apos;application seulement, jamais publié sur le site.</p>
          <FieldError message={state.errors?.officePhone} />
        </div>
        {state.formError && <Alert variant="error">{state.formError}</Alert>}
        {state.success && <Alert variant="success">Fiche enregistrée. La page publique est actualisée.</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer la fiche"}
        </Button>
      </form>
    </Card>
  );
}

export function ChiefForm({
  poolId,
  candidates,
  currentChiefId,
}: {
  poolId: string;
  candidates: { id: string; name: string }[];
  currentChiefId: string | null;
}) {
  const [state, formAction, pending] = useActionState(designateChiefAction.bind(null, poolId), initialState);

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucun inspecteur actif (compte officiel) n&apos;est affecté à ce POOL : impossible de nommer un chef pour
        l&apos;instant.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="userId">Nommer Chef de POOL</Label>
        <Select id="userId" name="userId" defaultValue={currentChiefId ?? ""} required>
          <option value="" disabled>
            Choisir un inspecteur de ce POOL
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError message={state.errors?.userId} />
        {state.formError && <FieldError message={state.formError} />}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Nomination..." : "Nommer"}
      </Button>
    </form>
  );
}

export function AddRoleForm({
  poolId,
  users,
  roles,
}: {
  poolId: string;
  users: { id: string; name: string }[];
  roles: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(addPoolRoleAction.bind(null, poolId), initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      <div>
        <Label htmlFor="add-userId">Compte</Label>
        <Select id="add-userId" name="userId" defaultValue="" required>
          <option value="" disabled>
            Choisir un compte actif
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <FieldError message={state.errors?.userId} />
      </div>
      <div>
        <Label htmlFor="add-roleId">Fonction dans ce POOL</Label>
        <Select id="add-roleId" name="roleId" defaultValue="" required>
          <option value="" disabled>
            Choisir une fonction
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
        <FieldError message={state.errors?.roleId} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Attribuer la fonction"}
      </Button>
      {state.formError && <p className="text-xs text-red-600 sm:col-span-3">{state.formError}</p>}
    </form>
  );
}

export function AuthorizationForm({
  poolId,
  userId,
  consentIdentity,
  consentPhoto,
  authIdentity,
  authPhoto,
  hasPhoto,
}: {
  poolId: string;
  userId: string;
  consentIdentity: boolean;
  consentPhoto: boolean;
  authIdentity: boolean;
  authPhoto: boolean;
  hasPhoto: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updatePublicationAuthorizationAction.bind(null, poolId, userId),
    initialState
  );
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
