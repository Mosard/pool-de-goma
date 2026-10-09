import {
  LayoutDashboard,
  School,
  Users,
  ClipboardList,
  UserPlus,
  ScrollText,
  Settings,
  Building2,
  Landmark,
  Newspaper,
  Sparkles,
  Inbox,
} from "lucide-react";
import { PERMISSIONS, PUBLICATION_AUTHORITY_ROLE_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool, type SessionPermission } from "@/lib/permission-checks";

/** Ce que le menu sait de l'utilisateur : permissions effectives et fonctions (« Voir comme » compris). */
export type NavContext = { permissions: SessionPermission[]; roleKeys: string[] };

type Access = {
  // Visible si l'utilisateur détient l'une de ces permissions ; absent =
  // visible à tout utilisateur connecté.
  permission?: string | string[];
  // En plus de la permission : l'une de ces fonctions est exigée (même règle que la page).
  roles?: readonly string[];
};

/**
 * Onglet d'un espace regroupé. Le menu n'accorde aucun droit : chaque onglet
 * reprend la condition d'accès de sa page, qui reste vérifiée côté serveur.
 */
export type NavTab = Access & {
  href: string;
  label: string;
  // Libellé de l'onglet parmi ses pages rattachées (ex. « Inspections » à côté de « Fiches de période »).
  subLabel?: string;
  // Autres pages rattachées à l'onglet (actif, et visible si l'une d'elles l'est).
  children?: NavTab[];
};

export type NavItem = Access & {
  href: string;
  label: string;
  icon: React.ElementType;
  // Espace à onglets : l'entrée est visible si un onglet l'est, et mène au premier onglet autorisé.
  tabs?: NavTab[];
};

function hasAccess(access: Access, ctx: NavContext): boolean {
  if (access.roles && !ctx.roleKeys.some((k) => access.roles!.includes(k))) return false;
  if (!access.permission) return true;
  const keys = Array.isArray(access.permission) ? access.permission : [access.permission];
  return keys.some((key) => hasPermissionAnyPool(ctx.permissions, key));
}

/** Onglet (ou l'une de ses pages rattachées) accessible ; renvoie le lien à suivre. */
function tabHref(tab: NavTab, ctx: NavContext): string | null {
  if (hasAccess(tab, ctx)) return tab.href;
  for (const child of tab.children ?? []) if (hasAccess(child, ctx)) return child.href;
  return null;
}

/** Onglets visibles d'un espace, dans l'ordre défini, avec le lien de chacun. */
export function visibleTabs(tabs: NavTab[], ctx: NavContext): (NavTab & { to: string })[] {
  return tabs.flatMap((tab) => {
    const to = tabHref(tab, ctx);
    return to ? [{ ...tab, to }] : [];
  });
}

/** Pages rattachées visibles d'un onglet (l'onglet lui-même en premier). */
export function visibleSubTabs(tab: NavTab, ctx: NavContext): NavTab[] {
  if (!tab.children?.length) return [];
  return [tab, ...tab.children].filter((t) => hasAccess(t, ctx));
}

/** Règle de visibilité commune au menu latéral et au menu mobile. */
export function isNavItemVisible(item: NavItem, ctx: NavContext): boolean {
  if (item.tabs) return visibleTabs(item.tabs, ctx).length > 0;
  return hasAccess(item, ctx);
}

/** Lien de l'entrée : pour un espace à onglets, le premier onglet autorisé. */
export function navItemHref(item: NavItem, ctx: NavContext): string {
  if (item.tabs) return visibleTabs(item.tabs, ctx)[0]?.to ?? item.href;
  return item.href;
}

