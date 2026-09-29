import { FileDown } from "lucide-react";
import { renderContentBody } from "@/lib/content-markup";
import { CONTENT_KIND_LABELS, type ContentKindKey } from "@/lib/content-meta";

// Présentation d'un contenu (actualité, article, communiqué), identique dans
// l'aperçu du back-office et sur la page publique.

export type ArticleView = {
  kind: ContentKindKey;
  title: string;
  summary: string;
  body: string;
  date: string | null;
  cover: { id: string; alt: string | null } | null;
  attachment: { id: string; fileName: string | null; size: number } | null;
};

export function formatContentDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lubumbashi" });
}

export function ContentArticle({ content }: { content: ArticleView }) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        {CONTENT_KIND_LABELS[content.kind]}
        {content.date && <span className="font-normal normal-case tracking-normal text-gray-500"> · {formatContentDate(content.date)}</span>}
      </p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-gray-900 sm:text-4xl">{content.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">{content.summary}</p>
      {content.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- image servie par /medias, déjà compressée
        <img
          src={`/medias/${content.cover.id}`}
          alt={content.cover.alt ?? ""}
          className="mt-8 aspect-[16/9] w-full rounded-2xl bg-gray-100 object-cover"
        />
      )}
      <div className="mt-6 text-[15px] text-gray-700 sm:text-base">{renderContentBody(content.body)}</div>
      {content.attachment && (
        <a
          href={`/medias/${content.attachment.id}`}
          target="_blank"
          rel="noopener"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-blue-300 hover:text-blue-700"
        >
          <FileDown size={16} aria-hidden />
          {content.attachment.fileName ?? "Télécharger le document"}
          <span className="text-xs text-gray-400">({Math.max(1, Math.round(content.attachment.size / 1024))} Ko, PDF)</span>
        </a>
      )}
    </article>
  );
}
