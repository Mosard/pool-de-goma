import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, Topbar } from "@/components/nav";
import { SIDEBAR_COOKIE } from "@/components/nav-items";
import { IPP_VIEW_MODE_EXTRA_ROLE_KEYS, RESTRICTED_ROLE_KEYS } from "@/lib/rbac-data";
import { ViewModeBar } from "./view-mode-bar";
import { AWAITING_CELL_MESSAGE, canReadReport, roleDisplayLabel } from "@/lib/cells/rules";
import { REPORT_SCOPE_INCLUDE, reportScope, reportTrack } from "@/lib/fiches/report-scope";
import { signOutAction } from "./actions";

// Extra safeguard: these pages already redirect to /login and are disallowed in robots.txt.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [notifications, currentUser] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id, channel: "IN_APP", readAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, payload: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true, status: true } }),
  ]);

  // Le JWT reste valide jusqu'à son expiration : on revérifie le statut en
  // base pour qu'une suspension prenne effet immédiatement, pages comprises.
  if (!currentUser || currentUser.status !== "ACTIVE") redirect("/login?compte=inactif");

  // IPA ou exploitant de l'IPP sans cellule (session ouverte avant un retrait
  // d'affectation) : seul le message d'attente, aucun menu ni page métier.
  // Les droits sont déjà vides côté serveur (loadUserAccess), API comprises.
  if (session.user.awaitingCell) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">IPP Nord-Kivu 1</h1>
          <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {AWAITING_CELL_MESSAGE}
          </p>
          <form action={signOutAction}>
            <button type="submit" className="text-sm font-medium text-blue-600 hover:underline">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Notification d'un rapport que le compte ne peut plus lire (changement ou
  // retrait d'affectation, réaffectation du rapport) : masquée — même règle
  // que la page du rapport, droits relus en base.
  const reportIdOf = (payload: unknown) =>
    payload && typeof payload === "object" && typeof (payload as { reportId?: unknown }).reportId === "string"
      ? (payload as { reportId: string }).reportId
      : null;
  const notifiedReportIds = [...new Set(notifications.flatMap((n) => reportIdOf(n.payload) ?? []))];
  const readable = new Set<string>();
  if (notifiedReportIds.length > 0) {
    const actor = { id: session.user.id, organizationId: session.user.organizationId, roles: session.user.roles, permissions: session.user.permissions };
    const reports = await prisma.report.findMany({ where: { id: { in: notifiedReportIds } }, include: REPORT_SCOPE_INCLUDE });
    for (const r of reports) if (canReadReport(actor, reportScope(r), reportTrack(r))) readable.add(r.id);
  }
  const visibleNotifications = notifications
    .filter((n) => {
      const reportId = reportIdOf(n.payload);
      return !reportId || readable.has(reportId);
    })
    .map(({ id, title, body }) => ({ id, title, body }));

  // Fonction et périmètre réels : « IPA — Responsable de la cellule Évaluation », « Exploitant — Cellule Évaluation ».
  const roleLabels = session.user.roles.map((r) => roleDisplayLabel(r));
  // Chef de POOL sans accès aux Paramètres : lien direct vers la fiche de son POOL.
  const chiefPoolId = session.user.roles.find((r) => r.key === "chef_pool")?.poolId ?? null;
  const myPoolHref =
    chiefPoolId && !session.user.permissions.some((p) => p.permissionKey === "pools.manage")
      ? `/parametres/pools/${chiefPoolId}`
      : null;

  // « Voir comme » : Super Admin (toute fonction non réservée) et IPP
  // (fonctions de POOL + chargé des médias), d'après les rôles réels relus en base.
  const [simulableRoles, pools, cells] = session.user.canViewAs
    ? await Promise.all([
        prisma.roleDefinition.findMany({
          where: {
            key: { notIn: [...RESTRICTED_ROLE_KEYS] },
            ...(session.user.isSuperAdmin
              ? {}
              : { OR: [{ scope: "POOL" as const }, { key: { in: [...IPP_VIEW_MODE_EXTRA_ROLE_KEYS] } }] }),
          },
          orderBy: { label: "asc" },
          select: { key: true, label: true, scope: true },
        }),
        prisma.pool.findMany({
          where: { organizationId: session.user.organizationId, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        // Simuler un exploitant de l'IPP ou un IPA exige une cellule (jamais de repli provincial).
        prisma.cell.findMany({
          where: { organizationId: session.user.organizationId, active: true },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        }),
      ])
    : [[], [], []];

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Sidebar
        permissions={session.user.permissions}
        myPoolHref={myPoolHref}
        initialCollapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed"}
      />
      {/* min-w-0 : sans lui, cette colonne s'élargit à la largeur du plus grand
          tableau et toute la page défile horizontalement, menu compris. Chaque
          tableau défile seul dans son conteneur overflow-x-auto. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={session.user.name ?? ""}
          roleLabels={roleLabels}
          notifications={visibleNotifications}
          permissions={session.user.permissions}
          photoUrl={currentUser?.photoUrl}
          myPoolHref={myPoolHref}
        />
        {session.user.canViewAs && (
          <ViewModeBar
            holderLabel={session.user.isSuperAdmin ? "Super Admin" : "IPP"}
            active={
              session.user.viewMode
                ? { label: session.user.viewMode.label, poolName: session.user.viewMode.poolName ?? session.user.viewMode.cellName ?? null }
                : null
            }
            roles={simulableRoles}
            pools={pools}
            cells={cells}
          />
        )}
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
