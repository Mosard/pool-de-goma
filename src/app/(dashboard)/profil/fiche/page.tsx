import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FicheView } from "@/components/personnel-file/fiche-view";
import { loadFileView, resolveFileContext } from "@/lib/personnel-file/server";

// « Ma fiche personnelle » : la fiche du compte connecté (identifiant de
// session, jamais un paramètre d'adresse), saisie progressive, rubrique par rubrique.
export default async function MaFichePage() {
  const session = await auth();
  if (!session?.user || session.user.awaitingCell) redirect("/login");
  const ctx = await resolveFileContext(session.user.id, session.user.id);
  if (!ctx) notFound();
  const view = await loadFileView(ctx);

  return (
    <div className="space-y-6">
      <Link href="/profil" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
        <ArrowLeft size={14} aria-hidden /> Mon profil
      </Link>
      <PageHeader
        title="Ma fiche personnelle"
        description="Fiche de renseignement de l'agent de l'administration (IGAP). Remplissez-la à votre rythme : chaque rubrique s'enregistre séparément et reste modifiable."
      />
      <FicheView view={view} access={ctx.access} targetId={ctx.targetId} pdfHref="/profil/fiche/pdf" />
    </div>
  );
}
