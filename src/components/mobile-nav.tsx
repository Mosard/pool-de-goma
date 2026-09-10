"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, User as UserIcon, LogOut } from "lucide-react";
import { clsx } from "clsx";
import { NAV_ITEMS } from "./nav-items";
import { hasPermissionAnyPool, type SessionPermission } from "@/lib/permissions";
import { signOutAction } from "@/app/(dashboard)/actions";

export function MobileNav({ permissions }: { permissions: SessionPermission[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermissionAnyPool(permissions, item.permission));

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
      >
        <Menu size={22} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-gray-200">
          <div className="flex h-16 items-center justify-between px-6">
            <span className="text-lg font-bold text-white">IPP Nord-Kivu 1</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X size={22} strokeWidth={1.75} />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-base font-medium",
                    active ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon size={20} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/profil"
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <UserIcon size={20} strokeWidth={1.75} />
              Mon profil
            </Link>
          </nav>
          <form action={signOutAction} className="px-4 pb-6">
            <button
              type="submit"
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <LogOut size={20} strokeWidth={1.75} />
              Déconnexion
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
