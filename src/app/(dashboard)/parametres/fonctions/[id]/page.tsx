import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS, PERMISSIONS, PERMISSION_CATALOG } from "@/lib/rbac-data";
import { EditFunctionForm } from "../edit-function-form";

// Modifier une fonction : personnalisée → formulaire (titulaires mis à jour
// automatiquement) ; système → consultation seule (le logiciel en dépend).
export default async function EditFunctionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermissionAnyPool(session.user.permissions, PERMISSIONS.POOLS_MANAGE)) redirect("/dashboard");
  const { id } = await params;
  const role = await prisma.roleDefinition.findUnique({
    where: { id },
    include: { rolePermissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
  });
  if (!role) notFound();
  const keys = role.rolePermissions.map((rp) => rp.permission.key);
  const back = (
    <Link href="/parametres">
      <Button type="button" variant="secondary">
        Retour aux paramètres
      </Button>
    </Link>
  );

  if (role.isSystem) {
    return (
      <div className="space-y-4">
        <PageHeader title={role.label} description="Fonction système : consultation seule" actions={back} />
        <Card className="text-sm text-gray-700">
          <p className="mb-3">
            <Badge color="blue">Système</Badge> Le logiciel s&apos;appuie sur cette fonction (circuits de rapports, cellules, présences) : ses permissions ne se
            modifient pas depuis l&apos;écran. {role._count.userRoles} titulaire(s).
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {PERMISSION_CATALOG.filter((p) => keys.includes(p.key)).map((p) => (
              <li key={p.key}>{p.label}</li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Modifier la fonction « ${role.label} »`} description="Fonction personnalisée" actions={back} />
      <EditFunctionForm
        role={{ id: role.id, label: role.label, description: role.description, permissionKeys: keys, holders: role._count.userRoles }}
        permissionCatalog={PERMISSION_CATALOG.filter((p) => !CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS.includes(p.key))}
      />
    </div>
  );
}
