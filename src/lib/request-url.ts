import { headers } from "next/headers";

/**
 * Adresse publique du site, pour les liens envoyés aux titulaires de compte.
 * AUTH_URL / NEXTAUTH_URL priment ; à défaut, l'hôte de la requête en cours
 * (Vercel renseigne x-forwarded-host / x-forwarded-proto).
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
