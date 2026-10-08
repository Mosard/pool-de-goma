"use server";

// Cellules de l'IPP (docs/exploitants-ipp-cellules.md § 6) : saisies par
// l'équipe métier (IPP, informaticien, Super Admin — permission pools.manage
// sur toute l'organisation). Aucune cellule n'est créée par le code.
// Contrôles serveur : droits relus en base, compte officiel, sigle unique,
// IPA réel de l'organisation et responsable d'une seule cellule (D2).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess, requireOfficialActor } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";

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

/** IPA choisi : compte officiel de l'organisation, qui exerce RÉELLEMENT la fonction d'IPA. */
async function checkIpa(ipaId: string | null, organizationId: string, cellId: string | null): Promise<string | null> {
  if (!ipaId) return null;
  const ipa = await prisma.user.findFirst({
    where: { id: ipaId, organizationId, isDemo: false, roles: { some: { role: { key: ROLE_KEYS.IPA } } } },
    select: { id: true, cellLed: { select: { id: true, code: true } } },
  });
  if (!ipa) return "Cet IPA est introuvable, de démonstration, ou n'exerce pas la fonction d'IPP adjoint.";
  if (ipa.cellLed && ipa.cellLed.id !== cellId) return `Cet IPA est déjà responsable de la cellule ${ipa.cellLed.code} : un IPA n'a qu'une cellule.`;
  return null;
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
  const ipaError = await checkIpa(ipaId, actor.organizationId, cellId);
  if (ipaError) return { error: ipaError };

  try {
    const saved = existing
      ? await prisma.cell.update({ where: { id: existing.id }, data: { code, name, ipaId } })
      : await prisma.cell.create({ data: { organizationId: actor.organizationId, code, name, ipaId } });
    await logAudit({
      actorId: actor.id,
      organizationId: actor.organizationId,
      action: existing ? "cell.update" : "cell.create",
      entityType: "Cell",
      entityId: saved.id,
      oldValue: existing ? { code: existing.code, name: existing.name, ipaId: existing.ipaId } : undefined,
      newValue: { code, name, ipaId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Ce sigle ou cet IPA est déjà utilisé par une autre cellule." };
    throw e;
  }
  revalidatePath("/parametres/cellules");
  return { ok: true };
}

/**
 * Archiver une cellule : elle ne reçoit plus de rapports, ses exploitants
 * perdent l'accès (permissions de cellule inactives) et son IPA est libéré.
 * Rien n'est supprimé : rapports, historique et rattachements restent.
 */
export async function setCellActiveAction(cellId: string, active: boolean) {
  const actor = await requireCellManager();
  const cell = await prisma.cell.findFirst({ where: { id: cellId, organizationId: actor.organizationId } });
  if (!cell) throw new ForbiddenError("Cellule introuvable.");
  if (cell.active === active) return;
  await prisma.cell.update({ where: { id: cell.id }, data: { active, ...(active ? {} : { ipaId: null }) } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: active ? "cell.reactivate" : "cell.archive",
    entityType: "Cell",
    entityId: cell.id,
    oldValue: { active: cell.active, ipaId: cell.ipaId },
    newValue: { active, ipaId: active ? cell.ipaId : null },
  });
  revalidatePath("/parametres/cellules");
}
