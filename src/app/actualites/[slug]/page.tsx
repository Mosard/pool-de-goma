import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContentArticle } from "@/components/content-article";
import { getPublishedContent } from "@/lib/contents";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedContent(slug);
  if (!content) return {};
  return {
    title: content.title,
    description: content.summary,
    alternates: { canonical: `/actualites/${content.slug}` },
    openGraph: {
      type: "article",
      title: content.title,
      description: content.summary,
      publishedTime: content.publishedAt,
      ...(content.coverId ? { images: [{ url: `/medias/${content.coverId}`, alt: content.coverAlt ?? undefined }] } : {}),
    },
  };
}

export default async function ActualitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [session, content] = await Promise.all([auth(), getPublishedContent(slug)]);
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
              title: content.title,
              summary: content.summary,
              body: content.body,
              date: content.publishedAt,
              cover: content.coverId ? { id: content.coverId, alt: content.coverAlt } : null,
              attachment: content.attachment,
            }}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
