"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOfficialActor, requirePermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications/dispatcher";
import { isPdf, normalizeContentImage, revalidatePublicContents } from "@/lib/contents";
import { inlineMediaIds } from "@/lib/content-markup";
import {
  CONTENT_CATEGORY_KEYS,
  CONTENT_KINDS,
  CONTENT_LIMITS,
  EDITABLE_STATUSES,
  parseGomaDateTime,
  parseVideoLink,
  slugify,
  type ContentStatusKey,
} from "@/lib/content-meta";

// Contenus du site public. Droits vérifiés en base à chaque appel, comptes
// officiels uniquement (jamais un compte de démonstration) :
// - rédaction (créer, modifier, soumettre, reprendre, supprimer un brouillon
//   jamais publié) : content.write, et seulement ses PROPRES contenus ;
// - validation (publier, renvoyer en correction, retirer du site) :
//   content.publish (IPP, IPP adjoint, informaticien, Super Admin), jamais
//   sur un contenu dont on est l'auteur.

export type ContentFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
  /** Image insérée : syntaxe à placer dans le texte. */
  snippet?: string;
};

async function actor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

async function requireWriter() {
  const user = await actor();
  await requirePermission(user.id, PERMISSIONS.CONTENT_WRITE);
  await requireOfficialActor(user.id);
  return user;
}

async function requirePublisher() {
  const user = await actor();
  await requirePermission(user.id, PERMISSIONS.CONTENT_PUBLISH);
  await requireOfficialActor(user.id);
  return user;
}

/** Contenu de l'organisation de l'acteur, ou null. */
async function findContent(id: string, organizationId: string) {
  return prisma.content.findFirst({ where: { id, organizationId } });
}

async function uniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = await prisma.content.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function firstErrors(fieldErrors: Record<string, string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, m]) => m && m.length > 0)
      .map(([f, m]) => [f, (m as string[])[0]])
  );
}

const contentSchema = z.object({
  kind: z.enum(CONTENT_KINDS, { message: "Choisissez un type de contenu." }),
  title: z.string().trim().min(3, "Titre trop court").max(CONTENT_LIMITS.title, `${CONTENT_LIMITS.title} caractères maximum`),
  summary: z
    .string()
    .trim()
    .min(10, "Résumé trop court (10 caractères minimum)")
    .max(CONTENT_LIMITS.summary, `${CONTENT_LIMITS.summary} caractères maximum`),
  body: z.string().max(CONTENT_LIMITS.body, "Texte trop long"),
  coverAlt: z.string().trim().max(CONTENT_LIMITS.alt).optional(),
  category: z.union([z.enum(CONTENT_CATEGORY_KEYS), z.literal("")], { message: "Catégorie inconnue." }),
  scheduledFor: z.string().trim().max(20),
  videoLinks: z.string().max(3000),
});

/** Liens vidéo saisis (un par ligne) : adresses normalisées, ou message d'erreur. */
function parseVideoLinks(raw: string): { links: string[] } | { error: string } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > CONTENT_LIMITS.videosPerContent) {
    return { error: `${CONTENT_LIMITS.videosPerContent} vidéos maximum.` };
  }
  const links: string[] = [];
  for (const line of lines) {
    const video = parseVideoLink(line);
    if (!video) return { error: `Lien non reconnu : ${line.slice(0, 80)}. Seuls YouTube et Facebook sont acceptés.` };
    links.push(video.url);
  }
  return { links: [...new Set(links)] };
}

function uploadedFile(formData: FormData, name: string): File | null {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

/** Prévient les valideurs habilités (hors auteur, comptes démo et comptes inactifs). */
async function notifyPublishers(organizationId: string, excludeUserId: string, title: string, body: string, contentId: string) {
  const publishers = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      isDemo: false,
      id: { not: excludeUserId },
      roles: { some: { role: { rolePermissions: { some: { permission: { key: PERMISSIONS.CONTENT_PUBLISH } } } } } },
    },
    select: { id: true },
  });
  for (const p of publishers) {
    await notify({ userId: p.id, event: "content.submitted", title, body, data: { contentId }, channels: ["IN_APP"] });
  }
}

