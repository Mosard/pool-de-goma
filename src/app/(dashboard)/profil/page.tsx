import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { pool: true, roles: { include: { role: true } } },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" description="Vos informations personnelles et professionnelles" />

      <Card className="flex items-center gap-4">
        <Avatar name={user.name} className="h-14 w-14 text-base" />
        <div>
          <p className="text-base font-semibold text-gray-900">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </Card>

      <ProfileForm
        defaultValues={{
          prenom: user.prenom,
          postnom: user.postnom,
          sex: user.sex,
          phone: user.phone,
          dateNaissance: user.dateNaissance ? user.dateNaissance.toISOString().slice(0, 10) : "",
          nombreEnfants: user.nombreEnfants,
        }}
      />

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Informations administratives</h3>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Matricule</dt>
            <dd className="font-medium text-gray-900">{user.matricule ?? "Non renseigné"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Statut administratif</dt>
            <dd className="font-medium text-gray-900">{user.statutAdministratif ?? "Non renseigné"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Mécanisé</dt>
            <dd className="font-medium text-gray-900">
              {user.mecanise === null ? "Non renseigné" : user.mecanise ? "Oui" : "Non"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-gray-400">
          Ces informations sont gérées par l&apos;administration de l&apos;Inspection.
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Affectation</h3>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Pool</dt>
            <dd className="font-medium text-gray-900">{user.pool?.name ?? "Niveau provincial"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Fonction(s)</dt>
            <dd className="font-medium text-gray-900">
              {user.roles.map((r) => r.role.label).join(", ") || "Aucune"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-gray-400">
          Un changement d&apos;affectation ou de rôle passe par le processus administratif de l&apos;Inspection.
        </p>
      </Card>
    </div>
  );
}
