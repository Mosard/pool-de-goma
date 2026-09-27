"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError, isSuperAdmin, loadUserAccess } from "@/lib/permissions";
import { VIEW_MODE_COOKIE, VIEW_MODE_MAX_AGE } from "@/lib/view-mode";
import { logAudit } from "@/lib/audit";

async function requireRealSuperAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Rôle RÉEL en base, jamais celui du mode simulé ni celui du jeton.
  if (!(await isSuperAdmin(session.user.id))) throw new ForbiddenError("Réservé au Super Admin.");
  return session.user;
}

/** « Voir comme » : fonction (et POOL) simulés, avec leurs seuls droits. */
export async function setViewModeAction(formData: FormData) {
  const user = await requireRealSuperAdmin();
  const role = String(formData.get("role") ?? "");
  const poolId = String(formData.get("poolId") ?? "") || null;
  if (!role) return clearViewModeAction();

  const access = await loadUserAccess(user.id, { viewMode: { role, poolId } });
  if (!access.viewMode) redirect("/dashboard?vue=invalide");

  (await cookies()).set(VIEW_MODE_COOKIE, JSON.stringify({ role: access.viewMode.role, poolId: access.viewMode.poolId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_MODE_MAX_AGE,
  });
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "super_admin.view_mode",
    entityType: "User",
    entityId: user.id,
    newValue: { role: access.viewMode.role, poolId: access.viewMode.poolId },
  });
  redirect("/dashboard");
}

export async function clearViewModeAction() {
  const user = await requireRealSuperAdmin();
  (await cookies()).delete(VIEW_MODE_COOKIE);
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: "super_admin.view_mode",
    entityType: "User",
    entityId: user.id,
    newValue: { role: "super_admin" },
  });
  redirect("/dashboard");
}
