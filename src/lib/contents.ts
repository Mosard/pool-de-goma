import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sniffImageMime } from "@/lib/profile-photo";
import { hasPermissionAnyPool, type SessionPermission } from "@/lib/permission-checks";
import { PERMISSIONS } from "@/lib/rbac-data";
import { parseVideoLink, type ContentKindKey, type VideoEmbed } from "@/lib/content-meta";

// Contenus éditoriaux (actualités, articles, communiqués, albums) : lecture
// publique (seuls les contenus PUBLIÉS dont la date de mise en ligne est
// atteinte sortent d'ici vers le site), fichiers et droits d'accès aux
// fichiers non publiés.

export const PUBLIC_CONTENTS_TAG = "public-contents";

/** À appeler après toute publication, tout retrait ou toute modification d'un contenu publié. */
export function revalidatePublicContents(slug?: string) {
  revalidateTag(PUBLIC_CONTENTS_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/actualites");
  if (slug) revalidatePath(`/actualites/${slug}`);
  revalidatePath("/sitemap.xml");
}

/** Publié ET date de mise en ligne atteinte (un contenu programmé reste caché). */
export function isOnline(status: string, publishedAt: Date | null, now = new Date()) {
  return status === "PUBLIE" && !!publishedAt && publishedAt.getTime() <= now.getTime();
}

/**
 * Limite de mise en ligne des lectures publiques : la minute suivante. Elle
 * entre dans la clé du cache, qui change donc chaque minute : un contenu
 * programmé paraît au plus une minute en avance, sans tâche planifiée.
 */
export function publicCutoff(now = Date.now()): string {
  return new Date(Math.ceil(now / 60_000) * 60_000).toISOString();
}

export function canWriteContents(permissions: SessionPermission[]) {
  return hasPermissionAnyPool(permissions, PERMISSIONS.CONTENT_WRITE);
}

export function canPublishContents(permissions: SessionPermission[]) {
  return hasPermissionAnyPool(permissions, PERMISSIONS.CONTENT_PUBLISH);
}

/** Liens vidéo enregistrés vers leurs adresses d'intégration (liens invalides ignorés). */
export function toVideoEmbeds(links: string[]): VideoEmbed[] {
  return links.map(parseVideoLink).filter((v): v is VideoEmbed => v !== null);
}

// ---------------------------------------------------------------------------
// Fichiers

type Sharp = import("sharp").SharpConstructor;
let sharpModule: Promise<Sharp | null> | null = null;
function loadSharp(): Promise<Sharp | null> {
  sharpModule ??= import("sharp").then((m) => m.default).catch(() => null);
  return sharpModule;
}

const IMAGE_MAX_PX = 1600;

/**
 * Image d'un contenu : type vérifié sur le contenu réel (JPEG, PNG, WebP ;
 * SVG refusé), réduite à 1600 px et recompressée en WebP. null si illisible.
 */
export async function normalizeContentImage(
  input: Buffer
): Promise<{ mime: string; data: Buffer; width: number | null; height: number | null } | null> {
  const sniffed = sniffImageMime(input);
  if (!sniffed) return null;
  const sharp = await loadSharp();
  if (!sharp) {
    // Sans sharp : image acceptée telle quelle si elle reste raisonnable.
    return input.length <= 1_500_000 ? { mime: sniffed, data: input, width: null, height: null } : null;
  }
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { mime: "image/webp", data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/**
 * Aperçu de partage (WhatsApp, Facebook) : JPEG 1200 × 630, format que tous
 * les réseaux affichent (le WebP n'est pas toujours lu). null sans sharp.
 */
export async function toShareJpeg(input: Buffer): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    return await sharp(input).resize({ width: 1200, height: 630, fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

/** PDF reconnu par sa signature. */
export function isPdf(input: Buffer): boolean {
  return input.length > 5 && input.toString("ascii", 0, 5) === "%PDF-";
}

/**
 * Fichier servi par /medias/<id> : public si son contenu est en ligne ;
 * sinon seulement pour un compte de la même organisation qui rédige ou
 * valide les contenus (aperçu du back-office).
 */
export async function getServableMedia(
  id: string,
  viewer: { organizationId: string; permissions: SessionPermission[] } | null
) {
  const media = await prisma.mediaFile.findUnique({
    where: { id },
    select: {
      mime: true,
      data: true,
      fileName: true,
      role: true,
      content: { select: { status: true, publishedAt: true, organizationId: true } },
    },
  });
  if (!media) return null;
  const published = isOnline(media.content.status, media.content.publishedAt);
  if (published) return { ...media, published };
  const staff =
    viewer &&
    viewer.organizationId === media.content.organizationId &&
    (canWriteContents(viewer.permissions) || canPublishContents(viewer.permissions));
  return staff ? { ...media, published } : null;
}

// ---------------------------------------------------------------------------
// Lecture publique (contenus EN LIGNE uniquement). Les dates sortent en texte
// ISO : le cache serveur sérialise les données en JSON.

export type PublicContentCard = {
  slug: string;
  kind: ContentKindKey;
  category: string | null;
  title: string;
  summary: string;
  publishedAt: string;
  pinned: boolean;
  coverId: string | null;
  coverAlt: string | null;
  /** Nombre de photos d'album (affiché sur la carte d'un album). */
  photoCount: number;
};

export type GalleryPhoto = { id: string; alt: string | null; width: number | null; height: number | null };

export type PublicContent = PublicContentCard & {
  body: string;
  attachment: { id: string; fileName: string | null; size: number } | null;
  gallery: GalleryPhoto[];
  videos: VideoEmbed[];
};

async function firstOrganizationId() {
  return (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
}

type CardRow = {
  slug: string;
  kind: ContentKindKey;
  category: string | null;
  title: string;
  summary: string;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  media: { id: string; alt: string | null }[];
  _count: { media: number };
};

function toCard(c: CardRow): PublicContentCard {
  return {
    slug: c.slug,
    kind: c.kind,
    category: c.category,
    title: c.title,
    summary: c.summary,
    publishedAt: (c.publishedAt ?? new Date(0)).toISOString(),
    pinned: c.pinnedAt !== null,
    coverId: c.media[0]?.id ?? null,
    coverAlt: c.media[0]?.alt ?? null,
    photoCount: c._count.media,
  };
}

const cardSelect = {
  slug: true,
  kind: true,
  category: true,
  title: true,
  summary: true,
  publishedAt: true,
  pinnedAt: true,
  media: { where: { role: "COVER" as const }, take: 1, select: { id: true, alt: true } },
  _count: { select: { media: { where: { role: "GALLERY" as const } } } },
} as const;

/** Contenus en ligne à la date limite donnée. */
function onlineWhere(organizationId: string, cutoff: string) {
  return { organizationId, status: "PUBLIE" as const, publishedAt: { lte: new Date(cutoff) } };
}

export const PUBLIC_PAGE_SIZE = 12;

export type PublicListFilter = { kind: ContentKindKey | null; category: string | null };

/** Liste publique : contenus « À la une » d'abord, puis du plus récent au plus ancien. */
export const getPublishedContents = unstable_cache(
  async (
    filter: PublicListFilter,
    page: number,
    cutoff: string
  ): Promise<{ items: PublicContentCard[]; total: number }> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return { items: [], total: 0 };
    const where = {
      ...onlineWhere(organizationId, cutoff),
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
        skip: Math.max(0, page - 1) * PUBLIC_PAGE_SIZE,
        take: PUBLIC_PAGE_SIZE,
        select: cardSelect,
      }),
      prisma.content.count({ where }),
    ]);
    return { items: rows.map(toCard), total };
  },
  ["public-contents-list-v2"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);

/** Catégories qui ont au moins un contenu en ligne (filtres de la page Actualités). */
export const getUsedCategories = unstable_cache(
  async (cutoff: string): Promise<string[]> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return [];
    const rows = await prisma.content.findMany({
      where: { ...onlineWhere(organizationId, cutoff), category: { not: null } },
      distinct: ["category"],
      select: { category: true },
    });
    return rows.map((r) => r.category).filter((c): c is string => c !== null);
  },
  ["public-content-categories-v1"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);

export const getPublishedContent = unstable_cache(
  async (slug: string, cutoff: string): Promise<PublicContent | null> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return null;
    const c = await prisma.content.findFirst({
      where: { slug, ...onlineWhere(organizationId, cutoff) },
      select: {
        ...cardSelect,
        body: true,
        videoLinks: true,
        media: {
          orderBy: { createdAt: "asc" },
          select: { id: true, alt: true, role: true, fileName: true, size: true, width: true, height: true },
        },
      },
    });
    if (!c) return null;
    const cover = c.media.find((m) => m.role === "COVER");
    const attachment = c.media.find((m) => m.role === "ATTACHMENT");
    return {
      ...toCard({ ...c, media: cover ? [cover] : [] }),
      body: c.body,
      attachment: attachment ? { id: attachment.id, fileName: attachment.fileName, size: attachment.size } : null,
      gallery: c.media
        .filter((m) => m.role === "GALLERY")
        .map((m) => ({ id: m.id, alt: m.alt, width: m.width, height: m.height })),
      videos: toVideoEmbeds(c.videoLinks),
    };
  },
  ["public-content-v2"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);

export const getPublishedSlugs = unstable_cache(
  async (cutoff: string): Promise<{ slug: string; publishedAt: string | null }[]> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return [];
    const rows = await prisma.content.findMany({
      where: onlineWhere(organizationId, cutoff),
      orderBy: { publishedAt: "desc" },
      select: { slug: true, publishedAt: true },
    });
    return rows.map((r) => ({ slug: r.slug, publishedAt: r.publishedAt?.toISOString() ?? null }));
  },
  ["public-content-slugs-v2"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);
