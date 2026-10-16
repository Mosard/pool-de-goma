import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmptyState, Field, Input, Notice, PageHeader } from "@/components/ui";
import { countDay, loadOwnRows, loadPresenceViewer, normalizePeriod } from "@/lib/presence/views";
import { addDays, gomaDateKey } from "@/lib/presence/time";
import { prisma } from "@/lib/prisma";
import { PendingRulesNote, PresenceTable, StatStrip } from "../presence-ui";
import { FilterBar } from "../filters";

// « Ma présence » : chaque compte consulte SA présence (aucune permission
// requise, jamais celle d'un autre), quels que soient ses autres droits.
export default async function MyPresencePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) redirect("/login");
  const sp = await searchParams;
  const today = gomaDateKey(new Date());
  const period = normalizePeriod(sp.from ?? addDays(today, -13), sp.to ?? today, today);
  const [rows, mappingCount] = await Promise.all([
    loadOwnRows(viewer, period.from, period.to),
    prisma.deviceUserMapping.count({ where: { userId: viewer.id } }),
  ]);
  const c = countDay(rows);

  return (
    <div className="space-y-5">
      <PageHeader title="Ma présence" description="Vos heures réelles de pointage, à l'heure de Goma. Le temps supplémentaire affiché est seulement proposé." />
      <FilterBar resetHref="/presence/moi" active={Boolean(sp.from || sp.to)}>
        <Field label="Du">
          <Input type="date" name="from" defaultValue={period.from} />
        </Field>
        <Field label="Au">
          <Input type="date" name="to" defaultValue={period.to} />
        </Field>
      </FilterBar>
      {mappingCount === 0 ? (
        <Notice tone="neutral" title="Aucun identifiant de pointage associé à votre compte">
          <p>Vos présences apparaîtront après votre enrôlement sur une pointeuse et l&apos;association de votre identifiant par une personne habilitée.</p>
        </Notice>
      ) : (
        rows.length > 0 && (
          <StatStrip
            stats={[
              { label: "Journées affichées", value: c.total },
              { label: "Avec pointage", value: c.withPunches },
              { label: "Retards signalés", value: c.late, hint: "durée non calculée", tone: "attention" },
              { label: "Départs anticipés", value: c.early, tone: "attention" },
            ]}
          />
        )
      )}
      {rows.length === 0 ? <EmptyState message="Aucune journée à afficher sur cette période." /> : <PresenceTable rows={[...rows].reverse()} showDate canOpenRecord={false} />}
      <PendingRulesNote />
    </div>
  );
}
