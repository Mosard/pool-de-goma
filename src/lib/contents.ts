import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sniffImageMime } from "@/lib/profile-photo";
import { hasPermissionAnyPool, type SessionPermission } from "@/lib/permission-checks";
import { PERMISSIONS } from "@/lib/rbac-data";
import type { ContentKindKey } from "@/lib/content-meta";

// Contenus éditoriaux (actualités, articles, communiqués) : lecture publique
// (seuls les contenus PUBLIÉS sortent d'ici vers le site), fichiers et
// droits d'accès aux fichiers non publiés.

export const PUBLIC_CONTENTS_TAG = "public-contents";

/** À appeler après toute publication, tout retrait ou toute modification d'un contenu publié. */
export function revalidatePublicContents(slug?: string) {
  revalidateTag(PUBLIC_CONTENTS_TAG, { expire: 0 });
  revalidatePath("/actualites");
  if (slug) revalidatePath(`/actualites/${slug}`);
  revalidatePath("/sitemap.xml");
}

export function canWriteContents(permissions: SessionPermission[]) {
  return hasPermissionAnyPool(permissions, PERMISSIONS.CONTENT_WRITE);
}

export function canPublishContents(permissions: SessionPermission[]) {
  return hasPermissionAnyPool(permissions, PERMISSIONS.CONTENT_PUBLISH);
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

/** PDF reconnu par sa signature. */
export function isPdf(input: Buffer): boolean {
  return input.length > 5 && input.toString("ascii", 0, 5) === "%PDF-";
}

/**
 * Fichier servi par /medias/<id> : public si son contenu est publié ; sinon
 * seulement pour un compte de la même organisation qui rédige ou valide les
 * contenus (aperçu du back-office).
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
      content: { select: { status: true, organizationId: true } },
    },
  });
  if (!media) return null;
  const published = media.content.status === "PUBLIE";
  if (published) return { ...media, published };
  const staff =
    viewer &&
    viewer.organizationId === media.content.organizationId &&
    (canWriteContents(viewer.permissions) || canPublishContents(viewer.permissions));
  return staff ? { ...media, published } : null;
}

// ---------------------------------------------------------------------------
// Lecture publique (contenus PUBLIÉS uniquement). Les dates sortent en texte
// ISO : le cache serveur sérialise les données en JSON.

export type PublicContentCard = {
  slug: string;
  kind: ContentKindKey;
  title: string;
  summary: string;
  publishedAt: string;
  coverId: string | null;
  coverAlt: string | null;
};

export type PublicContent = PublicContentCard & {
  body: string;
  attachment: { id: string; fileName: string | null; size: number } | null;
};

async function firstOrganizationId() {
  return (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
}

type CardRow = {
  slug: string;
  kind: ContentKindKey;
  title: string;
  summary: string;
  publishedAt: Date | null;
  media: { id: string; alt: string | null }[];
};

function toCard(c: CardRow): PublicContentCard {
  return {
    slug: c.slug,
    kind: c.kind,
    title: c.title,
    summary: c.summary,
    publishedAt: (c.publishedAt ?? new Date(0)).toISOString(),
    coverId: c.media[0]?.id ?? null,
    coverAlt: c.media[0]?.alt ?? null,
  };
}

const cardSelect = {
  slug: true,
  kind: true,
  title: true,
  summary: true,
  publishedAt: true,
  media: { where: { role: "COVER" as const }, take: 1, select: { id: true, alt: true } },
} as const;

export const PUBLIC_PAGE_SIZE = 12;

export const getPublishedContents = unstable_cache(
  async (kind: ContentKindKey | null, page: number): Promise<{ items: PublicContentCard[]; total: number }> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return { items: [], total: 0 };
    const where = { organizationId, status: "PUBLIE" as const, ...(kind ? { kind } : {}) };
    const [rows, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: Math.max(0, page - 1) * PUBLIC_PAGE_SIZE,
        take: PUBLIC_PAGE_SIZE,
        select: cardSelect,
      }),
      prisma.content.count({ where }),
    ]);
    return { items: rows.map(toCard), total };
  },
  ["public-contents-list-v1"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);

export const getPublishedContent = unstable_cache(
  async (slug: string): Promise<PublicContent | null> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return null;
    const c = await prisma.content.findFirst({
      where: { slug, organizationId, status: "PUBLIE" },
      select: {
        slug: true,
        kind: true,
        title: true,
        summary: true,
        publishedAt: true,
        body: true,
        media: { select: { id: true, alt: true, role: true, fileName: true, size: true } },
      },
    });
    if (!c) return null;
    const cover = c.media.find((m) => m.role === "COVER");
    const attachment = c.media.find((m) => m.role === "ATTACHMENT");
    return {
      ...toCard({ ...c, media: cover ? [cover] : [] }),
      body: c.body,
      attachment: attachment ? { id: attachment.id, fileName: attachment.fileName, size: attachment.size } : null,
    };
  },
  ["public-content-v1"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);

export const getPublishedSlugs = unstable_cache(
  async (): Promise<{ slug: string; publishedAt: string | null }[]> => {
    const organizationId = await firstOrganizationId();
    if (!organizationId) return [];
    const rows = await prisma.content.findMany({
      where: { organizationId, status: "PUBLIE" },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, publishedAt: true },
    });
    return rows.map((r) => ({ slug: r.slug, publishedAt: r.publishedAt?.toISOString() ?? null }));
  },
  ["public-content-slugs-v1"],
  { tags: [PUBLIC_CONTENTS_TAG], revalidate: 3600 }
);
