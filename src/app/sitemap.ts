import type { MetadataRoute } from "next";
import { getIndexablePoolSlugs } from "@/lib/pool-showcase";

const BASE_URL = "https://ippnk1.online";

// Régénéré au plus toutes les heures, et immédiatement après une modification
// d'un POOL depuis le back-office (revalidatePublicPools).
export const revalidate = 3600;

// Only public pages meant to be indexed — no login, account or dashboard routes.
// POOL : uniquement ceux confirmés en base qui affichent des données
// officielles (jamais une maquette fictive).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getIndexablePoolSlugs();
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/inuka-tech`, changeFrequency: "monthly", priority: 0.8 },
    ...slugs.map((slug) => ({
      url: `${BASE_URL}/pools/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
