// Import des écoles côté serveur (docs/import-ecoles-excel.md, § 3.3).
// Droit et portée relus en base (schools.manage pour le POOL choisi) ; le
// POOL vient du choix explicite à l'écran, jamais du fichier ; chaque ligne
// est traitée indépendamment ; rien n'est jamais supprimé.

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, hasPermission, loadUserAccess, poolsWithPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import type { ViewMode } from "@/lib/view-mode";
import { readSchoolRows } from "@/lib/schools-import/workbook";
import { planCreate, planUpdate, validateRows, type Rejection } from "@/lib/schools-import/validate";

export type ImportedSchool = { line: number; code: string; name: string };

export type SchoolImportReport = {
  pool: { code: string; name: string };
  fileName: string;
  created: ImportedSchool[];
  updated: ImportedSchool[];
  /** Codes déjà enregistrés dont le fichier ne change rien. */
  unchanged: ImportedSchool[];
  rejected: Rejection[];
};

type AccessOpts = { viewMode?: ViewMode | null };

/** POOL où le compte peut gérer les écoles (droits relus en base). */
export async function manageablePools(userId: string, opts?: AccessOpts) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user) return [];
  const { permissions } = await loadUserAccess(userId, opts);
  const pools = poolsWithPermission(permissions, PERMISSIONS.SCHOOLS_MANAGE);
  return prisma.pool.findMany({
    where: pools === "ALL" ? { organizationId: user.organizationId, active: true } : { id: { in: pools }, organizationId: user.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

const SCHOOL_SELECT = {
  id: true,
  code: true,
  isDemo: true,
  name: true,
  province: true,
  territoire: true,
  type: true,
  director: true,
  phone: true,
  address: true,
  approvalDecree: true,
  classCount: true,
  teacherCount: true,
  options: true,
} as const;

export async function importSchools(input: {
  actorId: string;
  poolId: string;
  fileName: string;
  data: ArrayBuffer | Uint8Array;
  viewMode?: ViewMode | null;
}): Promise<SchoolImportReport> {
  const opts: AccessOpts = "viewMode" in input ? { viewMode: input.viewMode } : {};
  // 1. Droit sur CE POOL, relu en base ; l'identifiant reçu n'est qu'une demande.
  const [pool, actor] = await Promise.all([
    prisma.pool.findUnique({ where: { id: input.poolId }, select: { id: true, code: true, name: true, organizationId: true } }),
    prisma.user.findUnique({ where: { id: input.actorId }, select: { isDemo: true } }),
  ]);
  const { permissions } = await loadUserAccess(input.actorId, opts);
  if (!pool || !actor || !hasPermission(permissions, PERMISSIONS.SCHOOLS_MANAGE, { poolId: pool.id, organizationId: pool.organizationId })) {
    throw new ForbiddenError("Vous n'avez pas le droit d'importer des écoles dans ce POOL.");
  }

  // 2. Lecture et validation (refus en bloc seulement si le fichier n'est pas le canevas).
  const rows = await readSchoolRows(input.data);
  const { valid, rejected } = validateRows(rows, pool.code);

  const report: SchoolImportReport = {
    pool: { code: pool.code, name: pool.name },
    fileName: input.fileName,
    created: [],
    updated: [],
    unchanged: [],
    rejected: [...rejected],
  };

  // 3. Écoles du POOL, retrouvées par code sans tenir compte de la casse (décision Q5).
  const existing = await prisma.school.findMany({ where: { poolId: pool.id }, select: SCHOOL_SELECT });
  const byCode = new Map<string, (typeof existing)[number][]>();
  for (const s of existing) byCode.set(s.code.toLowerCase(), [...(byCode.get(s.code.toLowerCase()) ?? []), s]);

  const audits: { action: string; entityId: string; oldValue?: object; newValue: object }[] = [];
  const reject = (line: number, code: string, reason: string) => report.rejected.push({ line, code, reason });

  for (const { line, data } of valid) {
    const matches = byCode.get(data.code.toLowerCase()) ?? [];
    if (matches.length > 1) {
      reject(line, data.code, `Plusieurs écoles de ce POOL ont ce code (${matches.map((m) => m.code).join(", ")}) : à corriger dans les fiches avant import`);
      continue;
    }
    try {
      if (matches.length === 0) {
        const plan = planCreate(data);
        if (!plan.ok) {
          reject(line, data.code, plan.reason);
          continue;
        }
        // Comme la saisie manuelle : école créée depuis un compte de démonstration = démo.
        const school = await prisma.school.create({ data: { ...plan.values, poolId: pool.id, isDemo: actor.isDemo }, select: SCHOOL_SELECT });
        byCode.set(school.code.toLowerCase(), [school]);
        report.created.push({ line, code: school.code, name: school.name });
        audits.push({ action: "school.create", entityId: school.id, newValue: { ...plan.values, poolId: pool.id } });
        continue;
      }

      const current = matches[0];
      // Même règle que la fiche : un compte de démonstration ne modifie pas une école réelle.
      if (actor.isDemo && !current.isDemo) {
        reject(line, data.code, "École réelle : modification impossible depuis un compte de démonstration");
        continue;
      }
      const plan = planUpdate(current, data);
      if (!plan.ok) {
        reject(line, data.code, plan.reason);
        continue;
      }
      const fields = Object.keys(plan.changes) as (keyof typeof plan.changes)[];
      if (fields.length === 0) {
        report.unchanged.push({ line, code: current.code, name: current.name });
        continue;
      }
      await prisma.school.update({ where: { id: current.id }, data: plan.changes });
      report.updated.push({ line, code: current.code, name: plan.changes.name ?? current.name });
      audits.push({
        action: "school.update",
        entityId: current.id,
        oldValue: Object.fromEntries(fields.map((f) => [f, current[f]])),
        newValue: plan.changes,
      });
    } catch (e) {
      console.error("Import des écoles : ligne", line, e);
      reject(line, data.code, "Enregistrement impossible (code peut-être créé entre-temps) : réessayez cette ligne");
    }
  }

  report.rejected.sort((a, b) => a.line - b.line);

  // 4. Traçabilité : une entrée par école touchée, plus le récapitulatif de l'import.
  if (audits.length > 0) {
    await prisma.auditLog.createMany({
      data: audits.map((a) => ({
        actorId: input.actorId,
        organizationId: pool.organizationId,
        action: a.action,
        entityType: "School",
        entityId: a.entityId,
        oldValue: a.oldValue,
        newValue: a.newValue,
        metadata: { source: "import Excel", fileName: input.fileName },
      })),
    });
  }
  await logAudit({
    actorId: input.actorId,
    organizationId: pool.organizationId,
    action: "school.import",
    entityType: "Pool",
    entityId: pool.id,
    metadata: {
      fileName: input.fileName,
      created: report.created.length,
      updated: report.updated.length,
      unchanged: report.unchanged.length,
      rejected: report.rejected.length,
    },
  });

  return report;
}
