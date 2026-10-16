import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, buttonClasses, Card, EmptyState, PageHeader, TABLE_HEAD } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { deleteFunctionAction, togglePoolStatusAction } from "./actions";

function SectionHeader({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <Link href={href} className={buttonClasses({ size: "sm", className: "min-h-10" })}>
        <Plus size={16} aria-hidden />
        {action}
      </Link>
    </div>
  );
}

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
  const th = "px-5 py-3 whitespace-nowrap";
  const td = "px-5 py-3";
  const small = "!min-h-8 !px-3 !py-1 text-xs";

  return (
    <div className="space-y-10">
      <PageHeader title="Paramètres" description="Organisation provinciale — pools, cellules et fonctions" />

      <section>
        <SectionHeader title="Pools" description={`${pools.length} pool(s) — fiche publique, chef et personnel de chacun.`} href="/parametres/nouveau" action="Nouveau pool" />
        {pools.length === 0 ? (
          <EmptyState message="Aucun pool enregistré pour le moment." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Code</th>
                  <th className={`${th} text-right`}>Écoles</th>
                  <th className={`${th} text-right`}>Utilisateurs</th>
                  <th className={th}>Statut</th>
                  <th className={th}>Site public</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pools.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-gray-50/70">
                    <td className={`${td} font-medium text-gray-900`}>
                      <Link href={`/parametres/pools/${p.id}`} className="hover:text-blue-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className={`${td} font-mono text-xs text-gray-600`}>{p.code}</td>
                    <td className={`${td} text-right tabular-nums text-gray-700`}>{p._count.schools}</td>
                    <td className={`${td} text-right tabular-nums text-gray-700`}>{p._count.users}</td>
                    <td className={td}>
                      <Badge color={p.active ? "green" : "gray"}>{p.active ? "Actif" : "Inactif"}</Badge>
                    </td>
                    <td className={`${td} text-gray-600`}>
                      {p.slug && p.active ? <span className="font-mono text-xs">/pools/{p.slug}</span> : <span className="text-gray-400">Non publié</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/parametres/pools/${p.id}`} className={buttonClasses({ variant: "outline", size: "sm", className: small })}>
                          Fiche et chef
                        </Link>
                        <ConfirmButton
                          label={p.active ? "Désactiver" : "Activer"}
                          confirmLabel={p.active ? "Désactiver" : "Activer"}
                          variant={p.active ? "danger" : "primary"}
                          className={small}
                          formAction={togglePoolStatusAction.bind(null, p.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <SectionHeader
          title="Fonctions"
          description="Les fonctions système ne se modifient pas ; une fonction ajoutée s'ajuste et se transmet à ses titulaires."
          href="/parametres/fonctions/nouveau"
          action="Nouvelle fonction"
        />
        <div className="mb-4 space-y-2 empty:hidden">
          {sp.fonction === "supprimee" && <Alert variant="success">Fonction supprimée ; elle a été retirée à tous ses titulaires.</Alert>}
          {sp.fonction === "modifiee" && <Alert variant="success">Fonction modifiée ; ses titulaires en héritent dès leur prochaine action.</Alert>}
          {sp.erreur && <Alert variant="error">{sp.erreur}</Alert>}
        </div>

        {functions.length === 0 ? (
          <EmptyState message="Aucune fonction enregistrée pour le moment." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Portée</th>
                  <th className={`${th} text-right`}>Permissions</th>
                  <th className={`${th} text-right`}>Titulaires</th>
                  <th className={th}>Origine</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {functions.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-gray-50/70">
                    <td className={`${td} min-w-56`}>
                      <Link href={`/parametres/fonctions/${f.id}`} className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                        {f.label}
                      </Link>
                      {f.description && <p className="text-pretty text-xs text-gray-500">{f.description}</p>}
                    </td>
                    <td className={`${td} text-gray-600`}>{scopeLabel[f.scope] ?? f.scope}</td>
                    <td className={`${td} text-right tabular-nums text-gray-700`}>{f.rolePermissions.length > 0 ? f.rolePermissions.length : <span className="text-gray-400">Aucune</span>}</td>
                    <td className={`${td} text-right tabular-nums text-gray-700`}>{f._count.userRoles}</td>
                    <td className={td}>
                      <Badge color={f.isSystem ? "blue" : "green"}>{f.isSystem ? "Système" : "Ajoutée"}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/parametres/fonctions/${f.id}`} className={buttonClasses({ variant: "outline", size: "sm", className: small })}>
                          {f.isSystem ? "Voir" : "Modifier"}
                        </Link>
                        {f.isSystem ? (
                          <span className="text-xs text-gray-400" title="Le logiciel s'appuie sur les fonctions système.">
                            Non supprimable
                          </span>
                        ) : (
                          <ConfirmButton
                            label="Supprimer"
                            confirmLabel={f._count.userRoles > 0 ? `Supprimer et retirer à ${f._count.userRoles} titulaire(s)` : "Supprimer"}
                            variant="danger"
                            className={small}
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
      </section>
    </div>
  );
}
