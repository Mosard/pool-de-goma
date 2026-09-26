import { getPublicPoolPage, getPublicPools, type PublicPerson, type PublicPool } from "@/lib/public-pools";
import { DEMO_POOL_SHOWCASES } from "@/lib/pool-demo";
import { LEGACY_POOL_PAGES } from "@/components/homepage/homepage-data";

// Modèle d'affichage unique des pages POOL (bloc du chef, cartes de
// l'équipe, liste latérale des écoles). Il est alimenté SOIT par les données
// officielles (src/lib/public-pools.ts), SOIT par une maquette de
// démonstration (src/lib/pool-demo) — jamais par un mélange des deux.

export type ShowcasePerson = {
  key: string;
  name: string;
  functionLabel: string;
  // Chemin d'image (route photo officielle ou portrait fictif), ou null →
  // visuel neutre.
  photo: string | null;
  schools: string[];
};

export type ShowcaseSchool = { name: string; address: string | null };

export type PoolShowcase = {
  // "demo" : maquette avec données et portraits FICTIFS, signalée comme telle.
  mode: "official" | "demo";
  slug: string;
  name: string;
  address: string | null;
  email: string | null;
  chief: ShowcasePerson | null;
  // Inspecteurs itinérants d'abord, puis les autres agents.
  staff: ShowcasePerson[];
  schools: ShowcaseSchool[];
};

function fromPerson(p: PublicPerson): ShowcasePerson {
  return { key: p.key, name: p.name, functionLabel: p.functionLabel, photo: p.photoPath, schools: p.schools };
}

function fromPublicPool(pool: PublicPool): PoolShowcase {
  return {
    mode: "official",
    slug: pool.slug,
    name: pool.name,
    address: pool.address,
    email: pool.officialEmail,
    chief: pool.chief ? fromPerson(pool.chief) : null,
    staff: [...pool.inspectors, ...pool.agents].map(fromPerson),
    schools: pool.schools,
  };
}

/**
 * La maquette d'un POOL n'est remplacée par les données officielles que sur
 * décision EXPLICITE de l'administration (Pool.officialPageSince), jamais
 * automatiquement parce qu'une école ou un agent vient d'être publié.
 */
function showsDemo(pool: PublicPool | null, slug: string) {
  return Boolean(DEMO_POOL_SHOWCASES[slug]) && !pool?.officialPage;
}

export type ResolvedPoolPage = {
  showcase: PoolShowcase;
  // false : URL existante dont la fiche n'est pas encore confirmée en base.
  confirmed: boolean;
};

/**
 * Règle de choix (sans mélange) :
 * 1. POOL disposant d'une maquette et pas encore passé en mode officiel →
 *    maquette entière (fictive, signalée, non indexée), même si des données
 *    officielles existent déjà ;
 * 2. POOL confirmé (passé en mode officiel, ou sans maquette) → données
 *    officielles uniquement, blocs vides « à publier » si besoin ;
 * 3. URL existante non confirmée → modèle officiel vide.
 */
export async function resolvePoolPage(slug: string): Promise<ResolvedPoolPage | null> {
  const page = await getPublicPoolPage(slug);
  const confirmedPool = page?.kind === "confirmed" ? page.pool : null;
  const confirmed = page?.kind === "confirmed";

  if (showsDemo(confirmedPool, slug)) return { showcase: DEMO_POOL_SHOWCASES[slug], confirmed };
  if (confirmedPool) return { showcase: fromPublicPool(confirmedPool), confirmed };
  if (page?.kind === "pending") {
    return {
      showcase: { mode: "official", slug, name: page.name, address: null, email: null, chief: null, staff: [], schools: [] },
      confirmed: false,
    };
  }
  return null;
}

export type PoolCard = {
  slug: string;
  name: string;
  chief: ShowcasePerson | null;
  // "pending" : URL existante dont la fiche n'est pas encore confirmée en base.
  mode: PoolShowcase["mode"] | "pending";
};

/**
 * POOL présentés sur l'accueil et entre les pages POOL : ceux confirmés en
 * base, les maquettes (signalées) et les autres POOL déjà connus du site,
 * affichés « en cours de confirmation ». Seules les cartes officielles
 * montrent une personne : une maquette ou une fiche en attente affiche un
 * visuel neutre, jamais une personne fictive.
 * Ordre : celui de la liste historique du site, puis les autres POOL
 * confirmés par ordre alphabétique.
 */
export async function getPoolCards(): Promise<PoolCard[]> {
  const pools = await getPublicPools();
  const cards: PoolCard[] = pools.map((pool) => {
    const isDemo = showsDemo(pool, pool.slug);
    return {
      slug: pool.slug,
      name: pool.name,
      chief: isDemo || !pool.chief ? null : fromPerson(pool.chief),
      mode: isDemo ? "demo" : "official",
    };
  });
  for (const demo of Object.values(DEMO_POOL_SHOWCASES)) {
    if (!cards.some((c) => c.slug === demo.slug)) {
      cards.push({ slug: demo.slug, name: demo.name, chief: null, mode: "demo" });
    }
  }
  for (const legacy of LEGACY_POOL_PAGES) {
    if (!cards.some((c) => c.slug === legacy.slug)) {
      cards.push({ slug: legacy.slug, name: legacy.name, chief: null, mode: "pending" });
    }
  }
  const order = (slug: string) => {
    const i = LEGACY_POOL_PAGES.findIndex((p) => p.slug === slug);
    return i === -1 ? LEGACY_POOL_PAGES.length : i;
  };
  return cards.sort((a, b) => order(a.slug) - order(b.slug) || a.name.localeCompare(b.name, "fr"));
}

/** Slugs à proposer à l'indexation : POOL confirmés qui n'affichent pas une maquette. */
export async function getIndexablePoolSlugs(): Promise<string[]> {
  return (await getPoolCards()).filter((c) => c.mode === "official").map((c) => c.slug);
}
