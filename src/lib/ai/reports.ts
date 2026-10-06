import { prisma } from "@/lib/prisma";
import { parseFieldsSchema, type FormFieldDef } from "@/lib/form-schema";
import { WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";

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
  from: Date;
  /** Borne exclue. */
  to: Date;
  isDemo: boolean;
};

export async function loadAiReports(q: AiReportQuery): Promise<AiReport[]> {
  const range = { gte: q.from, lt: q.to };
  const rows = await prisma.report.findMany({
    where: {
      status: { key: { not: WORKFLOW_STATUS_KEYS.BROUILLON } },
      inspection: {
        school: {
          isDemo: q.isDemo,
          ...(q.poolId ? { poolId: q.poolId } : {}),
          pool: { organizationId: q.organizationId },
        },
      },
      OR: [
        { inspection: { completedAt: range } },
        { inspection: { completedAt: null }, submittedAt: range },
        { inspection: { completedAt: null }, submittedAt: null, createdAt: range },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      status: { select: { key: true, label: true } },
      inspection: {
        select: {
          completedAt: true,
          school: { select: { id: true, name: true, pool: { select: { id: true, name: true } } } },
          forms: { select: { data: true, formTemplate: { select: { code: true, title: true, fieldsSchema: true } } } },
        },
      },
    },
  });

  return rows.map((r) => {
    const fields: AiReportField[] = [];
    for (const form of r.inspection.forms) {
      const data = (form.data ?? {}) as Record<string, unknown>;
      for (const def of parseFieldsSchema(form.formTemplate.fieldsSchema)) {
        const raw = data[def.name];
        let value: string | number | null = null;
        if (def.type === "number") {
          const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
          value = Number.isFinite(n) ? n : null;
        } else if (typeof raw === "string" && raw.trim() !== "") {
          value = raw.trim();
        }
        fields.push({
          key: `${form.formTemplate.code}.${def.name}`,
          label: `${form.formTemplate.title} — ${def.label}`,
          type: def.type,
          options: def.options,
          value,
        });
      }
    }
    return {
      id: r.id,
      date: r.inspection.completedAt ?? r.submittedAt ?? r.createdAt,
      statusKey: r.status.key,
      statusLabel: r.status.label,
      school: { id: r.inspection.school.id, name: r.inspection.school.name },
      pool: r.inspection.school.pool,
      summary: r.summary,
      recommendations: r.recommendations,
      fields,
    };
  });
}

/** Champ Oui/Non : sélection dont les options contiennent « Oui ». */
export function isYesNoField(f: Pick<AiReportField, "type" | "options">): boolean {
  return f.type === "select" && (f.options ?? []).some((o) => o.toLowerCase() === "oui");
}
