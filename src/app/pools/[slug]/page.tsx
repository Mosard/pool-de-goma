import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InteractiveCard, PersonSummary } from "@/components/homepage/ui-blocks";
import { POOLS } from "@/components/homepage/homepage-data";

export function generateStaticParams() {
  return POOLS.map((pool) => ({ slug: pool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pool = POOLS.find((p) => p.slug === slug);

  if (!pool) return {};

  return {
    title: `POOL de ${pool.name}`,
    description: `POOL de ${pool.name} de l'Inspection Principale Provinciale de l'Enseignement Nord-Kivu 1 : informations générales et contact du Chef de POOL.`,
    alternates: { canonical: `/pools/${pool.slug}` },
  };
}

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pool = POOLS.find((p) => p.slug === slug);

  if (!pool) notFound();

  const session = await auth();
  const isConnected = Boolean(session?.user);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={isConnected} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-10">
        <Link
          href="/#pools"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Retour aux POOL
        </Link>

        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-blue-600">Organisation territoriale</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">POOL de {pool.name}</h1>
        <p className="mt-3 max-w-xl text-sm text-gray-600 sm:text-base">
          Informations générales et contact du Chef de POOL. Le détail des établissements et des inspecteurs
          rattachés à ce POOL sera ajouté prochainement.
        </p>

        <div className="mt-10 max-w-xs">
          <InteractiveCard>
            <PersonSummary member={pool.chief} size="lg" />
          </InteractiveCard>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
