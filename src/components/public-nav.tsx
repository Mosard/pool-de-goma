"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";

// Menu principal du site public (ordinateur et téléphone). Une seule liste
// pour les deux affichages : une entrée ajoutée ici apparaît partout.
type PublicLink = { label: string; href: string; isActive?: (pathname: string) => boolean };

export const PUBLIC_LINKS: PublicLink[] = [
  { label: "Accueil", href: "/#accueil", isActive: (p) => p === "/" },
  { label: "L'Inspection", href: "/#inspection" },
  { label: "Actualités", href: "/actualites", isActive: (p) => p === "/actualites" || p.startsWith("/actualites/") },
  { label: "Diplômes", href: "/diplomes", isActive: (p) => p === "/diplomes" || p.startsWith("/diplomes/") },
  { label: "Contacts", href: "/#contacts" },
];

export function PublicNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
      {PUBLIC_LINKS.map((link) => {
        const active = link.isActive?.(pathname) ?? false;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative py-1 hover:text-white",
              active &&
                "font-semibold text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-400"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PublicMobileNav({ accountHref, accountLabel }: { accountHref: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const opener = openRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={openRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-controls="menu-public"
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-200 hover:bg-white/10"
      >
        <Menu size={22} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          id="menu-public"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-gray-200"
        >
          <div className="flex h-16 items-center justify-between px-6">
            <span className="text-base font-bold text-white">IPP Nord-Kivu 1</span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X size={22} strokeWidth={1.75} />
            </button>
          </div>
          <nav aria-label="Navigation principale" className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
            {PUBLIC_LINKS.map((link) => {
              const active = link.isActive?.(pathname) ?? false;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "flex min-h-[48px] items-center rounded-xl px-4 text-base font-medium",
                    active ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active && <span className="mr-3 h-5 w-1 rounded-full bg-blue-400" aria-hidden />}
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 pb-6">
            <Link
              href={accountHref}
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center justify-center rounded-full bg-white px-4 text-base font-medium text-blue-700 hover:bg-gray-100"
            >
              {accountLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
