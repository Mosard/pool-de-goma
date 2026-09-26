import { createHash } from "node:crypto";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLE_KEYS } from "@/lib/rbac-data";
import { LEGACY_POOL_PAGES } from "@/components/homepage/homepage-data";

// Source unique des données publiques des POOL (pages /pools/[slug], liste
// de l'accueil, sitemap, photos). Seuls les champs des types Public* sortent
// de ce module : aucun e-mail ni téléphone de compte, aucun matricule, aucun
// identifiant interne. Les données de démonstration (isDemo) sont exclues.

export const PUBLIC_POOLS_TAG = "public-pools";

export type PublicPerson = {
  // Clé d'affichage stable (non liée à l'identifiant du compte).
  key: string;
  name: string;
  functionLabel: string;
  // Vignette servie par /pools/<slug>/photo/<clé>, ou null → visuel neutre.
  photoPath: string | null;
  // Écoles auxquelles l'inspecteur est actuellement affecté (noms).
  schools: string[];
};

export type PublicSchool = { name: string; address: string | null };

export type PublicPool = {
  slug: string;
  name: string;
  address: string | null;
  officialEmail: string | null;
  // Passage explicite en mode officiel décidé par l'administration
  // (Pool.officialPageSince renseigné).
  officialPage: boolean;
  chief: PublicPerson | null;
  inspectors: PublicPerson[];
  agents: PublicPerson[];
  schools: PublicSchool[];
};

// Version interne (cache serveur uniquement) : correspondance clé photo →
// compte, pour la route photo. Jamais transmise aux composants.
type PublicPoolRecord = PublicPool & { photoOwners: Record<string, string> };

type Member = {
  userId: string;
  name: string;
  identityPublic: boolean;
  photoPublic: boolean;
  photoUpdatedAt: Date | null;
  roles: { key: string; label: string }[];
};

