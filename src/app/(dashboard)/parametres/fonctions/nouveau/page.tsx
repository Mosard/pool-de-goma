import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS, PERMISSIONS, PERMISSION_CATALOG } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { NewFunctionForm } from "../new-function-form";

export default async function NouvelleFonctionPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.POOLS_MANAGE)) {
    redirect("/parametres");
  }

  // Les pouvoirs réservés et permissions sensibles de la présence ne sont pas proposés.
  return <NewFunctionForm permissionCatalog={PERMISSION_CATALOG.filter((p) => !CUSTOM_FUNCTION_FORBIDDEN_PERMISSIONS.includes(p.key))} />;
}
