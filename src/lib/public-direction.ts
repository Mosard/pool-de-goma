import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLE_KEYS } from "@/lib/rbac-data";
import { PUBLIC_POOLS_TAG } from "@/lib/public-pools";

// Données publiques de la section « Direction de l'Inspection » (accueil).
// Même règles et même étiquette de cache que les POOL (src/lib/public-pools.ts) :
// toute action qui modifie une donnée publiée appelle revalidatePublicPools(),
// qui rafraîchit aussi cette section (accord, autorisation, photo, statut du
// compte, attributions). Seuls les champs des types Public* quittent ce module.

export type PublicDirectionPerson = {
  key: string;
  name: string;
  // Vignette servie par /photos/direction/<clé>, ou null → visuel neutre.
  photoPath: string | null;
};

export type PublicDirectionCard =
  // Adjoint publié, avec ses attributions réellement saisies (peut être vide).
  | { kind: "person"; person: PublicDirectionPerson; attributions: string[] }
  // Attribution saisie sans titulaire publié : place neutre, libellé seul.
  | { kind: "vacant"; key: string; attribution: string };

export type PublicDirection = {
  // null : aucun IPP principal publiable (bloc neutre).
  ipp: PublicDirectionPerson | null;
  adjoints: PublicDirectionCard[];
};

type Candidate = {
  id: string;
  name: string;
  photoUpdatedAt: Date | null;
  identityPublic: boolean;
  photoPublic: boolean;
};

