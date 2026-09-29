import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, PageHeader } from "@/components/ui";
import { canWriteContents } from "@/lib/contents";
import { ContentEditor } from "../content-editor";

export default async function NouveauContenuPage() {
  const session = await auth();
  const user = session!.user;
  if (!canWriteContents(user.permissions)) redirect("/contenus");
  const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { isDemo: true } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouveau contenu"
        description="Actualité, article ou communiqué : enregistrez un brouillon, puis soumettez-le à validation."
        actions={
          <Link href="/contenus" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Retour aux contenus
          </Link>
        }
      />
      {actor?.isDemo !== false ? (
        <Alert variant="info">Compte de démonstration : la rédaction de contenus du site est réservée aux comptes officiels.</Alert>
      ) : (
        <ContentEditor content={null} />
      )}
    </div>
  );
}
