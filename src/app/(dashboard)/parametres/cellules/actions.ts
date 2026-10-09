"use server";

// Cellules de l'IPP (docs/exploitants-ipp-cellules.md § 6) : saisies par
// l'équipe métier (IPP, informaticien, Super Admin — permission pools.manage
// sur toute l'organisation). Aucune cellule n'est créée par le code.
// Contrôles serveur : droits relus en base, compte officiel, sigle unique,
// IPA désigné par src/lib/cells/assignments.ts (même règle que la Direction).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess, requireOfficialActor } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { setCellIpa } from "@/lib/cells/assignments";

export type CellFormState = { error?: string; ok?: boolean };

const CODE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

async function requireCellManager() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { permissions } = await loadUserAccess(session.user.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, organizationId: true } });
  if (!permissions.some((p) => p.permissionKey === PERMISSIONS.POOLS_MANAGE && p.poolId === null && !p.cellId)) throw new ForbiddenError();
  await requireOfficialActor(user.id);
  return user;
}

export async function saveCellAction(_prev: CellFormState, formData: FormData): Promise<CellFormState> {
  let actor: { id: string; organizationId: string };
  try {
    actor = await requireCellManager();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action non autorisée." };
  }
  const cellId = String(formData.get("cellId") ?? "") || null;
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const ipaId = String(formData.get("ipaId") ?? "") || null;
  if (!CODE.test(code)) return { error: "Sigle : 2 à 20 caractères (lettres majuscules, chiffres, tiret)." };
  if (name.length < 3 || name.length > 120) return { error: "Intitulé : 3 à 120 caractères." };

  const existing = cellId ? await prisma.cell.findFirst({ where: { id: cellId, organizationId: actor.organizationId } }) : null;
  if (cellId && !existing) return { error: "Cellule introuvable." };
  if (existing && !existing.active) return { error: "Cellule archivée : réactivez-la d'abord." };

  let saved;
  try {
    saved = existing
      ? await prisma.cell.update({ where: { id: existing.id }, data: { code, name } })
      : await prisma.cell.create({ data: { organizationId: actor.organizationId, code, name } });
    await logAudit({
      actorId: actor.id,
      organizationId: actor.organizationId,
      action: existing ? "cell.update" : "cell.create",
      entityType: "Cell",
      entityId: saved.id,
      oldValue: existing ? { code: existing.code, name: existing.name } : undefined,
      newValue: { code, name },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Ce sigle est déjà utilisé par une autre cellule." };
    throw e;
  }
  // IPA responsable : même écriture que l'espace Direction (historique, poste public, droits).
  try {
    await setCellIpa(actor, { cellId: saved.id, ipaId, via: "cellules" });
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath("/parametres/cellules");
  revalidatePath("/direction");
  return { ok: true };
}

/**
 * Archiver une cellule : elle ne reçoit plus de rapports, son IPA est libéré
 * (historique fermé) et ses exploitants passent « en attente d'affectation ».
 * Rien n'est supprimé : rapports, historique et rattachements restent.
 */
export async function setCellActiveAction(cellId: string, active: boolean) {
  const actor = await requireCellManager();
  const cell = await prisma.cell.findFirst({ where: { id: cellId, organizationId: actor.organizationId } });
  if (!cell) throw new ForbiddenError("Cellule introuvable.");
  if (cell.active === active) return;
  if (!active && cell.ipaId) await setCellIpa(actor, { cellId: cell.id, ipaId: null, via: "cellules", reason: "Cellule archivée" });
  await prisma.cell.update({ where: { id: cell.id }, data: { active } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: active ? "cell.reactivate" : "cell.archive",
    entityType: "Cell",
    entityId: cell.id,
    oldValue: { active: cell.active },
    newValue: { active },
  });
  revalidatePath("/parametres/cellules");
  revalidatePath("/direction");
}
