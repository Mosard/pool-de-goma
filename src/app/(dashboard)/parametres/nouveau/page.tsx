import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { NewPoolForm } from "../new-pool-form";

export default async function NouveauPoolPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.POOLS_MANAGE)) {
    redirect("/parametres");
  }

  return <NewPoolForm />;
}
