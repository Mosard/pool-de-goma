// Côté serveur des listes et exports de rapports (docs/export-donnees.md) :
// le sujet vient de la session relue en base, le périmètre et les filtres de
// src/lib/exports/scope.ts. Aucun identifiant envoyé par le navigateur
// n'élargit le périmètre.

import { prisma } from "@/lib/prisma";
import { loadUserAccess } from "@/lib/permissions";
import { REPORT_SCOPE_INCLUDE, reportScope } from "@/lib/fiches/report-scope";
import { checkFilters, parseFilters, reportsWhere, reviewPools, scopeWhere, type ExportSubject, type ReportFilters } from "@/lib/exports/scope";

/** Plafond d'un export Excel ; au-delà, affiner les filtres. */
export const EXPORT_LIMIT = 10_000;

export async function loadExportSubject(userId: string): Promise<ExportSubject> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, organizationId: true, isDemo: true } });
  const { roles, permissions } = await loadUserAccess(userId);
  return { id: user.id, organizationId: user.organizationId, isDemo: user.isDemo, roles, permissions };
}

/** Filtres demandés, contrôlés : refus explicite s'ils sortent du périmètre. */
export async function resolveFilters(
  subject: ExportSubject,
  raw: Record<string, string | string[] | undefined>
): Promise<{ filters: ReportFilters; error: string | null }> {
  const filters = parseFilters(raw);
  const pool = filters.poolId ? await prisma.pool.findUnique({ where: { id: filters.poolId }, select: { organizationId: true } }) : null;
  return { filters, error: checkFilters(subject, filters, pool?.organizationId ?? null) };
}

export type ReportRow = {
  id: string;
  ecole: string;
  pool: string;
  inspecteur: string;
  fiche: string;
  numero: string;
  date: Date;
  statut: string;
  statutKey: string;
};

export async function loadReportRows(subject: ExportSubject, filters: ReportFilters, take: number): Promise<ReportRow[]> {
  const reports = await prisma.report.findMany({
    where: reportsWhere(subject, filters),
    include: { ...REPORT_SCOPE_INCLUDE, pool: { select: { name: true } } },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take,
  });
  return reports.map((r) => {
    const scope = reportScope(r);
    const poolName = r.inspection?.school.pool.name ?? r.form?.inspection?.school.pool.name ?? r.form?.pool?.name ?? r.pool?.name ?? "—";
    return {
      id: r.id,
      ecole: scope.schoolName ?? "—",
      pool: poolName,
      inspecteur: scope.authorName,
      fiche: r.form ? r.form.formTemplate.title : "Rapport d'inspection (ancien circuit)",
      numero: scope.number ?? "",
      date: r.submittedAt ?? r.createdAt,
      statut: r.status.label,
      statutKey: r.status.key,
    };
  });
}

/** Choix proposés dans les filtres, limités au périmètre. */
export async function filterOptions(subject: ExportSubject) {
  const pools = reviewPools(subject);
  const [poolRows, statuses, authors] = await Promise.all([
    pools === "ALL"
      ? prisma.pool.findMany({ where: { organizationId: subject.organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : prisma.pool.findMany({ where: { id: { in: pools } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.workflowStatus.findMany({ orderBy: { order: "asc" }, select: { key: true, label: true } }),
    pools !== "ALL" && pools.length === 0
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            OR: [
              { reportsAuthored: { some: scopeWhere(subject) } },
              { inspections: { some: { report: scopeWhere(subject) } } },
            ],
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);
  return { pools: poolRows, statuses, inspectors: authors, canFilterInspector: authors.length > 0, canFilterPool: poolRows.length > 1 };
}

/** Classeur Excel : une ligne par rapport, colonnes essentielles. */
export async function buildReportsWorkbook(rows: ReportRow[]): Promise<Buffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "IPP Nord-Kivu 1";
  const ws = wb.addWorksheet("Rapports");
  ws.columns = [
    { header: "École", key: "ecole", width: 32 },
    { header: "POOL", key: "pool", width: 18 },
    { header: "Inspecteur", key: "inspecteur", width: 26 },
    { header: "Type de fiche", key: "fiche", width: 44 },
    { header: "N° du rapport", key: "numero", width: 30 },
    { header: "Date", key: "date", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Statut", key: "statut", width: 24 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: "A1", to: "G1" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