/** `/rapports` couvre `/rapports/…` mais pas `/rapports-x` ; `/inspections` ne couvre pas `/inspecteurs`. */
export function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}.`);
}

export function tabMatches(tab: NavTab, pathname: string): boolean {
  return matchesPath(pathname, tab.href) || (tab.children ?? []).some((c) => tabMatches(c, pathname));
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.tabs) return item.tabs.some((t) => tabMatches(t, pathname));
  return matchesPath(pathname, item.href);
}

// Menu latéral réduit en icônes : choix mémorisé dans ce cookie, lu par le
// layout serveur (pas de saut d'affichage au chargement). Constante placée
// ici et non dans nav.tsx : un module « use client » ne fournit pas ses
// constantes au serveur.
export const SIDEBAR_COOKIE = "sidebar";

/** Lien « Mon POOL » du chef de POOL (fiche du bureau, inspecteurs). */
export function myPoolItem(href: string): NavItem {
  return { href, label: "Mon POOL", icon: Building2 };
}

// Exploitation des fiches officielles : notes et statistiques par POOL, par fiche et par période.
const EXPLOITATION_KEYS = [
  PERMISSIONS.REPORTS_REVIEW_POOL,
  PERMISSIONS.REPORTS_REVIEW_PROVINCE,
  PERMISSIONS.REPORTS_VALIDATE,
  PERMISSIONS.REPORTS_REVIEW_CELL,
  PERMISSIONS.REPORTS_SIGN_CELL,
];

// Rapports de synthèse (POOL : review_pool ; cellule : review_cell, signature sign_cell ; examen : review_province).
const SYNTHESES_KEYS = [
  PERMISSIONS.REPORTS_REVIEW_POOL,
  PERMISSIONS.REPORTS_REVIEW_PROVINCE,
  PERMISSIONS.REPORTS_REVIEW_CELL,
  PERMISSIONS.REPORTS_SIGN_CELL,
];

/** Espace « Exploitation » : quatre onglets, dans cet ordre (décision du 2026-10-09). */
export const EXPLOITATION_TABS: NavTab[] = [
  {
    href: "/inspections",
    label: "Inspection et fiches",
    subLabel: "Inspections",
    // Plan et relevés d'activités, bordereau de transmission (A2, A3, A4, A6).
    children: [{ href: "/fiches", label: "Fiches de période", permission: PERMISSIONS.INSPECTIONS_CONDUCT }],
  },
  { href: "/rapports", label: "Rapports" },
  { href: "/exploitation", label: "Exploitation", permission: EXPLOITATION_KEYS },
  { href: "/syntheses", label: "Synthèses", permission: SYNTHESES_KEYS },
];

/** Espace « Inspecteurs » : la liste et les affectations des écoles aux itinérants. */
export const INSPECTEURS_TABS: NavTab[] = [
  { href: "/inspecteurs", label: "Liste des inspecteurs", permission: PERMISSIONS.USERS_MANAGE },
  { href: "/affectations", label: "Affectations", permission: PERMISSIONS.ASSIGNMENTS_MANAGE },
];

/**
 * Espace « Demandes de compte ». Valider un compte et autoriser sa publication
 * restent deux actions distinctes, chacune avec sa permission.
 */
export const COMPTES_TABS: NavTab[] = [
  { href: "/comptes", label: "Validation des comptes", permission: PERMISSIONS.ACCOUNTS_MANAGE },
  {
    href: "/publication",
    label: "Publication des comptes",
    permission: PERMISSIONS.PUBLICATION_MANAGE,
    roles: PUBLICATION_AUTHORITY_ROLE_KEYS,
  },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/ecoles", label: "Écoles", icon: School },
  { href: "/inspections", label: "Exploitation", icon: ClipboardList, tabs: EXPLOITATION_TABS },
  // Secrétariat de l'IPP : rapports arrivés, à envoyer à une cellule.
  { href: "/secretariat", label: "Secrétariat", icon: Inbox, permission: PERMISSIONS.REPORTS_ROUTE_IPP },
  { href: "/inspecteurs", label: "Inspecteurs", icon: Users, tabs: INSPECTEURS_TABS },
  { href: "/comptes", label: "Demandes de compte", icon: UserPlus, tabs: COMPTES_TABS },
  // Page accessible aussi avec direction.manage (IPP) : l'IPP détient les deux.
  { href: "/direction", label: "Direction", icon: Landmark, permission: PERMISSIONS.PUBLICATION_MANAGE },
  // Rédacteurs (chargé des médias) et valideurs (IPP, IPP adjoints, informaticien).
  {
    href: "/contenus",
    label: "Actualités",
    icon: Newspaper,
    permission: [PERMISSIONS.CONTENT_WRITE, PERMISSIONS.CONTENT_PUBLISH],
  },
  // Inspool (son POOL), IPP adjoints, IPP, informaticien, Super Admin.
  { href: "/ia", label: "IA", icon: Sparkles, permission: PERMISSIONS.AI_ANALYZE },
  { href: "/audit", label: "Journal d'audit", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
  { href: "/parametres", label: "Paramètres", icon: Settings, permission: PERMISSIONS.POOLS_MANAGE },
];

/** Espace à onglets contenant cette page, s'il y en a un. */
export function sectionForPath(pathname: string): NavItem | null {
  return NAV_ITEMS.find((item) => item.tabs && isNavItemActive(item, pathname)) ?? null;
}
