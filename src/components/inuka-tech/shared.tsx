import { ArrowRight, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard } from "@/components/homepage/ui-blocks";

// Chaîne de pastilles reliées par des flèches — réutilisée pour tous les
// schémas de flux de la page (partenariat, diffusion enseignants, vision,
// méthodologie, récit JRS) afin qu'ils appartiennent à la même famille
// visuelle que la "chaîne de diffusion" de la page d'accueil.
export function FlowChain({ steps, tone = "light" }: { steps: string[]; tone?: "light" | "dark" }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-3">
          <span
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold",
              tone === "light" ? "bg-gray-100/80 text-gray-700" : "bg-white/10 text-white"
            )}
          >
            {step}
          </span>
          {i < steps.length - 1 && (
            <ArrowRight
              size={16}
              strokeWidth={1.75}
              className={tone === "light" ? "text-gray-300" : "text-white/40"}
            />
          )}
        </span>
      ))}
    </div>
  );
}

export function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-blue-700 sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">{label}</p>
    </div>
  );
}

export type IconCardItem = { icon: LucideIcon; title: string; body: string };

// Grille de cartes icône + titre + texte court — utilisée pour à peu près
// toutes les listes de la page (à propos, modules IA, fonctionnalités,
// modules de plateforme, rôle d'INUKA TECH) pour garder une seule variante
// de carte à faire évoluer.
export function IconCardGrid({
  items,
  columns = 3,
}: {
  items: IconCardItem[];
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={clsx("grid grid-cols-1 gap-4", colClass)}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <Reveal key={item.title} delay={0.05 * i}>
            <InteractiveCard>
              <Icon size={24} strokeWidth={1.5} className="text-blue-600" />
              <h3 className="mt-4 text-sm font-bold text-gray-900">{item.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600">{item.body}</p>
            </InteractiveCard>
          </Reveal>
        );
      })}
    </div>
  );
}

export type NumberStepItem = { number: string; title: string; body: string };

// Timeline verticale (numéro / titre / texte) — utilisée pour le déploiement
// dans les écoles et peut resservir pour toute future séquence chronologique.
export function NumberedTimeline({ steps }: { steps: NumberStepItem[] }) {
  return (
    <ol className="relative mx-auto max-w-2xl space-y-8 border-l border-gray-200 pl-8">
      {steps.map((step, i) => (
        <Reveal key={step.number} delay={0.06 * i}>
          <li className="relative">
            <span className="absolute -left-[calc(2rem+1px)] flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-blue-700">
              {step.number}
            </span>
            <h3 className="text-sm font-bold text-gray-900 sm:text-base">{step.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{step.body}</p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

export function SectionShell({
  id,
  eyebrow,
  title,
  description,
  tone = "light",
  className,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "light" | "dark";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={clsx(
        "overflow-hidden px-6 py-20 sm:px-10",
        tone === "dark" ? "bg-[#0b1b3a] text-white" : "bg-gray-50",
        className
      )}
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} description={description} align="center" tone={tone} />
        </Reveal>
        {children}
      </div>
    </section>
  );
}
