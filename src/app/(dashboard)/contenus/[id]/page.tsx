import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Send, Trash2, Undo2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ContentArticle } from "@/components/content-article";
import { canPublishContents, canWriteContents } from "@/lib/contents";
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_COLORS,
  CONTENT_STATUS_LABELS,
  EDITABLE_STATUSES,
  type ContentStatusKey,
} from "@/lib/content-meta";
import { deleteContentAction, reclaimContentAction, submitContentAction } from "../actions";
import { ContentEditor } from "../content-editor";
import { ReviewPanel, UnpublishPanel } from "../review-panel";

export default async function ContenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const session = await auth();
  const user = session!.user;
  const canWrite = canWriteContents(user.permissions);
  const canPublish = canPublishContents(user.permissions);
  const { id } = await params;
  const { erreur } = await searchParams;

  const content = await prisma.content.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      kind: true,
      status: true,
      title: true,
      slug: true,
      summary: true,
      body: true,
      authorId: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      publishedAt: true,
      author: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      media: {
        where: { role: { in: ["COVER", "ATTACHMENT"] } },
        select: { id: true, role: true, alt: true, fileName: true, size: true },
      },
    },
  });
  const isAuthor = content?.authorId === user.id;
  // Rédacteur : ses contenus ; valideur : tous ceux de l'organisation.
  if (!content || !((canWrite && isAuthor) || canPublish)) notFound();

  const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { isDemo: true } });
  const isOfficial = actor?.isDemo === false;
  const status = content.status as ContentStatusKey;
  const cover = content.media.find((m) => m.role === "COVER") ?? null;
  const attachment = content.media.find((m) => m.role === "ATTACHMENT") ?? null;
  const editable = isAuthor && canWrite && isOfficial && EDITABLE_STATUSES.includes(status);
  const fmt = (d: Date) => d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

  return (
    <div className="space-y-6">
      <PageHeader
        title={content.title}
        description={`${CONTENT_KIND_LABELS[content.kind]} — par ${content.author.name}`}
        actions={
          <Link href="/contenus" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Retour aux contenus
          </Link>
        }
      />

      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Badge color={CONTENT_STATUS_COLORS[status]}>{CONTENT_STATUS_LABELS[status]}</Badge>
        {content.submittedAt && <span className="text-gray-500">Soumis le {fmt(content.submittedAt)}</span>}
        {content.publishedAt && <span className="text-gray-500">Publié le {fmt(content.publishedAt)}</span>}
        {content.reviewedBy && content.reviewedAt && (
          <span className="text-gray-500">
            Dernière décision : {content.reviewedBy.name}, {fmt(content.reviewedAt)}
          </span>
        )}
        {status === "PUBLIE" && (
          <Link
            href={`/actualites/${content.slug}`}
            target="_blank"
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
          >
            Voir sur le site <ExternalLink size={14} aria-hidden />
          </Link>
        )}
      </Card>

      {!isOfficial && <Alert variant="info">Compte de démonstration : consultation seulement.</Alert>}
      {erreur === "texte" && <Alert variant="error">Le texte est vide : rédigez le contenu avant de le soumettre.</Alert>}
      {content.reviewNote && (status === "A_CORRIGER" || status === "RETIRE") && (
        <Alert variant={status === "A_CORRIGER" ? "error" : "info"}>
          {status === "A_CORRIGER" ? "Correction demandée" : "Motif du retrait"} : {content.reviewNote}
        </Alert>
      )}

      {/* Auteur : édition, soumission, suppression */}
      {editable && (
        <>
          <ContentEditor
            content={{
              id: content.id,
              kind: content.kind,
              title: content.title,
              summary: content.summary,
              body: content.body,
              cover: cover ? { id: cover.id, alt: cover.alt } : null,
              attachment: attachment ? { id: attachment.id, fileName: attachment.fileName } : null,
            }}
          />
          <Card className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-sm font-semibold text-gray-900">Prêt à paraître ?</p>
              <p className="text-xs text-gray-500">
                Enregistrez d&apos;abord vos modifications. La soumission prévient l&apos;IPP, les IPP adjoints et
                l&apos;informaticien, qui valident avant la mise en ligne.
              </p>
            </div>
            <ConfirmButton
              label="Soumettre pour validation"
              confirmLabel="Soumettre"
              icon={<Send size={16} aria-hidden />}
              className="!min-h-0 px-4 py-2"
              formAction={submitContentAction.bind(null, content.id)}
            />
            {!content.publishedAt && (
              <ConfirmButton
                label="Supprimer le brouillon"
                confirmLabel="Supprimer définitivement"
                variant="danger"
                icon={<Trash2 size={16} aria-hidden />}
                className="!min-h-0 px-4 py-2"
                formAction={deleteContentAction.bind(null, content.id)}
              />
            )}
          </Card>
        </>
      )}

      {isAuthor && canWrite && isOfficial && status === "SOUMIS" && (
        <Card className="flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-gray-600">
            En attente de validation. Pour modifier le contenu, reprenez-le en brouillon.
          </p>
          <ConfirmButton
            label="Reprendre pour modifier"
            confirmLabel="Reprendre"
            variant="secondary"
            icon={<Undo2 size={16} aria-hidden />}
            className="!min-h-0 px-4 py-2"
            formAction={reclaimContentAction.bind(null, content.id)}
          />
        </Card>
      )}

      {/* Valideur : décision (jamais sur son propre contenu) */}
      {canPublish && isOfficial && status === "SOUMIS" && !isAuthor && <ReviewPanel contentId={content.id} />}
      {canPublish && isOfficial && status === "SOUMIS" && isAuthor && (
        <Alert variant="info">Vous êtes l&apos;auteur de ce contenu : un autre compte habilité doit le valider.</Alert>
      )}
      {canPublish && isOfficial && status === "PUBLIE" && (
        <Card>
          <UnpublishPanel contentId={content.id} />
        </Card>
      )}

      {!editable && (
        <Card className="px-5 py-8 sm:px-10">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Aperçu tel qu&apos;il paraîtra
          </p>
          <ContentArticle
            content={{
              kind: content.kind,
              title: content.title,
              summary: content.summary,
              body: content.body,
              date: (content.publishedAt ?? content.submittedAt)?.toISOString() ?? null,
              cover: cover ? { id: cover.id, alt: cover.alt } : null,
              attachment: attachment ? { id: attachment.id, fileName: attachment.fileName, size: attachment.size } : null,
            }}
          />
        </Card>
      )}
    </div>
  );
}
