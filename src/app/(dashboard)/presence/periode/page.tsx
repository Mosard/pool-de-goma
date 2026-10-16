import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { canReadPersonnelRecords } from "@/lib/personnel/record";
import { MAX_PERIOD_DAYS, loadChangeCursor, loadFilterOptions, loadPresenceRows, loadPresenceViewer, normalizePeriod } from "@/lib/presence/views";
import { addDays, gomaDateKey } from "@/lib/presence/time";
import { PendingRulesNote, PresenceTable } from "../presence-ui";
import { PresenceFiltersForm } from "../filters";
import { PresenceRefresher } from "../refresher";

// Présences sur une période (31 jours au plus), dans le périmètre du lecteur.
// Le filtre « Agent » ne propose que les personnes déjà visibles ; une valeur
// forcée dans l'adresse hors périmètre ne renvoie rien.
export default async function PeriodPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; cellId?: string; poolId?: string; site?: string; userId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) redirect("/login");
  if (viewer.scope.kind === "self") redirect("/presence/moi");
  const sp = await searchParams;
  const today = gomaDateKey(new Date());
  const period = normalizePeriod(sp.from ?? addDays(today, -6), sp.to ?? today, today);
  const base = { ...period, cellId: sp.cellId || undefined, poolId: sp.poolId || undefined, site: sp.site || undefined };
  const [all, options, cursor] = await Promise.all([loadPresenceRows(viewer, base), loadFilterOptions(viewer), loadChangeCursor(viewer.organizationId)]);
  const agents = [...new Map(all.map((r) => [r.userId, { id: r.userId, name: r.name }])).values()];
  const rows = sp.userId ? all.filter((r) => r.userId === sp.userId) : all;
  const sorted = [...rows].sort((a, b) => (a.dateKey === b.dateKey ? a.name.localeCompare(b.name) : b.dateKey.localeCompare(a.dateKey)));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Présences sur une période"
        description={`${viewer.scope.kind === "all" ? "Vue globale" : "Vue de votre cellule"} — ${MAX_PERIOD_DAYS} jours au plus. Heures réelles à l'heure de Goma.`}
        actions={<PresenceRefresher initialCursor={cursor} />}
      />
      <PresenceFiltersForm options={options} values={{ ...period, cellId: sp.cellId, poolId: sp.poolId, site: sp.site, userId: sp.userId }} mode="period" agents={agents} />
      {sorted.length === 0 ? (
        <EmptyState message="Aucune journée à afficher pour ces filtres." />
      ) : (
        <PresenceTable rows={sorted} showDate canOpenRecord={canReadPersonnelRecords(viewer.permissions, viewer.organizationId)} />
      )}
      <PendingRulesNote />
    </div>
  );
}
