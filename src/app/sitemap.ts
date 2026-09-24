import type { MetadataRoute } from "next";
import { POOLS } from "@/components/homepage/homepage-data";

const BASE_URL = "https://ippnk1.online";

// Only public pages meant to be indexed — no login, account or dashboard routes.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/inuka-tech`, changeFrequency: "monthly", priority: 0.8 },
    ...POOLS.map((pool) => ({
      url: `${BASE_URL}/pools/${pool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
