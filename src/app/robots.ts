import type { MetadataRoute } from "next";

// Private areas: API routes and every page of the (dashboard) route group.
const PRIVATE_PATHS = [
  "/api/",
  "/affectations",
  "/audit",
  "/comptes",
  "/dashboard",
  "/ecoles",
  "/inspecteurs",
  "/inspections",
  "/parametres",
  "/profil",
  "/rapports",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: "https://ippnk1.online/sitemap.xml",
  };
}
