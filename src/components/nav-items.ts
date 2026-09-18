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
} from "lucide-react";
import { PERMISSIONS } from "@/lib/rbac-data";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string; // absent = visible à tout utilisateur connecté
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/ecoles", label: "Écoles", icon: School },
  { href: "/affectations", label: "Affectations", icon: Share2, permission: PERMISSIONS.ASSIGNMENTS_MANAGE },
  { href: "/inspections", label: "Inspections & fiches", icon: ClipboardList },
  { href: "/rapports", label: "Rapports", icon: FileCheck2 },
  { href: "/inspecteurs", label: "Inspecteurs", icon: Users, permission: PERMISSIONS.USERS_MANAGE },
  { href: "/comptes", label: "Demandes de compte", icon: UserPlus, permission: PERMISSIONS.ACCOUNTS_MANAGE },
  { href: "/audit", label: "Journal d'audit", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
  { href: "/parametres", label: "Paramètres", icon: Settings, permission: PERMISSIONS.POOLS_MANAGE },
];
