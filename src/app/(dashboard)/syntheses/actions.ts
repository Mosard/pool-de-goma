"use server";

// Actions du rapport de synthèse. L'acteur est toujours reconstruit côté
// serveur depuis la session (loadActor relit le compte et ses droits en
// base) ; les identifiants reçus du formulaire ne désignent que la synthèse
// et les rapports visés, contrôlés ensuite par src/lib/synthese/server.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { createSynthesis, loadActor, setSynthesisSources, synthesisTargetOf, transitionSynthesis, updateSynthesis } from "@/lib/synthese/server";
import { formatOf } from "@/lib/synthese/format";
import type { SynthesisStatusKey } from "@/lib/synthese/rules";

export type SynthesisFormState = { error?: string; ok?: string };

async function currentActor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return loadActor(session.user.id);
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function refusal(e: unknown): SynthesisFormState {
  if (e instanceof ForbiddenError) return { error: e.message };
  throw e;
}

export async function createSynthesisAction(_prev: SynthesisFormState, formData: FormData): Promise<SynthesisFormState> {
  const actor = await currentActor();
  const perimetre = String(formData.get("perimetre") ?? "");
  let id: string;
  try {
    id = await createSynthesis(actor, {
      title: String(formData.get("title") ?? ""),
      ...synthesisTargetOf(perimetre),
      reportIds: formData.getAll("reportIds").map(String),
      periodFrom: parseDate(formData.get("periodFrom")),
      periodTo: parseDate(formData.get("periodTo")),
    });
  } catch (e) {
    return refusal(e);
  }
  revalidatePath("/syntheses");
  redirect(`/syntheses/${id}`);
}

export async function saveSynthesisAction(
  id: string,
  formatVersion: number,
  _prev: SynthesisFormState,
  formData: FormData
): Promise<SynthesisFormState> {
  const actor = await currentActor();
  const sections: Record<string, unknown> = {};
  for (const s of formatOf(formatVersion)) sections[s.key] = formData.get(`section.${s.key}`);
  try {
    await updateSynthesis(actor, id, {
      title: String(formData.get("title") ?? ""),
      periodFrom: parseDate(formData.get("periodFrom")),
      periodTo: parseDate(formData.get("periodTo")),
      sections,
    });
  } catch (e) {
    return refusal(e);
  }
  revalidatePath(`/syntheses/${id}`);
  return { ok: "Synthèse enregistrée." };
}

export async function setSourcesAction(id: string, _prev: SynthesisFormState, formData: FormData): Promise<SynthesisFormState> {
  const actor = await currentActor();
  try {
    await setSynthesisSources(actor, id, formData.getAll("reportIds").map(String));
  } catch (e) {
    return refusal(e);
  }
  revalidatePath(`/syntheses/${id}`);
  return { ok: "Rapports retenus mis à jour." };
}

const TARGETS: readonly SynthesisStatusKey[] = ["SOUMIS", "A_CORRIGER", "VALIDE"];

export async function transitionSynthesisAction(id: string, _prev: SynthesisFormState, formData: FormData): Promise<SynthesisFormState> {
  const actor = await currentActor();
  const to = String(formData.get("toStatus") ?? "") as SynthesisStatusKey;
  if (!TARGETS.includes(to)) return { error: "Étape inconnue." };
  try {
    await transitionSynthesis(actor, id, to, String(formData.get("comment") ?? ""));
  } catch (e) {
    return refusal(e);
  }
  revalidatePath(`/syntheses/${id}`);
  revalidatePath("/syntheses");
  return { ok: "Étape enregistrée." };
}
