import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui";
import { InstitutionalCarousel } from "@/components/institutional-carousel";
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

async function getPublicPools() {
  try {
    return await prisma.pool.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch {
    // Le site public ne doit jamais tomber si la base est momentanément
    // indisponible — PoolsSection affiche un message de repli sur liste vide.
    return [];
  }
}

export default async function Home() {
  const [session, pools] = await Promise.all([auth(), getPublicPools()]);
  const isConnected = Boolean(session?.user);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navigation */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[var(--color-navy)] px-6 py-4 text-white sm:px-10">
        <span className="text-base font-bold">IPP Nord-Kivu 1</span>
        <nav className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
          <a href="#accueil" className="hover:text-white">Accueil</a>
          <a href="#inspection" className="hover:text-white">L&apos;Inspection</a>
          <a href="#actualites" className="hover:text-white">Actualités</a>
          <a href="#contacts" className="hover:text-white">Contacts</a>
        </nav>
        <Link href={isConnected ? "/dashboard" : "/login"}>
          <Button className="!min-h-0 !bg-white !text-blue-700 px-4 py-2 text-sm hover:!bg-gray-100">
            {isConnected ? "Mon espace" : "Connexion"}
          </Button>
        </Link>
      </header>

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

      <PoolsSection pools={pools} />

      <SiteFooter />
    </div>
  );
}
