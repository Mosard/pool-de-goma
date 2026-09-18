import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PERMISSIONS, PERMISSION_CATALOG } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { NewFunctionForm } from "../new-function-form";

export default async function NouvelleFonctionPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.POOLS_MANAGE)) {
    redirect("/parametres");
  }

  return <NewFunctionForm permissionCatalog={PERMISSION_CATALOG} />;
}
