import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, School as SchoolIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InteractiveCard, PersonSummary } from "@/components/homepage/ui-blocks";
import { chiefMember, personMember } from "@/components/homepage/pools-section";
import { POOL_ROLES, POOL_REPORT_STEPS } from "@/components/homepage/homepage-data";
import { getPublicPoolPage, getPublicPools, type PublicPerson } from "@/lib/public-pools";

// Données issues du back-office (src/lib/public-pools.ts), mises en cache et
// invalidées par les actions d'administration — pas de pré-rendu figé.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPoolPage(slug);

  if (!page) return {};

  const name = page.kind === "confirmed" ? page.pool.name : page.name;
  return {
    title: `POOL de ${name}`,
    description: `POOL de ${name} de l'Inspection Principale Provinciale de l'Enseignement Nord-Kivu 1 : bureau, Chef de POOL, inspecteurs et établissements rattachés.`,
    alternates: { canonical: `/pools/${slug}` },
    // Fiche pas encore confirmée en base : l'URL reste accessible mais n'est
    // pas proposée à l'indexation.
    ...(page.kind === "pending" && { robots: { index: false, follow: true } }),
  };
}

function AssignedSchools({ schools }: { schools: string[] }) {
  if (schools.length === 0) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Écoles suivies</p>
      <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
        {schools.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function PeopleGrid({ people, emptyText }: { people: PublicPerson[]; emptyText: string }) {
  if (people.length === 0) return <p className="mt-2 text-sm text-gray-500">{emptyText}</p>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
      {people.map((person) => (
        <InteractiveCard key={person.key} className="p-4">
          <PersonSummary member={personMember(person)} size="sm" />
          <AssignedSchools schools={person.schools} />
        </InteractiveCard>
      ))}
    </div>
  );
}

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicPoolPage(slug);

  if (!page) notFound();

  const pool = page.kind === "confirmed" ? page.pool : null;
  const name = page.kind === "confirmed" ? page.pool.name : page.name;
  const [session, publicPools] = await Promise.all([auth(), getPublicPools()]);
  const isConnected = Boolean(session?.user);
  const otherPools = publicPools.filter((p) => p.slug !== slug);

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
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">POOL de {name}</h1>
        {pool ? (
          <p className="mt-3 max-w-xl text-sm text-gray-600 sm:text-base">
            Bureau, Chef de POOL, inspecteurs et établissements rattachés à ce POOL. Seules les informations dont la
            publication a été autorisée sont affichées.
          </p>
        ) : (
          <p className="mt-3 max-w-xl text-sm text-gray-600 sm:text-base">
            La fiche de ce POOL est en cours de confirmation par l&apos;Inspection. Ses informations officielles
            seront publiées ici dès leur validation.
          </p>
        )}

        <p className="mt-4 flex items-start gap-2 text-sm text-gray-700 sm:text-base">
          <MapPin size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
          <span>
            <span className="font-semibold text-gray-900">Adresse du bureau : </span>
            {pool?.address ?? <span className="text-gray-500">à préciser</span>}
          </span>
        </p>
        {pool?.officialEmail && (
          <p className="mt-2 flex items-start gap-2 text-sm text-gray-700 sm:text-base">
            <Mail size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
            <span>
              <span className="font-semibold text-gray-900">E-mail : </span>
              <a href={`mailto:${pool.officialEmail}`} className="text-blue-700 hover:underline">
                {pool.officialEmail}
              </a>
            </span>
          </p>
        )}

        <div className="mt-10 max-w-xs">
          <InteractiveCard>
            <PersonSummary member={chiefMember(slug, pool?.chief ?? null)} size="lg" />
            {pool?.chief && <AssignedSchools schools={pool.chief.schools} />}
          </InteractiveCard>
        </div>

        {pool && (
          <>
            <section className="mt-14">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Inspecteurs itinérants</h2>
              <PeopleGrid people={pool.inspectors} emptyText="Liste à publier prochainement." />
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Autres agents du POOL</h2>
              <PeopleGrid people={pool.agents} emptyText="Liste à publier prochainement." />
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Établissements rattachés</h2>
              {pool.schools.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Liste à publier prochainement.</p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                  {pool.schools.map((school, i) => (
                    <li key={`${school.name}-${i}`} className="flex items-start gap-3 px-4 py-3">
                      <SchoolIcon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">{school.name}</span>
                        {school.address && <span className="block text-gray-500">{school.address}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="mt-14">
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Le rôle du POOL de {name}</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            Le POOL de {name} fait partie de l&apos;organisation territoriale de la Province Éducationnelle
            Nord-Kivu 1. Il assure, au plus près des établissements scolaires qui lui sont rattachés, le suivi
            pédagogique et administratif conduit par l&apos;Inspection Principale Provinciale de l&apos;Enseignement.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Organisation du POOL</h2>
          <ul className="mt-4 space-y-3">
            {POOL_ROLES.map((role) => (
              <li key={role.title} className="text-sm leading-relaxed text-gray-600 sm:text-base">
                <span className="font-semibold text-gray-900">{role.title}</span> : {role.description}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Le circuit d&apos;un rapport d&apos;inspection</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-600 sm:text-base">
            {POOL_REPORT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        {otherPools.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Les autres POOL de l&apos;Inspection</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {otherPools.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/pools/${p.slug}`}
                    className="inline-block rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
                  >
                    POOL de {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
