import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { NewUserForm } from "../new-user-form";

export default async function NouvelUtilisateurPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.USERS_MANAGE)) {
    redirect("/utilisateurs");
  }

  const [roles, pools] = await Promise.all([
    prisma.roleDefinition.findMany({ orderBy: { label: "asc" } }),
    prisma.pool.findMany({
      where: { active: true, organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  return <NewUserForm roles={roles} pools={pools} />;
}
