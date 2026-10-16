// Réponse PDF d'une fiche individuelle, commune à « Ma fiche » et à la fiche
// d'un agent : droits relus à chaque appel, hors périmètre = 404 (rien n'est
// révélé), aucun export en bascule de consultation, export journalisé.

import { auth } from "@/lib/auth";
import { assertNotReadOnly } from "@/lib/prisma";
import { READ_ONLY_MESSAGE } from "@/lib/errors";
import { buildPersonnelFilePdf } from "@/lib/exports/personnel-file-pdf";
import { loadFileView, resolveFileContext } from "./server";

export async function personnelFilePdfResponse(targetId: "self" | string): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("Connexion requise.", { status: 401 });
  try {
    await assertNotReadOnly();
  } catch {
    return new Response(READ_ONLY_MESSAGE, { status: 403 });
  }
  if (session.user.awaitingCell) return new Response("Compte en attente d'affectation à une cellule.", { status: 403 });
  const ctx = await resolveFileContext(session.user.id, targetId === "self" ? session.user.id : targetId);
  if (!ctx || !ctx.access.pdf) return new Response("Fiche introuvable.", { status: 404 });
  const view = await loadFileView(ctx, { audit: "pdf" });
  const { body, filename } = await buildPersonnelFilePdf(view);
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
