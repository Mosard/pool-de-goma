import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadPresenceViewer } from "@/lib/presence/views";

// Entrée de l'espace : la vue du jour pour qui peut voir d'autres personnes, sinon « Ma présence ».
export default async function PresenceIndex() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  redirect(viewer && viewer.scope.kind !== "self" ? "/presence/aujourdhui" : "/presence/moi");
}
