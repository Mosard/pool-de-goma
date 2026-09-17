import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading, PlaceholderMedia } from "@/components/homepage/ui-blocks";
import { FlowChain, IconCardGrid, StatBlock } from "./shared";
import {
  JRS_TRAINING,
  JRS_STATS,
  JRS_TOPICS,
  JRS_NEEDS,
  JRS_PLATFORM_MODULES,
  JRS_OFFLINE_POINTS,
  JRS_ROLE,
  JRS_STORY_FLOW,
} from "./inuka-tech-data";

// Étude de cas JRS — pensée comme une expérience web (grands chiffres,
// timeline, cartes animées) plutôt que comme un rapport PDF mis en page.
// La plateforme pédagogique y est présentée comme une proposition
// structurée par INUKA TECH à la suite de la formation, pas comme un
// service déjà déployé.
export function JrsCollaborationSection() {
  return (
    <section className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-blue-600">
            Cas concret — JRS
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            {JRS_TRAINING.title}
          </h2>
        </Reveal>

        <Reveal delay={0.15} className="mx-auto mt-8 max-w-2xl">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <span>{JRS_TRAINING.place}</span>
            <span className="text-gray-300">·</span>
            <span>{JRS_TRAINING.period}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>Formateur principal : {JRS_TRAINING.facilitator}</span>
            <span>Assistant : {JRS_TRAINING.assistant}</span>
          </div>
        </Reveal>

        <Reveal delay={0.25} className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {JRS_STATS.map((stat) => (
            <StatBlock key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </Reveal>

        {/* Photos de la formation : pas de photos spécifiques à Mungunga
            disponibles dans les assets — espace réservé plutôt qu'une
            image sans rapport présentée comme si elle en venait. */}
        <Reveal delay={0.3} className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PlaceholderMedia label="Photo de la formation à Mungunga" className="aspect-[4/3]" />
          <PlaceholderMedia label="Photo de la formation à Mungunga" className="aspect-[4/3]" />
        </Reveal>
      </div>

      {/* Ce qui a été enseigné */}
      <div className="mx-auto mt-20 max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="Contenu de la formation" title="Ce qui a été enseigné" align="center" />
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5">
          {JRS_TOPICS.map((topic) => (
            <span key={topic} className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 sm:text-sm">
              {topic}
            </span>
          ))}
        </Reveal>
        <Reveal delay={0.25} className="mx-auto mt-8 max-w-xl text-center">
          <p className="inline-flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} strokeWidth={2} className="shrink-0 text-emerald-500" />
            Chaque école a élaboré sa propre feuille de route de digitalisation.
          </p>
        </Reveal>
      </div>

      {/* Le constat */}
      <div className="mx-auto mt-20 max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Le constat après la formation"
            title="Former révèle aussi les besoins réels"
            align="center"
          />
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {JRS_NEEDS.map((need, i) => (
            <Reveal key={need.title} delay={0.1 * i}>
              <div className="h-full rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-sm font-bold text-gray-900">{need.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{need.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Transition vers la solution */}
      <div className="mx-auto mt-20 max-w-3xl text-center">
        <Reveal>
          <p className="text-sm italic text-gray-500">
            Une formation ne doit pas s&apos;arrêter à la dernière journée.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-6">
          <FlowChain steps={JRS_STORY_FLOW} />
        </Reveal>
      </div>

      {/* Plateforme pédagogique proposée */}
      <div className="mx-auto mt-20 max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Proposition d'INUKA TECH à JRS"
            title="Une plateforme pédagogique numérique locale"
            description="Transformer une formation ponctuelle en un écosystème durable de ressources, d'exercices et d'accompagnement pédagogique."
            align="center"
          />
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-center">
          <p className="text-xs text-amber-800 sm:text-sm">
            Solution proposée et structurée par INUKA TECH à la suite de la formation pilote — non encore déployée.
          </p>
        </Reveal>
        <div className="mt-12">
          <IconCardGrid items={JRS_PLATFORM_MODULES} columns={3} />
        </div>
      </div>

      {/* Réalités locales / hors-ligne */}
      <div className="mx-auto mt-20 max-w-5xl rounded-3xl bg-[#0b1b3a] px-6 py-14 text-white sm:px-10">
        <Reveal>
          <SectionHeading
            title="Une technologie pensée pour les réalités locales"
            description="Le numérique éducatif ne peut pas dépendre entièrement d'une connexion Internet permanente."
            align="center"
            tone="light"
          />
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5">
          {JRS_OFFLINE_POINTS.map((point) => (
            <span key={point} className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-gray-200 sm:text-sm">
              {point}
            </span>
          ))}
        </Reveal>
      </div>

      {/* Rôle d'INUKA TECH auprès de JRS */}
      <div className="mx-auto mt-20 max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="Auprès de JRS" title="Le rôle d'INUKA TECH" align="center" />
        </Reveal>
        <div className="mt-12">
          <IconCardGrid items={JRS_ROLE} columns={3} />
        </div>
      </div>
    </section>
  );
}
