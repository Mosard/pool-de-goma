import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { PERMISSIONS, PUBLICATION_AUTHORITY_ROLE_KEYS } from "@/lib/rbac-data";

/**
 * Point d'entrée de l'autorisation de publication (IPP, informaticien, Super
 * Admin) : liste des POOL et des accords d'agents en attente d'autorisation.
 * L'autorisation elle-même se fait dans la fiche du POOL, section « Personnel ».
 */
export default async function PublicationPage() {
  const session = await auth();
  const user = session!.user;
  const canPublish =
    hasPermissionAnyPool(user.permissions, PERMISSIONS.PUBLICATION_MANAGE) &&
    user.roles.some((r) => PUBLICATION_AUTHORITY_ROLE_KEYS.includes(r.key));
  if (!canPublish) redirect("/dashboard");

  const [pools, members] = await Promise.all([
    prisma.pool.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true, slug: true },
    }),
    prisma.userRole.findMany({
      where: {
        pool: { organizationId: user.organizationId },
        role: { scope: "POOL" },
        user: { status: "ACTIVE", isDemo: false },
      },
      select: {
        poolId: true,
        user: {
          select: {
            id: true,
            photoUrl: true,
            publicationConsentIdentity: true,
            publicationAuthIdentity: true,
            publicationConsentPhoto: true,
            publicationAuthPhoto: true,
          },
        },
      },
    }),
  ]);

  // Par POOL : agents officiels, publiés, et accords en attente d'autorisation.
  const stats = new Map<string, { agents: Set<string>; published: Set<string>; pending: Set<string> }>();
  for (const m of members) {
    if (!m.poolId) continue;
    const s = stats.get(m.poolId) ?? { agents: new Set(), published: new Set(), pending: new Set() };
    const u = m.user;
    s.agents.add(u.id);
    if (u.publicationConsentIdentity && u.publicationAuthIdentity) s.published.add(u.id);
    const identityWaiting = u.publicationConsentIdentity && !u.publicationAuthIdentity;
    const photoWaiting = Boolean(u.photoUrl) && u.publicationConsentPhoto && !u.publicationAuthPhoto;
    if (identityWaiting || photoWaiting) s.pending.add(u.id);
    stats.set(m.poolId, s);
  }
  const totalPending = [...stats.values()].reduce((n, s) => n + s.pending.size, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publication des agents"
        description={
          totalPending > 0
            ? `${totalPending} agent(s) ont donné leur accord et attendent votre autorisation`
            : "Aucun accord en attente d'autorisation"
        }
      />
      <Card>
        <p className="text-sm text-gray-600">
          Un agent n&apos;apparaît sur le site public qu&apos;avec <strong>son accord</strong> (donné depuis son profil){" "}
          <strong>et</strong> votre autorisation. Ouvrez la fiche d&apos;un POOL : dans « Personnel du POOL », cochez
          « Nom et fonction » (et « Photo » si l&apos;agent en a une), puis « Enregistrer ».
        </p>
      </Card>
      {pools.length === 0 ? (
        <EmptyState message="Aucun POOL." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">POOL</th>
                <th className="px-6 py-3">Site public</th>
                <th className="px-6 py-3">Agents officiels</th>
                <th className="px-6 py-3">Publiés</th>
                <th className="px-6 py-3">À autoriser</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pools.map((p) => {
                const s = stats.get(p.id);
                const pending = s?.pending.size ?? 0;
                return (
                  <tr key={p.id} className="hover:bg-blue-50/40">
                    <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-6 py-3">
                      <Badge color={p.active && p.slug ? "green" : "gray"}>{p.active && p.slug ? "Publié" : "Non publié"}</Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{s?.agents.size ?? 0}</td>
                    <td className="px-6 py-3 text-gray-600">{s?.published.size ?? 0}</td>
                    <td className="px-6 py-3">
                      {pending > 0 ? <Badge color="orange">{pending}</Badge> : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/parametres/pools/${p.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                        Ouvrir la fiche
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
