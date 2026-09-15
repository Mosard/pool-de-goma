import { prisma } from "@/lib/prisma";

/**
 * Organisation résolue pour un contexte public/non authentifié (page de
 * demande de compte, seed). Un utilisateur connecté a toujours son
 * organizationId en session — ce helper ne sert que là où il n'y a pas
 * encore d'acteur (donc pas d'organisation déterminée autrement).
 * Chaque déploiement ne sert qu'une seule organisation pour l'instant ; ce
 * helper prend la plus ancienne, seul point à changer si un jour une
 * résolution multi-organisation (sous-domaine, etc.) est nécessaire.
 */
export async function getDefaultOrganization() {
  return prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
}
