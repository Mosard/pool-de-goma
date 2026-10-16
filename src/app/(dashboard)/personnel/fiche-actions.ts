"use server";

// Actions de la fiche individuelle (« Ma fiche personnelle » et fiche d'un
// agent). Toute vérification de droit est refaite par src/lib/personnel-file/server.ts.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { findFieldsGroup, REPEAT_FIELDS } from "@/lib/personnel-file/defs";
import { FileConflictError, deleteEntry, saveEntry, saveGroup, saveObservation, type RepeatKind } from "@/lib/personnel-file/server";

export type FicheFormState = { ok?: string; error?: string; errors?: Record<string, string> };

async function actorId(): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.awaitingCell) throw new ForbiddenError("Connexion requise.");
  return session.user.id;
}

function refresh(targetId: string) {
  revalidatePath("/profil");
  revalidatePath("/profil/fiche");
  revalidatePath(`/personnel/${targetId}`);
}

async function run(fn: () => Promise<FicheFormState>): Promise<FicheFormState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof FileConflictError) return { error: e.message };
    throw e;
  }
}

function read(fd: FormData, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? ""]));
}

/** `_version` (champ caché) : version de la rubrique affichée au moment de la modification. */
export async function saveGroupAction(targetId: string, groupKey: string, _p: FicheFormState, fd: FormData): Promise<FicheFormState> {
  return run(async () => {
    const group = findFieldsGroup(groupKey);
    if (!group) return { error: "Rubrique inconnue." };
    const version = Number(fd.get("_version"));
    if (!Number.isInteger(version) || version < 0) return { error: "Rechargez la page avant de modifier." };
    const r = await saveGroup(await actorId(), targetId, groupKey, version, read(fd, group.fields.map((f) => f.key)));
    if (!r.ok) return { error: "Certaines valeurs sont à corriger.", errors: r.errors };
    refresh(targetId);
    return { ok: r.changed ? "Rubrique enregistrée." : "Aucun changement." };
  });
}

export async function saveEntryAction(targetId: string, kind: RepeatKind, entryId: string | null, _p: FicheFormState, fd: FormData): Promise<FicheFormState> {
  return run(async () => {
    const fields = REPEAT_FIELDS[kind];
    if (!fields) return { error: "Rubrique inconnue." };
    const r = await saveEntry(await actorId(), targetId, kind, entryId, read(fd, fields.map((f) => f.key)));
    if (!r.ok) return { error: r.errors._form ?? "Certaines valeurs sont à corriger.", errors: r.errors };
    refresh(targetId);
    return { ok: entryId ? "Entrée modifiée." : "Entrée ajoutée." };
  });
}

export async function deleteEntryAction(targetId: string, kind: RepeatKind, entryId: string): Promise<FicheFormState> {
  return run(async () => {
    await deleteEntry(await actorId(), targetId, kind, entryId);
    refresh(targetId);
    return { ok: "Entrée retirée." };
  });
}

export async function saveObservationAction(targetId: string, groupKey: string, _p: FicheFormState, fd: FormData): Promise<FicheFormState> {
  return run(async () => {
    await saveObservation(await actorId(), targetId, groupKey, String(fd.get("observation") ?? ""));
    refresh(targetId);
    return { ok: "Observation enregistrée." };
  });
}
