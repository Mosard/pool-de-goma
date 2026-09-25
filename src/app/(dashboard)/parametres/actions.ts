"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { poolSchema, functionSchema } from "@/lib/validations";
import { requirePermission } from "@/lib/permissions";
import { PERMISSIONS, PERMISSION_CATALOG } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";

export type PoolFormState = {
  errors?: Record<string, string>;
  formError?: string;
};

export type FunctionFormState = {
  errors?: Record<string, string>;
  formError?: string;
};

function slugifyRoleKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function createPoolAction(
  _prevState: PoolFormState,
  formData: FormData
): Promise<PoolFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.POOLS_MANAGE);

  const parsed = poolSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  let pool;
  try {
    pool = await prisma.pool.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        organizationId: session.user.organizationId,
      },
    });
  } catch {
    return { formError: "Ce code de pool existe déjà." };
  }

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "pool.create",
    entityType: "Pool",
    entityId: pool.id,
    newValue: { name: pool.name, code: pool.code },
  });

  revalidatePath("/parametres");
  redirect("/parametres");
}

export async function togglePoolStatusAction(poolId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.POOLS_MANAGE);

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool || pool.organizationId !== session.user.organizationId) return;

  const nextActive = !pool.active;
  await prisma.pool.update({ where: { id: poolId }, data: { active: nextActive } });

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "pool.status_change",
    entityType: "Pool",
    entityId: poolId,
    oldValue: { active: pool.active },
    newValue: { active: nextActive },
  });

  revalidatePath("/parametres");
  // Un POOL désactivé disparaît du site public.
  revalidatePublicPools();
}

export async function createFunctionAction(
  _prevState: FunctionFormState,
  formData: FormData
): Promise<FunctionFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requirePermission(session.user.id, PERMISSIONS.POOLS_MANAGE);

  const parsed = functionSchema.safeParse({
    label: formData.get("label"),
    description: formData.get("description"),
    scope: formData.get("scope"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const validKeys = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));
  const permissionKeys = formData.getAll("permissionKeys").filter((k): k is string => typeof k === "string" && validKeys.has(k));

  const key = slugifyRoleKey(parsed.data.label);
  if (!key) return { errors: { label: "Nom invalide." } };

  let role;
  try {
    role = await prisma.roleDefinition.create({
      data: {
        key,
        label: parsed.data.label,
        description: parsed.data.description || null,
        scope: parsed.data.scope,
        isSystem: false,
        rolePermissions: {
          create: permissionKeys.map((permissionKey) => ({
            permission: { connect: { key: permissionKey } },
          })),
        },
      },
    });
  } catch {
    return { formError: "Une fonction avec un nom très proche existe déjà." };
  }

  await logAudit({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: "function.create",
    entityType: "RoleDefinition",
    entityId: role.id,
    newValue: { key: role.key, label: role.label, scope: role.scope, permissionKeys },
  });

  revalidatePath("/parametres");
  redirect("/parametres");
}
