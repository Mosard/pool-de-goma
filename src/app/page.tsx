import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-lg font-bold text-gray-900">IPP Nord-Kivu 1</span>
        <Link href="/login">
          <Button variant="ghost">Connexion</Button>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">
          Site en construction — contenu provisoire
        </p>
        <h1 className="max-w-2xl text-3xl font-bold text-gray-900 sm:text-4xl">
          Inspection Principale Provinciale de l&apos;Enseignement — Province Éducationnelle Nord-Kivu 1
        </h1>
        <p className="mt-4 max-w-xl text-sm text-gray-600 sm:text-base">
          Cette plateforme numérise progressivement le fonctionnement de l&apos;Inspection : écoles, pools,
          inspections, rapports et validation. La présentation institutionnelle complète (missions, actualités,
          galeries, vidéo de présentation) sera publiée prochainement.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login">
            <Button>Espace professionnel</Button>
          </Link>
          <Link href="/demande-de-compte">
            <Button variant="secondary">Demander un accès</Button>
          </Link>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-gray-400">
        Inspection Principale Provinciale — Nord-Kivu 1
      </footer>
    </div>
  );
}
