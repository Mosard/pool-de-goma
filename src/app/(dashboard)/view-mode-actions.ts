"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError, loadUserAccess } from "@/lib/permissions";
import { VIEW_MODE_COOKIE, VIEW_MODE_MAX_AGE } from "@/lib/view-mode";
import { logAudit } from "@/lib/audit";

/** Super Admin ou IPP, d'après les rôles RÉELS en base (jamais le mode simulé ni le jeton). */
async function requireViewModeHolder() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const real = await loadUserAccess(session.user.id, { viewMode: null });
  if (!real.canViewAs) throw new ForbiddenError("Réservé au Super Admin et à l'IPP.");
  return { user: session.user, auditAction: real.superAdmin ? "super_admin.view_mode" : "ipp.view_mode" };
}

/** « Voir comme » : fonction (et POOL) simulés, avec leurs seuls droits. */
export async function setViewModeAction(formData: FormData) {
  const { user, auditAction } = await requireViewModeHolder();
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
    action: auditAction,
    entityType: "User",
    entityId: user.id,
    newValue: { role: access.viewMode.role, poolId: access.viewMode.poolId },
  });
  redirect("/dashboard");
}

export async function clearViewModeAction() {
  const { user, auditAction } = await requireViewModeHolder();
  (await cookies()).delete(VIEW_MODE_COOKIE);
  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: auditAction,
    entityType: "User",
    entityId: user.id,
    newValue: { role: null },
  });
  redirect("/dashboard");
}
