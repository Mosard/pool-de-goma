import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, Card, EmptyState } from "@/components/ui";
import { Scrollytelling } from "@/components/scrollytelling/scrollytelling";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

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
        <Link href="/login">
          <Button className="!min-h-0 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-gray-100">
            Connexion
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
            <Button className="bg-white text-blue-700 hover:bg-gray-100">Espace professionnel</Button>
          </Link>
          <Link href="/demande-de-compte">
            <Button variant="ghost" className="border border-white/30 text-white hover:bg-white/10">
              Demander un accès
            </Button>
          </Link>
        </div>
      </section>

      {/* Séquence narrative (scrollytelling) */}
      <section id="inspection">
        <Scrollytelling />
      </section>

      {/* Après la partie immersive : simple et pratique */}
      <main className="mx-auto w-full max-w-5xl space-y-10 px-6 py-16">
        <section id="actualites">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Actualités</h2>
          <EmptyState message="Aucune actualité publiée pour le moment. Le back-office éditorial arrive prochainement." />
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-gray-900">Espace professionnel</h3>
            <p className="text-sm text-gray-600">
              Accès réservé aux agents et inspecteurs de l&apos;Inspection, selon leur rôle et leur pool.
            </p>
            <Link href="/login" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
              Se connecter →
            </Link>
          </Card>
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-gray-900">Demande d&apos;accès</h3>
            <p className="text-sm text-gray-600">
              Vous travaillez pour l&apos;Inspection et n&apos;avez pas encore de compte ? Faites votre demande.
            </p>
            <Link href="/demande-de-compte" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
              Demander un accès →
            </Link>
          </Card>
        </section>

        <section id="contacts">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Contacts</h2>
          <Card>
            <p className="text-sm text-gray-600">
              Inspection Principale Provinciale de l&apos;Enseignement — Province Éducationnelle Nord-Kivu 1, Goma,
              République Démocratique du Congo.
            </p>
          </Card>
        </section>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6 text-center text-xs text-gray-400">
        Inspection Principale Provinciale — Nord-Kivu 1
      </footer>
    </div>
  );
}
