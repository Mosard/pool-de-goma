"use client";

import { useActionState } from "react";
import { Alert, Avatar, Button, Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui";
import { POOL_PHONES_MAX } from "@/lib/validations";
import {
  designateChiefAction,
  updatePoolProfileAction,
  updatePublicationAction,
  type PoolAdminFormState,
} from "./actions";

const initialState: PoolAdminFormState = {};

export function PoolProfileForm({
  poolId,
  defaults,
  slugSuggestions,
}: {
  poolId: string;
  defaults: { name: string; slug: string; address: string; phones: string[] };
  slugSuggestions: string[];
}) {
  const [state, formAction, pending] = useActionState(updatePoolProfileAction.bind(null, poolId), initialState);
  const phones = Array.from({ length: POOL_PHONES_MAX }, (_, i) => defaults.phones[i] ?? "");

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900">Fiche officielle du POOL</h2>
      <p className="mt-1 text-xs text-gray-500">
        Ces informations sont publiées telles quelles sur la page publique du POOL. N&apos;y saisissez que des
        informations officielles confirmées par l&apos;Inspection.
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
          <Label htmlFor="address">Adresse du bureau</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={defaults.address} />
          <FieldError message={state.errors?.address} />
        </div>
        <div>
          <Label htmlFor="phone-0">Téléphones officiels du bureau</Label>
          <div className="space-y-2">
            {phones.map((phone, i) => (
              <Input key={i} id={`phone-${i}`} name="phones" defaultValue={phone} placeholder="+243 …" inputMode="tel" />
            ))}
          </div>
          <FieldError message={state.errors?.phones} />
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
        Aucun inspecteur actif n&apos;est affecté à ce POOL : impossible de désigner un chef pour l&apos;instant.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="userId">Désigner comme Chef de POOL</Label>
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
        {pending ? "Désignation..." : "Désigner"}
      </Button>
    </form>
  );
}

export function PublicationForm({
  poolId,
  userId,
  name,
  photoUrl,
  publishIdentity,
  publishPhoto,
}: {
  poolId: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  publishIdentity: boolean;
  publishPhoto: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updatePublicationAction.bind(null, poolId, userId),
    initialState
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={photoUrl} className="h-14 w-14" />
        <p className="text-sm text-gray-600">
          {photoUrl ? "Photo fournie par l'inspecteur dans son profil." : "Aucune photo dans le profil : visuel neutre."}
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" name="publishIdentity" defaultChecked={publishIdentity} className="mt-1" />
        Autoriser la publication du nom et de la fonction sur le site public
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="publishPhoto"
          defaultChecked={publishPhoto}
          disabled={!photoUrl}
          className="mt-1"
        />
        Autoriser la publication de cette photo (nécessite aussi l&apos;autorisation du nom)
      </label>
      {state.formError && <Alert variant="error">{state.formError}</Alert>}
      {state.success && <Alert variant="success">Décision enregistrée et tracée dans le journal d&apos;audit.</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer la décision"}
      </Button>
    </form>
  );
}
