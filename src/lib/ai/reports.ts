import { prisma } from "@/lib/prisma";
import { parseFieldsSchema, type FormFieldDef } from "@/lib/form-schema";
import { WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { resolveFicheDef } from "@/lib/fiches/defs/index";
import { flattenFiche, toFicheData } from "@/lib/fiches/flatten";

// Lecture des rapports EXISTANTS (Report + fiches Form) pour la fonctionnalité
// IA : rien n'est recréé ni modifié. Rapports retenus : sortis du brouillon
// (soumis et au-delà), dans le périmètre et la période demandés. Un compte de
// démonstration ne voit que les écoles de démonstration, un compte officiel
// jamais.

export type AiReportField = {
  /** Clé stable de l'indicateur : <code de fiche>.<nom du champ>. */
  key: string;
  label: string;
  type: FormFieldDef["type"];
  options?: string[];
  value: string | number | null;
};

export type AiReport = {
  id: string;
  /** Date d'observation : fin d'inspection, sinon soumission, sinon création. */
  date: Date;
  statusKey: string;
  statusLabel: string;
  school: { id: string; name: string };
  pool: { id: string; name: string };
  summary: string | null;
  recommendations: string | null;
  fields: AiReportField[];
};

export type AiReportQuery = {
  organizationId: string;
  /** null : toute l'inspection. */
  poolId: string | null;
  /** Cellule de l'IPA : seulement les rapports que le secrétariat lui a affectés. */
  cellId?: string | null;
  from: Date;
  /** Borne exclue. */
  to: Date;
  isDemo: boolean;
};

export async function loadAiReports(q: AiReportQuery): Promise<AiReport[]> {
  const range = { gte: q.from, lt: q.to };
  const schoolFilter = {
    isDemo: q.isDemo,
    ...(q.poolId ? { poolId: q.poolId } : {}),
    pool: { organizationId: q.organizationId },
  };
  const formSelect = { data: true, formTemplate: { select: { code: true, title: true, version: true, fieldsSchema: true } } } as const;
  const schoolSelect = { select: { id: true, name: true, pool: { select: { id: true, name: true } } } } as const;
  const rows = await prisma.report.findMany({
    where: {
      status: { key: { not: WORKFLOW_STATUS_KEYS.BROUILLON } },
      ...(q.cellId ? { ippTrack: { is: { cellId: q.cellId, stage: { in: ["AFFECTE" as const, "EXPLOITE" as const, "SIGNE" as const] } } } } : {}),
      OR: [
        // Rapport d'inspection global (ancien circuit).
        {
          inspection: { school: schoolFilter },
          OR: [
            { inspection: { completedAt: range } },
            { inspection: { completedAt: null }, submittedAt: range },
            { inspection: { completedAt: null }, submittedAt: null, createdAt: range },
          ],
        },
        // Rapport d'une fiche officielle rattachée à une visite d'école. Les
        // fiches de période (A2, A3, A4, A6), sans école, n'entrent pas dans l'analyse.
        { form: { inspection: { school: schoolFilter } }, OR: [{ submittedAt: range }, { submittedAt: null, createdAt: range }] },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      status: { select: { key: true, label: true } },
      inspection: { select: { completedAt: true, school: schoolSelect, forms: { select: formSelect } } },
      form: { select: { ...formSelect, inspection: { select: { school: schoolSelect } } } },
    },
  });

  return rows.flatMap((r) => {
    const school = r.inspection?.school ?? r.form?.inspection?.school;
    if (!school) return [];
    const forms = r.form ? [r.form] : (r.inspection?.forms ?? []);
    const fields: AiReportField[] = forms.flatMap(formFields);
    return [
      {
        id: r.id,
        date: r.inspection?.completedAt ?? r.submittedAt ?? r.createdAt,
        statusKey: r.status.key,
        statusLabel: r.status.label,
        school: { id: school.id, name: school.name },
        pool: school.pool,
        summary: r.summary,
        recommendations: r.recommendations,
        fields,
      },
    ];
  });
}

/** Indicateurs d'une fiche : format officiel (2) aplati, ou ancien format plat. */
function formFields(form: { data: unknown; formTemplate: { code: string; title: string; version: number; fieldsSchema: unknown } }): AiReportField[] {
  const def = resolveFicheDef(form.formTemplate);
  if (def) return flattenFiche(def, toFicheData(form.data));
  const data = (form.data ?? {}) as Record<string, unknown>;
  return parseFieldsSchema(form.formTemplate.fieldsSchema).map((def) => {
    const raw = data[def.name];
    let value: string | number | null = null;
    if (def.type === "number") {
      const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
      value = Number.isFinite(n) ? n : null;
    } else if (typeof raw === "string" && raw.trim() !== "") {
      value = raw.trim();
    }
    return {
      key: `${form.formTemplate.code}.${def.name}`,
      label: `${form.formTemplate.title} — ${def.label}`,
      type: def.type,
      options: def.options,
      value,
    };
  });
}

/** Champ Oui/Non : sélection dont les options contiennent « Oui ». */
export function isYesNoField(f: Pick<AiReportField, "type" | "options">): boolean {
  return f.type === "select" && (f.options ?? []).some((o) => o.toLowerCase() === "oui");
}
