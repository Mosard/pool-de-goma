import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { PhotoForm } from "./photo-form";
import { ConsentForm } from "./consent-form";
import { roleDisplayLabel } from "@/lib/cells/rules";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { pool: true, roles: { include: { role: true } } },
  });
  if (!user) redirect("/login");
  const poolNames = new Map(
    (await prisma.pool.findMany({ where: { id: { in: session.user.roles.flatMap((r) => (r.poolId ? [r.poolId] : [])) } }, select: { id: true, name: true } })).map(
      (p) => [p.id, p.name]
    )
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" description="Vos informations personnelles et professionnelles" />

      <Card>
        <PhotoForm name={user.name} photoUrl={user.photoUrl} />
        <p className="mt-3 text-sm text-gray-500">{user.email}</p>
      </Card>

      {!user.isDemo && (
        <ConsentForm
          consentIdentity={user.publicationConsentIdentity}
          consentPhoto={user.publicationConsentPhoto}
          authIdentity={user.publicationAuthIdentity}
          authPhoto={user.publicationAuthPhoto}
          hasPhoto={Boolean(user.photoUrl)}
        />
      )}

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
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Fonction(s) et périmètre</dt>
            <dd className="font-medium text-gray-900">
              {/* Rôles effectifs relus en base : la cellule affichée est celle qui borne les droits. */}
              {session.user.roles.length === 0 ? (
                "Aucune"
              ) : (
                <ul className="space-y-1">
                  {session.user.roles.map((r, i) => (
                    <li key={`${r.key}-${r.poolId ?? ""}-${r.cellId ?? ""}-${i}`}>
                      {roleDisplayLabel(r, r.poolId ? poolNames.get(r.poolId) : null)}
                    </li>
                  ))}
                </ul>
              )}
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
