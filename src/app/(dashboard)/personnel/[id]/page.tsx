import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, Badge, PageHeader } from "@/components/ui";
import { FicheView } from "@/components/personnel-file/fiche-view";
import { SEARCH_SELECT, STATUS_LABELS, functionLabels } from "@/lib/personnel/record";
import { loadFileView, resolveFileContext } from "@/lib/personnel-file/server";

// Fiche individuelle d'un agent (formulaire IGAP) pour les profils habilités :
// lecture (personnel.records.read_all), modification et observations
// (personnel.records.edit_all). Droits relus à chaque ouverture ; hors
// périmètre, la fiche est « introuvable » (même réponse qu'une fiche inexistante).
// Consultation journalisée. Les fonctions et l'affectation affichées en tête
// sont celles de l'application, jamais celles déclarées dans la fiche.
export default async function PersonnelRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.awaitingCell) redirect("/login");
  const { id } = await params;
  if (id === session.user.id) redirect("/profil/fiche");
  const ctx = await resolveFileContext(session.user.id, id);
  if (!ctx) notFound();
  const [view, assignment] = await Promise.all([
    loadFileView(ctx, { audit: "view" }),
    prisma.user.findUniqueOrThrow({ where: { id: ctx.targetId }, select: SEARCH_SELECT }),
  ]);
  const functions = functionLabels(assignment);

  return (
    <div className="space-y-6">
      <Link href="/personnel" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
        <ArrowLeft size={14} aria-hidden /> Fiches du personnel
      </Link>
      <PageHeader
        title={view.user.name}
        description={ctx.access.edit ? "Fiche individuelle — consultation et modification (chaque changement est journalisé)." : "Fiche individuelle — consultation seule."}
      />
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <Avatar name={view.user.name} src={view.user.photoUrl} className="h-14 w-14" />
        <div className="min-w-0 flex-1 text-sm">
          <Badge color={view.user.status === "ACTIVE" ? "green" : "gray"}>{STATUS_LABELS[view.user.status] ?? view.user.status}</Badge>
          <p className="mt-1.5 text-xs text-gray-500">Fonctions dans l&apos;application</p>
          <p className="text-pretty text-gray-900">{functions.length ? functions.join(" · ") : "Aucune fonction"}</p>
        </div>
      </div>
      <FicheView view={view} access={ctx.access} targetId={ctx.targetId} pdfHref={`/personnel/${ctx.targetId}/fiche/pdf`} />
    </div>
  );
}
