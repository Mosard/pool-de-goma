import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, TriangleAlert } from "lucide-react";
import { clsx } from "clsx";
import { GenericAvatar } from "@/components/homepage/ui-blocks";
import type { PoolShowcase, ShowcasePerson } from "@/lib/pool-showcase";

// Présentation d'une page POOL, inspirée de la maquette « circonscription »
// (bloc principal du chef, cartes de l'équipe, liste latérale des écoles),
// transposée dans la charte du site : bandeau marine animé de l'accueil
// (hero-gradient), cartes blanches, bleu blue-600, police Geist. Animations
// en CSS uniquement (classe pool-rise), neutralisées si l'utilisateur
// réduit les animations. Aucun JavaScript côté client.

const pad = (n: number) => String(n).padStart(2, "0");

function riseDelay(seconds: number) {
  return { ["--pool-rise-delay" as string]: `${seconds}s` } as React.CSSProperties;
}

export function DemoNotice() {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-6 py-3 text-sm text-amber-900 sm:items-center">
        <TriangleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 sm:mt-0" aria-hidden />
        <span>
          <strong>Maquette — données et portraits fictifs.</strong> Les personnes, portraits, écoles et coordonnées de
          cette page sont des exemples : ils ne désignent aucun agent en poste ni aucun établissement réel.
        </span>
      </p>
    </div>
  );
}

function FictionTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950",
        className
      )}
    >
      Fictif
    </span>
  );
}

