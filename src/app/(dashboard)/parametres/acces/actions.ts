"use server";

// « Gérer les accès » : l'identité de l'acteur vient de la session ; tous les
// contrôles sont faits par applyAccessChanges sur ses droits relus en base.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { applyAccessChanges } from "@/lib/access-admin";
import { ForbiddenError } from "@/lib/permissions";

const changesSchema = z.object({
  addRoles: z.array(z.object({ roleId: z.string().min(1), poolId: z.string().nullable(), cellId: z.string().nullable().optional() })).max(20),
  removeUserRoleIds: z.array(z.string().min(1)).max(20),
  adjustments: z
    .array(z.object({ permissionKey: z.string().min(1), poolId: z.string().nullable(), effect: z.enum(["GRANT", "REVOKE"]) }))
    .max(500),
});

export type AccessActionResult = { ok: boolean; changed?: number; error?: string };

export async function saveAccessChangesAction(targetUserId: string, payload: string): Promise<AccessActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  let parsed;
  try {
    parsed = changesSchema.safeParse(JSON.parse(payload));
  } catch {
    return { ok: false, error: "Données illisibles." };
  }
  if (!parsed.success) return { ok: false, error: "Données invalides." };
  try {
    const { changed } = await applyAccessChanges(session.user.id, targetUserId, parsed.data);
    revalidatePath(`/parametres/acces/${targetUserId}`);
    revalidatePath("/parametres/acces");
    return { ok: true, changed };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
}
