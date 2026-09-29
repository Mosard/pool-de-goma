import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContentCard } from "@/components/content-card";
import { getPublishedContents } from "@/lib/contents";

/** Accueil : les trois dernières publications validées (aucun contenu fictif). */
export async function LatestNewsSection() {
  const { items } = await getPublishedContents(null, 1);
  const latest = items.slice(0, 3);

  return (
    <section id="actualites" className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Actualités</h2>
          {latest.length > 0 && (
            <Link href="/actualites" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">
              Toutes les actualités <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </div>
        {latest.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-500">
            Les actualités et communiqués de l&apos;Inspection paraîtront ici.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((item) => (
              <ContentCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
