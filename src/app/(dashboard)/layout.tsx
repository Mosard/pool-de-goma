import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, Topbar } from "@/components/nav";
import { RESTRICTED_ROLE_KEYS } from "@/lib/rbac-data";
import { ViewModeBar } from "./view-mode-bar";

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
      select: { id: true, title: true, body: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true, status: true } }),
  ]);

  // Le JWT reste valide jusqu'à son expiration : on revérifie le statut en
  // base pour qu'une suspension prenne effet immédiatement, pages comprises.
  if (!currentUser || currentUser.status !== "ACTIVE") redirect("/login?compte=inactif");

  const roleLabels = session.user.roles.map((r) => r.label);
  // Chef de POOL sans accès aux Paramètres : lien direct vers la fiche de son POOL.
  const chiefPoolId = session.user.roles.find((r) => r.key === "chef_pool")?.poolId ?? null;
  const myPoolHref =
    chiefPoolId && !session.user.permissions.some((p) => p.permissionKey === "pools.manage")
      ? `/parametres/pools/${chiefPoolId}`
      : null;

  // « Voir comme » : réservé au Super Admin (rôle réel, relu en base).
  const [simulableRoles, pools] = session.user.isSuperAdmin
    ? await Promise.all([
        prisma.roleDefinition.findMany({
          where: { key: { notIn: [...RESTRICTED_ROLE_KEYS] } },
          orderBy: { label: "asc" },
          select: { key: true, label: true, scope: true },
        }),
        prisma.pool.findMany({
          where: { organizationId: session.user.organizationId, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Sidebar permissions={session.user.permissions} myPoolHref={myPoolHref} />
      <div className="flex flex-1 flex-col">
        <Topbar
          name={session.user.name ?? ""}
          roleLabels={roleLabels}
          notifications={notifications}
          permissions={session.user.permissions}
          photoUrl={currentUser?.photoUrl}
          myPoolHref={myPoolHref}
        />
        {session.user.isSuperAdmin && (
          <ViewModeBar
            active={session.user.viewMode ? { label: session.user.viewMode.label, poolName: session.user.viewMode.poolName } : null}
            roles={simulableRoles}
            pools={pools}
          />
        )}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