function displayKey(userId: string, photoUpdatedAt: Date | null) {
  return createHash("sha256")
    .update(`${userId}:${photoUpdatedAt?.getTime() ?? 0}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Règles de publication (décisions de l'Inspection) :
 * - POOL : actif, avec un slug attribué ; publiés : nom, adresse officielle,
 *   e-mail institutionnel ;
 * - agent : compte ACTIVE, non démo, titulaire d'une fonction du POOL ; nom
 *   et fonction publiés seulement avec SON accord ET l'autorisation de l'IPP
 *   ou de l'informaticien ; photo seulement avec, en plus, accord et
 *   autorisation propres à la photo ;
 * - chef : l'unique titulaire de chef_pool qui est aussi inspecteur du POOL
 *   (sinon bloc neutre) ;
 * - école : active, non démo ; publiés : nom et adresse ;
 * - affectation affichée : en cours (non terminée, date d'effet atteinte),
 *   école et inspecteur publiables, inspecteur toujours inspecteur du POOL
 *   de l'école, affectation non créée par un compte de démonstration.
 */
async function queryPublicPools(): Promise<PublicPoolRecord[]> {
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!organization) return [];

  const pools = await prisma.pool.findMany({
    where: { organizationId: organization.id, active: true, slug: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, address: true, officialEmail: true, officialPageSince: true },
  });
  if (pools.length === 0) return [];
  const poolIds = pools.map((p) => p.id);
  const now = new Date();

  const [roleRows, schools, assignments] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        poolId: { in: poolIds },
        role: { scope: "POOL" },
        user: { organizationId: organization.id, status: "ACTIVE", isDemo: false },
      },
      select: {
        poolId: true,
        role: { select: { key: true, label: true } },
        user: {
          select: {
            id: true,
            name: true,
            photoUpdatedAt: true,
            publicationConsentIdentity: true,
            publicationAuthIdentity: true,
            publicationConsentPhoto: true,
            publicationAuthPhoto: true,
          },
        },
      },
    }),
    prisma.school.findMany({
      where: { poolId: { in: poolIds }, active: true, isDemo: false },
      orderBy: { name: "asc" },
      select: { id: true, poolId: true, name: true, address: true },
    }),
    prisma.assignment.findMany({
      where: {
        active: true,
        endedAt: null,
        effectiveFrom: { lte: now },
        school: { poolId: { in: poolIds }, active: true, isDemo: false },
        inspector: { status: "ACTIVE", isDemo: false },
        assignedBy: { isDemo: false },
      },
      select: { inspectorId: true, schoolId: true },
    }),
  ]);

  // Photo présente, sans charger les data URL (potentiellement lourdes).
  const photoCandidates = [
    ...new Set(
      roleRows
        .filter(
          (r) =>
            r.user.publicationConsentIdentity &&
            r.user.publicationAuthIdentity &&
            r.user.publicationConsentPhoto &&
            r.user.publicationAuthPhoto
        )
        .map((r) => r.user.id)
    ),
  ];
  const withPhoto = new Set(
    photoCandidates.length === 0
      ? []
      : (
          await prisma.user.findMany({
            where: { id: { in: photoCandidates }, photoUrl: { not: null } },
            select: { id: true },
          })
        ).map((u) => u.id)
  );

  const schoolById = new Map(schools.map((s) => [s.id, s]));

  return pools.map((pool) => {
    const slug = pool.slug as string;

    const members = new Map<string, Member>();
    for (const r of roleRows) {
      if (r.poolId !== pool.id) continue;
      const u = r.user;
      const identityPublic = u.publicationConsentIdentity && u.publicationAuthIdentity;
      const m = members.get(u.id) ?? {
        userId: u.id,
        name: u.name,
        identityPublic,
        photoPublic: identityPublic && u.publicationConsentPhoto && u.publicationAuthPhoto && withPhoto.has(u.id),
        photoUpdatedAt: u.photoUpdatedAt,
        roles: [],
      };
      m.roles.push(r.role);
      members.set(u.id, m);
    }

    const isInspector = (m: Member) => m.roles.some((r) => r.key === ROLE_KEYS.INSPECTEUR);
    const photoOwners: Record<string, string> = {};

    // Affectation publiée seulement si l'inspecteur est (toujours)
    // inspecteur de CE POOL — garanti ici puisqu'on part de ses fonctions.
    const schoolsOf = (userId: string) => {
      const names = new Set<string>();
      for (const a of assignments) {
        if (a.inspectorId !== userId) continue;
        const school = schoolById.get(a.schoolId);
        if (school && school.poolId === pool.id) names.add(school.name);
      }
      return [...names].sort((a, b) => a.localeCompare(b, "fr"));
    };

    const toPerson = (m: Member, labels: string[], withSchools: boolean): PublicPerson => {
      const key = displayKey(m.userId, m.photoUpdatedAt);
      if (m.photoPublic) photoOwners[key] = m.userId;
      return {
        key,
        name: m.name,
        functionLabel: labels.join(", "),
        photoPath: m.photoPublic ? `/pools/${slug}/photo/${key}` : null,
        schools: withSchools ? schoolsOf(m.userId) : [],
      };
    };

    const all = [...members.values()];
    const eligibleChiefs = all.filter((m) => m.roles.some((r) => r.key === ROLE_KEYS.CHEF_POOL) && isInspector(m));
    const chiefMember = eligibleChiefs.length === 1 ? eligibleChiefs[0] : null;
    const chief =
      chiefMember && chiefMember.identityPublic
        ? toPerson(
            chiefMember,
            chiefMember.roles.filter((r) => r.key === ROLE_KEYS.CHEF_POOL).map((r) => r.label),
            true
          )
        : null;

    const byName = (a: Member, b: Member) => a.name.localeCompare(b.name, "fr");
    const published = all.filter((m) => m.identityPublic && m.userId !== chiefMember?.userId).sort(byName);

    const inspectors = published
      .filter(isInspector)
      .map((m) => toPerson(m, m.roles.filter((r) => r.key !== ROLE_KEYS.CHEF_POOL).map((r) => r.label), true));
    const agents = published
      .filter((m) => !isInspector(m))
      .map((m) => {
        const labels = m.roles.filter((r) => r.key !== ROLE_KEYS.CHEF_POOL).map((r) => r.label);
        return labels.length > 0 ? toPerson(m, labels, false) : null;
      })
      .filter((p): p is PublicPerson => p !== null);

    return {
      slug,
      name: pool.name,
      address: pool.address,
      officialEmail: pool.officialEmail,
      officialPage: pool.officialPageSince !== null,
      chief,
      inspectors,
      agents,
      schools: schools.filter((s) => s.poolId === pool.id).map((s) => ({ name: s.name, address: s.address })),
      photoOwners,
    };
  });
}

const getPublicPoolRecords = unstable_cache(queryPublicPools, ["public-pools-v3"], {
  tags: [PUBLIC_POOLS_TAG],
  // Filet de sécurité (ex. une date d'effet atteinte, une modification faite
  // directement en base) : les actions du back-office invalident le cache
  // immédiatement via revalidatePublicPools.
  revalidate: 3600,
});

// Liste blanche explicite : seuls ces champs quittent le serveur.
function toPublic(record: PublicPoolRecord): PublicPool {
  return {
    slug: record.slug,
    name: record.name,
    address: record.address,
    officialEmail: record.officialEmail,
    officialPage: record.officialPage,
    chief: record.chief,
    inspectors: record.inspectors,
    agents: record.agents,
    schools: record.schools,
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

/** Photo publiable d'un agent d'un POOL public (par sa clé d'affichage), ou null. */
export async function getPublishablePhoto(slug: string, key: string): Promise<string | null> {
  const record = (await getPublicPoolRecords()).find((p) => p.slug === slug);
  const userId = record?.photoOwners[key];
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true } });
  return user?.photoUrl ?? null;
}

/**
 * À appeler depuis toute action qui modifie une donnée publiée : fiche ou
 * statut d'un POOL, fonctions et chef, photo, statut d'un compte, accord ou
 * autorisation de publication, écoles, affectations. Expiration immédiate
 * (pas de contenu périmé servi) : un retrait prend effet dès la requête
 * suivante.
 */
export function revalidatePublicPools() {
  revalidateTag(PUBLIC_POOLS_TAG, { expire: 0 });
  revalidatePath("/sitemap.xml");
}
