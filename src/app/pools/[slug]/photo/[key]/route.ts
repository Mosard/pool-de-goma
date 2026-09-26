import { getPublishablePhoto } from "@/lib/public-pools";
import { publicThumbnail } from "@/lib/profile-photo";

// Vignette publique d'un agent d'un POOL. La photo reste celle du profil
// (User.photoUrl) ; elle n'est jamais inlinée dans le HTML public : les pages
// référencent cette route, qui revérifie à chaque appel que la photo est
// publiable (compte actif, fonction dans ce POOL, accord et autorisation).

const THUMBNAIL_PX = 320;

export async function GET(_request: Request, ctx: RouteContext<"/pools/[slug]/photo/[key]">) {
  const { slug, key } = await ctx.params;
  const photoUrl = /^[a-f0-9]{16}$/.test(key) ? await getPublishablePhoto(slug, key) : null;
  const thumbnail = photoUrl ? await publicThumbnail(photoUrl, THUMBNAIL_PX) : null;

  if (!thumbnail) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(new Uint8Array(thumbnail.body), {
    headers: {
      "Content-Type": thumbnail.mime,
      // Cache court : un retrait de publication doit se propager vite. La clé
      // de l'URL change avec la photo.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
