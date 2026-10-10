// Rafraîchissement léger des vues ouvertes (~30 s) : renvoie seulement un
// curseur de changements ; la page se recharge si le curseur a changé. Session
// utilisateur exigée et droits relus ; aucune donnée de présence ici.

import { auth } from "@/lib/auth";
import { loadChangeCursor, loadPresenceViewer } from "@/lib/presence/views";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Connexion requise.", { status: 401 });
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) return new Response("Compte inactif.", { status: 403 });
  return Response.json({ cursor: await loadChangeCursor(viewer.organizationId) }, { headers: { "cache-control": "no-store" } });
}
