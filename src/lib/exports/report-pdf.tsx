// Rendu du PDF d'un rapport à partir de sa source préparée (report-pdf-source.ts).

import { FichePdf, SimplePdf, renderPdf } from "@/lib/exports/fiche-pdf";
import { loadReportPdfSource } from "@/lib/exports/report-pdf-source";
import type { ExportSubject } from "@/lib/exports/scope";

export { PdfAccessError } from "@/lib/exports/report-pdf-source";

export async function buildReportPdf(subject: ExportSubject, reportId: string): Promise<{ body: Buffer; filename: string; version: string }> {
  const src = await loadReportPdfSource(subject, reportId);
  const body =
    src.kind === "fiche"
      ? await renderPdf(<FichePdf def={src.def} data={src.data} computed={src.computed} number={src.number} statusLabel={src.statusLabel} />)
      : await renderPdf(
          <SimplePdf title={src.title} subtitle={src.subtitle} summary={src.summary} recommendations={src.recommendations} fields={src.fields} statusLabel={src.statusLabel} />
        );
  return { body, filename: src.filename, version: src.version };
}
