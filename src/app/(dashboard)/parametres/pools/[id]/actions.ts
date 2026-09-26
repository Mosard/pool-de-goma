"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { poolProfileSchema } from "@/lib/validations";
import {
  requireOfficialActor,
  requireOfficialActorUnlessDemoTarget,
  requirePermission,
  requirePublicationAuthority,
} from "@/lib/permissions";
import { ASSIGNMENT_END_REASONS, PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";
import { applyPublicationDecision } from "@/lib/publication";

// Droits (vérifiés en base à chaque appel, portée organisation, comptes
// officiels uniquement — jamais un compte de démonstration) :
// - fiche du POOL (nom officiel, slug, adresse, e-mail institutionnel) :
//   pools.manage ;
// - nomination / retrait du chef, ajout / retrait d'une fonction dans le
//   POOL : users.manage ;
// - autorisation de publier un agent : IPP ou Informaticien
//   (requirePublicationAuthority). Le Chef de POOL n'a aucun de ces droits.

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

async function findPool(poolId: string, organizationId: string) {
  return prisma.pool.findFirst({ where: { id: poolId, organizationId } });
}

function revalidatePoolAdmin(poolId: string) {
  revalidatePath(`/parametres/pools/${poolId}`);
  revalidatePath("/parametres");
  revalidatePath("/affectations");
  revalidatePublicPools();
}

export async function updatePoolProfileAction(
  poolId: string,
  _prevState: PoolAdminFormState,
  formData: FormData
): Promise<PoolAdminFormState> {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.POOLS_MANAGE);
  await requireOfficialActor(actor.id);

  const pool = await findPool(poolId, actor.organizationId);
  if (!pool) return { formError: "POOL introuvable." };

  const parsed = poolProfileSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    address: formData.get("address") ?? "",
    officialEmail: formData.get("officialEmail") ?? "",
  });
  if (!parsed.success) {
    return { errors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  const data = {
    name: parsed.data.name,
    slug: parsed.data.slug || null,
    address: parsed.data.address || null,
    officialEmail: parsed.data.officialEmail || null,
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
    oldValue: { name: pool.name, slug: pool.slug, address: pool.address, officialEmail: pool.officialEmail },
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
  await requireOfficialActor(actor.id);

  const pool = await findPool(poolId, actor.organizationId);
  if (!pool) return { formError: "POOL introuvable." };

  const userId = String(formData.get("userId") ?? "");
  // Décision de l'Inspection : le chef est un inspecteur du POOL (compte
  // actif, officiel) nommé à cette fonction ; un seul chef à la fois.
  const candidate = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: actor.organizationId,
      status: "ACTIVE",
      isDemo: false,
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

  // La nouvelle nomination retire la fonction aux titulaires précédents,
  // dans la même transaction.
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
  await requireOfficialActor(actor.id);

  const pool = await findPool(poolId, actor.organizationId);
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

/** Attribue à un compte existant une fonction de ce POOL (hors chef, qui passe par la nomination). */
export async function addPoolRoleAction(
  poolId: string,
  _prevState: PoolAdminFormState,
  formData: FormData
): Promise<PoolAdminFormState> {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.USERS_MANAGE);
  await requireOfficialActor(actor.id);

  const pool = await findPool(poolId, actor.organizationId);
  if (!pool) return { formError: "POOL introuvable." };

  const role = await prisma.roleDefinition.findUnique({ where: { id: String(formData.get("roleId") ?? "") } });
  if (!role || role.scope !== "POOL" || role.key === ROLE_KEYS.CHEF_POOL) {
    return { errors: { roleId: "Choisissez une fonction de POOL (le chef se nomme séparément)." } };
  }
  const user = await prisma.user.findFirst({
    where: { id: String(formData.get("userId") ?? ""), organizationId: actor.organizationId, status: "ACTIVE", isDemo: false },
    select: { id: true },
  });
  if (!user) return { errors: { userId: "Choisissez un compte actif." } };

  const exists = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, poolId: pool.id } });
  if (exists) return { formError: "Ce compte détient déjà cette fonction dans ce POOL." };

  const created = await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, poolId: pool.id } });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "user.role_add",
    entityType: "User",
    entityId: user.id,
    newValue: { userRoleId: created.id, roleKey: role.key, poolId: pool.id },
  });

  revalidatePoolAdmin(pool.id);
  return { success: true };
}

