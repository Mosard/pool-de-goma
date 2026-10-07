// Périmètre d'un rapport, qu'il s'agisse d'un rapport d'inspection global
// (ancien circuit : Report.inspection) ou du rapport d'une fiche officielle
// (circuit par fiche : Report.form, avec ou sans inspection pour les fiches
// de période A2, A3, A4, A6).

import type { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/rbac-data";
import { hasPermission, type SessionPermission } from "@/lib/permission-checks";

const INSPECTION_INCLUDE = { include: { school: { include: { pool: true } }, inspector: true } } as const;

export const REPORT_SCOPE_INCLUDE = {
  status: true,
  inspection: INSPECTION_INCLUDE,
  form: { include: { formTemplate: true, author: true, pool: true, inspection: INSPECTION_INCLUDE } },
} satisfies Prisma.ReportInclude;

export type ReportWithScope = Prisma.ReportGetPayload<{ include: typeof REPORT_SCOPE_INCLUDE }>;

export type ReportScope = {
  poolId: string | null;
  organizationId: string | null;
  authorId: string | null;
  authorName: string;
  inspectionId: string | null;
  schoolName: string | null;
  /** Titre affiché : « C3 — EP Kahembe » ou « A2 — Plan trimestriel d'activités ». */
  title: string;
  /** École ou compte de démonstration : jamais traité par un compte officiel seul. */
  isDemo: boolean;
  code: string | null;
  number: string | null;
};

export function reportScope(report: ReportWithScope): ReportScope {
  const form = report.form;
  const inspection = report.inspection ?? form?.inspection ?? null;
  const pool = inspection?.school.pool ?? form?.pool ?? null;
  const author = inspection?.inspector ?? form?.author ?? null;
  const schoolName = inspection?.school.name ?? null;
  const code = form?.formTemplate.code ?? null;
  const title = form ? `${form.formTemplate.code} — ${schoolName ?? form.formTemplate.title}` : (schoolName ?? "Rapport");
  return {
    poolId: pool?.id ?? report.poolId ?? null,
    organizationId: pool?.organizationId ?? null,
    authorId: author?.id ?? report.authorId ?? null,
    authorName: author?.name ?? "—",
    inspectionId: inspection?.id ?? null,
    schoolName,
    title,
    isDemo: Boolean(inspection?.school.isDemo || (!inspection && form?.author?.isDemo)),
    code,
    number: form?.number ?? null,
  };
}

/** Filtre Prisma : rapports d'un POOL (anciens par l'école, nouveaux par leur POOL). */
export function reportsOfPool(poolId: string): Prisma.ReportWhereInput {
  return { OR: [{ inspection: { school: { poolId } } }, { poolId }] };
}

/** Filtre Prisma : rapports d'une organisation. */
export function reportsOfOrganization(organizationId: string): Prisma.ReportWhereInput {
  return { OR: [{ inspection: { school: { pool: { organizationId } } } }, { pool: { organizationId } }] };
}

/** Filtre Prisma : rapports d'un auteur. */
export function reportsOfAuthor(userId: string): Prisma.ReportWhereInput {
  return { OR: [{ inspection: { inspectorId: userId } }, { authorId: userId }] };
}

/**
 * Lecture d'une inspection, d'une fiche ou d'un rapport : son auteur, ou une
 * personne qui exploite, valide ou affecte dans ce POOL (portée provinciale
 * comprise). Restreint les pages auparavant ouvertes à tout compte connecté.
 */
export function canReadScope(
  user: { id: string; permissions: SessionPermission[] },
  scope: { poolId: string | null; organizationId: string | null; authorId: string | null }
): boolean {
  if (scope.authorId === user.id) return true;
  if (!scope.organizationId) return false;
  const target = { poolId: scope.poolId, organizationId: scope.organizationId };
  return [PERMISSIONS.REPORTS_REVIEW_POOL, PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.REPORTS_VALIDATE, PERMISSIONS.ASSIGNMENTS_MANAGE].some((key) =>
    hasPermission(user.permissions, key, target)
  );
}
