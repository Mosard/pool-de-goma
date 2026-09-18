import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, Topbar } from "@/components/nav";

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
    prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true } }),
  ]);

  const roleLabels = session.user.roles.map((r) => r.label);

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Sidebar permissions={session.user.permissions} />
      <div className="flex flex-1 flex-col">
        <Topbar
          name={session.user.name ?? ""}
          roleLabels={roleLabels}
          notifications={notifications}
          permissions={session.user.permissions}
          photoUrl={currentUser?.photoUrl}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
