// Accès serveur aux fiches : inscription des définitions officielles,
// fiches proposées, pré-remplissage, droits de saisie et numérotation.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OFFICIAL_FICHES, commonHeaderFields, resolveFicheDef } from "@/lib/fiches/defs/index";
import { formatReportNumber, initialsOf, schoolYearOf } from "@/lib/fiches/calculs";
import type { FicheData, FicheDef, FicheScope, FicheValues, PrefillKey } from "@/lib/fiches/types";
import { WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";

// ---------------------------------------------------------------------------
// Inscription des définitions officielles en base
// ---------------------------------------------------------------------------

/** Catégories des fiches officielles, distinctes des catégories des fiches simulées (A, E, F). */
const OFFICIAL_CATEGORIES = [
  { code: "MOD-A", label: "Module I — Administration interne" },
  { code: "MOD-C", label: "Module II — Contrôle de l'enseignement" },
  { code: "MOD-F", label: "Module III — Formation en cours d'emploi" },
  { code: "MOD-T", label: "Module IV — Testing" },
];

let ensured: Promise<void> | null = null;

/**
 * Inscrit chaque (code, version) officiel absent de la base, avec un
 * instantané JSON de sa définition. Création seulement : une version déjà
 * présente n'est JAMAIS modifiée (les rapports qui l'utilisent restent lisibles).
 */
export function ensureOfficialTemplates(): Promise<void> {
  ensured ??= (async () => {
    const categories = await Promise.all(
      OFFICIAL_CATEGORIES.map((c) => prisma.inspectionCategory.upsert({ where: { code: c.code }, update: {}, create: c }))
    );
    const categoryId = (module: FicheDef["module"]) => categories.find((c) => c.code === `MOD-${module}`)!.id;
    await prisma.formTemplate.createMany({
      data: OFFICIAL_FICHES.map((def) => ({
        code: def.code,
        version: def.version,
        title: `${def.code} — ${def.title}`,
        fieldsSchema: def as unknown as Prisma.InputJsonValue,
        module: def.module,
        scope: def.scope,
        source: def.source,
        categoryId: categoryId(def.module),
      })),
      skipDuplicates: true,
    });
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

/** Fiches proposées à la saisie : dernière version active de chaque code, pour le cadre demandé. */
export async function proposedTemplates(scope: FicheScope) {
  await ensureOfficialTemplates();
  const all = await prisma.formTemplate.findMany({ where: { active: true, scope }, orderBy: [{ code: "asc" }, { version: "desc" }] });
  const latest = new Map<string, (typeof all)[number]>();
  for (const t of all) if (!latest.has(t.code)) latest.set(t.code, t);
  const order = (code: string) => {
    const i = OFFICIAL_FICHES.findIndex((d) => d.code === code);
    return i === -1 ? 1000 : i;
  };
  return [...latest.values()].sort((a, b) => order(a.code) - order(b.code) || a.code.localeCompare(b.code));
}

// ---------------------------------------------------------------------------
// Pré-remplissage
// ---------------------------------------------------------------------------

export type PrefillContext = {
  user: { name: string; postnom: string | null; prenom: string | null; sex: string | null; phone: string | null; email: string };
  poolName: string | null;
  school: { name: string; director: string | null } | null;
};

export function prefillValues(def: FicheDef, ctx: PrefillContext, now = new Date()): FicheValues {
  const sources: Record<PrefillKey, string | null> = {
    inspectorName: [ctx.user.name, ctx.user.postnom, ctx.user.prenom].filter(Boolean).join(" "),
    inspectorSex: ctx.user.sex === "M" || ctx.user.sex === "F" ? ctx.user.sex : null,
    inspectorPhone: ctx.user.phone,
    inspectorEmail: ctx.user.email,
    poolName: ctx.poolName,
    schoolName: ctx.school?.name ?? null,
    schoolDirector: ctx.school?.director ?? null,
    schoolYear: schoolYearOf(now),
    province: "Nord-Kivu 1",
    today: now.toISOString().slice(0, 10),
  };
  const values: FicheValues = {};
  const fields = [...commonHeaderFields(def), ...def.header, ...def.sections.flatMap((s) => s.blocks)];
  for (const f of fields) {
    if (f.kind === "field" && f.prefill && sources[f.prefill]) values[f.id] = sources[f.prefill]!;
  }
  return values;
}

// ---------------------------------------------------------------------------
// Fiche et droits de saisie
// ---------------------------------------------------------------------------

export const FORM_INCLUDE = {
  formTemplate: true,
  author: true,
  pool: true,
  inspection: { include: { school: { include: { pool: true } }, inspector: true } },
  report: {
    include: {
      status: true,
      ippTrack: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "asc" } },
    },
  },
} satisfies Prisma.FormInclude;

export type FormWithContext = Prisma.FormGetPayload<{ include: typeof FORM_INCLUDE }>;

export function formAuthorId(form: FormWithContext): string | null {
  return form.authorId ?? form.inspection?.inspectorId ?? null;
}

export function formPool(form: FormWithContext): { id: string; organizationId: string; name: string; code: string } | null {
  return form.inspection?.school.pool ?? form.pool ?? null;
}

export function formIsDemo(form: FormWithContext): boolean {
  return form.inspection ? form.inspection.school.isDemo : Boolean(form.author?.isDemo);
}

/** Modifiable par l'auteur : jamais soumise, ou renvoyée « À corriger ». */
export function isFormEditable(form: Pick<FormWithContext, "report">): boolean {
  const key = form.report?.status.key;
  return !key || key === WORKFLOW_STATUS_KEYS.BROUILLON || key === WORKFLOW_STATUS_KEYS.A_CORRIGER;
}

export function formDef(form: FormWithContext): FicheDef | null {
  return resolveFicheDef(form.formTemplate);
}

/** Données d'une fiche au format 2 (valeurs vides si la fiche vient d'être créée). */
export function ficheData(form: { data: unknown }): FicheData {
  const d = (form.data ?? {}) as Partial<FicheData>;
  return { format: 2, values: d.values ?? {}, signatures: d.signatures ?? {} };
}

/** Libellé d'un exemplaire (ex. nom de l'enseignant pour un C3). */
export function instanceLabel(def: FicheDef | null, data: FicheData): string | null {
  if (!def?.instanceLabel) return null;
  const v = data.values[def.instanceLabel];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ---------------------------------------------------------------------------
// Numérotation à la première soumission
// ---------------------------------------------------------------------------

/**
 * Attribue le numéro du rapport (module, « Numérotation du rapport ») :
 * n° thématique par code et n° universel continu de l'inspecteur dans
 * l'année civile. L'unicité (auteur, année, n° universel) protège contre
 * deux soumissions simultanées : l'appelant réessaie en cas de conflit.
 */
export async function nextReportNumber(
  tx: Prisma.TransactionClient,
  p: { authorId: string; code: string; poolCode: string; author: { name: string; postnom: string | null; prenom: string | null }; now: Date }
) {
  const year = p.now.getFullYear();
  const [universal, thematic] = await Promise.all([
    tx.form.aggregate({ where: { authorId: p.authorId, numberYear: year }, _max: { universalSeq: true } }),
    tx.form.aggregate({ where: { authorId: p.authorId, numberYear: year, formTemplate: { code: p.code } }, _max: { thematicSeq: true } }),
  ]);
  const universalSeq = (universal._max.universalSeq ?? 0) + 1;
  const thematicSeq = (thematic._max.thematicSeq ?? 0) + 1;
  const number = formatReportNumber({
    poolCode: p.poolCode,
    initials: initialsOf(p.author.name, p.author.postnom, p.author.prenom),
    code: p.code,
    thematic: thematicSeq,
    universal: universalSeq,
    year,
  });
  return { number, numberYear: year, thematicSeq, universalSeq };
}

/** Libellés et clés des statuts du circuit, par identifiant (l'historique ne porte que l'identifiant). */
export async function workflowStatusById() {
  const statuses = await prisma.workflowStatus.findMany();
  return new Map(statuses.map((s) => [s.id, s]));
}
