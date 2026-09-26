import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PoolShowcaseView } from "@/components/pools/pool-showcase";
import { POOL_ROLES, POOL_REPORT_STEPS } from "@/components/homepage/homepage-data";
import { getPoolCards, resolvePoolPage } from "@/lib/pool-showcase";

// Un seul modèle pour toutes les pages POOL. Les données viennent du
// back-office (src/lib/public-pools.ts) ou, tant qu'un POOL n'a aucun
// contenu officiel publié, d'une maquette fictive signalée (src/lib/pool-demo).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolvePoolPage(slug);
  if (!resolved) return {};

  const { showcase, confirmed } = resolved;
  const demo = showcase.mode === "demo";
  return {
    title: demo ? `POOL de ${showcase.name} (maquette)` : `POOL de ${showcase.name}`,
    description: `POOL de ${showcase.name} de l'Inspection Principale Provinciale de l'Enseignement Nord-Kivu 1 : bureau, Chef de POOL, équipe et établissements rattachés.`,
    alternates: { canonical: `/pools/${slug}` },
    // Maquette fictive ou fiche non confirmée : accessible, mais jamais
    // proposée à l'indexation (aucune personne fictive dans les moteurs).
    ...((demo || !confirmed) && { robots: { index: false, follow: true } }),
  };
}

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolvePoolPage(slug);
  if (!resolved) notFound();

  const { showcase, confirmed } = resolved;
  const [session, cards] = await Promise.all([auth(), getPoolCards()]);
  const isConnected = Boolean(session?.user);
  const otherPools = cards.filter((c) => c.slug !== slug);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={isConnected} />

      <main className="flex-1">
        <PoolShowcaseView showcase={showcase} confirmed={confirmed} />

        <div className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="grid gap-10 border-t border-gray-200 pt-12 lg:grid-cols-3">
            <section>
              <h2 className="text-base font-bold text-gray-900">Le rôle du POOL</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Le POOL de {showcase.name} fait partie de l&apos;organisation territoriale de la Province Éducationnelle
                Nord-Kivu 1. Il assure, au plus près des établissements scolaires qui lui sont rattachés, le suivi
                pédagogique et administratif conduit par l&apos;Inspection Principale Provinciale de l&apos;Enseignement.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-gray-900">Organisation du POOL</h2>
              <ul className="mt-3 space-y-2">
                {POOL_ROLES.map((role) => (
                  <li key={role.title} className="text-sm leading-relaxed text-gray-600">
                    <span className="font-semibold text-gray-900">{role.title}</span> : {role.description}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-base font-bold text-gray-900">Le circuit d&apos;un rapport d&apos;inspection</h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-600">
                {POOL_REPORT_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </div>

          {otherPools.length > 0 && (
            <section className="mt-12">
              <h2 className="text-base font-bold text-gray-900">Les autres POOL de l&apos;Inspection</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {otherPools.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/pools/${p.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      POOL de {p.name}
                      {p.mode === "demo" && (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold uppercase text-amber-800">
                          Maquette
                        </span>
                      )}
                      {p.mode === "pending" && (
                        <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold uppercase text-gray-600">
                          En cours de confirmation
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
