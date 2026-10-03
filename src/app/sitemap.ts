import type { MetadataRoute } from "next";
import { getIndexablePoolSlugs } from "@/lib/pool-showcase";
import { getPublishedSlugs, publicCutoff } from "@/lib/contents";

const BASE_URL = "https://ippnk1.online";

// Régénéré au plus toutes les heures, et immédiatement après une modification
// d'un POOL (revalidatePublicPools) ou d'une publication (revalidatePublicContents).
export const revalidate = 3600;

// Only public pages meant to be indexed — no login, account or dashboard routes.
// POOL : uniquement ceux confirmés en base qui affichent des données
// officielles (jamais une maquette fictive). Contenus : seulement publiés.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, contents] = await Promise.all([getIndexablePoolSlugs(), getPublishedSlugs(publicCutoff())]);
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/actualites`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/inuka-tech`, changeFrequency: "monthly", priority: 0.8 },
    ...slugs.map((slug) => ({
      url: `${BASE_URL}/pools/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...contents.map((c) => ({
      url: `${BASE_URL}/actualites/${c.slug}`,
      lastModified: c.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
