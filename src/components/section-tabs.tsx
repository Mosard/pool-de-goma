"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { SessionPermission } from "@/lib/permission-checks";
import { matchesPath, sectionForPath, tabMatches, visibleSubTabs, visibleTabs } from "./nav-items";

/**
 * Onglets de l'espace regroupé contenant la page (Exploitation, Inspecteurs,
 * Demandes de compte). Seuls les onglets autorisés sont affichés ; chaque page
 * garde son contrôle d'accès serveur, l'onglet n'est qu'un lien.
 */
export function SectionTabs({
  permissions,
  roleKeys,
  context,
}: {
  permissions: SessionPermission[];
  roleKeys: string[];
  // Fonction et cellule affichées dans l'espace Exploitation (IPA, exploitant de l'IPP).
  context?: string[];
}) {
  const pathname = usePathname();
  const section = sectionForPath(pathname);
  if (!section?.tabs) return null;
  const ctx = { permissions, roleKeys };
  const tabs = visibleTabs(section.tabs, ctx);
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => tabMatches(t, pathname));
  const subTabs = current ? visibleSubTabs(current, ctx) : [];
  const showContext = section.label === "Exploitation" && context && context.length > 0;

  return (
    <div className="mb-6">
      <nav
        aria-label={section.label}
        // Ordinateur : onglets côte à côte. Téléphone : grille de deux colonnes, même ordre de lecture.
        className={clsx(
          "grid gap-1 rounded-2xl border border-gray-100 bg-white p-1 sm:flex sm:flex-wrap",
          tabs.length === 1 ? "grid-cols-1" : "grid-cols-2"
        )}
      >
        {tabs.map((tab) => {
          const active = tab === current;
          return (
            <Link
              key={tab.href}
              href={tab.to}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-center text-sm font-medium transition-colors sm:flex-1 lg:flex-none",
                active ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {current && subTabs.length > 1 && (
        <nav aria-label={current.label} className="mt-3 flex flex-wrap gap-2">
          {subTabs.map((sub) => {
            // Le parent n'est actif que sur ses propres pages, pas sur celles de ses rattachées.
            const active =
              sub === current
                ? matchesPath(pathname, sub.href) && !(current.children ?? []).some((c) => tabMatches(c, pathname))
                : tabMatches(sub, pathname);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                )}
              >
                {sub.subLabel ?? sub.label}
              </Link>
            );
          })}
        </nav>
      )}
      {showContext && (
        <p className="mt-3 text-sm text-gray-600">
          Votre fonction :{" "}
          {context.map((line, i) => (
            <strong key={line} className="font-semibold text-gray-900">
              {i > 0 ? " · " : ""}
              {line}
            </strong>
          ))}
        </p>
      )}
    </div>
  );
}
