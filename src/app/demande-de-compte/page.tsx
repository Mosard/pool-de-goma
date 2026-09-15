import { prisma } from "@/lib/prisma";
import { getDefaultOrganization } from "@/lib/organization";
import { AccountRequestForm } from "./account-request-form";

// Ne pas prérendre au build : évite toute dépendance à une connexion DB
// disponible pendant le build (voir contraintes de déploiement Vercel).
export const dynamic = "force-dynamic";

export default async function DemandeDeComptePage() {
  const organization = await getDefaultOrganization();
  const [roles, pools] = await Promise.all([
    prisma.roleDefinition.findMany({ orderBy: { label: "asc" } }),
    prisma.pool.findMany({
      where: { active: true, organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Demande d&apos;accès</h1>
          <p className="mt-1 text-sm text-gray-500">
            Votre demande sera examinée par l&apos;informaticien de l&apos;Inspection avant activation.
          </p>
        </div>
        <AccountRequestForm roles={roles} pools={pools} />
      </div>
    </div>
  );
}
