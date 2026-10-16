import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { buttonClasses } from "@/components/ui";
import { isDiplomaSearchAvailable } from "@/lib/diplomes/search";

/** Accès rapide à la rubrique publique « Diplômes », sous le hero de l'accueil. */
export function DiplomasAccessSection() {
  const available = isDiplomaSearchAvailable();
  return (
    <section aria-labelledby="acces-diplomes" className="border-b border-gray-200 bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600" aria-hidden>
            <GraduationCap size={24} strokeWidth={1.75} />
          </span>
          <div>
            <h2 id="acces-diplomes" className="flex flex-wrap items-center gap-2 text-base font-bold text-gray-900">
              Diplômes d&apos;État
              {!available && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  Service bientôt disponible
                </span>
              )}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">
              Consultez la disponibilité de votre diplôme et le bureau où le récupérer : IPP Nord-Kivu 1 ou POOL.
            </p>
          </div>
        </div>
        <Link href="/diplomes" className={buttonClasses({ className: "w-full shrink-0 sm:w-auto" })}>
          Rechercher mon diplôme
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
