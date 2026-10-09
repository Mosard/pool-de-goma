// Export Excel des rapports affichés (docs/export-donnees.md, § 4.2) : mêmes
// filtres et même périmètre que la liste, recalculés ici côté serveur depuis
// la session ; un filtre hors périmètre est refusé (403).

import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { EXPORT_LIMIT, buildReportsWorkbook, loadExportSubject, loadReportRows, resolveFilters } from "@/lib/exports/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Connexion requise.", { status: 401 });
  // IPA ou exploitant de l'IPP sans cellule : aucun accès métier, même par appel direct.
  if (session.user.awaitingCell) return new Response("Compte en attente d'affectation à une cellule.", { status: 403 });

  const subject = await loadExportSubject(session.user.id);
  const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { filters, error } = await resolveFilters(subject, raw);
  if (error) return new Response(error, { status: 403 });

  const rows = await loadReportRows(subject, filters, EXPORT_LIMIT + 1);
  if (rows.length > EXPORT_LIMIT) {
    return new Response(`Plus de ${EXPORT_LIMIT} rapports : affinez les filtres avant d'exporter.`, { status: 413 });
  }
  const body = await buildReportsWorkbook(rows);
  await logAudit({
    actorId: subject.id,
    organizationId: subject.organizationId,
    action: "reports.export_xlsx",
    entityType: "Report",
    entityId: "export",
    metadata: { count: rows.length, filters },
  });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rapports-ippnk1-${day}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
