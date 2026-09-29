"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Home, LogOut, PanelLeftClose, PanelLeftOpen, User as UserIcon } from "lucide-react";
import { signOutAction } from "@/app/(dashboard)/actions";
import type { SessionPermission } from "@/lib/permission-checks";
import { NotificationBell, type NotificationItem } from "./notifications-bell";
import { MobileNav } from "./mobile-nav";
import { Avatar } from "./ui";
import { NAV_ITEMS, SIDEBAR_COOKIE, isNavItemVisible, myPoolItem } from "./nav-items";

export function Sidebar({
  permissions,
  myPoolHref,
  initialCollapsed = false,
}: {
  permissions: SessionPermission[];
  myPoolHref?: string | null;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const items = NAV_ITEMS.filter((item) => isNavItemVisible(item, permissions));
  if (myPoolHref) items.splice(1, 0, myPoolItem(myPoolHref));

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Ouvrir le menu" : "Réduire le menu";

  return (
    // Collant en haut de l'écran : le menu reste en place quand la page défile.
    <aside
      className={clsx(
        "sticky top-0 hidden h-screen shrink-0 flex-col bg-gray-950 text-gray-300 transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={clsx("flex h-16 items-center text-white", collapsed ? "justify-center" : "justify-between gap-2 pl-6 pr-3")}>
        {!collapsed && <span className="truncate text-lg font-bold">IPP Nord-Kivu 1</span>}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
        >
          <ToggleIcon size={18} strokeWidth={1.75} />
        </button>
      </div>
      <nav className={clsx("flex-1 space-y-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "gap-3 px-3",
                active
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && item.label}
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
  photoUrl,
  myPoolHref,
}: {
  name: string;
  roleLabels: string[];
  notifications: NotificationItem[];
  permissions: SessionPermission[];
  photoUrl?: string | null;
  myPoolHref?: string | null;
}) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav permissions={permissions} myPoolHref={myPoolHref} />
        <Avatar name={name} src={photoUrl} className="hidden sm:flex" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{roleLabels.length > 0 ? roleLabels.join(", ") : "Aucun rôle attribué"}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell notifications={notifications} />
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <Home size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Accueil</span>
        </Link>
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
