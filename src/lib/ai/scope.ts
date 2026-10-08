import { prisma } from "@/lib/prisma";
import { ForbiddenError, loadUserAccess, poolsWithPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";

// Périmètre IA d'un compte, relu en base à chaque appel (jamais depuis le
// seul jeton) : l'Inspool ne voit que son POOL (permission rattachée à son
// rôle de chef de pool), les fonctions provinciales voient toute l'inspection.
// L'IPA (décision D4 du 2026-10-08) : seulement les rapports affectés à SA
// cellule, et seulement les analyses de sa cellule.

export type AiScope = {
  userId: string;
  organizationId: string;
  /** Vrai : toute l'inspection (et chaque POOL). Faux : seulement `pools`. */
  allPools: boolean;
  pools: { id: string; name: string }[];
  isDemo: boolean;
  /** Cellule de l'IPA : les rapports analysés sont ceux affectés à cette cellule. */
  cellId: string | null;
};

export async function requireAiScope(userId: string): Promise<AiScope> {
  const [access, user] = await Promise.all([
    loadUserAccess(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, isDemo: true } }),
  ]);
  if (!user) throw new ForbiddenError();
  // Permissions IA hors cellule (POOL ou organisation).
  const allowed = poolsWithPermission(
    access.permissions.filter((p) => !p.cellId),
    PERMISSIONS.AI_ANALYZE
  );
  const cellIds = [...new Set(access.permissions.flatMap((p) => (p.permissionKey === PERMISSIONS.AI_ANALYZE && p.cellId ? [p.cellId] : [])))];
  const cellOnly = allowed !== "ALL" && allowed.length === 0;
  if (cellOnly && cellIds.length === 0) throw new ForbiddenError();

  const pools = await prisma.pool.findMany({
    where: {
      organizationId: user.organizationId,
      active: true,
      // Cellule : ses rapports viennent de plusieurs POOL ; le POOL ne fait que restreindre.
      ...(allowed === "ALL" || cellOnly ? {} : { id: { in: allowed } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!cellOnly && allowed !== "ALL" && pools.length === 0) throw new ForbiddenError();

  return {
    userId,
    organizationId: user.organizationId,
    allPools: allowed === "ALL" || cellOnly,
    pools,
    isDemo: user.isDemo,
    cellId: cellOnly ? cellIds[0] : null,
  };
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

/**
 * Une analyse enregistrée est-elle visible pour ce périmètre ? Une analyse de
 * cellule n'est vue que dans sa cellule ; une analyse hors cellule jamais
 * depuis une cellule.
 */
export function analysisInScope(scope: AiScope, analysis: { organizationId: string; poolId: string | null; cellId?: string | null }): boolean {
  if (analysis.organizationId !== scope.organizationId) return false;
  if ((analysis.cellId ?? null) !== scope.cellId) return false;
  if (scope.allPools) return true;
  return analysis.poolId !== null && scope.pools.some((p) => p.id === analysis.poolId);
}
