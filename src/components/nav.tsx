"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOutAction } from "@/app/(dashboard)/actions";
import { hasPermissionAnyPool, type SessionPermission } from "@/lib/permissions";
import { NotificationBell, type NotificationItem } from "./notifications-bell";
import { MobileNav } from "./mobile-nav";
import { Avatar } from "./ui";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ permissions }: { permissions: SessionPermission[] }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermissionAnyPool(permissions, item.permission));

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-gray-950 text-gray-300 md:flex">
      <div className="flex h-16 items-center gap-2 px-6 text-white">
        <span className="text-lg font-bold">IPP Nord-Kivu 1</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function Topbar({
  name,
  roleLabels,
  notifications,
  permissions,
}: {
  name: string;
  roleLabels: string[];
  notifications: NotificationItem[];
  permissions: SessionPermission[];
}) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav permissions={permissions} />
        <Avatar name={name} className="hidden sm:flex" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{roleLabels.length > 0 ? roleLabels.join(", ") : "Aucun rôle attribué"}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell notifications={notifications} />
        <Link
          href="/profil"
          className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 sm:flex"
        >
          <UserIcon size={16} strokeWidth={1.75} />
          Mon profil
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut size={16} strokeWidth={1.75} />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </form>
      </div>
    </header>
  );
}
