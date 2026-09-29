import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContentCard } from "@/components/content-card";
import { getPublishedContents, PUBLIC_PAGE_SIZE } from "@/lib/contents";
import { CONTENT_KIND_PLURALS, type ContentKindKey } from "@/lib/content-meta";

export const metadata: Metadata = {
  title: "Actualités",
  description:
    "Actualités, articles et communiqués officiels de l'Inspection Principale Provinciale de l'Enseignement Nord-Kivu 1.",
  alternates: { canonical: "/actualites" },
};

const FILTERS: { key: string; label: string; kind: ContentKindKey | null }[] = [
  { key: "", label: "Tout", kind: null },
  { key: "actualite", label: CONTENT_KIND_PLURALS.ACTUALITE, kind: "ACTUALITE" },
  { key: "article", label: CONTENT_KIND_PLURALS.ARTICLE, kind: "ARTICLE" },
  { key: "communique", label: CONTENT_KIND_PLURALS.COMMUNIQUE, kind: "COMMUNIQUE" },
];

export default async function ActualitesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { type, page: rawPage } = await searchParams;
  const filter = FILTERS.find((f) => f.key === (type ?? "")) ?? FILTERS[0];
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const [session, { items, total }] = await Promise.all([auth(), getPublishedContents(filter.kind, page)]);
  const pages = Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE));
  const href = (p: number) =>
    `/actualites?${new URLSearchParams({ ...(filter.key ? { type: filter.key } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={Boolean(session?.user)} />
      <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Actualités</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
            Actualités, articles et communiqués officiels de l&apos;Inspection Principale Provinciale — Nord-Kivu 1.
          </p>

          <nav className="mt-8 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer par type">
            {FILTERS.map((f) => (
              <Link
                key={f.key || "tout"}
                href={f.key ? `/actualites?type=${f.key}` : "/actualites"}
                className={clsx(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
                  f.key === filter.key ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {items.length === 0 ? (
            <p className="mt-12 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
              Aucune publication pour le moment.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ContentCard key={item.slug} item={item} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
              {page > 1 && (
                <Link
                  href={href(page - 1)}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 hover:border-gray-300"
                >
                  Plus récents
                </Link>
              )}
              <span className="text-gray-500">
                Page {page} sur {pages}
              </span>
              {page < pages && (
                <Link
                  href={href(page + 1)}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 hover:border-gray-300"
                >
                  Plus anciens
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
