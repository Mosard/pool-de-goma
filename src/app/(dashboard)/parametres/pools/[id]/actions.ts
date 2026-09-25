"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { poolProfileSchema } from "@/lib/validations";
import { requirePermission } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";

// Droits (vérifiés en base à chaque appel, portée organisation) :
// - fiche du POOL (nom officiel, slug, adresse, téléphones) : pools.manage ;
// - désignation / retrait du Chef de POOL : users.manage (c'est une
//   attribution de fonction, donc de droits sur le POOL) ;
// - autorisation de publier nom, fonction et photo : publication.manage.
// Le Chef de POOL ne détient aucun de ces droits par défaut.

export type PoolAdminFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

function firstErrors(fieldErrors: Record<string, string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, messages]) => messages && messages.length > 0)
      .map(([field, messages]) => [field, (messages as string[])[0]])
  );
}

async function currentActor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

function revalidatePoolAdmin(poolId: string) {
  revalidatePath(`/parametres/pools/${poolId}`);
  revalidatePath("/parametres");
  revalidatePublicPools();
}

export async function updatePoolProfileAction(
  poolId: string,
  _prevState: PoolAdminFormState,
  formData: FormData
): Promise<PoolAdminFormState> {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.POOLS_MANAGE);

  const pool = await prisma.pool.findFirst({ where: { id: poolId, organizationId: actor.organizationId } });
  if (!pool) return { formError: "POOL introuvable." };

  const parsed = poolProfileSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    address: formData.get("address") ?? "",
    phones: formData
      .getAll("phones")
      .map((v) => String(v).trim())
      .filter(Boolean),
  });
  if (!parsed.success) {
    return { errors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  const data = {
    name: parsed.data.name,
    slug: parsed.data.slug || null,
    address: parsed.data.address || null,
    phones: parsed.data.phones,
  };

  try {
    await prisma.pool.update({ where: { id: pool.id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { slug: "Cette adresse publique est déjà utilisée par un autre POOL." } };
    }
    throw e;
  }

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "pool.profile_update",
    entityType: "Pool",
    entityId: pool.id,
    oldValue: { name: pool.name, slug: pool.slug, address: pool.address, phones: pool.phones },
    newValue: data,
  });

  revalidatePoolAdmin(pool.id);
  return { success: true };
}

export async function designateChiefAction(
  poolId: string,
  _prevState: PoolAdminFormState,
  formData: FormData
): Promise<PoolAdminFormState> {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.USERS_MANAGE);

  const pool = await prisma.pool.findFirst({ where: { id: poolId, organizationId: actor.organizationId } });
  if (!pool) return { formError: "POOL introuvable." };

  const userId = String(formData.get("userId") ?? "");
  // Règle validée : le chef est un inspecteur affecté à ce POOL (fonction
  // d'inspecteur sur ce POOL), avec un compte actif.
  const candidate = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: actor.organizationId,
      status: "ACTIVE",
      roles: { some: { poolId: pool.id, role: { key: ROLE_KEYS.INSPECTEUR } } },
    },
    select: { id: true },
  });
  if (!candidate) {
    return { errors: { userId: "Choisissez un inspecteur actif affecté à ce POOL." } };
  }

  const chiefRole = await prisma.roleDefinition.findUnique({ where: { key: ROLE_KEYS.CHEF_POOL } });
  if (!chiefRole) return { formError: "La fonction « Chef de pool » n'existe pas dans le référentiel." };

  const previous = await prisma.userRole.findMany({
    where: { poolId: pool.id, roleId: chiefRole.id },
    select: { userId: true },
  });
  const alreadyChief = previous.some((p) => p.userId === candidate.id);

  // Un seul chef par POOL : la nouvelle nomination retire la fonction aux
  // titulaires précédents, dans la même transaction.
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { poolId: pool.id, roleId: chiefRole.id, userId: { not: candidate.id } } }),
    ...(alreadyChief ? [] : [prisma.userRole.create({ data: { userId: candidate.id, roleId: chiefRole.id, poolId: pool.id } })]),
  ]);

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "pool.chief_designate",
    entityType: "Pool",
    entityId: pool.id,
    oldValue: { chiefUserIds: previous.map((p) => p.userId) },
    newValue: { chiefUserId: candidate.id },
  });

  revalidatePoolAdmin(pool.id);
  return { success: true };
}

export async function removeChiefAction(poolId: string) {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.USERS_MANAGE);

  const pool = await prisma.pool.findFirst({ where: { id: poolId, organizationId: actor.organizationId } });
  if (!pool) return;

  const chiefRole = await prisma.roleDefinition.findUnique({ where: { key: ROLE_KEYS.CHEF_POOL } });
  if (!chiefRole) return;

  const previous = await prisma.userRole.findMany({
    where: { poolId: pool.id, roleId: chiefRole.id },
    select: { userId: true },
  });
  if (previous.length === 0) return;

  await prisma.userRole.deleteMany({ where: { poolId: pool.id, roleId: chiefRole.id } });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "pool.chief_remove",
    entityType: "Pool",
    entityId: pool.id,
    oldValue: { chiefUserIds: previous.map((p) => p.userId) },
    newValue: { chiefUserIds: [] },
  });

  revalidatePoolAdmin(pool.id);
}

export async function updatePublicationAction(
  poolId: string,
  userId: string,
  _prevState: PoolAdminFormState,
  formData: FormData
): Promise<PoolAdminFormState> {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.PUBLICATION_MANAGE);

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    select: { id: true, publishIdentity: true, publishPhoto: true, photoUrl: true },
  });
  if (!user) return { formError: "Compte introuvable." };

  const publishIdentity = formData.get("publishIdentity") === "on";
  // La photo n'est publiable qu'avec l'identité, et seulement si elle existe.
  const publishPhoto = publishIdentity && Boolean(user.photoUrl) && formData.get("publishPhoto") === "on";

  if (publishIdentity === user.publishIdentity && publishPhoto === user.publishPhoto) {
    return { success: true };
  }

  await prisma.user.update({ where: { id: user.id }, data: { publishIdentity, publishPhoto } });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "user.publication_update",
    entityType: "User",
    entityId: user.id,
    oldValue: { publishIdentity: user.publishIdentity, publishPhoto: user.publishPhoto },
    newValue: { publishIdentity, publishPhoto },
    metadata: { poolId },
  });

  revalidatePoolAdmin(poolId);
  return { success: true };
}
