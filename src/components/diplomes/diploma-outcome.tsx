import { clsx } from "clsx";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Hourglass,
  Info,
  Mail,
  MapPin,
  PackageCheck,
  SearchX,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DiplomaSearchOutcome } from "@/lib/diplomes/types";

// Présentation des réponses de la recherche publique. Aucune donnée n'est
// lue ici : le composant affiche ce que la recherche a renvoyé (ou, en
// développement, un exemple fictif de src/lib/diplomes/apercu.ts).

export const NATIONAL_PLATFORM_URL = "https://diplome.cd";

type Tone = "success" | "info" | "progress" | "neutral" | "warning" | "danger";

const tones: Record<Tone, { box: string; icon: string; badge: string }> = {
  success: { box: "border-emerald-200 bg-emerald-50/60", icon: "bg-emerald-600 text-white", badge: "bg-emerald-100 text-emerald-800" },
  info: { box: "border-blue-200 bg-blue-50/60", icon: "bg-blue-600 text-white", badge: "bg-blue-100 text-blue-800" },
  progress: { box: "border-amber-200 bg-amber-50/60", icon: "bg-amber-500 text-white", badge: "bg-amber-100 text-amber-900" },
  neutral: { box: "border-gray-200 bg-white", icon: "bg-gray-700 text-white", badge: "bg-gray-100 text-gray-700" },
  warning: { box: "border-amber-200 bg-amber-50/60", icon: "bg-amber-500 text-white", badge: "bg-amber-100 text-amber-900" },
  danger: { box: "border-red-200 bg-red-50/60", icon: "bg-red-600 text-white", badge: "bg-red-100 text-red-800" },
};

function OutcomeCard({
  tone,
  icon: Icon,
  badge,
  title,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  badge: string;
  title: string;
  children?: React.ReactNode;
}) {
  const t = tones[tone];
  return (
    <article className={clsx("rounded-2xl border p-5 sm:p-6", t.box)}>
      <div className="flex items-start gap-4">
        <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", t.icon)} aria-hidden>
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", t.badge)}>{badge}</span>
          <h3 className="mt-2 text-pretty text-base font-semibold text-gray-900 sm:text-lg">{title}</h3>
          {children && <div className="mt-3 space-y-3 text-sm text-gray-700">{children}</div>}
        </div>
      </div>
    </article>
  );
}

