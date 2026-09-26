import { getPublicPoolPage, getPublicPools, type PublicPerson, type PublicPool } from "@/lib/public-pools";
import { DEMO_POOL_SHOWCASES } from "@/lib/pool-demo";

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

/** Au moins une information de personnel ou d'école officiellement publiée. */
function hasOfficialContent(s: PoolShowcase) {
  return Boolean(s.chief) || s.staff.length > 0 || s.schools.length > 0;
}

export type ResolvedPoolPage = {
  showcase: PoolShowcase;
  // false : URL existante dont la fiche n'est pas encore confirmée en base.
  confirmed: boolean;
};

/**
 * Règle de choix (sans mélange) :
 * 1. POOL confirmé avec du contenu officiel publié → données officielles ;
 * 2. sinon, si une maquette existe pour ce slug → maquette (entièrement
 *    fictive, signalée, non indexée) ;
 * 3. sinon → modèle officiel avec les informations disponibles (blocs vides
 *    « à publier »).
 * Dès que du contenu officiel est publié, la maquette cesse d'être utilisée.
 */
export async function resolvePoolPage(slug: string): Promise<ResolvedPoolPage | null> {
  const page = await getPublicPoolPage(slug);
  const demo = DEMO_POOL_SHOWCASES[slug];
  const official = page?.kind === "confirmed" ? fromPublicPool(page.pool) : null;
  const confirmed = page?.kind === "confirmed";

  if (official && hasOfficialContent(official)) return { showcase: official, confirmed };
  if (demo) return { showcase: demo, confirmed };
  if (official) return { showcase: official, confirmed };
  if (page?.kind === "pending") {
    return {
      showcase: { mode: "official", slug, name: page.name, address: null, email: null, chief: null, staff: [], schools: [] },
      confirmed: false,
    };
  }
  return null;
}

export type PoolCard = { slug: string; name: string; chief: ShowcasePerson | null; mode: PoolShowcase["mode"] };

/**
 * POOL présentés sur l'accueil et entre les pages POOL : ceux confirmés en
 * base, plus les maquettes (signalées). Les cartes d'une maquette n'affichent
 * aucune personne fictive (chef neutre + mention « Maquette »).
 */
export async function getPoolCards(): Promise<PoolCard[]> {
  const pools = await getPublicPools();
  const cards: PoolCard[] = pools.map((pool) => {
    const official = fromPublicPool(pool);
    const isDemo = !hasOfficialContent(official) && Boolean(DEMO_POOL_SHOWCASES[pool.slug]);
    return { slug: pool.slug, name: pool.name, chief: isDemo ? null : official.chief, mode: isDemo ? "demo" : "official" };
  });
  for (const demo of Object.values(DEMO_POOL_SHOWCASES)) {
    if (!cards.some((c) => c.slug === demo.slug)) {
      cards.push({ slug: demo.slug, name: demo.name, chief: null, mode: "demo" });
    }
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Slugs à proposer à l'indexation : POOL confirmés qui n'affichent pas une maquette. */
export async function getIndexablePoolSlugs(): Promise<string[]> {
  return (await getPoolCards()).filter((c) => c.mode === "official").map((c) => c.slug);
}