// ---------------------------------------------------------------------------
// Rédaction

/**
 * Crée (contentId = null) ou enregistre un brouillon. Couverture et PDF joint
 * facultatifs, remplacés s'ils sont renvoyés. Un contenu retiré du site
 * repasse en brouillon lorsqu'il est modifié.
 */
export async function saveContentAction(
  contentId: string | null,
  _prev: ContentFormState,
  formData: FormData
): Promise<ContentFormState> {
  const user = await requireWriter();
  const parsed = contentSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title") ?? "",
    summary: formData.get("summary") ?? "",
    body: formData.get("body") ?? "",
    coverAlt: formData.get("coverAlt") ?? "",
    category: formData.get("category") ?? "",
    scheduledFor: formData.get("scheduledFor") ?? "",
    videoLinks: formData.get("videoLinks") ?? "",
  });
  if (!parsed.success) return { errors: firstErrors(parsed.error.flatten().fieldErrors) };
  const data = parsed.data;

  const videos = parseVideoLinks(data.videoLinks);
  if ("error" in videos) return { errors: { videoLinks: videos.error } };
  // Date souhaitée : facultative, mais jamais dans le passé.
  const scheduledFor = parseGomaDateTime(data.scheduledFor);
  if (data.scheduledFor && !scheduledFor) return { errors: { scheduledFor: "Date invalide." } };
  if (scheduledFor && scheduledFor.getTime() < Date.now()) {
    return { errors: { scheduledFor: "Cette date est déjà passée. Laissez vide pour une publication dès la validation." } };
  }
  const extra = { category: data.category || null, scheduledFor, videoLinks: videos.links };

  let existing = null;
  if (contentId) {
    existing = await findContent(contentId, user.organizationId);
    if (!existing) return { formError: "Contenu introuvable." };
    if (existing.authorId !== user.id) return { formError: "Seul l'auteur peut modifier ce contenu." };
    if (!EDITABLE_STATUSES.includes(existing.status as ContentStatusKey)) {
      return { formError: "Ce contenu n'est pas modifiable dans son état actuel." };
    }
    // Images du texte : uniquement celles de CE contenu.
    const ids = inlineMediaIds(data.body);
    if (ids.length > 0) {
      const own = await prisma.mediaFile.count({ where: { id: { in: ids }, contentId: existing.id, role: "INLINE" } });
      if (own !== new Set(ids).size) return { errors: { body: "Le texte contient une image qui n'appartient pas à ce contenu." } };
    }
  } else if (inlineMediaIds(data.body).length > 0) {
    return { errors: { body: "Enregistrez d'abord le brouillon avant d'insérer des images." } };
  }

  // Fichiers (validés avant toute écriture).
  const coverFile = uploadedFile(formData, "cover");
  const attachmentFile = uploadedFile(formData, "attachment");
  let cover: Awaited<ReturnType<typeof normalizeContentImage>> = null;
  if (coverFile) {
    if (coverFile.size > CONTENT_LIMITS.uploadBytes) return { errors: { cover: "Image trop lourde (4 Mo maximum)." } };
    cover = await normalizeContentImage(Buffer.from(await coverFile.arrayBuffer()));
    if (!cover) return { errors: { cover: "L'image doit être au format JPEG, PNG ou WebP." } };
  }
  let attachment: Buffer | null = null;
  if (attachmentFile) {
    if (data.kind !== "COMMUNIQUE") return { errors: { attachment: "Seul un communiqué peut avoir un PDF joint." } };
    if (attachmentFile.size > CONTENT_LIMITS.uploadBytes) return { errors: { attachment: "PDF trop lourd (4 Mo maximum)." } };
    attachment = Buffer.from(await attachmentFile.arrayBuffer());
    if (!isPdf(attachment)) return { errors: { attachment: "Le fichier joint doit être un PDF." } };
  }

  const status: ContentStatusKey =
    existing && existing.status !== "RETIRE" ? (existing.status as ContentStatusKey) : "BROUILLON";
  // L'adresse publique est figée dès la première publication.
  const slug = existing?.publishedAt ? existing.slug : await uniqueSlug(data.title, existing?.id);

  const saved = existing
    ? await prisma.content.update({
        where: { id: existing.id },
        data: { kind: data.kind, title: data.title, summary: data.summary, body: data.body, slug, status, ...extra },
      })
    : await prisma.content.create({
        data: {
          organizationId: user.organizationId,
          authorId: user.id,
          kind: data.kind,
          title: data.title,
          summary: data.summary,
          body: data.body,
          slug,
          ...extra,
        },
      });

  if (cover) {
    await prisma.$transaction([
      prisma.mediaFile.deleteMany({ where: { contentId: saved.id, role: "COVER" } }),
      prisma.mediaFile.create({
        data: {
          contentId: saved.id,
          role: "COVER",
          mime: cover.mime,
          data: new Uint8Array(cover.data),
          size: cover.data.length,
          width: cover.width,
          height: cover.height,
          alt: data.coverAlt || null,
          uploadedById: user.id,
        },
      }),
    ]);
  } else if (formData.get("removeCover") === "on") {
    await prisma.mediaFile.deleteMany({ where: { contentId: saved.id, role: "COVER" } });
  } else if (existing) {
    await prisma.mediaFile.updateMany({ where: { contentId: saved.id, role: "COVER" }, data: { alt: data.coverAlt || null } });
  }
  if (attachment && attachmentFile) {
    await prisma.$transaction([
      prisma.mediaFile.deleteMany({ where: { contentId: saved.id, role: "ATTACHMENT" } }),
      prisma.mediaFile.create({
        data: {
          contentId: saved.id,
          role: "ATTACHMENT",
          mime: "application/pdf",
          data: new Uint8Array(attachment),
          size: attachment.length,
          fileName: attachmentFile.name.slice(0, 120) || "communique.pdf",
          uploadedById: user.id,
        },
      }),
    ]);
  } else if (formData.get("removeAttachment") === "on" || data.kind !== "COMMUNIQUE") {
    await prisma.mediaFile.deleteMany({ where: { contentId: saved.id, role: "ATTACHMENT" } });
  }

  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: existing ? "content.update" : "content.create",
    entityType: "Content",
    entityId: saved.id,
    oldValue: existing ? { title: existing.title, status: existing.status } : undefined,
    newValue: { kind: saved.kind, title: saved.title, status: saved.status },
  });

  revalidatePath("/contenus");
  revalidatePath(`/contenus/${saved.id}`);
  if (!existing) redirect(`/contenus/${saved.id}`);
  return { success: true };
}

