import { cookies } from "next/headers";

// « Voir comme » du Super Admin : fonction simulée (et POOL pour une fonction
// de POOL), conservée dans un cookie httpOnly. Le cookie n'a d'effet que pour
// un compte qui détient RÉELLEMENT le rôle Super Admin en base (vérifié dans
// loadUserAccess) : pour tout autre compte, il est ignoré.

export const VIEW_MODE_COOKIE = "ippnk1_vue";
export const VIEW_MODE_MAX_AGE = 8 * 60 * 60;

/** `cellId` : cellule simulée (exploitant de l'IPP, IPA), vérifiée en base par loadUserAccess. */
export type ViewMode = { role: string; poolId: string | null; cellId?: string | null };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function parseViewMode(raw: string | null | undefined): ViewMode | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { role?: unknown; poolId?: unknown; cellId?: unknown };
    if (typeof v.role !== "string" || !/^[a-z_]{2,40}$/.test(v.role)) return null;
    const poolId = typeof v.poolId === "string" && ID.test(v.poolId) ? v.poolId : null;
    const cellId = typeof v.cellId === "string" && ID.test(v.cellId) ? v.cellId : null;
    return { role: v.role, poolId, cellId };
  } catch {
    return null;
  }
}

/** Mode de la requête en cours ; null hors requête (scripts, tests) ou sans cookie. */
export async function readViewMode(): Promise<ViewMode | null> {
  try {
    const store = await cookies();
    return parseViewMode(store.get(VIEW_MODE_COOKIE)?.value);
  } catch {
    return null;
  }
}
