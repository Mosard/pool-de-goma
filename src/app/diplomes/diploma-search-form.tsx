"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { clsx } from "clsx";
import { Loader2, Search } from "lucide-react";
import { buttonClasses, FieldError } from "@/components/ui";
import { SchoolCombobox, type SchoolOptionGroup } from "@/components/diplomes/school-combobox";
import { DiplomaOutcomeSkeleton, DiplomaOutcomeView, ServiceComingSoon } from "@/components/diplomes/diploma-outcome";
import { searchDiplomaAction, type DiplomaSearchState } from "./actions";

const initialState: DiplomaSearchState = {};

const inputClass = (invalid?: boolean) =>
  clsx(
    "w-full rounded-xl border bg-white px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:bg-gray-50 sm:text-sm",
    invalid ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
  );

function FieldLabel({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-gray-800">
      {children}
      {optional && <span className="text-xs font-normal text-gray-500">Facultatif</span>}
    </label>
  );
}

export function DiplomaSearchForm({
  years,
  schoolGroups,
  available,
  preview,
}: {
  years: number[];
  schoolGroups: SchoolOptionGroup[];
  /** Une source provinciale fiable est connectée. */
  available: boolean;
  /** Aperçu de développement : états fictifs simulables (jamais en production). */
  preview: { key: string; label: string }[] | null;
}) {
  const [state, formAction, pending] = useActionState(searchDiplomaAction, initialState);
  const resultRef = useRef<HTMLDivElement>(null);
  const enabled = available || preview !== null;
  const errors = state.errors ?? {};

  // À chaque nouvelle réponse, le focus va sur le résultat (lecteurs d'écran,
  // et sur téléphone le résultat est sous le formulaire).
  useEffect(() => {
    if (state.outcome && state.attempt) resultRef.current?.focus();
  }, [state.attempt, state.outcome]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Soumission manuelle : les champs ne sont pas vidés après la recherche.
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <div className="space-y-6">
      {!available && <ServiceComingSoon />}

      <form onSubmit={onSubmit} noValidate aria-describedby="diplomes-aide">
        <fieldset disabled={!enabled || pending} className={clsx("space-y-5", !enabled && "opacity-75")}>
          <legend className="sr-only">Informations du bénéficiaire</legend>
          <p id="diplomes-aide" className="text-sm text-gray-600">
            Saisissez les informations telles qu&apos;elles figurent sur le diplôme. Les champs non marqués « Facultatif »
            sont obligatoires.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="nom">Nom du bénéficiaire</FieldLabel>
              <input
                id="nom"
                name="nom"
                autoComplete="family-name"
                autoCapitalize="characters"
                required
                maxLength={60}
                aria-invalid={Boolean(errors.nom) || undefined}
                aria-describedby={errors.nom ? "nom-erreur" : undefined}
                className={inputClass(Boolean(errors.nom))}
              />
              <span id="nom-erreur"><FieldError message={errors.nom} /></span>
            </div>
            <div>
              <FieldLabel htmlFor="postNom" optional>Post-nom</FieldLabel>
              <input
                id="postNom"
                name="postNom"
                autoComplete="additional-name"
                autoCapitalize="characters"
                maxLength={60}
                aria-invalid={Boolean(errors.postNom) || undefined}
                aria-describedby={errors.postNom ? "postNom-erreur" : undefined}
                className={inputClass(Boolean(errors.postNom))}
              />
              <span id="postNom-erreur"><FieldError message={errors.postNom} /></span>
            </div>
            <div>
              <FieldLabel htmlFor="prenom">Prénom</FieldLabel>
              <input
                id="prenom"
                name="prenom"
                autoComplete="given-name"
                required
                maxLength={60}
                aria-invalid={Boolean(errors.prenom) || undefined}
                aria-describedby={errors.prenom ? "prenom-erreur" : undefined}
                className={inputClass(Boolean(errors.prenom))}
              />
              <span id="prenom-erreur"><FieldError message={errors.prenom} /></span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
            <div>
              <FieldLabel htmlFor="annee">Année de réussite</FieldLabel>
              <select
                id="annee"
                name="annee"
                required
                defaultValue=""
                aria-invalid={Boolean(errors.annee) || undefined}
                aria-describedby={errors.annee ? "annee-erreur" : undefined}
                className={inputClass(Boolean(errors.annee))}
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span id="annee-erreur"><FieldError message={errors.annee} /></span>
            </div>
            <div>
              <FieldLabel htmlFor="etablissement">Établissement scolaire</FieldLabel>
              <SchoolCombobox
                id="etablissement"
                name="etablissement"
                groups={schoolGroups}
                invalid={Boolean(errors.etablissement)}
                describedBy={errors.etablissement ? "etablissement-erreur etablissement-aide" : "etablissement-aide"}
              />
              <p id="etablissement-aide" className="mt-1.5 text-xs text-gray-500">
                Établissement où l&apos;examen d&apos;État a été présenté. S&apos;il n&apos;apparaît pas dans la liste,
                saisissez son nom complet.
              </p>
              <span id="etablissement-erreur"><FieldError message={errors.etablissement} /></span>
            </div>
          </div>

          {/* Champ piège : invisible pour les personnes, rempli par les robots. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="site_web">Ne pas remplir</label>
            <input id="site_web" name="site_web" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          {preview && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
              <label htmlFor="apercuEtat" className="mb-1.5 block text-sm font-semibold text-amber-900">
                Aperçu de développement — état à simuler
              </label>
              <select id="apercuEtat" name="apercuEtat" defaultValue={preview[0]?.key} className={inputClass()}>
                {preview.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-amber-800">
                Réponse fictive, sans aucune donnée réelle. Ce réglage n&apos;existe pas en production.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">Aucune liste de diplômés n&apos;est consultable : seule votre situation est indiquée.</p>
            <button type="submit" className={buttonClasses({ className: "w-full sm:w-auto" })}>
              {pending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Search size={18} aria-hidden />}
              {pending ? "Recherche en cours…" : "Rechercher mon diplôme"}
            </button>
          </div>
        </fieldset>
      </form>

      <div
        ref={resultRef}
        tabIndex={-1}
        aria-live="polite"
        aria-busy={pending}
        className="scroll-mt-24 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {pending ? (
          <>
            <span className="sr-only">Recherche en cours…</span>
            <DiplomaOutcomeSkeleton />
          </>
        ) : (
          state.outcome && state.outcome.kind !== "SERVICE_INDISPONIBLE" && <DiplomaOutcomeView outcome={state.outcome} />
        )}
      </div>
    </div>
  );
}
