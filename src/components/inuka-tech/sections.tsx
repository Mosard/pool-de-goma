import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard } from "@/components/homepage/ui-blocks";
import { RdcMapCanvas } from "@/components/homepage/rdc-map-canvas";
import { SoftwareMockup } from "@/components/homepage/software-mockup";
import { FlowChain, IconCardGrid, NumberedTimeline, SectionShell } from "./shared";
import {
  COMPANY,
  ABOUT_TEXT,
  ABOUT_CARDS,
  PARTNERSHIP_FLOW,
  PARTNERSHIP_POINTS,
  INSPECTOR_TRAINING_AXES,
  TEACHER_FLOW,
  AI_PROGRAM_MODULES,
  SOFTWARE_ROLES,
  APP_FEATURES,
  DEPLOYMENT_STEPS,
  VISION_FLOW,
  VISION_TEXT,
  EXPERTISE_AREAS,
  PARTNERS,
} from "./inuka-tech-data";

export function HeroSection() {
  return (
    <section className="hero-gradient flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center text-white">
      <div className="relative h-20 w-20 sm:h-24 sm:w-24">
        <Image src="/inuka-tech/logo.png" alt="INUKA TECH" fill sizes="96px" className="object-contain" priority />
      </div>
      <h1 className="mt-6 max-w-2xl text-3xl font-bold sm:text-5xl">{COMPANY.heroTitle}</h1>
      <p className="mt-5 max-w-2xl text-sm text-gray-200 sm:text-base">{COMPANY.heroSubtitle}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {COMPANY.heroBadges.map((badge) => (
          <span
            key={badge}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-gray-100"
          >
            {badge}
          </span>
        ))}
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section className="relative overflow-hidden bg-gray-50 px-6 py-20 sm:px-10">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <RdcMapCanvas />
      </div>
      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Qui est INUKA TECH ?"
            title="Un partenaire technologique ancré à Goma"
            description={ABOUT_TEXT}
            align="center"
          />
        </Reveal>
        <div className="mt-12">
          <IconCardGrid items={ABOUT_CARDS} columns={4} />
        </div>
      </div>
    </section>
  );
}

export function PartnershipSection() {
  return (
    <SectionShell
      eyebrow="Une collaboration, pas une substitution"
      title="Une collaboration au service de la transformation numérique de l'éducation"
      tone="dark"
    >
      <Reveal delay={0.15} className="mt-12">
        <FlowChain steps={PARTNERSHIP_FLOW} tone="dark" />
      </Reveal>
      <Reveal delay={0.25} className="mx-auto mt-10 max-w-2xl space-y-3">
        {PARTNERSHIP_POINTS.map((point) => (
          <p key={point} className="text-sm text-gray-200 sm:text-base">
            {point}
          </p>
        ))}
      </Reveal>
      <Reveal delay={0.35} className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center">
        <p className="text-xs text-gray-300 sm:text-sm">
          L&apos;Inspection reste l&apos;autorité institutionnelle et pédagogique. INUKA TECH intervient comme
          partenaire technologique et opérationnel.
        </p>
      </Reveal>
    </SectionShell>
  );
}

