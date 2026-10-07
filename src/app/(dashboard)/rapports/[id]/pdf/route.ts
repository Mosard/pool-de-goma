// PDF d'un rapport : seules les personnes autorisées à le lire (contrôle serveur).

import { auth } from "@/lib/auth";
import { loadExportSubject } from "@/lib/exports/server";
import { PdfAccessError, buildReportPdf } from "@/lib/exports/report-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Connexion requise.", { status: 401 });
  const { id } = await params;
  try {
    const { body, filename } = await buildReportPdf(await loadExportSubject(session.user.id), id);
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof PdfAccessError) return new Response(e.message, { status: 404 });
    throw e;
  }
}
