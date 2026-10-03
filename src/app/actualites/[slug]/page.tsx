import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContentArticle } from "@/components/content-article";
import { ShareButtons } from "@/components/share-buttons";
import { getPublishedContent, publicCutoff } from "@/lib/contents";

const SITE_URL = "https://ippnk1.online";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedContent(slug, publicCutoff());
  if (!content) return {};
  // Aperçu de partage : couverture, sinon première photo d'album, en JPEG 1200 × 630.
  const imageId = content.coverId ?? content.gallery[0]?.id ?? null;
  const imageAlt = content.coverId ? content.coverAlt : (content.gallery[0]?.alt ?? null);
  const images = imageId
    ? [{ url: `/medias/${imageId}?format=partage`, width: 1200, height: 630, alt: imageAlt ?? content.title }]
    : undefined;
  return {
    title: content.title,
    description: content.summary,
    alternates: { canonical: `/actualites/${content.slug}` },
    openGraph: {
      type: "article",
      url: `/actualites/${content.slug}`,
      siteName: "IPP Nord-Kivu 1",
      locale: "fr_CD",
      title: content.title,
      description: content.summary,
      publishedTime: content.publishedAt,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: content.title,
      description: content.summary,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
  };
}

export default async function ActualitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [session, content] = await Promise.all([auth(), getPublishedContent(slug, publicCutoff())]);
  if (!content) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={Boolean(session?.user)} />
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <Link href="/actualites" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900">
            <ChevronLeft size={16} aria-hidden /> Toutes les actualités
          </Link>
        </div>
        <div className="mx-auto mt-6 max-w-4xl rounded-3xl bg-white px-5 py-8 shadow-sm ring-1 ring-gray-100 sm:px-10 sm:py-12">
          <ContentArticle
            content={{
              kind: content.kind,
              category: content.category,
              title: content.title,
              summary: content.summary,
              body: content.body,
              date: content.publishedAt,
              cover: content.coverId ? { id: content.coverId, alt: content.coverAlt } : null,
              attachment: content.attachment,
              gallery: content.gallery,
              videos: content.videos,
            }}
          />
          <div className="mx-auto mt-10 max-w-3xl border-t border-gray-100 pt-6">
            <ShareButtons url={`${SITE_URL}/actualites/${content.slug}`} title={content.title} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
