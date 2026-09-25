import { getPublishableChiefPhoto } from "@/lib/public-pools";
import { publicThumbnail } from "@/lib/profile-photo";

// Vignette publique du Chef de POOL. La photo reste stockée en base (data
// URL) ; elle n'est jamais inlinée dans le HTML public : les pages
// référencent cette route, qui revérifie à chaque appel que la photo est
// publiable (compte actif, fonction attribuée, publication autorisée).

const THUMBNAIL_PX = 384;

export async function GET(_request: Request, ctx: RouteContext<"/pools/[slug]/photo-chef">) {
  const { slug } = await ctx.params;
  const photoUrl = await getPublishableChiefPhoto(slug);
  const thumbnail = photoUrl ? await publicThumbnail(photoUrl, THUMBNAIL_PX) : null;

  if (!thumbnail) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(new Uint8Array(thumbnail.body), {
    headers: {
      "Content-Type": thumbnail.mime,
      // Cache court : un retrait de publication doit se propager vite. L'URL
      // porte une version (?v=) qui change avec la photo ou le titulaire.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
