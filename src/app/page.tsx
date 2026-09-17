import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui";
import { InstitutionalCarousel } from "@/components/institutional-carousel";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LeadershipSection } from "@/components/homepage/leadership-section";
import { PoolsSection } from "@/components/homepage/pools-section";
import {
  IppIntroSection,
  MissionSection,
  TrilogySection,
  AiObservationSection,
  AiResponseSection,
  AiMessageSection,
  DigitalTransformationSection,
  SchoolSoftwareSection,
  ActionSection,
} from "@/components/homepage/sections";

export default async function Home() {
  const session = await auth();
  const isConnected = Boolean(session?.user);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader isConnected={isConnected} />

      {/* Hero institutionnel */}
      <section id="accueil" className="hero-gradient flex min-h-[80vh] flex-col items-center justify-center px-6 text-center text-white">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-300">
          Site en construction — contenu provisoire
        </p>
        <h1 className="max-w-3xl text-3xl font-bold sm:text-5xl">
          Inspection Principale Provinciale de l&apos;Enseignement — Nord-Kivu 1
        </h1>
        <p className="mt-5 max-w-xl text-sm text-gray-200 sm:text-base">
          Une administration qui accompagne la transformation numérique de l&apos;enseignement, des institutions
          jusqu&apos;aux élèves.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login">
            <Button className="!bg-white !text-blue-700 hover:!bg-gray-100">Espace professionnel</Button>
          </Link>
          <Link href="/demande-de-compte">
            <Button variant="ghost" className="border border-white/30 !text-white hover:!bg-white/10">
              Demander un accès
            </Button>
          </Link>
        </div>
      </section>

      {/* L'Inspection : qui elle est, sa mission, ses piliers */}
      <section id="inspection">
        <IppIntroSection />
        <MissionSection />
        <TrilogySection />
      </section>

      {/* Constat de terrain sur l'IA, puis réponse de l'IPP */}
      <AiObservationSection />
      <AiResponseSection />
      <AiMessageSection />

      {/* Modernisation de l'administration et outil gratuit pour les écoles */}
      <DigitalTransformationSection />
      <SchoolSoftwareSection />

      {/* Gouvernance de l'Inspection */}
      <LeadershipSection />

      {/* Vie institutionnelle */}
      <ActionSection />

      <section id="actualites" className="bg-white px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-3xl">Actualités</h2>
          <InstitutionalCarousel />
        </div>
      </section>

      <PoolsSection />

      <SiteFooter />
    </div>
  );
}
