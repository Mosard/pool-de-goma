import { isChiefOf, type SessionRole } from "@/lib/permission-checks";
import { ROLE_KEYS } from "@/lib/rbac-data";

// Qui réagit à une décision proposée par l'IA (décision du 2026-10-06) :
// - l'Inspool (chef de pool) sur les analyses de SON POOL ;
// - l'IPP adjoint titulaire de l'attribution désignée comme service responsable ;
// - l'IPP sur toutes les cartes ; il désigne aussi le service quand l'analyse
//   ne l'a pas reconnu.
// Le Super Admin et l'informaticien consultent sans décider. Fonction pure sur
// les rôles EFFECTIFS (mode « Voir comme » compris), revérifiés en base par
// l'appelant.

export function canActOnAiProblem(
  actor: { userId: string; roles: SessionRole[] },
  analysis: { poolId: string | null },
  problem: { attribution: { holderId: string | null } | null }
): boolean {
  if (actor.roles.some((r) => r.key === ROLE_KEYS.IPP)) return true;
  if (analysis.poolId && isChiefOf(actor.roles, analysis.poolId)) return true;
  return (
    actor.roles.some((r) => r.key === ROLE_KEYS.IPA) &&
    problem.attribution?.holderId != null &&
    problem.attribution.holderId === actor.userId
  );
}

export function canDesignateAiService(actor: { roles: SessionRole[] }): boolean {
  return actor.roles.some((r) => r.key === ROLE_KEYS.IPP);
}
