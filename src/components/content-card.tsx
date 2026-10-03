import Link from "next/link";
import { Images, Newspaper, Star } from "lucide-react";
import { CONTENT_KIND_LABELS, categoryLabel } from "@/lib/content-meta";
import type { PublicContentCard } from "@/lib/contents";
import { formatContentDate } from "./content-article";

/** Carte d'un contenu publié (accueil, page Actualités). */
export function ContentCard({ item }: { item: PublicContentCard }) {
  const category = categoryLabel(item.category);
  return (
    <Link
      href={`/actualites/${item.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg"
    >
      <div className="relative">
        {item.coverId ? (
          // eslint-disable-next-line @next/next/no-img-element -- image servie par /medias, déjà compressée
          <img
            src={`/medias/${item.coverId}`}
            alt={item.coverAlt ?? ""}
            loading="lazy"
            className="aspect-[16/9] w-full bg-gray-100 object-cover"
          />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 text-blue-300">
            {item.kind === "GALERIE" ? (
              <Images size={36} strokeWidth={1.5} aria-hidden />
            ) : (
              <Newspaper size={36} strokeWidth={1.5} aria-hidden />
            )}
          </div>
        )}
        {item.pinned && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow">
            <Star size={12} className="fill-current" aria-hidden /> À la une
          </span>
        )}
        {item.photoCount > 0 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white">
            <Images size={12} aria-hidden /> {item.photoCount} photo{item.photoCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          {CONTENT_KIND_LABELS[item.kind]}
          {category && <span className="text-gray-500"> · {category}</span>}
          <span className="font-normal normal-case tracking-normal text-gray-400"> · {formatContentDate(item.publishedAt)}</span>
        </p>
        <h3 className="mt-2 text-base font-bold leading-snug text-gray-900 group-hover:text-blue-800">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{item.summary}</p>
      </div>
    </Link>
  );
}
