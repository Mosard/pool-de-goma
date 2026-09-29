import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { AuthorizationForm } from "@/components/publication-authorization-form";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { PERMISSIONS, PUBLICATION_AUTHORITY_ROLE_KEYS, ROLE_KEYS } from "@/lib/rbac-data";
import { CONFIRMED_IPPA_ATTRIBUTIONS } from "@/components/homepage/homepage-data";
import {
  createConfirmedAttributionsAction,
  deleteAttributionAction,
  updateDirectionAuthorizationAction,
} from "./actions";
import { AttributionForm, CreateAttributionForm } from "./direction-forms";

/**
 * Direction de l'Inspection (section publique de l'accueil) :
 * - IPP principal (direction.manage) : attributions des IPP adjoints ;
 * - IPP, informaticien, Super Admin (publication.manage) : autorisation de
 *   publier chaque membre, jamais soi-même.
 * L'accord de chacun se donne depuis son profil.
 */
export default async function DirectionPage() {
  const session = await auth();
  const user = session!.user;
  const canManage = hasPermissionAnyPool(user.permissions, PERMISSIONS.DIRECTION_MANAGE);
  const canPublish =
    hasPermissionAnyPool(user.permissions, PERMISSIONS.PUBLICATION_MANAGE) &&
    user.roles.some((r) => PUBLICATION_AUTHORITY_ROLE_KEYS.includes(r.key));
  if (!canManage && !canPublish) redirect("/dashboard");

  const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { isDemo: true } });
  const isOfficial = actor?.isDemo === false;

  const memberSelect = {
    id: true,
    name: true,
    status: true,
    photoUrl: true,
    publicationConsentIdentity: true,
    publicationConsentPhoto: true,
    publicationAuthIdentity: true,
    publicationAuthPhoto: true,
  } as const;
  const [ippHolders, adjoints, attributions] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: user.organizationId, isDemo: false, roles: { some: { role: { key: ROLE_KEYS.IPP } } } },
      orderBy: { name: "asc" },
      select: memberSelect,
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, isDemo: false, roles: { some: { role: { key: ROLE_KEYS.IPA } } } },
      orderBy: { name: "asc" },
      select: memberSelect,
    }),
    prisma.directionAttribution.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ position: "asc" }, { label: "asc" }],
      select: { id: true, label: true, position: true, holderId: true },
    }),
  ]);

  type Member = (typeof adjoints)[number];
  const identityPublic = (m: Member) => m.status === "ACTIVE" && m.publicationConsentIdentity && m.publicationAuthIdentity;
  const candidates = adjoints.filter((a) => a.status === "ACTIVE").map((a) => ({ id: a.id, name: a.name }));
  const adjointById = new Map(adjoints.map((a) => [a.id, a]));
  const activeIpp = ippHolders.filter((m) => m.status === "ACTIVE");
  const nextPosition = (attributions.at(-1)?.position ?? 0) + 10;

  const authorization = (m: Member) => {
    if (!canPublish || !isOfficial) {
      return (
        <div className="flex flex-wrap gap-1.5">
          <Badge color={m.publicationAuthIdentity ? "green" : "gray"}>Autorisation : {m.publicationAuthIdentity ? "oui" : "non"}</Badge>
          <Badge color={m.publicationAuthPhoto ? "green" : "gray"}>Photo : {m.publicationAuthPhoto ? "oui" : "non"}</Badge>
        </div>
      );
    }
    if (m.id === user.id) {
      return (
        <p className="max-w-xs text-xs text-gray-500">
          Votre propre publication doit être autorisée par un autre compte habilité (l&apos;informaticien, par exemple).
        </p>
      );
    }
    return (
      <AuthorizationForm
        action={updateDirectionAuthorizationAction.bind(null, m.id)}
        consentIdentity={m.publicationConsentIdentity}
        consentPhoto={m.publicationConsentPhoto}
        authIdentity={m.publicationAuthIdentity}
        authPhoto={m.publicationAuthPhoto}
        hasPhoto={Boolean(m.photoUrl)}
      />
    );
  };

  const memberRow = (m: Member, detail: React.ReactNode, published: boolean) => (
    <li key={m.id} className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={m.name} src={m.photoUrl} className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{m.name}</p>
          <div className="mt-1 text-xs text-gray-500">{detail}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.status !== "ACTIVE" && <Badge color="red">{m.status}</Badge>}
            <Badge color={published ? "green" : "gray"}>{published ? "Publié sur le site" : "Non publié"}</Badge>
          </div>
        </div>
      </div>
      <div className="lg:w-[22rem] lg:shrink-0">{authorization(m)}</div>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Direction de l'Inspection"
        description="IPP principal et IPP adjoints présentés sur la page d'accueil du site"
      />

      {!isOfficial && (
        <Alert variant="info">Compte de démonstration : consultation seulement. Les comptes de démonstration ne sont jamais publiés.</Alert>
      )}

      <Card>
        <p className="text-sm text-gray-600">
          Une personne n&apos;apparaît sur le site qu&apos;avec <strong>son accord</strong> (donné depuis son profil){" "}
          <strong>et</strong> l&apos;autorisation d&apos;un autre compte habilité ; la photo exige un accord et une
          autorisation distincts. Une attribution sans titulaire publié s&apos;affiche comme une place neutre, sans nom.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">IPP principal</h2>
        {activeIpp.length === 0 && (
          <p className="text-sm text-amber-700">Aucun compte IPP officiel actif : le site affiche un bloc neutre.</p>
        )}
        {activeIpp.length > 1 && (
          <p className="text-sm text-amber-700">
            Plusieurs comptes IPP actifs : le site affiche un bloc neutre tant qu&apos;un seul compte détient la fonction.
          </p>
        )}
        {ippHolders.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {ippHolders.map((m) =>
              memberRow(m, "Inspecteur Principal Provincial", identityPublic(m) && activeIpp.length === 1)
            )}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Attributions des IPP adjoints</h2>
          <p className="mt-1 text-xs text-gray-500">
            Le rôle du compte reste « IPP adjoint » ; l&apos;attribution décrit le domaine dont il est chargé. Seules les
            attributions saisies ici apparaissent sur le site.
          </p>
        </div>

        {canManage && isOfficial && attributions.length === 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
            <p>
              Attributions déjà confirmées par l&apos;Inspection : {CONFIRMED_IPPA_ATTRIBUTIONS.join(", ")}. Les autres
              restent à saisir quand elles seront connues.
            </p>
            <div className="mt-3">
              <ConfirmButton
                label="Créer ces attributions"
                confirmLabel="Créer"
                className="!min-h-0 px-3.5 py-1.5 text-xs"
                formAction={createConfirmedAttributionsAction}
              />
            </div>
          </div>
        )}

        {attributions.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune attribution saisie.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {attributions.map((a) => {
              const holder = a.holderId ? adjointById.get(a.holderId) : undefined;
              return (
                <li key={a.id} className="space-y-2 py-4">
                  {canManage && isOfficial ? (
                    <>
                      <AttributionForm
                        attributionId={a.id}
                        label={a.label}
                        position={a.position}
                        holderId={holder && holder.status === "ACTIVE" ? holder.id : null}
                        candidates={candidates}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {holder && holder.status !== "ACTIVE" && (
                          <span className="text-xs text-amber-700">
                            Titulaire actuel ({holder.name}) non actif : place neutre sur le site.
                          </span>
                        )}
                        <ConfirmButton
                          label="Supprimer l'attribution"
                          confirmLabel="Supprimer"
                          variant="danger"
                          className="!min-h-0 px-3 py-1 text-xs"
                          formAction={deleteAttributionAction.bind(null, a.id)}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-900">{a.label}</span> —{" "}
                      {holder ? holder.name : "place non attribuée"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canManage && isOfficial && (
          <div className="border-t border-gray-100 pt-4">
            <CreateAttributionForm nextPosition={nextPosition} />
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">IPP adjoints — publication</h2>
          <p className="mt-1 text-xs text-gray-500">
            Comptes officiels ayant la fonction d&apos;IPP adjoint. Un compte suspendu ou sans cette fonction disparaît du
            site.
          </p>
        </div>
        {adjoints.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun compte officiel n&apos;a la fonction d&apos;IPP adjoint.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {adjoints.map((m) => {
              const labels = attributions.filter((a) => a.holderId === m.id).map((a) => a.label);
              return memberRow(
                m,
                <>Inspecteur Principal Adjoint{labels.length > 0 ? ` — ${labels.join(", ")}` : " — sans attribution"}</>,
                identityPublic(m)
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
