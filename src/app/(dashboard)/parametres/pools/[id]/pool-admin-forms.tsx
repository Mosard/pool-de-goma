"use client";

import { useActionState } from "react";
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
  defaults,
  slugSuggestions,
}: {
  poolId: string;
  defaults: { name: string; slug: string; address: string; officialEmail: string };
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
  const consent = (v: boolean) => (v ? "accord donné" : "pas d'accord de l'agent");

  return (
    <form action={formAction} className="space-y-1.5 text-xs text-gray-700">
      <label className="flex items-start gap-1.5">
        <input type="checkbox" name="authIdentity" defaultChecked={authIdentity} className="mt-0.5" />
        <span>
          Nom et fonction <span className="text-gray-400">({consent(consentIdentity)})</span>
        </span>
      </label>
      <label className="flex items-start gap-1.5">
        <input type="checkbox" name="authPhoto" defaultChecked={authPhoto} disabled={!hasPhoto} className="mt-0.5" />
        <span>
          Photo <span className="text-gray-400">({hasPhoto ? consent(consentPhoto) : "aucune photo"})</span>
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" disabled={pending} className="!min-h-0 px-2.5 py-1 text-xs">
          {pending ? "..." : "Enregistrer"}
        </Button>
        {state.success && <span className="text-emerald-700">Enregistré</span>}
        {state.formError && <span className="text-red-600">{state.formError}</span>}
      </div>
    </form>
  );
}
