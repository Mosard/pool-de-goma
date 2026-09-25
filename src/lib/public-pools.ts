import { createHash } from "node:crypto";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLE_KEYS } from "@/lib/rbac-data";
import { LEGACY_POOL_PAGES } from "@/components/homepage/homepage-data";

// Source unique des données publiques des POOL (pages /pools/[slug], liste
// de l'accueil, sitemap, photo du Chef de POOL). Seuls les champs listés
// dans PublicPool sortent de ce module : aucun email, téléphone personnel,
// matricule ni autre donnée de compte.

export const PUBLIC_POOLS_TAG = "public-pools";

export type PublicChief = {
  name: string;
  functionLabel: string;
  // Chemin de la vignette (route /pools/<slug>/photo-chef), ou null →
  // visuel neutre.
  photoPath: string | null;
};

export type PublicPool = {
  slug: string;
  name: string;
  address: string | null;
  phones: string[];
  chief: PublicChief | null;
};

// Version interne (cache serveur uniquement) : garde l'identifiant du chef
// pour la route photo, jamais transmis aux composants.
type PublicPoolRecord = PublicPool & { chiefUserId: string | null };

/**
 * Règles de publication :
 * - POOL : actif, dans l'organisation servie, avec un slug attribué ;
 * - Chef : exactement un titulaire de la fonction chef_pool pour ce POOL
 *   dont le compte est ACTIVE et qui est aussi inspecteur de ce même POOL
 *   (sinon aucun chef n'est affiché) ; nom et fonction seulement si
 *   publishIdentity ; photo seulement si publishPhoto et photo présente.
 */
async function queryPublicPools(): Promise<PublicPoolRecord[]> {
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!organization) return [];

  const pools = await prisma.pool.findMany({
    where: { organizationId: organization.id, active: true, slug: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, address: true, phones: true },
  });
  if (pools.length === 0) return [];

  const chiefRoles = await prisma.userRole.findMany({
    where: {
      poolId: { in: pools.map((p) => p.id) },
      role: { key: ROLE_KEYS.CHEF_POOL },
      user: { organizationId: organization.id, status: "ACTIVE" },
    },
    select: {
      poolId: true,
      role: { select: { label: true } },
      user: {
        select: {
          id: true,
          name: true,
          publishIdentity: true,
          publishPhoto: true,
          photoUpdatedAt: true,
          roles: { where: { role: { key: ROLE_KEYS.INSPECTEUR } }, select: { poolId: true } },
        },
      },
    },
  });

  const eligibleByPool = new Map<string, (typeof chiefRoles)[number][]>();
  for (const cr of chiefRoles) {
    if (!cr.poolId || !cr.user.roles.some((r) => r.poolId === cr.poolId)) continue;
    const list = eligibleByPool.get(cr.poolId) ?? [];
    list.push(cr);
    eligibleByPool.set(cr.poolId, list);
  }

  const publishedChiefIds = [...eligibleByPool.values()]
    .filter((list) => list.length === 1 && list[0].user.publishIdentity && list[0].user.publishPhoto)
    .map((list) => list[0].user.id);
  // Existence de la photo sans charger la data URL (potentiellement lourde).
  const withPhoto = new Set(
    publishedChiefIds.length === 0
      ? []
      : (
          await prisma.user.findMany({
            where: { id: { in: publishedChiefIds }, photoUrl: { not: null } },
            select: { id: true },
          })
        ).map((u) => u.id)
  );

  return pools.map((pool) => {
    const slug = pool.slug as string;
    const eligible = eligibleByPool.get(pool.id) ?? [];
    const chiefRole = eligible.length === 1 && eligible[0].user.publishIdentity ? eligible[0] : null;

    let chief: PublicChief | null = null;
    if (chiefRole) {
      const { user } = chiefRole;
      const version = createHash("sha256")
        .update(`${user.id}:${user.photoUpdatedAt?.getTime() ?? 0}`)
        .digest("hex")
        .slice(0, 12);
      chief = {
        name: user.name,
        functionLabel: chiefRole.role.label,
        photoPath: withPhoto.has(user.id) ? `/pools/${slug}/photo-chef?v=${version}` : null,
      };
    }

    return {
      slug,
      name: pool.name,
      address: pool.address,
      phones: pool.phones,
      chief,
      chiefUserId: chiefRole?.user.id ?? null,
    };
  });
}

const getPublicPoolRecords = unstable_cache(queryPublicPools, ["public-pools-v1"], {
  tags: [PUBLIC_POOLS_TAG],
  // Filet de sécurité : les actions du back-office invalident le cache
  // immédiatement (revalidatePublicPools).
  revalidate: 3600,
});

// Liste blanche explicite : seuls ces champs quittent le serveur.
function toPublic(record: PublicPoolRecord): PublicPool {
  return {
    slug: record.slug,
    name: record.name,
    address: record.address,
    phones: record.phones,
    chief: record.chief,
  };
}

/** POOL confirmés en base (actifs, avec slug), pour l'accueil et le sitemap. */
export async function getPublicPools(): Promise<PublicPool[]> {
  return (await getPublicPoolRecords()).map(toPublic);
}

export type PublicPoolPage =
  | { kind: "confirmed"; pool: PublicPool }
  // Ancienne URL publique qu'aucun POOL de la base ne porte encore.
  | { kind: "pending"; slug: string; name: string };

export async function getPublicPoolPage(slug: string): Promise<PublicPoolPage | null> {
  const record = (await getPublicPoolRecords()).find((p) => p.slug === slug);
  if (record) return { kind: "confirmed", pool: toPublic(record) };
  const legacy = LEGACY_POOL_PAGES.find((p) => p.slug === slug);
  return legacy ? { kind: "pending", slug: legacy.slug, name: legacy.name } : null;
}

/** Photo publiable du chef d'un POOL public, ou null. Recontrôle les règles via le cache tagué. */
export async function getPublishableChiefPhoto(slug: string): Promise<string | null> {
  const record = (await getPublicPoolRecords()).find((p) => p.slug === slug);
  if (!record?.chief?.photoPath || !record.chiefUserId) return null;
  const user = await prisma.user.findUnique({ where: { id: record.chiefUserId }, select: { photoUrl: true } });
  return user?.photoUrl ?? null;
}

/**
 * À appeler depuis toute action qui modifie une donnée publiée : fiche ou
 * statut d'un POOL, désignation du chef, photo, statut du compte,
 * autorisation de publication. Expiration immédiate (pas de contenu périmé
 * servi), pour qu'un retrait prenne effet dès la requête suivante.
 */
export function revalidatePublicPools() {
  revalidateTag(PUBLIC_POOLS_TAG, { expire: 0 });
  revalidatePath("/sitemap.xml");
}
