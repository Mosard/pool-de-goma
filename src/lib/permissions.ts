import { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  CHEF_POOL: "Chef de POOL",
  INSPECTEUR: "Inspecteur itinérant",
  EXPLOITANT: "Exploitant",
};

export const canManageUsers = (role: Role) => role === "CHEF_POOL";
export const canManageSchools = (role: Role) => role === "CHEF_POOL";
export const canAssignSchools = (role: Role) => role === "CHEF_POOL";
export const canConductInspections = (role: Role) => role === "INSPECTEUR";
export const canReviewReports = (role: Role) =>
  role === "EXPLOITANT" || role === "CHEF_POOL";

export function assertRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) {
    throw new Error("Action non autorisée pour ce rôle.");
  }
}
