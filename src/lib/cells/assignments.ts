// Affectations aux cellules de l'IPP (décisions du 2026-10-09) : SEUL point
// d'écriture des deux relations qui déterminent les droits internes —
//  - IPA responsable d'une cellule : Cell.ipaId (+ historique CellIpaAssignment,
//    + titulaire du poste public de la Direction relié à la cellule) ;
//  - exploitant de l'IPP : UserRole.cellId de sa fonction « exploitant_ipp ».
// Utilisé par l'espace « Direction » et par Paramètres › Cellules : aucun
// système d'affectation parallèle. Droits relus en base à chaque appel
// (requireRoleGrant : IPA ← IPP, Super Admin ; exploitant ← IPP,
// informaticien, Super Admin ; jamais sur son propre compte), compte
// officiel, audit. Les droits de la personne affectée sont recalculés à sa
// requête suivante (loadUserAccess) : rien ne reste en session ni en cache.

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications/dispatcher";
import { ForbiddenError, requireOfficialActorUnlessDemoTarget, requireRoleGrant } from "@/lib/permissions";
import { ROLE_KEYS } from "@/lib/rbac-data";
import { cellDisplayName } from "@/lib/cells/rules";

/** Point d'entrée de l'affectation, conservé dans l'historique. */
export type AssignmentVia = "direction" | "cellules";

type Actor = { id: string; organizationId: string };

async function activeCell(organizationId: string, cellId: string) {
  const cell = await prisma.cell.findFirst({ where: { id: cellId, organizationId } });
  if (!cell) throw new ForbiddenError("Cellule introuvable.");
  if (!cell.active) throw new ForbiddenError("Cellule archivée : réactivez-la d'abord.");
  return cell;
}

/**
 * Désigne (ipaId) ou retire (null) l'IPA responsable d'une cellule. L'IPA
 * doit être un compte officiel actif de l'organisation qui exerce la fonction
 * d'IPA, et ne diriger aucune autre cellule (un IPA, une cellule).
 * `allowArchived` : libérer l'IPA d'une cellule qu'on archive.
 */
export async function setCellIpa(
  actor: Actor,
  p: { cellId: string; ipaId: string | null; via: AssignmentVia; reason?: string | null; allowArchived?: boolean }
) {
  const cell = p.allowArchived && !p.ipaId
    ? await prisma.cell.findFirst({ where: { id: p.cellId, organizationId: actor.organizationId } })
    : await activeCell(actor.organizationId, p.cellId);
  if (!cell) throw new ForbiddenError("Cellule introuvable.");
  if (cell.ipaId === p.ipaId) return;
  // Habilitation sur le compte qui gagne ou perd la responsabilité (jamais soi-même).
  for (const targetUserId of [p.ipaId, cell.ipaId]) {
    if (targetUserId) await requireRoleGrant(actor.id, { roleKey: ROLE_KEYS.IPA, poolId: null, organizationId: actor.organizationId, targetUserId });
  }
  await requireOfficialActorUnlessDemoTarget(actor.id, false);

  if (p.ipaId) {
    const ipa = await prisma.user.findFirst({
      where: { id: p.ipaId, organizationId: actor.organizationId, isDemo: false, status: "ACTIVE", roles: { some: { role: { key: ROLE_KEYS.IPA } } } },
      select: { id: true, cellLed: { select: { id: true, code: true } } },
    });
    if (!ipa) throw new ForbiddenError("Choisissez un compte officiel actif ayant la fonction d'IPP adjoint.");
    if (ipa.cellLed && ipa.cellLed.id !== cell.id) {
      throw new ForbiddenError(`Cet IPA est déjà responsable de la cellule ${ipa.cellLed.code} : retirez-le d'abord de cette cellule (un IPA, une cellule).`);
    }
  }

  const now = new Date();
  const reason = p.reason?.trim().slice(0, 300) || (p.ipaId ? (cell.ipaId ? "Remplacement" : null) : "Retrait de l'affectation");
  await prisma.$transaction(async (tx) => {
    // Garde contre une modification concurrente : l'IPA n'a pas changé depuis la lecture.
    const updated = await tx.cell.updateMany({ where: { id: cell.id, ipaId: cell.ipaId }, data: { ipaId: p.ipaId } });
    if (updated.count !== 1) throw new ForbiddenError("La cellule a changé entre-temps : rechargez la page.");
    await tx.cellIpaAssignment.updateMany({
      where: { cellId: cell.id, endedAt: null },
      data: { endedAt: now, endedById: actor.id, endReason: reason },
    });
    if (p.ipaId) await tx.cellIpaAssignment.create({ data: { cellId: cell.id, ipaId: p.ipaId, assignedById: actor.id, via: p.via, startedAt: now } });
    // Poste public relié à la cellule : son titulaire suit l'IPA responsable.
    await tx.directionAttribution.updateMany({ where: { cellId: cell.id }, data: { holderId: p.ipaId } });
  });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: p.ipaId ? "cell.ipa_assign" : "cell.ipa_remove",
    entityType: "Cell",
    entityId: cell.id,
    oldValue: { ipaId: cell.ipaId },
    newValue: { ipaId: p.ipaId },
    metadata: { via: p.via, ...(reason ? { reason } : {}) },
  });
  const name = cellDisplayName(cell.name);
  if (p.ipaId) {
    await notify({ userId: p.ipaId, event: "cell.ipa_assign", title: `Responsable de la cellule ${name}`, body: "Vous êtes désigné IPA responsable de cette cellule." });
  }
  if (cell.ipaId) {
    await notify({ userId: cell.ipaId, event: "cell.ipa_remove", title: `Cellule ${name}`, body: "Vous n'êtes plus responsable de cette cellule." });
  }
}