/** Image insérée dans le texte (le brouillon doit exister). Retourne la syntaxe à placer dans le texte. */
export async function uploadInlineImageAction(
  contentId: string,
  _prev: ContentFormState,
  formData: FormData
): Promise<ContentFormState> {
  const user = await requireWriter();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.authorId !== user.id) return { formError: "Contenu introuvable." };
  if (!EDITABLE_STATUSES.includes(content.status as ContentStatusKey)) return { formError: "Contenu non modifiable." };

  const file = uploadedFile(formData, "image");
  if (!file) return { formError: "Choisissez une image." };
  if (file.size > CONTENT_LIMITS.uploadBytes) return { formError: "Image trop lourde (4 Mo maximum)." };
  const count = await prisma.mediaFile.count({ where: { contentId, role: "INLINE" } });
  if (count >= CONTENT_LIMITS.imagesPerContent) return { formError: `${CONTENT_LIMITS.imagesPerContent} images maximum par contenu.` };

  const image = await normalizeContentImage(Buffer.from(await file.arrayBuffer()));
  if (!image) return { formError: "L'image doit être au format JPEG, PNG ou WebP." };
  const alt = String(formData.get("alt") ?? "").trim().replace(/[\[\]()]/g, "").slice(0, CONTENT_LIMITS.alt);

  const media = await prisma.mediaFile.create({
    data: {
      contentId,
      role: "INLINE",
      mime: image.mime,
      data: new Uint8Array(image.data),
      size: image.data.length,
      width: image.width,
      height: image.height,
      alt: alt || null,
      uploadedById: user.id,
    },
  });
  return { success: true, snippet: `![${alt}](/medias/${media.id})` };
}