export function InspectorTrainingSection() {
  return (
    <section className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Formation des inspecteurs"
            title="Renforcer d'abord ceux qui accompagnent les écoles"
            description="Du niveau provincial jusqu'aux inspecteurs de terrain, une même montée en compétences numériques."
            align="center"
          />
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5">
          {INSPECTOR_TRAINING_AXES.map((axis) => (
            <span
              key={axis}
              className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 sm:text-sm"
            >
              {axis}
            </span>
          ))}
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {["/scrollytelling/formation-1.jpg", "/scrollytelling/formation-2.jpg"].map((src, i) => (
            <Reveal key={src} delay={0.1 * i}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100">
                <Image src={src} alt="Formation des inspecteurs" fill className="object-cover" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TeacherTrainingSection() {
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100">
              <Image src="/homepage/formation-enseignants.jpg" alt="Formation des enseignants" fill className="object-cover" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <SectionHeading
              eyebrow="Formation des enseignants"
              title="Donner aux enseignants les moyens de maîtriser le numérique"
              description="L'objectif n'est pas de remplacer les enseignants par la technologie, mais de leur donner de nouveaux outils. Les enseignants d'informatique deviennent des relais du programme dans leur établissement."
            />
            <div className="mt-8">
              <FlowChain steps={TEACHER_FLOW} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function AiProgramSection() {
  return (
    <SectionShell eyebrow="Programme Intelligence Artificielle" title="Former pour maîtriser" tone="dark">
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {AI_PROGRAM_MODULES.map((mod, i) => (
          <Reveal key={mod.number} delay={0.06 * i}>
            <div className="h-full rounded-2xl border border-white/15 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">
              <span className="text-xs font-bold text-blue-300">{mod.number}</span>
              <h3 className="mt-2 text-sm font-bold text-white">{mod.title}</h3>
              <p className="mt-1.5 text-xs text-gray-300 sm:text-sm">{mod.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

export function SoftwareSection() {
  return (
    <section className="overflow-hidden bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Application de gestion scolaire"
            title="De la formation à l'outil concret"
            description="Une application conçue pour simplifier la gestion des établissements scolaires, co-conçue avec l'Inspection."
            align="center"
          />
        </Reveal>
        <Reveal delay={0.15} className="mt-14">
          <SoftwareMockup />
        </Reveal>
        <Reveal delay={0.2} className="mx-auto mt-10 max-w-3xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            Le rôle d&apos;INUKA TECH
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SOFTWARE_ROLES.map((role) => (
              <span key={role} className="rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-medium text-gray-700">
                {role}
              </span>
            ))}
          </div>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {APP_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={0.04 * i}>
                <InteractiveCard className="!p-4">
                  <div className="flex items-center gap-3">
                    <Icon size={20} strokeWidth={1.5} className="shrink-0 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">{feature.title}</span>
                  </div>
                </InteractiveCard>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={0.3} className="mt-12 text-center">
          <Link href="/demande-de-compte">
            <Button>Découvrir le logiciel</Button>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function DeploymentSection() {
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="Déploiement" title="Déploiement dans les écoles" align="center" />
        </Reveal>
        <div className="mt-14">
          <NumberedTimeline steps={DEPLOYMENT_STEPS} />
        </div>
      </div>
    </section>
  );
}

export function VisionSection() {
  return (
    <SectionShell
      eyebrow="Une vision plus large"
      title="Construire des compétences, pas seulement installer des technologies"
      description={VISION_TEXT}
      tone="dark"
    >
      <Reveal delay={0.2} className="mt-12">
        <FlowChain steps={VISION_FLOW} tone="dark" />
      </Reveal>
    </SectionShell>
  );
}

export function ExpertiseSection() {
  return (
    <section className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Expertise technique"
            title="Une équipe technique expérimentée"
            description="Une expérience concrète de conception et de développement de solutions de gestion dans des environnements professionnels locaux."
            align="center"
          />
        </Reveal>
        <Reveal delay={0.15} className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5">
          {EXPERTISE_AREAS.map((area) => (
            <span key={area} className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 sm:text-sm">
              {area}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function CollaborationsIntroSection() {
  return (
    <section id="collaborations" className="bg-gray-50 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Nos collaborations"
            title="Des collaborations qui transforment le terrain"
            description="INUKA TECH accompagne également des organisations éducatives dans la formation, la conception d'outils numériques et la construction de solutions adaptées aux réalités locales."
            align="center"
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {PARTNERS.map((partner, i) => (
            <Reveal key={partner.name} delay={0.1 * i}>
              <InteractiveCard className="h-full">
                <h3 className="text-sm font-bold text-gray-900 sm:text-base">{partner.name}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {partner.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </InteractiveCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function InukaCtaSection() {
  return (
    <section className="hero-gradient px-6 py-20 text-center text-white sm:px-10">
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <h2 className="text-2xl font-bold sm:text-3xl">
            Vous êtes une école et souhaitez rejoindre la transformation numérique ?
          </h2>
          <p className="mt-4 text-sm text-gray-200 sm:text-base">
            Découvrez les solutions, formations et outils développés en collaboration avec l&apos;Inspection
            Principale Provinciale Nord-Kivu 1.
          </p>
        </Reveal>
        <Reveal delay={0.15} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/demande-de-compte">
            <Button className="!bg-white !text-blue-700 hover:!bg-gray-100">Demander un accompagnement</Button>
          </Link>
          <Link href="/demande-de-compte">
            <Button variant="ghost" className="border border-white/30 !text-white hover:!bg-white/10">
              Découvrir le logiciel
            </Button>
          </Link>
          <Link href="#collaborations">
            <Button variant="ghost" className="border border-white/30 !text-white hover:!bg-white/10">
              Contacter INUKA TECH
            </Button>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
