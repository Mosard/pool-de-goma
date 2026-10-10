import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { canReadPersonnelRecords } from "@/lib/personnel/record";
import { countDay, loadChangeCursor, loadFilterOptions, loadPresenceRows, loadPresenceViewer } from "@/lib/presence/views";
import { formatDateKey, gomaDateKey, isDateKey } from "@/lib/presence/time";
import { PendingRulesNote, PresenceTable } from "../presence-ui";
import { PresenceFiltersForm } from "../filters";
import { PresenceRefresher } from "../refresher";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </Card>
  );
}

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
    <div className="space-y-4">
      <PageHeader title={`Présences — ${formatDateKey(date)}`} description={`${scopeLabel}. Heures réelles à l'heure de Goma.`} />
      <PresenceRefresher initialCursor={cursor} />
      <PresenceFiltersForm options={options} values={{ date, cellId: sp.cellId, poolId: sp.poolId, site: sp.site }} mode="day" />

      {deviceCount === 0 && (
        <Card className="border-gray-200 bg-gray-50 text-sm text-gray-700">
          Aucune pointeuse n&apos;est enregistrée : aucune donnée de pointage ne peut encore arriver.{" "}
          <Link href="/presence/synchronisation" className="underline">
            État de synchronisation
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Personnes" value={c.total} />
        <Stat label="Avec pointage" value={c.withPunches} />
        <Stat label="Retards signalés" value={c.late} hint="durée non calculée" />
        <Stat label="Départs anticipés" value={c.early} />
        <Stat label="Temps suppl. proposé" value={c.overtime} hint="non approuvé" />
        <Stat label="Aucun pointage reçu" value={c.noPunch} hint="ne vaut pas absence" />
        <Stat label="Sans identifiant" value={c.unmapped} />
        <Stat label="Données simulées" value={c.simulated} />
      </div>

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
