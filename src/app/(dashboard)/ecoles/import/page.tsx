import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, PageHeader } from "@/components/ui";
import { manageablePools } from "@/lib/schools-import/server";
import { ImportForm } from "./import-form";

// Un fichier de 2 000 écoles s'enregistre ligne par ligne.
export const maxDuration = 120;

export default async function ImportEcolesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // POOL où ce compte gère les écoles, droits relus en base.
  const pools = await manageablePools(session.user.id);
  if (pools.length === 0) redirect("/ecoles");

  return (
    <div>
      <PageHeader
        title="Importer des écoles"
        description="Enregistrement en masse à partir du canevas Excel rempli"
        actions={
          <a href="/ecoles/canevas.xlsx" download>
            <Button variant="ghost">Télécharger le canevas</Button>
          </a>
        }
      />
      <ImportForm pools={pools} />
      <p className="mt-6 text-sm">
        <Link href="/ecoles" className="text-blue-700 hover:underline">← Retour à la liste des écoles</Link>
      </p>
    </div>
  );
}
