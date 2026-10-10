// Consultation des fiches du personnel (lecture seule). Chaque appel relit les
// droits en base (loadUserAccess, « Voir comme » compris : la consultation des
// fiches n'existe jamais en simulation) et journalise la recherche ou la
// consultation — auteur, fiche, action, date — sans recopier aucun contenu.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess } from "@/lib/permissions";
import { RECORD_SELECT, SEARCH_SELECT, canReadPersonnelRecords } from "@/lib/personnel/record";

export const SEARCH_PAGE_SIZE = 50;

export type PersonnelReader = { id: string; organizationId: string; isDemo: boolean };

/** Refuse (ForbiddenError) tout compte sans la consultation globale des fiches. */
export async function requirePersonnelReader(userId: string): Promise<PersonnelReader> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, organizationId: true, isDemo: true } });
  if (!user) throw new ForbiddenError();
  const { permissions } = await loadUserAccess(userId);
  if (!canReadPersonnelRecords(permissions, user.organizationId)) {
    throw new ForbiddenError("La consultation des fiches du personnel est réservée aux titulaires de cette permission.");
  }
  return user;
}

export type PersonnelSearch = { q?: string; poolId?: string; cellId?: string; page?: number };

function searchWhere(reader: PersonnelReader, s: PersonnelSearch): Prisma.UserWhereInput {
  const q = (s.q ?? "").trim().slice(0, 80);
  const and: Prisma.UserWhereInput[] = [
    // Données de démonstration séparées des données réelles, comme ailleurs dans l'application.
    { organizationId: reader.organizationId, isDemo: reader.isDemo },
  ];
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { postnom: { contains: q, mode: "insensitive" } },
        { prenom: { contains: q, mode: "insensitive" } },
        { matricule: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (s.poolId) and.push({ OR: [{ poolId: s.poolId }, { roles: { some: { poolId: s.poolId } } }] });
  if (s.cellId) and.push({ OR: [{ cellLed: { is: { id: s.cellId } } }, { roles: { some: { cellId: s.cellId } } }] });
  return { AND: and };
}

/** Recherche (identification et affectation seulement), paginée, journalisée sans le texte cherché. */
export async function searchPersonnel(userId: string, s: PersonnelSearch) {
  const reader = await requirePersonnelReader(userId);
  const page = Number.isInteger(s.page) && (s.page as number) > 0 ? (s.page as number) : 1;
  const where = searchWhere(reader, s);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, select: SEARCH_SELECT, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * SEARCH_PAGE_SIZE, take: SEARCH_PAGE_SIZE }),
    prisma.user.count({ where }),
  ]);
  await logAudit({
    actorId: reader.id,
    organizationId: reader.organizationId,
    action: "personnel.search",
    entityType: "PersonnelRecord",
    entityId: "recherche",
    metadata: { hasQuery: Boolean(s.q?.trim()), poolFilter: Boolean(s.poolId), cellFilter: Boolean(s.cellId), page, resultCount: rows.length },
  });
  return { rows, total, page, pageSize: SEARCH_PAGE_SIZE };
}

/** Fiche d'un compte de l'organisation (null si introuvable), consultation journalisée. */
export async function getPersonnelRecord(userId: string, targetId: string) {
  const reader = await requirePersonnelReader(userId);
  const record = await prisma.user.findFirst({
    where: { id: targetId, organizationId: reader.organizationId, isDemo: reader.isDemo },
    select: RECORD_SELECT,
  });
  if (!record) return null;
  await logAudit({
    actorId: reader.id,
    organizationId: reader.organizationId,
    action: "personnel.record.view",
    entityType: "User",
    entityId: record.id,
  });
  return record;
}
