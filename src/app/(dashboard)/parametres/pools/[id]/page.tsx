import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { LEGACY_POOL_PAGES } from "@/components/homepage/homepage-data";
import { ChiefForm, PoolProfileForm, PublicationForm } from "./pool-admin-forms";
import { removeChiefAction } from "./actions";

export default async function PoolAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session!.user;
  const canEditProfile = hasPermissionAnyPool(user.permissions, PERMISSIONS.POOLS_MANAGE);
  const canDesignate = hasPermissionAnyPool(user.permissions, PERMISSIONS.USERS_MANAGE);
  const canPublish = hasPermissionAnyPool(user.permissions, PERMISSIONS.PUBLICATION_MANAGE);
  if (!canEditProfile && !canDesignate && !canPublish) redirect("/dashboard");

  const { id } = await params;
  const pool = await prisma.pool.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true, code: true, active: true, slug: true, address: true, phones: true },
  });
  if (!pool) notFound();

  const [chiefHolders, candidates, claimedSlugs] = await Promise.all([
    prisma.userRole.findMany({
      where: { poolId: pool.id, role: { key: ROLE_KEYS.CHEF_POOL } },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            status: true,
            photoUrl: true,
            publishIdentity: true,
            publishPhoto: true,
            roles: { where: { poolId: pool.id, role: { key: ROLE_KEYS.INSPECTEUR } }, select: { id: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        status: "ACTIVE",
        roles: { some: { poolId: pool.id, role: { key: ROLE_KEYS.INSPECTEUR } } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pool.findMany({
      where: { organizationId: user.organizationId, slug: { not: null }, id: { not: pool.id } },
      select: { slug: true },
    }),
  ]);

  const taken = new Set(claimedSlugs.map((p) => p.slug));
  const slugSuggestions = LEGACY_POOL_PAGES.map((p) => p.slug).filter((s) => !taken.has(s));

  const holders = chiefHolders.map((h) => h.user);
  const eligible = holders.filter((h) => h.status === "ACTIVE" && h.roles.length > 0);
  const chief = eligible.length === 1 ? eligible[0] : null;
  const isPublic = pool.active && Boolean(pool.slug);

  const warnings: string[] = [];
  if (!pool.active) warnings.push("Ce POOL est inactif : il n'apparaît pas sur le site public.");
  if (!pool.slug) warnings.push("Aucune adresse publique : ce POOL n'apparaît pas encore sur le site public.");
  for (const h of holders) {
    if (h.status !== "ACTIVE") warnings.push(`${h.name} détient la fonction de chef mais son compte n'est pas actif : non affiché.`);
    else if (h.roles.length === 0)
      warnings.push(`${h.name} détient la fonction de chef sans être inspecteur de ce POOL : non affiché. Désignez un inspecteur du POOL.`);
  }
  if (eligible.length > 1) warnings.push("Plusieurs chefs valides : aucun n'est affiché tant qu'un seul n'est pas désigné.");

  let publicChiefStatus = "Visuel neutre, sans nom (aucun chef désigné).";
  if (chief) {
    if (!chief.publishIdentity) publicChiefStatus = "Visuel neutre, sans nom : publication non autorisée.";
    else if (chief.publishPhoto && chief.photoUrl) publicChiefStatus = `${chief.name}, avec sa photo.`;
    else publicChiefStatus = `${chief.name}, avec un visuel neutre (photo non publiée).`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`POOL de ${pool.name}`}
        description={`Code ${pool.code} — fiche publique, Chef de POOL et publication`}
        actions={
          <Link href="/parametres" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Retour aux paramètres
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={isPublic ? "green" : "gray"}>{isPublic ? "Publié sur le site" : "Non publié"}</Badge>
          {isPublic && (
            <Link href={`/pools/${pool.slug}`} target="_blank" className="text-sm text-blue-700 hover:underline">
              /pools/{pool.slug}
            </Link>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-600">
          <span className="font-medium text-gray-900">Bloc « Chef de POOL » affiché : </span>
          {publicChiefStatus}
        </p>
        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-sm text-amber-700">
                {w}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEditProfile ? (
        <PoolProfileForm
          poolId={pool.id}
          defaults={{ name: pool.name, slug: pool.slug ?? "", address: pool.address ?? "", phones: pool.phones }}
          slugSuggestions={slugSuggestions}
        />
      ) : (
        <Alert variant="info">La modification de la fiche du POOL est réservée aux gestionnaires des POOL.</Alert>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Chef de POOL</h2>
          <p className="mt-1 text-xs text-gray-500">
            Le chef est un inspecteur affecté à ce POOL à qui la fonction de chef est attribuée. Son nom et sa
            fonction alimentent automatiquement la page publique, sous réserve de l&apos;autorisation de publication.
          </p>
        </div>

        {holders.length > 0 ? (
          <ul className="space-y-1 text-sm text-gray-700">
            {holders.map((h) => (
              <li key={h.id} className="flex items-center gap-2">
                <span className="font-medium">{h.name}</span>
                <Badge color={h.status === "ACTIVE" ? "green" : "red"}>{h.status === "ACTIVE" ? "Actif" : h.status}</Badge>
                {h.roles.length === 0 && <Badge color="orange">Pas inspecteur du POOL</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Aucun chef désigné.</p>
        )}

        {canDesignate ? (
          <div className="space-y-3">
            <ChiefForm poolId={pool.id} candidates={candidates} currentChiefId={chief?.id ?? null} />
            {holders.length > 0 && (
              <ConfirmButton
                label="Retirer la fonction de chef"
                confirmLabel="Retirer"
                variant="danger"
                className="!min-h-0 px-3 py-1.5 text-xs"
                formAction={removeChiefAction.bind(null, pool.id)}
              />
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">La désignation du chef est réservée aux gestionnaires des comptes.</p>
        )}
      </Card>

      {chief && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Publication sur le site public</h2>
            <p className="mt-1 text-xs text-gray-500">
              Décision de l&apos;administration, tracée dans le journal d&apos;audit. Une nouvelle photo déposée par
              l&apos;inspecteur retire automatiquement l&apos;autorisation photo jusqu&apos;à une nouvelle décision.
            </p>
          </div>
          {canPublish ? (
            <PublicationForm
              poolId={pool.id}
              userId={chief.id}
              name={chief.name}
              photoUrl={chief.photoUrl}
              publishIdentity={chief.publishIdentity}
              publishPhoto={chief.publishPhoto}
            />
          ) : (
            <p className="text-xs text-gray-500">Décision réservée aux personnes habilitées à autoriser la publication.</p>
          )}
        </Card>
      )}
    </div>
  );
}
