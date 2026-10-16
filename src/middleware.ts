import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Uses the edge-safe config (no providers/Prisma/bcrypt) so this middleware
// stays under the Edge Function size limit — see auth.config.ts.
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = [
  "/login",
  "/demande-de-compte",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/activer-compte",
  "/pools",
  // Actualités publiées et leurs fichiers (la route /medias revérifie le statut).
  "/actualites",
  "/medias/",
  // Vignettes publiques de la Direction de l'Inspection (revérifiées par la route).
  "/photos/direction/",
  "/inuka-tech",
  // Recherche publique des diplômes : aucun compte requis.
  "/diplomes",
  // Réception des pointeuses : authentification technique par jeton, contrôlée
  // dans chaque route (src/app/api/presence/v1/*), jamais par session.
  "/api/presence/v1/",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Pointeuses ADMS (/iclock/*, /p/<secret>/iclock/*) : exclues du matcher —
// aucune session ni redirection, et pas d'appel à auth() à chaque
// interrogation ; les contrôles sont faits dans src/lib/presence/adms/handler.ts.
export const config = {
  matcher: ["/((?!api/auth|iclock/|p/[^/]+/iclock/|_next/static|_next/image|favicon.ico|robots\\.txt$|sitemap\\.xml$|.*\\.(?:svg|png|jpg|jpeg|webp)).*)"],
};
