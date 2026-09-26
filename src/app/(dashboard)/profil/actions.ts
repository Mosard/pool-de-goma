"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { normalizeProfilePhoto } from "@/lib/profile-photo";
import { revalidatePublicPools } from "@/lib/public-pools";
import { applyPublicationDecision, PUBLICATION_REASONS } from "@/lib/publication";

export type ProfileFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = profileSchema.safeParse({
    prenom: formData.get("prenom"),
    postnom: formData.get("postnom"),
    sex: formData.get("sex"),
    phone: formData.get("phone"),
    dateNaissance: formData.get("dateNaissance"),
    nombreEnfants: formData.get("nombreEnfants"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      prenom: parsed.data.prenom || null,
      postnom: parsed.data.postnom || null,
      sex: parsed.data.sex || null,
      phone: parsed.data.phone || null,
      dateNaissance: parsed.data.dateNaissance ? new Date(parsed.data.dateNaissance) : null,
      nombreEnfants: parsed.data.nombreEnfants ? Number(parsed.data.nombreEnfants) : null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "profile.update",
    entityType: "User",
    entityId: session.user.id,
  });

  revalidatePath("/profil");
  return { success: true };
}

export type PhotoFormState = {
  formError?: string;
  success?: boolean;
};

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function updatePhotoAction(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Aucune image sélectionnée." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { formError: "L'image ne doit pas dépasser 2 Mo." };
  }

  // Type vérifié sur le contenu réel (JPEG/PNG/WebP), puis image réduite à
  // 512 px : la data URL stockée reste légère.
  const dataUrl = await normalizeProfilePhoto(Buffer.from(await file.arrayBuffer()));
  if (!dataUrl) {
    return { formError: "Le fichier doit être une image JPEG, PNG ou WebP." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { photoUrl: dataUrl, photoUpdatedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "profile.photo_update",
    entityType: "User",
    entityId: session.user.id,
  });

  // Une nouvelle photo n'a pas encore été examinée : l'autorisation de la
  // publier est retirée (trace « photo_changed ») jusqu'à une nouvelle
  // décision de l'IPP ou de l'informaticien. L'accord de l'agent, le nom et
  // la fonction ne changent pas.
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { publicationAuthIdentity: true },
  });
  await applyPublicationDecision({
    userId: session.user.id,
    actorId: null,
    organizationId: session.user.organizationId,
    kind: "AUTHORIZATION",
    identity: current?.publicationAuthIdentity ?? false,
    photo: false,
    reason: PUBLICATION_REASONS.PHOTO_CHANGED,
  });

  revalidatePath("/profil");
  revalidatePath("/dashboard");
  revalidatePublicPools();
  return { success: true };
}

export type ConsentFormState = {
  formError?: string;
  success?: boolean;
};

/**
 * Accord (ou retrait d'accord) de l'agent lui-même pour la publication de
 * son nom et de sa fonction, et de sa photo de profil. Sans l'autorisation
 * de l'IPP ou de l'informaticien, l'accord seul ne publie rien.
 */
export async function updatePublicationConsentAction(
  _prevState: ConsentFormState,
  formData: FormData
): Promise<ConsentFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true } });
  if (user?.status !== "ACTIVE") return { formError: "Compte inactif." };

  await applyPublicationDecision({
    userId: session.user.id,
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    kind: "CONSENT",
    identity: formData.get("consentIdentity") === "on",
    photo: formData.get("consentPhoto") === "on",
  });

  revalidatePath("/profil");
  return { success: true };
}