/**
 * Retire une fonction de ce POOL à un agent (départ, mutation…). Il disparaît
 * de l'affichage correspondant. Retirer la fonction d'inspecteur met aussi fin
 * à ses affectations dans les écoles du POOL et, le cas échéant, à sa
 * fonction de chef (le chef doit être inspecteur du POOL).
 */
export async function removePoolRoleAction(poolId: string, userRoleId: string) {
  const actor = await currentActor();
  await requirePermission(actor.id, PERMISSIONS.USERS_MANAGE);

  const pool = await findPool(poolId, actor.organizationId);
  if (!pool) return;

  const userRole = await prisma.userRole.findFirst({
    where: { id: userRoleId, poolId: pool.id },
    include: { role: true, user: { select: { id: true, isDemo: true, organizationId: true } } },
  });
  if (!userRole || userRole.user.organizationId !== actor.organizationId) return;
  await requireOfficialActorUnlessDemoTarget(actor.id, userRole.user.isDemo);

  const userId = userRole.user.id;
  let endedAssignments = 0;
  let chiefRemoved = false;

  if (userRole.role.key === ROLE_KEYS.INSPECTEUR) {
    const [, ended, chief] = await prisma.$transaction([
      prisma.userRole.delete({ where: { id: userRole.id } }),
      prisma.assignment.updateMany({
        where: { inspectorId: userId, active: true, school: { poolId: pool.id } },
        data: {
          active: false,
          endedAt: new Date(),
          endReason: ASSIGNMENT_END_REASONS.ROLE_REMOVED,
          endedById: actor.id,
        },
      }),
      prisma.userRole.deleteMany({ where: { userId, poolId: pool.id, role: { key: ROLE_KEYS.CHEF_POOL } } }),
    ]);
    endedAssignments = ended.count;
    chiefRemoved = chief.count > 0;
  } else {
    await prisma.userRole.delete({ where: { id: userRole.id } });
  }

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "user.role_remove",
    entityType: "User",
    entityId: userId,
    oldValue: { roleKey: userRole.role.key, poolId: pool.id },
    metadata: { ...(endedAssignments > 0 && { endedAssignments }), ...(chiefRemoved && { chiefRemoved }) },
  });

  revalidatePoolAdmin(pool.id);
}

/** Autorisation (ou retrait) de l'IPP ou de l'informaticien pour un agent. */
export async function updatePublicationAuthorizationAction(
  poolId: string,
  userId: string,
  _prevState: PoolAdminFormState,
  formData: FormData
): Promise<PoolAdminFormState> {
  const actor = await currentActor();
  await requirePublicationAuthority(actor.id);

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, isDemo: false },
    select: { id: true, photoUrl: true },
  });
  if (!user) return { formError: "Compte introuvable." };

  await applyPublicationDecision({
    userId: user.id,
    actorId: actor.id,
    organizationId: actor.organizationId,
    kind: "AUTHORIZATION",
    identity: formData.get("authIdentity") === "on",
    // Une photo absente ne peut pas être autorisée.
    photo: Boolean(user.photoUrl) && formData.get("authPhoto") === "on",
    metadata: { poolId },
  });

  revalidatePath(`/parametres/pools/${poolId}`);
  return { success: true };
}

/**
 * Passage EXPLICITE de la page publique en mode officiel (ou retour à la
 * maquette). Décision de l'IPP ou de l'informaticien, compte officiel,
 * tracée dans l'audit. Tant que ce passage n'est pas décidé, un POOL qui
 * dispose d'une maquette l'affiche entièrement, même si des données
 * officielles sont déjà publiées ; ensuite, aucune donnée fictive.
 */
export async function setOfficialPageAction(poolId: string, enable: boolean) {
  const actor = await currentActor();
  await requirePublicationAuthority(actor.id);

  const pool = await findPool(poolId, actor.organizationId);
  if (!pool || !pool.slug) return;
  if (enable === (pool.officialPageSince !== null)) return;

  const officialPageSince = enable ? new Date() : null;
  await prisma.pool.update({ where: { id: pool.id }, data: { officialPageSince } });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: enable ? "pool.official_page_enable" : "pool.official_page_disable",
    entityType: "Pool",
    entityId: pool.id,
    oldValue: { officialPageSince: pool.officialPageSince?.toISOString() ?? null },
    newValue: { officialPageSince: officialPageSince?.toISOString() ?? null },
  });

  revalidatePoolAdmin(pool.id);
}
