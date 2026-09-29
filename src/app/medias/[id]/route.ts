import { auth } from "@/lib/auth";
import { getServableMedia } from "@/lib/contents";

// Fichiers des contenus (images compressées, PDF). Public seulement si le
// contenu est publié ; sinon réservé aux comptes qui rédigent ou valident
// les contenus de la même organisation (aperçu du back-office).

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response(null, { status: 404 });

  const session = await auth();
  const viewer = session?.user ? { organizationId: session.user.organizationId, permissions: session.user.permissions } : null;
  const media = await getServableMedia(id, viewer);
  if (!media) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  const headers: Record<string, string> = {
    "Content-Type": media.mime,
    // Contenu publié : cache court pour qu'un retrait se propage vite ;
    // brouillon : jamais mis en cache hors du navigateur de l'agent.
    "Cache-Control": media.published ? "public, max-age=300, s-maxage=300" : "private, no-store",
  };
  if (media.mime === "application/pdf") {
    const name = (media.fileName ?? "document.pdf").replace(/[^\w.\- ]+/g, "_");
    headers["Content-Disposition"] = `inline; filename="${name}"`;
  }
  if (!media.published) headers["X-Robots-Tag"] = "noindex";
  return new Response(new Uint8Array(media.data), { headers });
}