// ---------------------------------------------------------------------------
// Galerie (photos d'album) : une photo par appel, pour rester sous la limite
// d'envoi de 4,5 Mo ; l'éditeur envoie les photos choisies l'une après l'autre.

async function editableOwnContent(contentId: string) {
  const user = await requireWriter();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.authorId !== user.id) return { user, content: null };
  if (!EDITABLE_STATUSES.includes(content.status as ContentStatusKey)) return { user, content: null };
  return { user, content };
}

export type GalleryUploadResult = { error?: string; photo?: { id: string; alt: string | null } };

export async function uploadGalleryPhotoAction(contentId: string, formData: FormData): Promise<GalleryUploadResult> {
  const { user, content } = await editableOwnContent(contentId);
  if (!content) return { error: "Contenu introuvable ou non modifiable." };

  const file = uploadedFile(formData, "photo");
  if (!file) return { error: "Choisissez une photo." };
  if (file.size > CONTENT_LIMITS.uploadBytes) return { error: `${file.name} : photo trop lourde (4 Mo maximum).` };
  const count = await prisma.mediaFile.count({ where: { contentId, role: "GALLERY" } });
  if (count >= CONTENT_LIMITS.galleryPerContent) return { error: `${CONTENT_LIMITS.galleryPerContent} photos maximum par album.` };

  const image = await normalizeContentImage(Buffer.from(await file.arrayBuffer()));
  if (!image) return { error: `${file.name} : la photo doit être au format JPEG, PNG ou WebP.` };
  const alt = String(formData.get("alt") ?? "").trim().slice(0, CONTENT_LIMITS.alt) || null;

  const media = await prisma.mediaFile.create({
    data: {
      contentId,
      role: "GALLERY",
      mime: image.mime,
      data: new Uint8Array(image.data),
      size: image.data.length,
      width: image.width,
      height: image.height,
      alt,
      uploadedById: user.id,
    },
    select: { id: true, alt: true },
  });
  revalidatePath(`/contenus/${contentId}`);
  return { photo: media };
}

export async function updateGalleryCaptionAction(contentId: string, mediaId: string, alt: string): Promise<{ error?: string }> {
  const { content } = await editableOwnContent(contentId);
  if (!content) return { error: "Contenu introuvable ou non modifiable." };
  const caption = alt.trim().slice(0, CONTENT_LIMITS.alt) || null;
  const res = await prisma.mediaFile.updateMany({ where: { id: mediaId, contentId, role: "GALLERY" }, data: { alt: caption } });
  return res.count === 1 ? {} : { error: "Photo introuvable." };
}

export async function deleteGalleryPhotoAction(contentId: string, mediaId: string): Promise<{ error?: string }> {
  const { content } = await editableOwnContent(contentId);
  if (!content) return { error: "Contenu introuvable ou non modifiable." };
  await prisma.mediaFile.deleteMany({ where: { id: mediaId, contentId, role: "GALLERY" } });
  revalidatePath(`/contenus/${contentId}`);
  return {};
}

export async function submitContentAction(contentId: string) {
  const user = await requireWriter();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.authorId !== user.id) return;
  if (!EDITABLE_STATUSES.includes(content.status as ContentStatusKey)) return;
  // Un album peut se passer de texte s'il a au moins une photo ou une vidéo.
  if (content.kind === "GALERIE") {
    const photos = await prisma.mediaFile.count({ where: { contentId, role: "GALLERY" } });
    if (photos === 0 && content.videoLinks.length === 0) redirect(`/contenus/${contentId}?erreur=album`);
  } else if (!content.body.trim()) {
    redirect(`/contenus/${contentId}?erreur=texte`);
  }

  await prisma.content.update({
    where: { id: content.id },
    data: { status: "SOUMIS", submittedAt: new Date() },
  });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "content.submit",
    entityType: "Content",
    entityId: content.id,
    oldValue: { status: content.status },
    newValue: { status: "SOUMIS" },
  });
  await notifyPublishers(
    user.organizationId,
    user.id,
    "Contenu à valider",
    `« ${content.title} » attend votre validation avant publication sur le site.`,
    content.id
  );
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
}