function displayKey(userId: string, photoUpdatedAt: Date | null) {
  return createHash("sha256")
    .update(`direction:${userId}:${photoUpdatedAt?.getTime() ?? 0}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Règles (décisions de l'Inspection) :
 * - personne affichée : compte ACTIVE, non démo, titulaire RÉEL de la fonction
 *   (ipp pour l'IPP principal, ipa pour un adjoint) ; nom et fonction publiés
 *   seulement avec SON accord ET l'autorisation d'un compte habilité ; photo
 *   seulement avec, en plus, accord et autorisation propres à la photo ;
 * - IPP principal : un seul titulaire éligible, sinon bloc neutre ;
 * - attribution : affichée seulement si elle a été saisie ; sans titulaire
 *   publié, place neutre (libellé seul, jamais de nom ni de portrait).
 */
/** Ligne source : une fonction (ipp / ipa) d'un compte, avec ses indicateurs de publication. */
export type DirectionSourceRow = {
  roleKey: string;
  user: {
    id: string;
    name: string;
    status: string;
    isDemo: boolean;
    photoUpdatedAt: Date | null;
    hasPhoto: boolean;
    publicationConsentIdentity: boolean;
    publicationAuthIdentity: boolean;
    publicationConsentPhoto: boolean;
    publicationAuthPhoto: boolean;
  };
};

/**
 * Calcul PUR de la section publique à partir des fonctions et des
 * attributions (testable sans base). Revérifie aussi compte actif et non
 * démo, même si la requête les filtre déjà.
 */
export function buildPublicDirection(
  rows: DirectionSourceRow[],
  attributions: { id: string; label: string; holderId: string | null }[]
): PublicDirection & { photoOwners: Record<string, string> } {
  const eligible = rows.filter((r) => r.user.status === "ACTIVE" && !r.user.isDemo);

  const toCandidate = (u: DirectionSourceRow["user"]): Candidate => {
    const identityPublic = u.publicationConsentIdentity && u.publicationAuthIdentity;
    return {
      id: u.id,
      name: u.name,
      photoUpdatedAt: u.photoUpdatedAt,
      identityPublic,
      photoPublic: identityPublic && u.publicationConsentPhoto && u.publicationAuthPhoto && u.hasPhoto,
    };
  };
  const holdersOf = (roleKey: string) => {
    const byId = new Map<string, Candidate>();
    for (const r of eligible) if (r.roleKey === roleKey) byId.set(r.user.id, toCandidate(r.user));
    return byId;
  };

  const photoOwners: Record<string, string> = {};
  const toPerson = (c: Candidate): PublicDirectionPerson => {
    const key = displayKey(c.id, c.photoUpdatedAt);
    if (c.photoPublic) photoOwners[key] = c.id;
    return { key, name: c.name, photoPath: c.photoPublic ? `/photos/direction/${key}` : null };
  };

  const ippHolders = [...holdersOf(ROLE_KEYS.IPP).values()];
  const ipp = ippHolders.length === 1 && ippHolders[0].identityPublic ? toPerson(ippHolders[0]) : null;

  const published = new Map([...holdersOf(ROLE_KEYS.IPA)].filter(([, c]) => c.identityPublic));

  // Une carte par adjoint publié (à la place de sa première attribution),
  // puis les places neutres, puis les adjoints publiés sans attribution.
  const adjoints: PublicDirectionCard[] = [];
  const placed = new Map<string, Extract<PublicDirectionCard, { kind: "person" }>>();
  for (const a of attributions) {
    const holder = a.holderId ? published.get(a.holderId) : undefined;
    if (!holder) {
      adjoints.push({ kind: "vacant", key: `place-${a.id}`, attribution: a.label });
      continue;
    }
    const existing = placed.get(holder.id);
    if (existing) {
      existing.attributions.push(a.label);
    } else {
      const card = { kind: "person" as const, person: toPerson(holder), attributions: [a.label] };
      placed.set(holder.id, card);
      adjoints.push(card);
    }
  }
  const withoutAttribution = [...published.values()]
    .filter((c) => !placed.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  for (const c of withoutAttribution) adjoints.push({ kind: "person", person: toPerson(c), attributions: [] });

  return { ipp, adjoints, photoOwners };
}

async function queryPublicDirection(): Promise<PublicDirection & { photoOwners: Record<string, string> }> {
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!organization) return { ipp: null, adjoints: [], photoOwners: {} };

  const [roleRows, attributions] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        role: { key: { in: [ROLE_KEYS.IPP, ROLE_KEYS.IPA] } },
        user: { organizationId: organization.id, status: "ACTIVE", isDemo: false },
      },
      select: {
        role: { select: { key: true } },
        user: {
          select: {
            id: true,
            name: true,
            status: true,
            isDemo: true,
            photoUpdatedAt: true,
            publicationConsentIdentity: true,
            publicationAuthIdentity: true,
            publicationConsentPhoto: true,
            publicationAuthPhoto: true,
          },
        },
      },
    }),
    prisma.directionAttribution.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ position: "asc" }, { label: "asc" }],
      select: { id: true, label: true, holderId: true },
    }),
  ]);

  // Photo présente, sans charger les data URL (potentiellement lourdes).
  const userIds = [...new Set(roleRows.map((r) => r.user.id))];
  const withPhoto = new Set(
    userIds.length === 0
      ? []
      : (await prisma.user.findMany({ where: { id: { in: userIds }, photoUrl: { not: null } }, select: { id: true } })).map(
          (u) => u.id
        )
  );

  return buildPublicDirection(
    roleRows.map((r) => ({ roleKey: r.role.key, user: { ...r.user, hasPhoto: withPhoto.has(r.user.id) } })),
    attributions
  );
}

const getPublicDirectionRecord = unstable_cache(queryPublicDirection, ["public-direction-v1"], {
  tags: [PUBLIC_POOLS_TAG],
  // Filet de sécurité (ex. une fonction modifiée directement en base).
  revalidate: 3600,
});

export async function getPublicDirection(): Promise<PublicDirection> {
  const { ipp, adjoints } = await getPublicDirectionRecord();
  return { ipp, adjoints };
}

/** Photo publiable d'un membre de la Direction (par sa clé d'affichage), ou null. */
export async function getPublishableDirectionPhoto(key: string): Promise<string | null> {
  const userId = (await getPublicDirectionRecord()).photoOwners[key];
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true } });
  return user?.photoUrl ?? null;
}
