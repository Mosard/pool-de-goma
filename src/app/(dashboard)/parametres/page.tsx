import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { togglePoolStatusAction } from "./actions";

export default async function ParametresPage() {
  const session = await auth();
  const user = session!.user;
  if (!hasPermissionAnyPool(user.permissions, PERMISSIONS.POOLS_MANAGE)) redirect("/dashboard");

  const [pools, functions] = await Promise.all([
    prisma.pool.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { schools: true, users: true } } },
    }),
    prisma.roleDefinition.findMany({
      orderBy: { label: "asc" },
      include: { rolePermissions: true, _count: { select: { userRoles: true } } },
    }),
  ]);

  const scopeLabel: Record<string, string> = { PROVINCE: "Provincial", POOL: "Pool" };

  return (
    <div className="space-y-10">
      <PageHeader title="Paramètres" description="Organisation provinciale — pools et fonctions" />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pools</h2>
          <Link href="/parametres/nouveau">
            <Button>Nouveau pool</Button>
          </Link>
        </div>

        {pools.length === 0 ? (
          <EmptyState message="Aucun pool enregistré pour le moment." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Écoles</th>
                  <th className="px-6 py-3">Utilisateurs</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3">Site public</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pools.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <Link href={`/parametres/pools/${p.id}`} className="hover:text-blue-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{p.code}</td>
                    <td className="px-6 py-3 text-gray-600">{p._count.schools}</td>
                    <td className="px-6 py-3 text-gray-600">{p._count.users}</td>
                    <td className="px-6 py-3">
                      <Badge color={p.active ? "green" : "gray"}>{p.active ? "Actif" : "Inactif"}</Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {p.slug && p.active ? `/pools/${p.slug}` : <span className="text-gray-400">Non publié</span>}
                    </td>
                    <td className="space-x-2 whitespace-nowrap px-6 py-3 text-right">
                      <Link href={`/parametres/pools/${p.id}`}>
                        <Button variant="secondary" className="!min-h-0 px-3 py-1.5 text-xs">
                          Fiche et chef
                        </Button>
                      </Link>
                      <ConfirmButton
                        label={p.active ? "Désactiver" : "Activer"}
                        confirmLabel={p.active ? "Désactiver" : "Activer"}
                        variant={p.active ? "danger" : "primary"}
                        className="!min-h-0 px-3 py-1.5 text-xs"
                        formAction={togglePoolStatusAction.bind(null, p.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Fonctions</h2>
          <Link href="/parametres/fonctions/nouveau">
            <Button>Nouvelle fonction</Button>
          </Link>
        </div>

        {functions.length === 0 ? (
          <EmptyState message="Aucune fonction enregistrée pour le moment." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Portée</th>
                  <th className="px-6 py-3">Permissions</th>
                  <th className="px-6 py-3">Titulaires</th>
                  <th className="px-6 py-3">Origine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {functions.map((f) => (
                  <tr key={f.id} className="hover:bg-blue-50/40">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{f.label}</p>
                      {f.description && <p className="text-xs text-gray-400">{f.description}</p>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{scopeLabel[f.scope] ?? f.scope}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {f.rolePermissions.length > 0 ? `${f.rolePermissions.length} permission(s)` : "Aucune"}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{f._count.userRoles}</td>
                    <td className="px-6 py-3">
                      <Badge color={f.isSystem ? "blue" : "green"}>{f.isSystem ? "Système" : "Ajoutée"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