/** L'auteur reprend un contenu soumis pour le modifier (retour en brouillon). */
export async function reclaimContentAction(contentId: string) {
  const user = await requireWriter();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.authorId !== user.id || content.status !== "SOUMIS") return;
  await prisma.content.update({ where: { id: content.id }, data: { status: "BROUILLON" } });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "content.reclaim",
    entityType: "Content",
    entityId: content.id,
    oldValue: { status: "SOUMIS" },
    newValue: { status: "BROUILLON" },
  });
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
}

/** Supprime un brouillon jamais publié (et ses fichiers). */
export async function deleteContentAction(contentId: string) {
  const user = await requireWriter();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.authorId !== user.id || content.publishedAt || content.status === "SOUMIS") return;
  await prisma.content.delete({ where: { id: content.id } });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "content.delete",
    entityType: "Content",
    entityId: content.id,
    oldValue: { title: content.title, status: content.status },
  });
  revalidatePath("/contenus");
  redirect("/contenus");
}

// ---------------------------------------------------------------------------
// Validation

async function reviewable(contentId: string, expected: ContentStatusKey) {
  const user = await requirePublisher();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.status !== expected) return { user, content: null, refusal: "Ce contenu n'est plus dans l'état attendu." };
  if (content.authorId === user.id) return { user, content: null, refusal: "Vous ne pouvez pas valider votre propre contenu." };
  return { user, content, refusal: null };
}

const fmtGoma = (d: Date) =>
  d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

/**
 * Publication, immédiate ou programmée (champ « publishAt », heure de Goma).
 * Programmé = PUBLIE avec une date future : le site ne l'affiche qu'à cette
 * date (src/lib/contents.ts). Une republication garde la date d'origine.
 */
export async function publishContentAction(contentId: string, _prev: ContentFormState, formData: FormData): Promise<ContentFormState> {
  const { user, content, refusal } = await reviewable(contentId, "SOUMIS");
  if (!content) return { formError: refusal ?? "Contenu introuvable." };

  const now = new Date();
  const raw = String(formData.get("publishAt") ?? "").trim();
  const publishAt = parseGomaDateTime(raw);
  if (raw && !publishAt) return { errors: { publishAt: "Date invalide." } };
  if (publishAt && publishAt.getTime() < now.getTime() - 60_000) {
    return { errors: { publishAt: "Cette date est déjà passée. Videz le champ pour publier maintenant." } };
  }
  const scheduled = publishAt !== null && publishAt.getTime() > now.getTime();
  const publishedAt = scheduled
    ? publishAt
    : content.publishedAt && content.publishedAt.getTime() <= now.getTime()
      ? content.publishedAt
      : now;

  await prisma.content.update({
    where: { id: content.id },
    data: { status: "PUBLIE", publishedAt, scheduledFor: null, reviewedById: user.id, reviewedAt: now, reviewNote: null },
  });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: scheduled ? "content.schedule" : "content.publish",
    entityType: "Content",
    entityId: content.id,
    oldValue: { status: content.status },
    newValue: { status: "PUBLIE", slug: content.slug, publishedAt: publishedAt.toISOString() },
  });
  await notify({
    userId: content.authorId,
    event: "content.published",
    title: scheduled ? "Contenu programmé" : "Contenu publié",
    body: scheduled
      ? `« ${content.title} » paraîtra sur le site le ${fmtGoma(publishedAt)}.`
      : `« ${content.title} » est en ligne sur le site.`,
    data: { contentId: content.id },
    channels: ["IN_APP"],
  });
  revalidatePublicContents(content.slug);
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
  return { success: true };
}