function NationalPlatformLink() {
  return (
    <a
      href={NATIONAL_PLATFORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-blue-700 underline-offset-2 hover:underline"
    >
      Consulter la plateforme nationale diplome.cd
      <ArrowUpRight size={14} aria-hidden />
      <span className="sr-only">(nouvel onglet)</span>
    </a>
  );
}

export function DiplomaOutcomeView({ outcome }: { outcome: DiplomaSearchOutcome }) {
  switch (outcome.kind) {
    case "TROUVE": {
      const result = outcome.result;
      switch (result.status) {
        case "DISPONIBLE_IPP":
          return (
            <OutcomeCard
              tone="success"
              icon={CheckCircle2}
              badge="Disponible"
              title="Votre diplôme est disponible à l'IPP Nord-Kivu 1, cellule des titres scolaires."
            />
          );
        case "DISPONIBLE_POOL": {
          const pool = result.pool;
          const hasDetails = pool.address || pool.officialEmail || pool.pickupInstructions;
          return (
            <OutcomeCard
              tone="success"
              icon={Building2}
              badge="Disponible"
              title={`Votre diplôme est disponible au POOL de ${pool.name}.`}
            >
              {hasDetails && (
                <dl className="divide-y divide-emerald-100 rounded-xl border border-emerald-100 bg-white">
                  {pool.address && (
                    <div className="flex gap-3 px-4 py-3">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Adresse officielle</dt>
                        <dd className="mt-0.5 text-gray-900">{pool.address}</dd>
                      </div>
                    </div>
                  )}
                  {pool.officialEmail && (
                    <div className="flex gap-3 px-4 py-3">
                      <Mail size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
                      <div className="min-w-0">
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Contact du bureau</dt>
                        <dd className="mt-0.5 break-words">
                          <a href={`mailto:${pool.officialEmail}`} className="text-blue-700 hover:underline">
                            {pool.officialEmail}
                          </a>
                        </dd>
                      </div>
                    </div>
                  )}
                  {pool.pickupInstructions && (
                    <div className="flex gap-3 px-4 py-3">
                      <Info size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Pour le retrait</dt>
                        <dd className="mt-0.5 text-gray-900">{pool.pickupInstructions}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              )}
            </OutcomeCard>
          );
        }
        case "EN_TRANSFERT":
          return (
            <OutcomeCard
              tone="progress"
              icon={Truck}
              badge="En cours de transfert"
              title="Votre diplôme est en cours de transfert. Il n'est pas encore disponible au bureau de destination."
            >
              <p>Consultez de nouveau ce service dans quelques jours avant de vous déplacer.</p>
            </OutcomeCard>
          );
        case "RETIRE":
          return <OutcomeCard tone="neutral" icon={PackageCheck} badge="Retiré" title="Ce diplôme a déjà été retiré." />;
        case "RETRAIT_A_CONFIRMER":
          return (
            <OutcomeCard
              tone="info"
              icon={Hourglass}
              badge="Retrait déclaré"
              title="Le retrait de ce diplôme a été déclaré. Sa confirmation est en cours."
            />
          );
      }
      break;
    }
    case "AUCUN_RESULTAT":
      return (
        <OutcomeCard
          tone="neutral"
          icon={SearchX}
          badge="Aucun résultat"
          title="Aucun diplôme correspondant à ces informations n'est actuellement répertorié dans la base provinciale de l'IPP Nord-Kivu 1."
        >
          <p>
            Cette absence ne signifie pas nécessairement que le diplôme n&apos;existe pas au niveau national : la base
            provinciale ne recense que les diplômes physiquement reçus par l&apos;Inspection. Vérifiez l&apos;orthographe
            des noms et l&apos;année de réussite.
          </p>
          <NationalPlatformLink />
        </OutcomeCard>
      );
    case "PLUSIEURS_CORRESPONDANCES":
      return (
        <OutcomeCard
          tone="warning"
          icon={Users}
          badge="Précision nécessaire"
          title="Plusieurs dossiers pourraient correspondre à ces informations."
        >
          <p>
            Pour protéger les données des bénéficiaires, aucun détail n&apos;est affiché. Complétez le post-nom et vérifiez
            l&apos;établissement, ou adressez-vous à la cellule des titres scolaires de l&apos;IPP Nord-Kivu 1.
          </p>
        </OutcomeCard>
      );
    case "TROP_DE_RECHERCHES":
      return (
        <OutcomeCard tone="warning" icon={Clock} badge="Patientez" title="Trop de recherches ont été effectuées en peu de temps.">
          <p>Réessayez dans quelques minutes.</p>
        </OutcomeCard>
      );
    case "ERREUR":
      return (
        <OutcomeCard tone="danger" icon={AlertTriangle} badge="Erreur" title="La recherche n'a pas pu aboutir.">
          <p>Le service a rencontré un problème technique. Réessayez un peu plus tard.</p>
        </OutcomeCard>
      );
    case "SERVICE_INDISPONIBLE":
      return <ServiceComingSoon />;
  }
  return null;
}

/** Message affiché tant qu'aucune source provinciale fiable n'est connectée. */
export function ServiceComingSoon({ className }: { className?: string }) {
  return (
    <div className={clsx("flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900 sm:px-5", className)}>
      <Clock size={20} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">Le service de recherche des diplômes sera prochainement disponible.</p>
        <p className="text-blue-800">
          Le formulaire ci-dessous est présenté à titre indicatif : aucune recherche n&apos;est encore effectuée.
        </p>
      </div>
    </div>
  );
}

/** Squelette pendant une recherche (zone annoncée aux lecteurs d'écran par aria-busy). */
export function DiplomaOutcomeSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6" aria-hidden>
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-gray-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-5 w-full max-w-md animate-pulse rounded-full bg-gray-200" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
