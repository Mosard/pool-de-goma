// Historique d'appartenance aux cellules de l'IPP (StaffCellTerm, décisions du
// 2026-10-10) : rapproché de l'état officiel — Cell.ipaId (IPA responsable) et
// UserRole.cellId (exploitant de l'IPP) — après chaque écriture de ces deux
// relations. Une appartenance qui disparaît est close (endedAt), une nouvelle
// est ouverte avec une date CONNUE (celle de l'enregistrement). Seules les
// cellules actives comptent. Le passé n'est jamais réécrit.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_KEYS } from "@/lib/rbac-data";

export type Membership = { cellId: string; roleKey: string };
export type OpenTerm = Membership & { id: string };

const key = (m: Membership) => `${m.roleKey}|${m.cellId}`;

/** Fonction pure : appartenances à clore et à ouvrir pour atteindre l'état courant. */
export function diffMemberships(open: readonly OpenTerm[], current: readonly Membership[]): { close: string[]; start: Membership[] } {
  const wanted = new Map(current.map((m) => [key(m), m]));
  const seen = new Set<string>();
  const close: string[] = [];
  for (const t of open) {
    const k = key(t);
    // Doublon d'un terme ouvert : le plus ancien suffit, les autres sont clos.
    if (!wanted.has(k) || seen.has(k)) close.push(t.id);
    seen.add(k);
  }
  const start = [...wanted.values()].filter((m) => !seen.has(key(m)));
  return { close, start };
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Rapproche l'historique d'un ou plusieurs comptes de leurs affectations actuelles. */
export async function reconcileStaffCellTerms(userIds: readonly (string | null | undefined)[], via: string, db: Db = prisma): Promise<void> {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return;
  const now = new Date();
  for (const userId of ids) {
    const [led, roles, open] = await Promise.all([
      db.cell.findMany({ where: { ipaId: userId, active: true }, select: { id: true } }),
      db.userRole.findMany({
        where: { userId, cellId: { not: null }, role: { key: ROLE_KEYS.EXPLOITANT_IPP }, cell: { active: true } },
        select: { cellId: true },
      }),
      db.staffCellTerm.findMany({ where: { userId, endedAt: null }, select: { id: true, cellId: true, roleKey: true }, orderBy: { observedAt: "asc" } }),
    ]);
    const current: Membership[] = [
      ...led.map((c) => ({ cellId: c.id, roleKey: ROLE_KEYS.IPA as string })),
      ...roles.map((r) => ({ cellId: r.cellId as string, roleKey: ROLE_KEYS.EXPLOITANT_IPP as string })),
    ];
    const { close, start } = diffMemberships(open, current);
    if (close.length > 0) await db.staffCellTerm.updateMany({ where: { id: { in: close } }, data: { endedAt: now } });
    if (start.length > 0) {
      await db.staffCellTerm.createMany({
        data: start.map((m) => ({ userId, cellId: m.cellId, roleKey: m.roleKey, startedAt: now, startSource: "CONNUE" as const, observedAt: now, via })),
      });
    }
  }
}
