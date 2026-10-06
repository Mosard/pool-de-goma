import { prisma } from "@/lib/prisma";
import { ForbiddenError, loadUserAccess, poolsWithPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";

// Périmètre IA d'un compte, relu en base à chaque appel (jamais depuis le
// seul jeton) : l'Inspool ne voit que son POOL (permission rattachée à son
// rôle de chef de pool), les fonctions provinciales voient toute l'inspection.

export type AiScope = {
  userId: string;
  organizationId: string;
  /** Vrai : toute l'inspection (et chaque POOL). Faux : seulement `pools`. */
  allPools: boolean;
  pools: { id: string; name: string }[];
  isDemo: boolean;
};

export async function requireAiScope(userId: string): Promise<AiScope> {
  const [access, user] = await Promise.all([
    loadUserAccess(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, isDemo: true } }),
  ]);
  if (!user) throw new ForbiddenError();
  const allowed = poolsWithPermission(access.permissions, PERMISSIONS.AI_ANALYZE);
  if (allowed !== "ALL" && allowed.length === 0) throw new ForbiddenError();

  const pools = await prisma.pool.findMany({
    where: {
      organizationId: user.organizationId,
      active: true,
      ...(allowed === "ALL" ? {} : { id: { in: allowed } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (allowed !== "ALL" && pools.length === 0) throw new ForbiddenError();

  return { userId, organizationId: user.organizationId, allPools: allowed === "ALL", pools, isDemo: user.isDemo };
}

/**
 * POOL effectivement analysé. `null` = toute l'inspection, réservé aux
 * fonctions provinciales ; un compte limité à un POOL ne peut pas en sortir,
 * quoi que contienne la requête.
 */
export function resolveAiPool(scope: AiScope, requested: string | null | undefined): string | null {
  const wanted = requested || null;
  if (scope.allPools) {
    if (wanted === null) return null;
    if (!scope.pools.some((p) => p.id === wanted)) throw new ForbiddenError("POOL inconnu ou hors de votre périmètre.");
    return wanted;
  }
  if (wanted === null) return scope.pools[0].id;
  if (!scope.pools.some((p) => p.id === wanted)) throw new ForbiddenError("Ce POOL est hors de votre périmètre.");
  return wanted;
}

/** Une analyse enregistrée est-elle visible pour ce périmètre ? */
export function analysisInScope(scope: AiScope, analysis: { organizationId: string; poolId: string | null }): boolean {
  if (analysis.organizationId !== scope.organizationId) return false;
  if (scope.allPools) return true;
  return analysis.poolId !== null && scope.pools.some((p) => p.id === analysis.poolId);
}
