// Périmètre d'un rapport, qu'il s'agisse d'un rapport d'inspection global
// (ancien circuit : Report.inspection) ou du rapport d'une fiche officielle
// (circuit par fiche : Report.form, avec ou sans inspection pour les fiches
// de période A2, A3, A4, A6).

import type { Prisma } from "@prisma/client";
import type { SessionPermission, SessionRole } from "@/lib/permission-checks";
import { canReadReport, type IppTrackInfo } from "@/lib/cells/rules";

const INSPECTION_INCLUDE = { include: { school: { include: { pool: true } }, inspector: true } } as const;

export const REPORT_SCOPE_INCLUDE = {
  status: true,
  inspection: INSPECTION_INCLUDE,
  form: { include: { formTemplate: true, author: true, pool: true, inspection: INSPECTION_INCLUDE } },
  // Branche IPP (secrétariat, cellule, signature) : nécessaire à la règle de lecture.
  ippTrack: true,
} satisfies Prisma.ReportInclude;

/** Branche IPP d'un rapport chargé avec REPORT_SCOPE_INCLUDE. */
export function reportTrack(report: ReportWithScope): IppTrackInfo | null {
  const t = report.ippTrack;
  return t ? { stage: t.stage, cellId: t.cellId, legacy: t.legacy, organizationId: t.organizationId } : null;
}

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
 * Lecture d'une inspection, d'une fiche ou d'un rapport : règle centrale
 * `canReadReport` (src/lib/cells/rules.ts) — son auteur ; une personne qui
 * exploite, valide ou affecte dans ce POOL ; la portée organisation (sauf
 * l'IPP principal, limité dans la branche IPP à ce que les cellules ont
 * signé) ; le secrétariat de l'IPP ; la cellule à laquelle le rapport est
 * affecté. `track` : branche IPP du rapport (null pour une visite ou une
 * fiche sans rapport). `visit` : page d'une visite, hors branche IPP.
 */
export function canReadScope(
  user: { id: string; organizationId?: string; roles: SessionRole[]; permissions: SessionPermission[] },
  scope: { poolId: string | null; organizationId: string | null; authorId: string | null },
  track: IppTrackInfo | null = null,
  opts: { visit?: boolean } = {}
): boolean {
  const actor = { id: user.id, organizationId: user.organizationId ?? scope.organizationId ?? "", roles: user.roles, permissions: user.permissions };
  return canReadReport(actor, scope, track, opts);
}
