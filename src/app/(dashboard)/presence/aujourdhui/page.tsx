import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { canReadPersonnelRecords } from "@/lib/personnel/record";
import { countDay, loadChangeCursor, loadFilterOptions, loadPresenceRows, loadPresenceViewer } from "@/lib/presence/views";
import { formatDateKey, gomaDateKey, isDateKey } from "@/lib/presence/time";
import { PendingRulesNote, PresenceTable, StatStrip } from "../presence-ui";
import { PresenceFiltersForm } from "../filters";
import { PresenceRefresher } from "../refresher";

// Synthèse du jour : vue globale (presence.read_all) ou de cellule
// (presence.read_cell), périmètre et filtres contrôlés côté serveur.
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string; cellId?: string; poolId?: string; site?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) redirect("/login");
  if (viewer.scope.kind === "self") redirect("/presence/moi");
  const sp = await searchParams;
  const date = isDateKey(sp.date) ? sp.date : gomaDateKey(new Date());
  const filters = { from: date, to: date, cellId: sp.cellId || undefined, poolId: sp.poolId || undefined, site: sp.site || undefined };
  const [rows, options, cursor, deviceCount] = await Promise.all([
    loadPresenceRows(viewer, filters),
    loadFilterOptions(viewer),
    loadChangeCursor(viewer.organizationId),
    prisma.attendanceDevice.count({ where: { organizationId: viewer.organizationId, status: { not: "DESACTIVE" } } }),
  ]);
  const c = countDay(rows);
  const scopeLabel = viewer.scope.kind === "all" ? "Vue globale : tous les POOL, bureaux et cellules" : "Vue de votre cellule";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Présences — ${formatDateKey(date)}`}
        description={`${scopeLabel}. Heures réelles à l'heure de Goma.`}
        actions={<PresenceRefresher initialCursor={cursor} />}
      />
      <PresenceFiltersForm options={options} values={{ date, cellId: sp.cellId, poolId: sp.poolId, site: sp.site }} mode="day" />

      {deviceCount === 0 && (
        <Notice tone="neutral" title="Aucune pointeuse enregistrée">
          <p>
            Aucune donnée de pointage ne peut encore arriver.{" "}
            <Link href="/presence/synchronisation" className="font-medium underline underline-offset-2">
              Voir l&apos;état de synchronisation
            </Link>
          </p>
        </Notice>
      )}

      <StatStrip
        stats={[
          { label: "Personnes", value: c.total },
          { label: "Avec pointage", value: c.withPunches },
          { label: "Retards signalés", value: c.late, hint: "durée non calculée", tone: "attention" },
          { label: "Départs anticipés", value: c.early, tone: "attention" },
          { label: "Temps suppl. proposé", value: c.overtime, hint: "non approuvé" },
          { label: "Aucun pointage reçu", value: c.noPunch, hint: "ne vaut pas absence" },
          { label: "Sans identifiant", value: c.unmapped, tone: "attention" },
          { label: "Données simulées", value: c.simulated, tone: "attention" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          message={
            viewer.scope.kind === "all"
              ? "Aucune personne associée à un identifiant de pointage pour cette journée et ces filtres."
              : "Aucune personne de votre cellule pour cette journée et ces filtres."
          }
        />
      ) : (
        <PresenceTable rows={rows} showDate={false} canOpenRecord={canReadPersonnelRecords(viewer.permissions, viewer.organizationId)} />
      )}
      <PendingRulesNote />
    </div>
  );
}
