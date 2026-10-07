import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, RESTRICTED_ROLE_KEYS } from "@/lib/rbac-data";
import { canGrantRole, hasPermissionAnyPool } from "@/lib/permissions";
import { NewUserForm } from "../new-user-form";

export default async function NouvelInspecteurPage() {
  const session = await auth();
  if (!session?.user || !hasPermissionAnyPool(session.user.permissions, PERMISSIONS.USERS_MANAGE)) {
    redirect("/inspecteurs");
  }

  const [allRoles, pools] = await Promise.all([
    prisma.roleDefinition.findMany({ where: { key: { notIn: [...RESTRICTED_ROLE_KEYS] } }, orderBy: { label: "asc" } }),
    prisma.pool.findMany({
      where: { active: true, organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  // Seules les fonctions que ce compte peut attribuer (ROLE_GRANTORS).
  const roles = allRoles.filter((r) => canGrantRole(session.user.roles, r.key, null));

  return <NewUserForm roles={roles} pools={pools} />;
}