/** Rattachements de la fonction d'exploitant de l'IPP d'un compte (avec ou sans cellule). */
export function exploitantRolesOf(userId: string) {
  return prisma.userRole.findMany({
    where: { userId, role: { key: ROLE_KEYS.EXPLOITANT_IPP } },
    orderBy: { createdAt: "asc" },
    select: { id: true, cellId: true },
  });
}

/**
 * Affecte (cellId), change ou retire (null) la cellule d'un exploitant de
 * l'IPP. Une seule cellule par exploitant : s'il en avait plusieurs, les
 * rattachements en trop sont supprimés (tracé dans l'audit). Le retrait
 * garde la fonction : le compte passe « en attente d'affectation ».
 */
export async function setExploitantCell(actor: Actor, p: { userId: string; cellId: string | null; via: AssignmentVia }) {
  const target = await prisma.user.findFirst({
    where: { id: p.userId, organizationId: actor.organizationId },
    select: { id: true, isDemo: true },
  });
  if (!target) throw new ForbiddenError("Compte introuvable.");
  await requireRoleGrant(actor.id, { roleKey: ROLE_KEYS.EXPLOITANT_IPP, poolId: null, organizationId: actor.organizationId, targetUserId: target.id });
  await requireOfficialActorUnlessDemoTarget(actor.id, target.isDemo);

  const rows = await exploitantRolesOf(target.id);
  if (rows.length === 0) throw new ForbiddenError("Ce compte n'exerce pas la fonction d'exploitant de l'IPP.");
  const cell = p.cellId ? await activeCell(actor.organizationId, p.cellId) : null;
  const before = [...new Set(rows.map((r) => r.cellId).filter(Boolean))] as string[];
  if (rows.length === 1 && rows[0].cellId === (cell?.id ?? null)) return;

  await prisma.$transaction(async (tx) => {
    const [kept, ...extra] = rows;
    if (extra.length > 0) await tx.userRole.deleteMany({ where: { id: { in: extra.map((r) => r.id) } } });
    await tx.userRole.update({ where: { id: kept.id }, data: { cellId: cell?.id ?? null } });
  });

  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: cell ? "user.cell_assign" : "user.cell_remove",
    entityType: "User",
    entityId: target.id,
    oldValue: { roleKey: ROLE_KEYS.EXPLOITANT_IPP, cellIds: before },
    newValue: { roleKey: ROLE_KEYS.EXPLOITANT_IPP, cellIds: cell ? [cell.id] : [] },
    metadata: { via: p.via },
  });
  await notify({
    userId: target.id,
    event: cell ? "user.cell_assign" : "user.cell_remove",
    title: cell ? `Affectation : cellule ${cellDisplayName(cell.name)}` : "Affectation retirée",
    body: cell ? "Vous êtes affecté comme exploitant de cette cellule." : "Vous n'êtes plus affecté à une cellule.",
  });
}
