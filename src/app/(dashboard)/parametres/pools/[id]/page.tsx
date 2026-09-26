import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { PERMISSIONS, PUBLICATION_AUTHORITY_ROLE_KEYS, ROLE_KEYS } from "@/lib/rbac-data";
import { LEGACY_POOL_PAGES } from "@/components/homepage/homepage-data";
import { AddRoleForm, AuthorizationForm, ChiefForm, PoolProfileForm } from "./pool-admin-forms";
import { removeChiefAction, removePoolRoleAction, setOfficialPageAction } from "./actions";
import { DEMO_POOL_SHOWCASES } from "@/lib/pool-demo";

const RECORD_LABELS = {
  CONSENT: { true: "Accord donné par l'agent", false: "Accord retiré par l'agent" },
  AUTHORIZATION: { true: "Publication autorisée", false: "Autorisation retirée" },
} as const;

export default async function PoolAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session!.user;
  const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { isDemo: true } });
  const isOfficial = actor?.isDemo === false;
  const canEditProfile = hasPermissionAnyPool(user.permissions, PERMISSIONS.POOLS_MANAGE);
  const canManageStaff = hasPermissionAnyPool(user.permissions, PERMISSIONS.USERS_MANAGE);
  const canPublish =
    hasPermissionAnyPool(user.permissions, PERMISSIONS.PUBLICATION_MANAGE) &&
    user.roles.some((r) => PUBLICATION_AUTHORITY_ROLE_KEYS.includes(r.key));
  if (!canEditProfile && !canManageStaff && !canPublish) redirect("/dashboard");

  const { id } = await params;
  const pool = await prisma.pool.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      slug: true,
      address: true,
      officialEmail: true,
      officialPageSince: true,
    },
  });
  if (!pool) notFound();

  const [memberRoles, poolRoles, activeUsers, claimedSlugs] = await Promise.all([
    prisma.userRole.findMany({
      where: { poolId: pool.id },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        role: { select: { key: true, label: true } },
        user: {
          select: {
            id: true,
            name: true,
            status: true,
            isDemo: true,
            photoUrl: true,
            publicationConsentIdentity: true,
            publicationConsentPhoto: true,
            publicationAuthIdentity: true,
            publicationAuthPhoto: true,
          },
        },
      },
    }),
    prisma.roleDefinition.findMany({
      where: { scope: "POOL", key: { not: ROLE_KEYS.CHEF_POOL } },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, status: "ACTIVE", isDemo: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pool.findMany({
      where: { organizationId: user.organizationId, slug: { not: null }, id: { not: pool.id } },
      select: { slug: true },
    }),
  ]);

  // Regroupe les fonctions par agent.
  type MemberUser = (typeof memberRoles)[number]["user"];
  const members = new Map<string, { user: MemberUser; roles: { userRoleId: string; key: string; label: string }[] }>();
  for (const mr of memberRoles) {
    const m = members.get(mr.user.id) ?? { user: mr.user, roles: [] };
    m.roles.push({ userRoleId: mr.id, key: mr.role.key, label: mr.role.label });
    members.set(mr.user.id, m);
  }
  const memberList = [...members.values()];
  const isInspector = (m: (typeof memberList)[number]) => m.roles.some((r) => r.key === ROLE_KEYS.INSPECTEUR);

  const history = await prisma.publicationRecord.findMany({
    where: { userId: { in: memberList.map((m) => m.user.id) } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      kind: true,
      scope: true,
      granted: true,
      reason: true,
      createdAt: true,
      user: { select: { name: true } },
      actor: { select: { name: true } },
    },
  });

  const taken = new Set(claimedSlugs.map((p) => p.slug));
  const slugSuggestions = LEGACY_POOL_PAGES.map((p) => p.slug).filter((s) => !taken.has(s));

  const holders = memberList.filter((m) => m.roles.some((r) => r.key === ROLE_KEYS.CHEF_POOL));
  const eligible = holders.filter((m) => m.user.status === "ACTIVE" && !m.user.isDemo && isInspector(m));
  const chief = eligible.length === 1 ? eligible[0].user : null;
  const candidates = memberList
    .filter((m) => m.user.status === "ACTIVE" && !m.user.isDemo && isInspector(m))
    .map((m) => ({ id: m.user.id, name: m.user.name }));
  const isPublic = pool.active && Boolean(pool.slug);
  const identityPublic = (u: MemberUser) =>
    u.status === "ACTIVE" && !u.isDemo && u.publicationConsentIdentity && u.publicationAuthIdentity;

  const warnings: string[] = [];
  if (!pool.active) warnings.push("Ce POOL est inactif : il n'apparaît pas sur le site public.");
  if (!pool.slug) warnings.push("Aucune adresse publique : ce POOL n'apparaît pas encore sur le site public.");
  for (const h of holders) {
    if (h.user.isDemo) warnings.push(`${h.user.name} (compte de démonstration) détient la fonction de chef : jamais affiché.`);
    else if (h.user.status !== "ACTIVE") warnings.push(`${h.user.name} détient la fonction de chef mais son compte n'est pas actif : non affiché.`);
    else if (!isInspector(h))
      warnings.push(`${h.user.name} détient la fonction de chef sans être inspecteur de ce POOL : non affiché. Nommez un inspecteur du POOL.`);
  }
  if (eligible.length > 1) warnings.push("Plusieurs chefs valides : aucun n'est affiché tant qu'un seul n'est pas nommé.");

  let publicChiefStatus = "visuel neutre, sans nom (aucun chef nommé).";
  if (chief) {
    if (!identityPublic(chief)) publicChiefStatus = "visuel neutre, sans nom (accord ou autorisation manquant).";
    else if (chief.publicationConsentPhoto && chief.publicationAuthPhoto && chief.photoUrl)
      publicChiefStatus = `${chief.name}, avec sa photo.`;
    else publicChiefStatus = `${chief.name}, avec un visuel neutre (photo non publiée).`;
  }
  const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Africa/Lubumbashi" });
  const hasDemo = Boolean(pool.slug && DEMO_POOL_SHOWCASES[pool.slug]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`POOL de ${pool.name}`}
        description={`Code ${pool.code} — fiche publique, personnel et publication`}
        actions={
          <Link href="/parametres" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Retour aux paramètres
          </Link>
        }
      />

      {!isOfficial && (
        <Alert variant="info">
          Compte de démonstration : consultation seulement. Les informations officielles ne peuvent pas être modifiées
          depuis ce compte.
        </Alert>
      )}

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

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Page publique : maquette ou mode officiel</h2>
        {!hasDemo ? (
          <p className="text-sm text-gray-600">
            Aucune maquette n&apos;existe pour ce POOL : sa page affiche uniquement les données officielles publiées.
          </p>
        ) : pool.officialPageSince ? (
          <>
            <p className="text-sm text-gray-600">
              <Badge color="green">Mode officiel</Badge>{" "}
              depuis le {fmt(pool.officialPageSince)} : la page n&apos;affiche que les données officielles, aucune donnée
              fictive.
            </p>
            {canPublish && isOfficial && (
              <ConfirmButton
                label="Revenir à la maquette"
                confirmLabel="Revenir à la maquette"
                variant="danger"
                className="!min-h-0 px-3 py-1.5 text-xs"
                formAction={setOfficialPageAction.bind(null, pool.id, false)}
              />
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              <Badge color="orange">Maquette affichée</Badge>{" "}
              La page publique montre la maquette (données et portraits fictifs, signalés) tant que le passage en mode
              officiel n&apos;est pas décidé — même si des écoles ou des agents sont déjà publiés. Après le passage, seules
              les données officielles autorisées apparaissent.
            </p>
            {canPublish && isOfficial ? (
              <ConfirmButton
                label="Passer la page en mode officiel"
                confirmLabel="Confirmer le passage en mode officiel"
                className="!min-h-0 px-3 py-1.5 text-xs"
                formAction={setOfficialPageAction.bind(null, pool.id, true)}
              />
            ) : (
              <p className="text-xs text-gray-500">Décision réservée à l&apos;IPP et à l&apos;informaticien.</p>
            )}
          </>
        )}
      </Card>

      {canEditProfile && isOfficial ? (
        <PoolProfileForm
          poolId={pool.id}
          defaults={{
            name: pool.name,
            slug: pool.slug ?? "",
            address: pool.address ?? "",
            officialEmail: pool.officialEmail ?? "",
          }}
          slugSuggestions={slugSuggestions}
        />
      ) : (
        <Card>
          <h2 className="text-base font-semibold text-gray-900">Fiche officielle du POOL</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Adresse du bureau</dt>
              <dd className="text-gray-900">{pool.address ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">E-mail institutionnel</dt>
              <dd className="text-gray-900">{pool.officialEmail ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Chef de POOL</h2>
          <p className="mt-1 text-xs text-gray-500">
            Un seul chef à la fois : un inspecteur de ce POOL nommé à cette fonction. Sa nomination renseigne le bloc
            « Chef de POOL » de la page publique, sous réserve de son accord et de l&apos;autorisation de publication.
          </p>
        </div>
        {canManageStaff && isOfficial ? (
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
          <p className="text-sm text-gray-700">{chief ? chief.name : "Aucun chef nommé."}</p>
        )}
      </Card>

      <Card className="space-y-4 overflow-x-auto">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Personnel du POOL</h2>
          <p className="mt-1 text-xs text-gray-500">
            Un agent n&apos;apparaît sur le site qu&apos;avec son accord (donné depuis son profil) ET l&apos;autorisation de
            l&apos;IPP ou de l&apos;informaticien. Un compte suspendu ou une fonction retirée disparaît de l&apos;affichage.
          </p>
        </div>
        {memberList.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun agent n&apos;a de fonction dans ce POOL.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Fonction(s)</th>
                <th className="py-2 pr-4">Sur le site</th>
                <th className="py-2">Autorisation (IPP / informaticien)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {memberList.map(({ user: u, roles }) => (
                <tr key={u.id} className="align-top">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} src={u.photoUrl} className="h-9 w-9" />
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <div className="mt-0.5 flex gap-1">
                          {u.status !== "ACTIVE" && <Badge color="red">{u.status}</Badge>}
                          {u.isDemo && <Badge color="orange">Démo</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <ul className="space-y-1">
                      {roles.map((r) => (
                        <li key={r.userRoleId} className="flex items-center gap-2 text-gray-700">
                          {r.label}
                          {canManageStaff && (isOfficial || u.isDemo) && r.key !== ROLE_KEYS.CHEF_POOL && (
                            <ConfirmButton
                              label="Retirer"
                              confirmLabel="Retirer la fonction"
                              variant="danger"
                              className="!min-h-0 px-2 py-0.5 text-[11px]"
                              formAction={removePoolRoleAction.bind(null, pool.id, r.userRoleId)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge color={identityPublic(u) ? "green" : "gray"}>{identityPublic(u) ? "Publié" : "Non publié"}</Badge>
                  </td>
                  <td className="py-3">
                    {u.isDemo ? (
                      <span className="text-xs text-gray-400">Compte de démonstration : jamais publié.</span>
                    ) : canPublish && isOfficial ? (
                      <AuthorizationForm
                        poolId={pool.id}
                        userId={u.id}
                        consentIdentity={u.publicationConsentIdentity}
                        consentPhoto={u.publicationConsentPhoto}
                        authIdentity={u.publicationAuthIdentity}
                        authPhoto={u.publicationAuthPhoto}
                        hasPhoto={Boolean(u.photoUrl)}
                      />
                    ) : (
                      <span className="text-xs text-gray-500">
                        Accord : {u.publicationConsentIdentity ? "oui" : "non"} — Autorisation :{" "}
                        {u.publicationAuthIdentity ? "oui" : "non"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManageStaff && isOfficial && (
          <div className="border-t border-gray-100 pt-4">
            <AddRoleForm poolId={pool.id} users={activeUsers} roles={poolRoles} />
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Historique des accords et autorisations</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune décision enregistrée.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-gray-700">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-gray-400">{fmt(h.createdAt)}</span> — {h.user.name} :{" "}
                {RECORD_LABELS[h.kind][h.granted ? "true" : "false"]} ({h.scope === "PHOTO" ? "photo" : "nom et fonction"})
                {h.reason === "photo_changed" && " — nouvelle photo à examiner"}
                {h.actor && <span className="text-gray-400"> — par {h.actor.name}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
