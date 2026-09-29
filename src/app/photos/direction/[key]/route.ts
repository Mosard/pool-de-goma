import { getPublishableDirectionPhoto } from "@/lib/public-direction";
import { publicThumbnail } from "@/lib/profile-photo";

// Vignette publique d'un membre de la Direction de l'Inspection. Même principe
// que /pools/[slug]/photo/[key] : la photo reste celle du profil, et cette
// route revérifie à chaque appel qu'elle est publiable (compte actif, fonction,
// accord et autorisation de la photo).

const THUMBNAIL_PX = 384;

export async function GET(_request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const photoUrl = /^[a-f0-9]{16}$/.test(key) ? await getPublishableDirectionPhoto(key) : null;
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
