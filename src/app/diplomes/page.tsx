import type { Metadata } from "next";
import { ArrowUpRight, Building2, FileSearch, ShieldCheck, UserRoundSearch } from "lucide-react";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DiplomaOutcomeView, NATIONAL_PLATFORM_URL } from "@/components/diplomes/diploma-outcome";
import type { SchoolOptionGroup } from "@/components/diplomes/school-combobox";
import { getPublicPools } from "@/lib/public-pools";
import { diplomaYears } from "@/lib/diplomes/criteria";
import { isDiplomaSearchAvailable } from "@/lib/diplomes/search";
import { isStatePreviewAllowed, PREVIEW_STATES } from "@/lib/diplomes/apercu";
import { DiplomaSearchForm } from "./diploma-search-form";

export const metadata: Metadata = {
  title: "Diplômes",
  description:
    "Consultez la disponibilité de votre diplôme d'État auprès de l'Inspection Principale Provinciale du Nord-Kivu 1 et identifiez le bureau où le récupérer.",
  alternates: { canonical: "/diplomes" },
};

const STEPS = [
  {
    icon: UserRoundSearch,
    title: "Identifiez-vous",
    text: "Nom, prénom, année de réussite et établissement, tels qu'ils figurent sur le diplôme.",
  },
  {
    icon: FileSearch,
    title: "Consultez la situation",
    text: "Disponible à l'IPP, disponible dans un POOL, en cours de transfert ou déjà retiré.",
  },
  {
    icon: Building2,
    title: "Rendez-vous au bon bureau",
    text: "Le retrait se fait uniquement au bureau indiqué, là où le diplôme a été physiquement reçu.",
  },
];

const PRIVACY_POINTS = [
  "Aucune liste de diplômés n'est publiée.",
  "Un nom seul ne suffit pas : plusieurs informations sont exigées.",
  "En cas d'homonymie, aucun détail n'est affiché.",
  "Seule la situation du diplôme est indiquée, sans autre donnée personnelle.",
];

/** Établissements déjà publiés sur les pages POOL (nom seulement), groupés par POOL. */
async function loadSchoolGroups(): Promise<SchoolOptionGroup[]> {
  try {
    const pools = await getPublicPools();
    return pools
      .map((p) => ({ pool: p.name, schools: p.schools.map((s) => s.name) }))
      .filter((g) => g.schools.length > 0);
  } catch (error) {
    // La page reste utilisable : la saisie libre de l'établissement suffit.
    console.error("[diplomes] établissements indisponibles", error);
    return [];
  }
}

export default async function DiplomesPage({ searchParams }: { searchParams: Promise<{ apercu?: string }> }) {
  const { apercu } = await searchParams;
  const preview = isStatePreviewAllowed() && apercu === "1";
  const available = isDiplomaSearchAvailable();
  const [session, schoolGroups] = await Promise.all([auth(), loadSchoolGroups()]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={Boolean(session?.user)} />

      <main className="flex-1">
        <section className="hero-gradient px-6 pb-28 pt-14 text-white sm:px-10 sm:pt-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Diplômes d&apos;État</p>
            <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold sm:text-5xl">Retrouvez votre diplôme scolaire</h1>
            <p className="mt-5 max-w-2xl text-pretty text-sm text-gray-200 sm:text-base">
              Consultez la disponibilité de votre diplôme d&apos;État auprès de l&apos;Inspection Principale Provinciale du
              Nord-Kivu 1 et identifiez le bureau où vous pourrez le récupérer.
            </p>
          </div>
        </section>

        <div className="-mt-16 px-4 pb-16 sm:px-10">
          <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section
              aria-labelledby="recherche-titre"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8"
            >
              <h2 id="recherche-titre" className="mb-5 text-lg font-semibold text-gray-900 sm:text-xl">
                Rechercher un diplôme
              </h2>
              <DiplomaSearchForm
                years={diplomaYears()}
                schoolGroups={schoolGroups}
                available={available}
                preview={preview ? PREVIEW_STATES.map(({ key, label }) => ({ key, label })) : null}
              />
            </section>

            <aside className="space-y-4">
              <section aria-labelledby="etapes-titre" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 id="etapes-titre" className="text-sm font-semibold text-gray-900">
                  Comment ça marche
                </h2>
                <ol className="mt-4 space-y-4">
                  {STEPS.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <li key={step.title} className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden>
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            <span className="sr-only">Étape {i + 1} : </span>
                            {step.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{step.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section aria-labelledby="confidentialite-titre" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 id="confidentialite-titre" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ShieldCheck size={18} className="text-emerald-600" aria-hidden />
                  Vos données sont protégées
                </h2>
                <ul className="mt-3 space-y-2">
                  {PRIVACY_POINTS.map((point) => (
                    <li key={point} className="flex gap-2 text-xs leading-relaxed text-gray-600">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="national-titre" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 id="national-titre" className="text-sm font-semibold text-gray-900">
                  Plateforme nationale
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  Ce service ne concerne que les diplômes physiquement reçus par l&apos;IPP Nord-Kivu 1. Pour les
                  informations nationales, consultez la plateforme officielle.
                </p>
                <a
                  href={NATIONAL_PLATFORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                >
                  diplome.cd
                  <ArrowUpRight size={14} aria-hidden />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              </section>
            </aside>
          </div>

          {preview && (
            <section aria-labelledby="apercu-titre" className="mt-12 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-5 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Développement uniquement</p>
              <h2 id="apercu-titre" className="mt-1 text-lg font-semibold text-gray-900">
                Aperçu des états de résultat
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Exemples fictifs pour valider l&apos;interface avant l&apos;intégration des données provinciales. Cette
                section n&apos;est jamais affichée en production.
              </p>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {PREVIEW_STATES.map((s) => (
                  <div key={s.key}>
                    <p className="mb-2 text-xs font-medium text-gray-500">{s.label}</p>
                    <DiplomaOutcomeView outcome={s.outcome} />
                  </div>
                ))}
              </div>
            </section>
          )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
