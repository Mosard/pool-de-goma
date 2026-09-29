import {
  LayoutDashboard,
  School,
  Users,
  ClipboardList,
  FileCheck2,
  Share2,
  UserPlus,
  ScrollText,
  Settings,
  Building2,
  BadgeCheck,
  Landmark,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/rbac-data";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string; // absent = visible à tout utilisateur connecté
};

// Menu latéral réduit en icônes : choix mémorisé dans ce cookie, lu par le
// layout serveur (pas de saut d'affichage au chargement). Constante placée
// ici et non dans nav.tsx : un module « use client » ne fournit pas ses
// constantes au serveur.
export const SIDEBAR_COOKIE = "sidebar";

/** Lien « Mon POOL » du chef de POOL (fiche du bureau, inspecteurs). */
export function myPoolItem(href: string): NavItem {
  return { href, label: "Mon POOL", icon: Building2 };
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/ecoles", label: "Écoles", icon: School },
  { href: "/affectations", label: "Affectations", icon: Share2, permission: PERMISSIONS.ASSIGNMENTS_MANAGE },
  { href: "/inspections", label: "Inspections & fiches", icon: ClipboardList },
  { href: "/rapports", label: "Rapports", icon: FileCheck2 },
  { href: "/inspecteurs", label: "Inspecteurs", icon: Users, permission: PERMISSIONS.USERS_MANAGE },
  { href: "/comptes", label: "Demandes de compte", icon: UserPlus, permission: PERMISSIONS.ACCOUNTS_MANAGE },
  { href: "/publication", label: "Publication", icon: BadgeCheck, permission: PERMISSIONS.PUBLICATION_MANAGE },
  // Page accessible aussi avec direction.manage (IPP) : l'IPP détient les deux.
  { href: "/direction", label: "Direction", icon: Landmark, permission: PERMISSIONS.PUBLICATION_MANAGE },
  { href: "/audit", label: "Journal d'audit", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
  { href: "/parametres", label: "Paramètres", icon: Settings, permission: PERMISSIONS.POOLS_MANAGE },
];
