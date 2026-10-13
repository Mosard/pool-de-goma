import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { canOpenAccessScreen } from "@/lib/access-rules";
import { deleteFunctionAction, togglePoolStatusAction } from "./actions";
import { Alert } from "@/components/ui";

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ fonction?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const user = session!.user;
  if (!hasPermissionAnyPool(user.permissions, PERMISSIONS.POOLS_MANAGE)) {
    // Gestion de la cellule du personnel seule (secrétaires, IPA du personnel) : directement aux cellules.
    redirect(hasPermissionAnyPool(user.permissions, PERMISSIONS.CELLS_PERSONNEL_MANAGE) ? "/parametres/cellules" : "/dashboard");
  }

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

  const scopeLabel: Record<string, string> = { PROVINCE: "Provincial", POOL: "Pool", CELL: "Cellule" };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Paramètres"
        description="Organisation provinciale — pools, cellules et fonctions"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/parametres/cellules">
              <Button type="button" variant="secondary">
                Cellules de l&apos;IPP
              </Button>
            </Link>
            {canOpenAccessScreen(user.roles) && (
              <Link href="/parametres/acces">
                <Button type="button">Gérer les accès</Button>
              </Link>
            )}
          </div>
        }
      />

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
        {sp.fonction === "supprimee" && <Alert variant="success">Fonction supprimée ; elle a été retirée à tous ses titulaires.</Alert>}
        {sp.fonction === "modifiee" && <Alert variant="success">Fonction modifiée ; ses titulaires en héritent dès leur prochaine action.</Alert>}
        {sp.erreur && <Alert variant="error">{sp.erreur}</Alert>}
        <div className="mb-4 mt-2 flex items-center justify-between">
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
                  <th className="px-6 py-3" />
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
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/parametres/fonctions/${f.id}`} className="text-xs font-medium text-blue-700 underline">
                          {f.isSystem ? "Voir" : "Modifier"}
                        </Link>
                        {f.isSystem ? (
                          <span className="text-xs text-gray-400" title="Le logiciel s'appuie sur les fonctions système.">Non supprimable</span>
                        ) : (
                          <ConfirmButton
                            label="Supprimer"
                            confirmLabel={f._count.userRoles > 0 ? `Supprimer et retirer à ${f._count.userRoles} titulaire(s)` : "Supprimer"}
                            variant="danger"
                            className="!min-h-0 !px-3 !py-1.5 text-xs"
                            formAction={deleteFunctionAction.bind(null, f.id)}
                          />
                        )}
                      </div>
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
