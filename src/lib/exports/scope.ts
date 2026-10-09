// Périmètre commun des listes de rapports, de l'exploitation et des exports
// (docs/export-donnees.md, § 3). Fonctions PURES : le sujet est construit
// côté serveur depuis la session relue en base (loadUserAccess), jamais
// depuis ce qu'envoie le navigateur. Les filtres ne font que restreindre.

import type { Prisma } from "@prisma/client";
import { readableCells, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { PERMISSIONS } from "@/lib/rbac-data";
import { reportsOfAuthor, reportsOfOrganization, reportsOfPool } from "@/lib/fiches/report-scope";
import { CELL_VISIBLE_STAGES, TRANSMITTED_SYNTHESIS_STATUSES, holdsRouteIpp, readsSignedOnly } from "@/lib/cells/rules";

/** Permissions qui donnent accès aux rapports des autres (exploiter, valider). */
export const REVIEW_KEYS: readonly string[] = [PERMISSIONS.REPORTS_REVIEW_POOL, PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.REPORTS_VALIDATE];

export type ExportSubject = { id: string; organizationId: string; roles: SessionRole[]; permissions: SessionPermission[]; isDemo: boolean };

/** Permissions de lecture au POOL ou à l'organisation (hors permissions de cellule). */
function heldReview(subject: ExportSubject) {
  return subject.permissions.filter((p) => REVIEW_KEYS.includes(p.permissionKey) && !p.cellId && p.organizationId === subject.organizationId);
}

/**
 * POOL proposés dans les filtres : « ALL » (tous ceux de l'organisation),
 * une liste, ou aucun. Le secrétariat et les cellules reçoivent des rapports
 * de plusieurs POOL : « ALL », mais le filtre ne fait que RESTREINDRE leur
 * périmètre (scopeWhere), jamais l'élargir.
 */
export function reviewPools(subject: ExportSubject): "ALL" | string[] {
  const held = heldReview(subject);
  if (held.some((p) => p.poolId === null)) return "ALL";
  if (holdsRouteIpp(subject, subject.organizationId) || readableCells(subject.permissions).length > 0) return "ALL";
  return [...new Set(held.map((p) => p.poolId as string))];
}

/** Données de démonstration et officielles ne se mélangent jamais. */
export function demoWhere(isDemo: boolean): Prisma.ReportWhereInput {
  return {
    OR: [
      { inspection: { school: { isDemo } } },
      { form: { inspection: { school: { isDemo } } } },
      // Fiche de période (sans école) : selon son auteur.
      { inspectionId: null, form: { inspectionId: null, author: { isDemo } } },
    ],
  };
}

/**
 * Rapports que la personne peut voir et exporter — même règle que la lecture
 * d'un rapport (canReadReport, src/lib/cells/rules.ts) : les siens ; ceux des
 * POOL qu'elle exploite ; toute l'organisation pour une portée provinciale
 * (l'IPP principal : seulement les rapports sources d'une synthèse de
 * cellule validée et transmise, et l'historique) ; le secrétariat : la
 * branche IPP ; une cellule : les rapports qui lui sont affectés.
 */
export function scopeWhere(subject: ExportSubject): Prisma.ReportWhereInput {
  const org = subject.organizationId;
  const held = heldReview(subject);
  const visible: Prisma.ReportWhereInput[] = [reportsOfAuthor(subject.id)];
  if (held.some((p) => p.poolId === null)) {
    visible.push(
      readsSignedOnly(subject.roles)
        ? {
            AND: [
              reportsOfOrganization(org),
              {
                OR: [
                  { synthesisSources: { some: { synthesis: { cellId: { not: null }, status: { in: [...TRANSMITTED_SYNTHESIS_STATUSES] as ("VALIDE" | "SIGNE")[] } } } } },
                  { ippTrack: { is: { legacy: true } } },
                ],
              },
            ],
          }
        : reportsOfOrganization(org)
    );
  }
  for (const poolId of new Set(held.flatMap((p) => (p.poolId ? [p.poolId] : [])))) visible.push(reportsOfPool(poolId));
  if (holdsRouteIpp(subject, org)) visible.push({ AND: [reportsOfOrganization(org), { ippTrack: { isNot: null } }] });
  const cells = readableCells(subject.permissions);
  if (cells.length > 0) visible.push({ ippTrack: { is: { organizationId: org, cellId: { in: cells }, stage: { in: [...CELL_VISIBLE_STAGES] } } } });
  return { AND: [{ OR: visible }, demoWhere(subject.isDemo)] };
}

export type ReportFilters = {
  ecole?: string;
  inspecteurId?: string;
  poolId?: string;
  du?: string;
  au?: string;
  statut?: string;
  code?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Lecture des paramètres d'URL : valeurs mal formées ignorées. */
export function parseFilters(raw: Record<string, string | string[] | undefined>): ReportFilters {
  const one = (k: string) => {
    const v = raw[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s.slice(0, 120) : undefined;
  };
  const du = one("du");
  const au = one("au");
  return {
    ecole: one("ecole"),
    inspecteurId: one("inspecteur"),
    poolId: one("pool"),
    du: du && DATE.test(du) ? du : undefined,
    au: au && DATE.test(au) ? au : undefined,
    statut: one("statut"),
    code: one("fiche"),
  };
}

/**
 * Contrôle des filtres demandés : un POOL hors des POOL exploités, ou un
 * inspecteur autre que soi pour qui n'exploite rien, est REFUSÉ (jamais
 * élargi). `poolOrganizationId` : organisation du POOL demandé, lue en base.
 */
export function checkFilters(subject: ExportSubject, f: ReportFilters, poolOrganizationId: string | null): string | null {
  const pools = reviewPools(subject);
  if (f.poolId) {
    const ok = pools === "ALL" ? poolOrganizationId === subject.organizationId : pools.includes(f.poolId);
    if (!ok) return "POOL hors de votre périmètre.";
  }
  if (f.inspecteurId && f.inspecteurId !== subject.id && pools !== "ALL" && pools.length === 0) {
    return "Vous ne pouvez consulter que vos propres rapports.";
  }
  return null;
}

/** Filtres de recherche, appliqués PAR-DESSUS le périmètre. */
export function filtersWhere(f: ReportFilters): Prisma.ReportWhereInput[] {
  const and: Prisma.ReportWhereInput[] = [];
  if (f.ecole) {
    const school = { name: { contains: f.ecole, mode: "insensitive" as const } };
    and.push({ OR: [{ inspection: { school } }, { form: { inspection: { school } } }] });
  }
  if (f.inspecteurId) and.push(reportsOfAuthor(f.inspecteurId));
  if (f.poolId) and.push(reportsOfPool(f.poolId));
  if (f.statut) and.push({ status: { key: f.statut } });
  if (f.code) and.push({ form: { formTemplate: { code: f.code } } });
  if (f.du || f.au) {
    const range = {
      ...(f.du ? { gte: new Date(`${f.du}T00:00:00`) } : {}),
      ...(f.au ? { lt: new Date(new Date(`${f.au}T00:00:00`).getTime() + 86_400_000) } : {}),
    };
    and.push({ OR: [{ submittedAt: range }, { submittedAt: null, createdAt: range }] });
  }
  return and;
}

/** Requête complète : périmètre ET filtres. */
export function reportsWhere(subject: ExportSubject, f: ReportFilters): Prisma.ReportWhereInput {
  return { AND: [scopeWhere(subject), ...filtersWhere(f)] };
}

/** Paramètres d'URL des filtres (pour le lien d'export qui reprend l'écran). */
export function filtersQuery(f: ReportFilters): string {
  const params = new URLSearchParams();
  const map: [keyof ReportFilters, string][] = [["ecole", "ecole"], ["inspecteurId", "inspecteur"], ["poolId", "pool"], ["du", "du"], ["au", "au"], ["statut", "statut"], ["code", "fiche"]];
  for (const [k, name] of map) if (f[k]) params.set(name, f[k]!);
  const s = params.toString();
  return s ? `?${s}` : "";
}
