// Préparation du PDF d'un rapport, sans rendu : contrôle d'accès côté serveur
// (lecture du rapport, démonstration séparée) et choix de la définition de la
// VERSION liée au rapport. Le rendu est dans report-pdf.tsx.

import { prisma } from "@/lib/prisma";
import { parseFieldsSchema } from "@/lib/form-schema";
import { REPORT_SCOPE_INCLUDE, canReadScope, reportScope, reportTrack } from "@/lib/fiches/report-scope";
import { resolveFicheDef } from "@/lib/fiches/defs/index";
import { ficheData } from "@/lib/fiches/server";
import type { FicheComputed } from "@/lib/fiches/calculs";
import type { FicheData, FicheDef } from "@/lib/fiches/types";
import type { ExportSubject } from "@/lib/exports/scope";

export class PdfAccessError extends Error {}

export type PdfSource =
  | { kind: "fiche"; def: FicheDef; data: FicheData; computed: FicheComputed | null; number: string | null; statusLabel: string; filename: string; version: string }
  | {
      kind: "simple";
      title: string;
      subtitle: string;
      summary: string | null;
      recommendations: string | null;
      fields: { label: string; value: string }[];
      statusLabel: string;
      filename: string;
      version: string;
    };

export async function loadReportPdfSource(subject: ExportSubject, reportId: string): Promise<PdfSource> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { ...REPORT_SCOPE_INCLUDE, inspection: { include: { school: { include: { pool: true } }, inspector: true, forms: { include: { formTemplate: true } } } } },
  });
  if (!report) throw new PdfAccessError("Rapport introuvable.");
  const scope = reportScope(report);
  if (!canReadScope(subject, scope, reportTrack(report)) || scope.isDemo !== subject.isDemo) throw new PdfAccessError("Rapport introuvable.");

  const form = report.form;
  const def = form ? resolveFicheDef(form.formTemplate) : null;
  if (form && def) {
    return {
      kind: "fiche",
      def,
      data: ficheData(form),
      computed: (form.computed as FicheComputed | null) ?? null,
      number: form.number,
      statusLabel: report.status.label,
      filename: `${def.code}-${(form.number ?? report.id).replaceAll("/", "-")}.pdf`,
      version: `${def.code} v${def.version}`,
    };
  }
  const forms = form ? [form] : (report.inspection?.forms ?? []);
  return {
    kind: "simple",
    title: scope.title,
    subtitle: `Inspecteur : ${scope.authorName}`,
    summary: report.summary,
    recommendations: report.recommendations,
    fields: forms.flatMap((f) => {
      const data = (f.data ?? {}) as Record<string, string>;
      return parseFieldsSchema(f.formTemplate.fieldsSchema).map((d) => ({ label: `${f.formTemplate.title} — ${d.label}`, value: data[d.name] ?? "" }));
    }),
    statusLabel: report.status.label,
    filename: `rapport-${report.id}.pdf`,
    version: "ancien format",
  };
}
