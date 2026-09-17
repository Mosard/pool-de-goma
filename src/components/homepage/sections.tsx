import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { SectionHeading, PlaceholderMedia } from "./ui-blocks";
import { TrilogyGrid } from "./trilogy-grid";
import { MISSION_ITEMS, TRILOGY_PILLARS, AI_STAT, PROGRAM_STEPS, ACTIVITIES } from "./homepage-data";

export function IppIntroSection() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:px-10">
      <Reveal>
        <SectionHeading
          eyebrow="L'Inspection"
          title="Qui est l'IPP Nord-Kivu 1 ?"
          align="center"
        />
        <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
          L&apos;Inspection Principale Provinciale de l&apos;Enseignement — Nord-Kivu 1 est l&apos;autorité
          provinciale chargée de veiller à la qualité et à la conformité de l&apos;enseignement dans la
          Province Éducationnelle Nord-Kivu 1. Elle contrôle le fonctionnement des établissements, évalue
          la qualité pédagogique, encadre les inspecteurs et le personnel enseignant, et accompagne la
          modernisation de l&apos;enseignement à travers les différents POOL qui composent la province.
        </p>
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

export function TrilogySection() {
  return (
    <div className="px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Fondements"
            title="Trilogie de l'Inspection"
            description="Trois piliers fondent l'action de l'Inspection. Leur formulation officielle sera intégrée prochainement."
            align="center"
          />
        </Reveal>
        <Reveal delay={0.08}>
          <TrilogyGrid pillars={TRILOGY_PILLARS} />
        </Reveal>
      </div>
    </div>
  );
}

export function AiObservationSection() {
  return (
    <section className="bg-[var(--color-navy)] px-6 py-20 text-white sm:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <SectionHeading
            eyebrow="Constat institutionnel"
            title="Une réalité de terrain : l'intelligence artificielle est déjà là"
            tone="light"
            align="center"
          />
          <p className="mx-auto mt-5 max-w-2xl text-sm text-gray-300 sm:text-base">
            Sur le terrain, les inspecteurs constatent une adoption rapide et souvent incontrôlée des
            outils d&apos;intelligence artificielle par les élèves, et parfois les enseignants, sans
            accompagnement ni cadre pédagogique clair.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <p className="text-6xl font-bold tracking-tight sm:text-7xl">{AI_STAT.value}</p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-gray-400">{AI_STAT.label}</p>
        </Reveal>
      </div>
    </section>
  );
}

export function AiResponseSection() {
  return (
    <section className="px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <SectionHeading
            eyebrow="La réponse de l'IPP"
            title="Interdire ne suffit pas : il faut éduquer"
            align="center"
          />
          <p className="mx-auto mt-5 max-w-2xl text-sm text-gray-600 sm:text-base">
            Plutôt que d&apos;interdire l&apos;intelligence artificielle, l&apos;Inspection Principale
            Provinciale choisit de former et d&apos;accompagner l&apos;ensemble des acteurs de
            l&apos;enseignement vers un usage responsable et pédagogique de ces outils.
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
          <PlaceholderMedia label="Visuel — transformation numérique" className="aspect-[4/3] w-full" />
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
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow="Sur le terrain" title="L'Inspection en action" align="center" />
          <p className="mx-auto mt-2 max-w-xl text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
            Contenu de démonstration — en attente des reportages réels
          </p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {ACTIVITIES.map((activity, i) => (
            <Reveal key={activity.title} delay={i * 0.06}>
              <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <PlaceholderMedia
                  label="Photo / vidéo"
                  rounded="rounded-none"
                  className="aspect-video w-full transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className="p-5">
                  <h3 className="text-sm font-bold text-gray-900">{activity.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-600">{activity.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
