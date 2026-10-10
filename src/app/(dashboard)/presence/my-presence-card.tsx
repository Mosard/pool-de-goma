import Link from "next/link";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { loadOwnRows, loadPresenceViewer } from "@/lib/presence/views";
import { gomaDateKey } from "@/lib/presence/time";
import { StatusBadge } from "./presence-ui";

/** Carte « Ma présence » du tableau de bord : sa journée, rien d'autre. */
export async function MyPresenceCard({ userId }: { userId: string }) {
  const viewer = await loadPresenceViewer(userId);
  if (!viewer) return null;
  const today = gomaDateKey(new Date());
  const [rows, mappings] = await Promise.all([loadOwnRows(viewer, today, today), prisma.deviceUserMapping.count({ where: { userId } })]);
  const s = rows[0]?.summary;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <p className="font-semibold text-gray-900">Ma présence aujourd&apos;hui</p>
        {mappings === 0 || !s ? (
          <p className="text-gray-600">Aucun identifiant de pointage associé à votre compte.</p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-gray-700">
            <StatusBadge s={s} />
            {s.arrival && <span>Arrivée {s.arrival}</span>}
            {s.departure && <span>· Départ {s.departure}</span>}
          </div>
        )}
      </div>
      <Link href="/presence/moi" className="text-sm font-medium text-blue-700 underline">
        Voir ma présence
      </Link>
    </Card>
  );
}
