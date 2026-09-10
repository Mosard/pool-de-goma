import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { SchoolForm } from "../school-form";
import { createSchoolAction } from "../actions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";

export default async function NouvelleEcolePage() {
  const session = await auth();
  const user = session?.user;
  if (!user || !hasPermissionAnyPool(user.permissions, PERMISSIONS.SCHOOLS_MANAGE)) redirect("/ecoles");

  const isProvinceScoped = user.permissions.some((p) => p.poolId === null);
  const pools = await prisma.pool.findMany({
    where: isProvinceScoped ? { active: true } : { id: user.poolId ?? "__none__" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader title="Nouvelle école" description="Ajouter une école à un pool" />
      <SchoolForm action={createSchoolAction} pools={pools} defaultValues={{ poolId: user.poolId ?? undefined }} />
    </div>
  );
}
