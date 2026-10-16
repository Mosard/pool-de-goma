"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { normalizeProfilePhoto } from "@/lib/profile-photo";
import { revalidatePublicPools } from "@/lib/public-pools";
import { applyPublicationDecision, PUBLICATION_REASONS } from "@/lib/publication";
import { AccountError } from "@/lib/accounts";
import { changeOwnPassword, changeOwnUsername, checkUsernameAvailability } from "@/lib/login-credentials";
import {
  AVAILABILITY_MESSAGES,
  isRecentGoogleLogin,
  passwordChangeSchema,
  usernameChangeSchema,
  type UsernameAvailability,
} from "@/lib/login-credentials-rules";

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
  if (!session?.user || session.user.awaitingCell) redirect("/login");

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
  if (!session?.user || session.user.awaitingCell) redirect("/login");

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
// ─── Sécurité et identifiants (« Mon compte ») ───────────────────────────────

async function credentialActor() {
  const session = await auth();
  if (!session?.user || session.user.awaitingCell) redirect("/login");
  return {
    session,
    actor: {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      recentGoogle: isRecentGoogleLogin(session.user.authMethod, session.user.authAt),
      mayUseReservedUsername: Boolean(session.user.isSuperAdmin),
    },
  };
}

const VIEW_MODE_REFUSAL = "Quittez le mode « Voir comme » pour modifier vos identifiants de connexion.";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  return Object.fromEntries(Object.entries(error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""]));
}

/** Disponibilité d'un nom d'utilisateur, pendant la saisie. */
export async function checkUsernameAction(username: string): Promise<{ status: UsernameAvailability; message: string }> {
  const { actor } = await credentialActor();
  const status = await checkUsernameAvailability(actor.userId, String(username ?? "").slice(0, 64), actor.mayUseReservedUsername);
  return { status, message: AVAILABILITY_MESSAGES[status] };
}

export type UsernameFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: { username: string; previous: string | null };
};

export async function updateUsernameAction(_prev: UsernameFormState, formData: FormData): Promise<UsernameFormState> {
  const { session, actor } = await credentialActor();
  if (session.user.viewMode) return { formError: VIEW_MODE_REFUSAL };

  const parsed = usernameChangeSchema.safeParse({
    username: formData.get("username") ?? "",
    currentPassword: formData.get("currentPassword") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const result = await changeOwnUsername(actor, parsed.data);
    revalidatePath("/profil");
    return { success: result };
  } catch (e) {
    if (e instanceof AccountError) return { formError: e.message };
    throw e;
  }
}

export type PasswordFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

export async function updatePasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const { session, actor } = await credentialActor();
  if (session.user.viewMode) return { formError: VIEW_MODE_REFUSAL };

  const parsed = passwordChangeSchema.safeParse({
    password: formData.get("password") ?? "",
    confirmation: formData.get("confirmation") ?? "",
    currentPassword: formData.get("currentPassword") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    await changeOwnPassword(actor, parsed.data);
    revalidatePath("/profil");
    return { success: true };
  } catch (e) {
    if (e instanceof AccountError) return { formError: e.message };
    throw e;
  }
}
