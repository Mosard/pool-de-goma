"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOfficialActor, requirePermission, requirePublicationAuthority } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";
import { applyPublicationDecision } from "@/lib/publication";
import { CONFIRMED_IPPA_ATTRIBUTIONS } from "@/components/homepage/homepage-data";

// Direction de l'Inspection. Droits vérifiés en base à chaque appel :
// - attributions des IPP adjoints (créer, modifier, assigner, supprimer) :
//   direction.manage (IPP principal, Super Admin), compte officiel ;
// - autorisation de publication (IPP principal ou adjoint) :
//   requirePublicationAuthority (publication.manage + IPP, informaticien ou
//   Super Admin, compte officiel), JAMAIS pour son propre compte.

export type DirectionFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

const attributionSchema = z.object({
  label: z.string().trim().min(2, "2 caractères minimum").max(80, "80 caractères maximum"),
  position: z.coerce.number().int("Nombre entier").min(0, "0 minimum").max(99, "99 maximum"),
});

async function currentActor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

async function requireDirectionManager() {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.DIRECTION_MANAGE);
  await requireOfficialActor(actor.id);
  return actor;
}

function revalidateDirection() {
  revalidatePath("/direction");
  revalidatePublicPools();
}

function firstErrors(fieldErrors: Record<string, string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, messages]) => messages && messages.length > 0)
      .map(([field, messages]) => [field, (messages as string[])[0]])
  );
}

/** Titulaire possible d'une attribution : compte officiel actif de l'organisation, fonction « ipa ». */
async function findEligibleAdjoint(userId: string, organizationId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
      status: "ACTIVE",
      isDemo: false,
      roles: { some: { role: { key: ROLE_KEYS.IPA } } },
    },
    select: { id: true },
  });
}

export async function createAttributionAction(_prev: DirectionFormState, formData: FormData): Promise<DirectionFormState> {
  const actor = await requireDirectionManager();
  const parsed = attributionSchema.safeParse({ label: formData.get("label") ?? "", position: formData.get("position") || 0 });
  if (!parsed.success) return { errors: firstErrors(parsed.error.flatten().fieldErrors) };

  try {
    const created = await prisma.directionAttribution.create({
      data: { organizationId: actor.organizationId, label: parsed.data.label, position: parsed.data.position },
    });
    await logAudit({
      actorId: actor.id,
      organizationId: actor.organizationId,
      action: "direction.attribution_create",
      entityType: "DirectionAttribution",
      entityId: created.id,
      newValue: { label: created.label, position: created.position },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { label: "Cette attribution existe déjà." } };
    }
    throw e;
  }

  revalidateDirection();
  return { success: true };
}

/** Crée, en une fois, les attributions déjà confirmées par l'Inspection (seulement si aucune n'existe). */
export async function createConfirmedAttributionsAction() {
  const actor = await requireDirectionManager();
  const existing = await prisma.directionAttribution.count({ where: { organizationId: actor.organizationId } });
  if (existing > 0) return;

  await prisma.directionAttribution.createMany({
    data: CONFIRMED_IPPA_ATTRIBUTIONS.map((label, i) => ({
      organizationId: actor.organizationId,
      label,
      position: (i + 1) * 10,
    })),
    skipDuplicates: true,
  });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "direction.attribution_create",
    entityType: "DirectionAttribution",
    entityId: actor.organizationId,
    newValue: { labels: CONFIRMED_IPPA_ATTRIBUTIONS },
    metadata: { source: "attributions_confirmees" },
  });
  revalidateDirection();
}

export async function updateAttributionAction(
  attributionId: string,
  _prev: DirectionFormState,
  formData: FormData
): Promise<DirectionFormState> {
  const actor = await requireDirectionManager();
  const attribution = await prisma.directionAttribution.findFirst({
    where: { id: attributionId, organizationId: actor.organizationId },
  });
  if (!attribution) return { formError: "Attribution introuvable." };

  const parsed = attributionSchema.safeParse({ label: formData.get("label") ?? "", position: formData.get("position") || 0 });
  if (!parsed.success) return { errors: firstErrors(parsed.error.flatten().fieldErrors) };

  const holderId = String(formData.get("holderId") ?? "") || null;
  if (holderId && !(await findEligibleAdjoint(holderId, actor.organizationId))) {
    return { errors: { holderId: "Choisissez un compte officiel actif ayant la fonction d'IPP adjoint." } };
  }

  const data = { label: parsed.data.label, position: parsed.data.position, holderId };
  try {
    await prisma.directionAttribution.update({ where: { id: attribution.id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { label: "Cette attribution existe déjà." } };
    }
    throw e;
  }

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "direction.attribution_update",
    entityType: "DirectionAttribution",
    entityId: attribution.id,
    oldValue: { label: attribution.label, position: attribution.position, holderId: attribution.holderId },
    newValue: data,
  });

  revalidateDirection();
  return { success: true };
}

export async function deleteAttributionAction(attributionId: string) {
  const actor = await requireDirectionManager();
  const attribution = await prisma.directionAttribution.findFirst({
    where: { id: attributionId, organizationId: actor.organizationId },
  });
  if (!attribution) return;

  await prisma.directionAttribution.delete({ where: { id: attribution.id } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "direction.attribution_delete",
    entityType: "DirectionAttribution",
    entityId: attribution.id,
    oldValue: { label: attribution.label, position: attribution.position, holderId: attribution.holderId },
  });
  revalidateDirection();
}

/**
 * Autorisation (ou retrait) de publier un membre de la Direction (IPP
 * principal ou adjoint). Jamais sur son propre compte : la fiche de l'IPP
 * principal est autorisée par un autre compte habilité (informaticien…).
 */
export async function updateDirectionAuthorizationAction(
  userId: string,
  _prev: DirectionFormState,
  formData: FormData
): Promise<DirectionFormState> {
  const actor = await currentActor();
  await requirePublicationAuthority(actor.id);
  if (userId === actor.id) {
    return { formError: "Vous ne pouvez pas autoriser votre propre publication : un autre compte habilité doit le faire." };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: actor.organizationId,
      isDemo: false,
      roles: { some: { role: { key: { in: [ROLE_KEYS.IPP, ROLE_KEYS.IPA] } } } },
    },
    select: { id: true, photoUrl: true },
  });
  if (!user) return { formError: "Compte introuvable ou sans fonction de direction." };

  await applyPublicationDecision({
    userId: user.id,
    actorId: actor.id,
    organizationId: actor.organizationId,
    kind: "AUTHORIZATION",
    identity: formData.get("authIdentity") === "on",
    // Une photo absente ne peut pas être autorisée.
    photo: Boolean(user.photoUrl) && formData.get("authPhoto") === "on",
    metadata: { scope: "direction" },
  });

  revalidatePath("/direction");
  return { success: true };
}
