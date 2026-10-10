// Cellule du personnel (décision Q-A du 2026-10-10) : SEUL point d'écriture de
// la vocation Cell.mandate. Autorisés : détenteurs de cells.personnel.manage à
// portée organisation — IPP principal, Super Admins, secrétaires de l'IPP,
// informaticien (par leur fonction) et IPA chargé du personnel en fonction
// (par son affectation). Droits relus en base, compte officiel, audit avant /
// après. Une seule cellule active PERSONNEL : contrôlé ici ET garanti par
// l'index unique partiel « Cell_one_active_personnel_key » (concurrence).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications/dispatcher";
import { ForbiddenError, loadUserAccess, requireOfficialActor } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import type { SessionPermission } from "@/lib/permission-checks";
import { CELL_MANDATE_LABELS, cellDisplayName, type CellMandateKey } from "@/lib/cells/rules";

type Actor = { id: string; organizationId: string };

export const PERSONNEL_DUPLICATE_MESSAGE =
  "Une autre cellule active porte déjà la vocation « Gestion du personnel » : retirez-la d'abord de cette cellule (une seule à la fois).";

/** Détient la gestion de la cellule du personnel à portée organisation (jamais une copie de cellule ou de POOL). */
export function holdsPersonnelCellManage(permissions: readonly SessionPermission[], organizationId: string): boolean {
  return permissions.some(
    (p) => p.permissionKey === PERMISSIONS.CELLS_PERSONNEL_MANAGE && p.poolId === null && !p.cellId && p.organizationId === organizationId
  );
}

/** Refuse (ForbiddenError) un acteur sans cette permission ; droits relus en base. */
export async function requirePersonnelCellManager(actorId: string, organizationId: string): Promise<void> {
  const { permissions } = await loadUserAccess(actorId);
  if (!holdsPersonnelCellManage(permissions, organizationId)) {
    throw new ForbiddenError("Seuls l'IPP, les Super Admins, l'IPA chargé du personnel, les secrétaires de l'IPP et l'informaticien gèrent la cellule du personnel.");
  }
}

/** Violation de l'index unique partiel (deux cellules actives PERSONNEL) ? */
export function isPersonnelDuplicate(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Attribue (PERSONNEL) ou retire (GENERAL) la vocation « gestion du personnel ».
 * L'attribution exige une cellule active et aucune autre cellule active de
 * cette vocation. Les pouvoirs du responsable suivent à sa requête suivante.
 */
export async function setCellMandate(actor: Actor, p: { cellId: string; mandate: CellMandateKey; via: string }) {
  if (p.mandate !== "PERSONNEL" && p.mandate !== "GENERAL") throw new ForbiddenError("Vocation inconnue.");
  await requirePersonnelCellManager(actor.id, actor.organizationId);
  await requireOfficialActor(actor.id);
  const cell = await prisma.cell.findFirst({ where: { id: p.cellId, organizationId: actor.organizationId } });
  if (!cell) throw new ForbiddenError("Cellule introuvable.");
  if (cell.mandate === p.mandate) return;
  if (p.mandate === "PERSONNEL" && !cell.active) throw new ForbiddenError("Cellule archivée : réactivez-la d'abord.");

  try {
    await prisma.$transaction(async (tx) => {
      if (p.mandate === "PERSONNEL") {
        const other = await tx.cell.findFirst({
          where: { organizationId: actor.organizationId, active: true, mandate: "PERSONNEL", id: { not: cell.id } },
          select: { code: true },
        });
        if (other) throw new ForbiddenError(`${PERSONNEL_DUPLICATE_MESSAGE} (cellule ${other.code})`);
      }
      // Garde contre une modification concurrente de la même cellule.
      const updated = await tx.cell.updateMany({ where: { id: cell.id, mandate: cell.mandate }, data: { mandate: p.mandate } });
      if (updated.count !== 1) throw new ForbiddenError("La cellule a changé entre-temps : rechargez la page.");
    });
  } catch (e) {
    if (isPersonnelDuplicate(e)) throw new ForbiddenError(PERSONNEL_DUPLICATE_MESSAGE);
    throw e;
  }

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: p.mandate === "PERSONNEL" ? "cell.mandate_personnel_set" : "cell.mandate_personnel_remove",
    entityType: "Cell",
    entityId: cell.id,
    oldValue: { mandate: cell.mandate },
    newValue: { mandate: p.mandate },
    metadata: { via: p.via, cellCode: cell.code, ipaId: cell.ipaId },
  });
  if (cell.ipaId) {
    await notify({
      userId: cell.ipaId,
      event: "cell.mandate",
      title: `Cellule ${cellDisplayName(cell.name)}`,
      body:
        p.mandate === "PERSONNEL"
          ? `Vocation « ${CELL_MANDATE_LABELS.PERSONNEL} » attribuée : vous exercez les pouvoirs du responsable du personnel.`
          : `Vocation « ${CELL_MANDATE_LABELS.PERSONNEL} » retirée : vous n'exercez plus les pouvoirs du responsable du personnel.`,
    });
  }
}