function StaffCard({ person, demo }: { person: ShowcasePerson; demo: boolean }) {
  return (
    <article className="group relative rounded-2xl bg-white p-4 ring-1 ring-gray-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-gray-300">
      {demo && <FictionTag className="absolute right-3 top-3" />}
      <div className="flex items-center gap-4">
        {person.photo ? (
          <Image
            src={person.photo}
            alt={demo ? `Portrait fictif — ${person.name}` : person.name}
            width={56}
            height={56}
            unoptimized
            loading="lazy"
            className="size-14 shrink-0 rounded-full object-cover object-top"
          />
        ) : (
          <GenericAvatar className="size-14 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{person.name}</p>
          <p className="text-xs text-gray-500">{person.functionLabel}</p>
        </div>
      </div>
      {person.schools.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">Écoles suivies</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {person.schools.map((s) => (
              <li key={s} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function PoolShowcaseView({ showcase, confirmed }: { showcase: PoolShowcase; confirmed: boolean }) {
  const demo = showcase.mode === "demo";
  const { chief } = showcase;
  const statusLabel = demo ? "Maquette — données et portraits fictifs" : confirmed ? "Fiche officielle" : "Fiche en cours de confirmation";

  return (
    <>
      {demo && <DemoNotice />}

      {/* Bandeau : identité du POOL et bloc principal du Chef de POOL */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="relative mx-auto max-w-6xl px-6 pb-12 pt-8 sm:pb-16">
          <Link href="/#pools" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white">
            <ArrowLeft size={16} strokeWidth={1.75} />
            Retour aux POOL
          </Link>

          <div className="pool-rise mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-300">
                Organisation territoriale · Nord-Kivu 1
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">POOL de {showcase.name}</h1>
            </div>
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                demo ? "bg-amber-400 text-amber-950 ring-amber-300" : "bg-white/5 text-gray-200 ring-white/15"
              )}
            >
              <span className={clsx("size-1.5 rounded-full", demo ? "bg-amber-950" : confirmed ? "bg-emerald-400" : "bg-gray-400")} />
              {statusLabel}
            </span>
          </div>

          <div
            className="pool-rise relative mt-8 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10"
            style={riseDelay(0.1)}
          >
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-8 p-6 sm:flex-row sm:items-stretch sm:p-10">
              <div className="relative shrink-0 self-start">
                {chief?.photo ? (
                  <Image
                    src={chief.photo}
                    alt={demo ? `Portrait fictif — ${chief.name}` : chief.name}
                    width={208}
                    height={260}
                    unoptimized
                    loading="eager"
                    fetchPriority="high"
                    className="h-64 w-52 rounded-xl object-cover object-top"
                  />
                ) : (
                  <div className="flex h-64 w-52 items-center justify-center rounded-xl bg-white/10">
                    <GenericAvatar className="size-28 !bg-white/10 !text-blue-200" />
                  </div>
                )}
                {demo && chief && <FictionTag className="absolute bottom-3 left-3" />}
              </div>

              <div className="flex flex-1 flex-col justify-between gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-300">Chef de POOL</p>
                  <h2 className="mt-1 text-3xl font-bold text-white sm:text-4xl">{chief ? chief.name : "Nom à publier"}</h2>
                  <p className="mt-1 text-sm text-gray-300">
                    {chief
                      ? demo
                        ? `${chief.functionLabel} — exemple fictif`
                        : chief.functionLabel
                      : "Présenté ici après sa nomination, avec son accord et l'autorisation de publication."}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-[1fr_1fr_1.8fr]">
                  <div className="bg-[var(--color-navy)]/70 p-4">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Établissements</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{pad(showcase.schools.length)}</dd>
                  </div>
                  <div className="bg-[var(--color-navy)]/70 p-4">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Équipe présentée</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{pad(showcase.staff.length)}</dd>
                  </div>
                  <div className="col-span-2 bg-[var(--color-navy)]/70 p-4 sm:col-span-1">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Contact du bureau</dt>
                    <dd className="mt-1 text-sm font-semibold text-white [overflow-wrap:anywhere]">
                      {showcase.email ? (
                        demo ? (
                          showcase.email
                        ) : (
                          <a href={`mailto:${showcase.email}`} className="inline-flex items-center gap-1.5 hover:text-blue-200">
                            <Mail size={14} strokeWidth={1.75} aria-hidden />
                            {showcase.email}
                          </a>
                        )
                      ) : (
                        <span className="text-gray-400">à préciser</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {chief && chief.schools.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">Écoles suivies</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {chief.schools.map((s) => (
                        <li key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white ring-1 ring-white/15">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="flex items-start gap-2 text-sm text-gray-300">
                  <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-blue-300" aria-hidden />
                  <span>
                    <span className="font-semibold text-white">Bureau du POOL : </span>
                    {showcase.address ?? "adresse à préciser"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Équipe (cartes) + écoles (liste latérale) */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
          <div className="pool-rise" style={riseDelay(0.25)}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-gray-900">Équipe du POOL</h2>
              <span className="text-xs text-gray-500">
                {showcase.staff.length > 0 ? `${pad(showcase.staff.length)} présenté${showcase.staff.length > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            {showcase.staff.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {showcase.staff.map((person) => (
                  <StaffCard key={person.key} person={person} demo={demo} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white p-6 text-sm text-gray-500 ring-1 ring-gray-200">
                Les inspecteurs itinérants et les agents du POOL seront présentés ici après autorisation de publication.
              </p>
            )}
          </div>

          <aside className="pool-rise" style={riseDelay(0.4)}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-gray-900">Établissements rattachés</h2>
              <span className="text-xs text-gray-500">{showcase.schools.length > 0 ? pad(showcase.schools.length) : ""}</span>
            </div>
            {showcase.schools.length > 0 ? (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
                {showcase.schools.map((school, i) => (
                  <li key={`${school.name}-${i}`} className="flex items-start gap-3 px-4 py-3">
                    <span className="pt-0.5 text-[11px] tabular-nums text-gray-400">{pad(i + 1)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{school.name}</p>
                      {school.address && <p className="text-xs text-gray-500">{school.address}</p>}
                    </div>
                    {demo && <FictionTag />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-white p-6 text-sm text-gray-500 ring-1 ring-gray-200">
                La liste des établissements sera publiée prochainement.
              </p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