/** Met en ligne tout de suite un contenu programmé. */
export async function publishNowAction(contentId: string) {
  const user = await requirePublisher();
  const content = await findContent(contentId, user.organizationId);
  const now = new Date();
  if (!content || content.status !== "PUBLIE" || !content.publishedAt || content.publishedAt <= now) return;
  await prisma.content.update({ where: { id: content.id }, data: { publishedAt: now } });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "content.publish_now",
    entityType: "Content",
    entityId: content.id,
    oldValue: { publishedAt: content.publishedAt.toISOString() },
    newValue: { publishedAt: now.toISOString() },
  });
  revalidatePublicContents(content.slug);
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
}

/** Met un contenu publié « À la une », ou l'en retire (3 au plus en même temps). */
export async function togglePinAction(contentId: string): Promise<ContentFormState> {
  const user = await requirePublisher();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.status !== "PUBLIE") return { formError: "Seul un contenu publié peut être mis à la une." };

  const pin = content.pinnedAt === null;
  if (pin) {
    const pinned = await prisma.content.count({
      where: { organizationId: user.organizationId, status: "PUBLIE", pinnedAt: { not: null } },
    });
    if (pinned >= CONTENT_LIMITS.pinned) {
      return { formError: `${CONTENT_LIMITS.pinned} contenus sont déjà à la une : retirez-en un d'abord.` };
    }
  }
  await prisma.content.update({ where: { id: content.id }, data: { pinnedAt: pin ? new Date() : null } });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: pin ? "content.pin" : "content.unpin",
    entityType: "Content",
    entityId: content.id,
  });
  revalidatePublicContents(content.slug);
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
  return { success: true };
}

const noteSchema = z.string().trim().min(5, "Précisez la correction attendue (5 caractères minimum).").max(1000);

export async function requestChangesAction(contentId: string, _prev: ContentFormState, formData: FormData): Promise<ContentFormState> {
  const { user, content, refusal } = await reviewable(contentId, "SOUMIS");
  if (!content) return { formError: refusal ?? "Contenu introuvable." };
  const note = noteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return { errors: { note: note.error.issues[0].message } };

  await prisma.content.update({
    where: { id: content.id },
    data: { status: "A_CORRIGER", reviewedById: user.id, reviewedAt: new Date(), reviewNote: note.data },
  });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "content.request_changes",
    entityType: "Content",
    entityId: content.id,
    oldValue: { status: content.status },
    newValue: { status: "A_CORRIGER", note: note.data },
  });
  await notify({
    userId: content.authorId,
    event: "content.changes_requested",
    title: "Contenu à corriger",
    body: `« ${content.title} » : ${note.data}`,
    data: { contentId: content.id },
    channels: ["IN_APP"],
  });
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
  return { success: true };
}

export async function unpublishContentAction(contentId: string, _prev: ContentFormState, formData: FormData): Promise<ContentFormState> {
  const user = await requirePublisher();
  const content = await findContent(contentId, user.organizationId);
  if (!content || content.status !== "PUBLIE") return { formError: "Ce contenu n'est pas publié." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;

  await prisma.content.update({
    where: { id: content.id },
    data: { status: "RETIRE", pinnedAt: null, reviewedById: user.id, reviewedAt: new Date(), reviewNote: note },
  });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "content.unpublish",
    entityType: "Content",
    entityId: content.id,
    oldValue: { status: "PUBLIE" },
    newValue: { status: "RETIRE", note },
  });
  if (content.authorId !== user.id) {
    await notify({
      userId: content.authorId,
      event: "content.unpublished",
      title: "Contenu retiré du site",
      body: `« ${content.title} » a été retiré du site${note ? ` : ${note}` : "."}`,
      data: { contentId: content.id },
      channels: ["IN_APP"],
    });
  }
  revalidatePublicContents(content.slug);
  revalidatePath("/contenus");
  revalidatePath(`/contenus/${content.id}`);
  return { success: true };
}
