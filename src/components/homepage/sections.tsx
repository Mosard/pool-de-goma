import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { SectionHeading, PlaceholderMedia, YoutubeEmbed } from "./ui-blocks";
import { HeroSequence } from "@/components/hero-sequence";
import { RdcMapCanvas } from "./rdc-map-canvas";
import { TrilogyGrid } from "./trilogy-grid";
import {
  MISSION_ITEMS,
  TRILOGY_PILLARS,
  ADMINISTRATIVE_CONTROL,
  AI_STAT,
  AI_OBSERVATIONS,
  PROGRAM_STEPS,
  DIFFUSION_CHAIN,
  ACTIVITIES,
  type Activity,
} from "./homepage-data";

export function IppIntroSection() {
  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center sm:px-10">
      <HeroSequence overlay />
      <Reveal className="relative z-10 mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="L'Inspection"
          title="Qui est l'IPP Nord-Kivu 1 ?"
          align="center"
          tone="light"
          shadow
          description="L'Inspection Principale Provinciale de l'Enseignement — Nord-Kivu 1 est l'autorité provinciale chargée de veiller à la qualité et à la conformité de l'enseignement dans la Province Éducationnelle Nord-Kivu 1. Elle contrôle le fonctionnement des établissements, évalue la qualité pédagogique, encadre les inspecteurs et le personnel enseignant, et accompagne la modernisation de l'enseignement à travers les différents POOL qui composent la province."
        />
      </Reveal>
    </div>
  );
}

