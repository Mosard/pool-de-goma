import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { loadOwnRows, loadPresenceViewer, normalizePeriod } from "@/lib/presence/views";
import { addDays, gomaDateKey } from "@/lib/presence/time";
import { prisma } from "@/lib/prisma";
import { PendingRulesNote, PresenceTable } from "../presence-ui";

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

  return (
    <div className="space-y-4">
      <PageHeader title="Ma présence" description="Vos heures réelles de pointage, à l'heure de Goma. Le temps supplémentaire affiché est seulement proposé." />
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-700">
          Du
          <Input type="date" name="from" defaultValue={period.from} className="mt-1" />
        </label>
        <label className="text-sm text-gray-700">
          Au
          <Input type="date" name="to" defaultValue={period.to} className="mt-1" />
        </label>
        <Button type="submit" variant="ghost">Afficher</Button>
      </form>
      {mappingCount === 0 && (
        <Card className="border-gray-200 bg-gray-50 text-sm text-gray-700">
          Aucun identifiant de pointage n&apos;est associé à votre compte pour l&apos;instant. Vos présences apparaîtront après votre enrôlement sur une pointeuse et
          l&apos;association de votre identifiant par une personne habilitée.
        </Card>
      )}
      {rows.length === 0 ? <EmptyState message="Aucune journée à afficher sur cette période." /> : <PresenceTable rows={[...rows].reverse()} showDate canOpenRecord={false} />}
      <PendingRulesNote />
    </div>
  );
}