export function MissionSection() {
  return (
    <div className="bg-gray-50 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow="Mission" title="Ce que fait l'Inspection" align="center" />
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MISSION_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={i * 0.05}>
                <Card className="group h-full transition-all duration-300 ease-out hover:-translate-y-1 hover:border-gray-300 hover:shadow-md">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-110">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RdcMapSection() {
  return (
    <section className="bg-[var(--color-navy)] px-6 py-20 text-white sm:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionHeading
            eyebrow="Ancrage territorial"
            title="De la RDC à la Province Éducationnelle Nord-Kivu 1"
            description="L'Inspection Principale Provinciale s'inscrit dans l'organisation nationale de l'enseignement, avec une action concentrée sur la Province Éducationnelle Nord-Kivu 1 et les différents POOL qui la composent."
            align="center"
            tone="light"
          />
        </Reveal>
        <Reveal delay={0.1} className="mx-auto mt-10 max-w-md">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl">
            <RdcMapCanvas />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function TrilogySection() {
  return (
    <div className="px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Fondements"
            title="Trilogie de l'Inspection"
            description="Trois piliers fondent l'action de l'Inspection."
            align="center"
          />
        </Reveal>
        <Reveal delay={0.08}>
          <TrilogyGrid pillars={TRILOGY_PILLARS} />
        </Reveal>
        <Reveal delay={0.14} className="mx-auto mt-6 max-w-2xl rounded-2xl border border-gray-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-900">{ADMINISTRATIVE_CONTROL.title}</p>
          <p className="mt-1 text-sm text-gray-500">{ADMINISTRATIVE_CONTROL.body}</p>
        </Reveal>
      </div>
    </div>
  );
}

export function AiObservationSection() {
  return (
    <section className="bg-[var(--color-navy)] px-6 py-20 text-white sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Constat institutionnel"
            title="L'intelligence artificielle est déjà dans nos écoles"
            tone="light"
            align="center"
          />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <Reveal delay={0.08} className="text-center lg:text-left">
            <p className="text-6xl font-bold tracking-tight sm:text-7xl">{AI_STAT.value}</p>
            <p className="mx-auto mt-4 max-w-md text-sm text-gray-300 lg:mx-0">{AI_STAT.label}</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-gray-500">— {AI_STAT.source}</p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              <Image
                src="/homepage/eleves-numerique.jpg"
                alt="Élèves utilisant des outils numériques en classe"
                fill
                sizes="(min-width: 1024px) 480px, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AI_OBSERVATIONS.map((point, i) => {
            const Icon = point.icon;
            return (
              <Reveal key={point.title} delay={0.05 * i}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
                  <Icon size={20} strokeWidth={1.75} className="text-blue-300" />
                  <h3 className="mt-3 text-sm font-bold text-white">{point.title}</h3>
                  <p className="mt-2 text-sm text-gray-400">{point.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function AiResponseSection() {
  return (
    <section className="px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <SectionHeading eyebrow="La réponse de l'IPP" title="Former pour maîtriser" align="center" />
          <p className="mx-auto mt-5 max-w-2xl text-sm text-gray-600 sm:text-base">
            Plutôt que d&apos;interdire l&apos;intelligence artificielle, l&apos;Inspection Principale
            Provinciale choisit de former l&apos;ensemble des acteurs de l&apos;enseignement à un usage
            responsable, éthique et maîtrisé de ces outils.
          </p>
        </Reveal>
      </div>
      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROGRAM_STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.06}>
            <Card className="h-full">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                {step.step}
              </span>
              <h3 className="mt-4 text-base font-bold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.body}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2} className="mx-auto mt-14 max-w-4xl">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
          Une formation qui se diffuse
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
          {DIFFUSION_CHAIN.map((step, i) => (
            <span key={step} className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                {step}
              </span>
              {i < DIFFUSION_CHAIN.length - 1 && (
                <ArrowRight size={16} strokeWidth={1.75} className="text-gray-300" />
              )}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function AiMessageSection() {
  return (
    <section className="hero-gradient flex min-h-[50vh] flex-col items-center justify-center px-6 py-20 text-center text-white sm:px-10">
      <Reveal>
        <p className="mx-auto max-w-3xl text-2xl font-bold sm:text-4xl">
          L&apos;intelligence artificielle ne doit pas remplacer l&apos;apprentissage.
        </p>
        <p className="mx-auto mt-3 max-w-3xl text-2xl font-bold text-blue-300 sm:text-4xl">
          Elle doit l&apos;accompagner.
        </p>
      </Reveal>
    </section>
  );
}

export function DigitalTransformationSection() {
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-10">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <SectionHeading
            eyebrow="Transformation numérique"
            title="Une administration qui se modernise"
          />
          <p className="mt-5 text-sm leading-relaxed text-gray-600 sm:text-base">
            La transformation numérique de l&apos;Inspection a commencé par la formation de ses
            responsables et de ses agents, avant de s&apos;étendre aux inspecteurs itinérants. Elle se
            poursuit aujourd&apos;hui vers les enseignants et les élèves, avec l&apos;ambition de
            moderniser durablement le fonctionnement de l&apos;enseignement dans la province.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
            <Image
              src="/homepage/formation-enseignants.jpg"
              alt="Formation numérique des enseignants"
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SchoolSoftwareSection() {
  return (
    <section className="px-6 py-20 sm:px-10">
      <Reveal className="mx-auto max-w-4xl rounded-3xl bg-[var(--color-primary)] px-8 py-14 text-center text-white shadow-lg sm:px-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">
          Initiative institutionnelle
        </p>
        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
          Un logiciel de gestion scolaire, gratuit pour les établissements
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-blue-50 sm:text-base">
          Dans le cadre de sa stratégie de transformation numérique, l&apos;Inspection met à la
          disposition des établissements scolaires un outil numérique gratuit pour moderniser la gestion
          administrative et pédagogique des écoles.
        </p>
        <Link href="/demande-de-compte" className="mt-8 inline-block">
          <Button className="!bg-white !text-blue-700 hover:!bg-gray-100">Découvrir le programme</Button>
        </Link>
      </Reveal>
    </section>
  );
}

export function ActionSection() {
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="Sur le terrain" title="L'Inspection en action" align="center" />
        </Reveal>
        <div className="mt-10 space-y-8">
          {ACTIVITIES.map((activity, i) => (
            <Reveal key={activity.title} delay={i * 0.06}>
              <ActivityCard activity={activity} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <div className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-2 lg:items-center">
      <div className={clsx(!activity.videoId && !activity.image && "lg:order-2")}>
        <h3 className="text-base font-bold text-gray-900 sm:text-lg">{activity.title}</h3>
        <p className="mt-2 text-sm text-gray-600">{activity.body}</p>
        {activity.skills && (
          <ol className="mt-5 flex flex-wrap gap-2">
            {activity.skills.map((skill, i) => (
              <li
                key={skill}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                {skill}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        {activity.videoId ? (
          <YoutubeEmbed videoId={activity.videoId} title={activity.title} caption={activity.videoCaption} />
        ) : activity.image ? (
          <div className="group relative aspect-video w-full overflow-hidden rounded-xl">
            <Image
              src={activity.image}
              alt={activity.title}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
        ) : (
          <PlaceholderMedia label="Photo / vidéo" className="aspect-video w-full" />
        )}
      </div>
    </div>
  );
}
