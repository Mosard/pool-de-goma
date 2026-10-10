import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { PENDING_RULES } from "@/lib/presence/settings";
import type { DaySummary } from "@/lib/presence/rules";
import type { PresenceRow } from "@/lib/presence/views";
import { formatDateKey } from "@/lib/presence/time";

// Affichage commun des présences : heures réelles, signalements validés,
// mentions explicites pour tout ce qui dépend d'une règle non décidée.

const STATUS_COLORS: Record<string, "gray" | "blue" | "green" | "orange" | "red"> = {
  ENTREE_SORTIE: "green",
  ENTREE_SEULE: "blue",
  SORTIE_SEULE: "blue",
  POINTAGES_MULTIPLES: "orange",
  SENS_INCONNU: "orange",
  AUCUN_POINTAGE: "gray",
  SANS_IDENTIFIANT: "gray",
  JOUR_NON_TRAVAILLE: "gray",
  A_VENIR: "gray",
  HORAIRE_NON_CONFIGURE: "red",
};

export function SimulatedBadge() {
  return <Badge color="orange">Simulation</Badge>;
}

export function StatusBadge({ s }: { s: DaySummary }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge color={STATUS_COLORS[s.status] ?? "gray"}>{s.label}</Badge>
      {s.simulated && <SimulatedBadge />}
    </span>
  );
}

function yesNo(v: boolean | null, label: string) {
  if (v === null) return <span className="text-xs text-amber-700">Non déterminé</span>;
  return v ? <span className="font-medium text-red-700">{label}</span> : <span className="text-gray-400">Non</span>;
}

export function LateCell({ s }: { s: DaySummary }) {
  if (!s.arrival) return <span className="text-gray-400">—</span>;
  if (s.late === true) {
    return (
      <span>
        <span className="font-medium text-red-700">Retard signalé</span>
        <span className="block text-xs text-amber-700">Durée non calculée — règle à configurer</span>
      </span>
    );
  }
  return yesNo(s.late, "Retard signalé");
}

export function OvertimeCell({ s }: { s: DaySummary }) {
  if (s.overtimeProposedMin !== null) {
    return (
      <span>
        {s.overtimeProposedMin} min <span className="block text-xs text-gray-500">proposées, non approuvées</span>
      </span>
    );
  }
  if (s.overtimePending) return <span className="text-xs text-amber-700">Proposé — durée non calculée</span>;
  return <span className="text-gray-400">—</span>;
}

export function EarlyCell({ s }: { s: DaySummary }) {
  if (!s.departure) return <span className="text-gray-400">—</span>;
  if (s.earlyDeparture) {
    return (
      <span>
        <span className="font-medium text-red-700">Départ anticipé</span>
        <span className="block text-xs text-gray-500">sous réserve d&apos;une autorisation</span>
      </span>
    );
  }
  return yesNo(s.earlyDeparture, "Départ anticipé");
}

const DIRECTION_LABELS = { IN: " (entrée)", OUT: " (sortie)", UNKNOWN: " (sens non transmis)" } as const;

export function Notes({ s }: { s: DaySummary }) {
  const shown = s.notes.filter((n) => !n.startsWith("Retard signalé") && !n.startsWith("Temps supplémentaire proposé :"));
  return (
    <div className="space-y-0.5 text-xs text-gray-600">
      {s.punches.length > 0 && <p>Pointages : {s.punches.map((p) => `${p.clock}${DIRECTION_LABELS[p.direction]}`).join(", ")}</p>}
      {shown.map((n) => (
        <p key={n} className={/règle à configurer|non confirmée|pas décidée/.test(n) ? "text-amber-700" : ""}>
          {n}
        </p>
      ))}
    </div>
  );
}

/** Tableau des présences : aucune coordonnée, aucune donnée familiale. */
export function PresenceTable({ rows, showDate, canOpenRecord }: { rows: PresenceRow[]; showDate: boolean; canOpenRecord: boolean }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
          <tr>
            {showDate && <th className="px-4 py-3">Date</th>}
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">État</th>
            <th className="px-4 py-3">Arrivée</th>
            <th className="px-4 py-3">Retard</th>
            <th className="px-4 py-3">Départ</th>
            <th className="px-4 py-3">Départ anticipé</th>
            <th className="px-4 py-3">Temps suppl.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 align-top">
          {rows.map((r) => (
            <tr key={`${r.userId}-${r.dateKey}`}>
              {showDate && <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateKey(r.dateKey)}</td>}
              <td className="px-4 py-3">
                <span className="font-medium text-gray-900">{r.name}</span>
                <span className="block text-xs text-gray-500">{[...r.cells.map((c) => `Cellule ${c}`), ...r.sites].join(" · ") || r.functions.join(", ")}</span>
                {canOpenRecord && (
                  <Link href={`/personnel/${r.userId}`} className="text-xs text-blue-700 underline">
                    Fiche
                  </Link>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge s={r.summary} />
                <div className="mt-1">
                  <Notes s={r.summary} />
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.summary.arrival ?? "—"}</td>
              <td className="px-4 py-3">
                <LateCell s={r.summary} />
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.summary.departure ?? "—"}</td>
              <td className="px-4 py-3">
                <EarlyCell s={r.summary} />
              </td>
              <td className="px-4 py-3">
                <OvertimeCell s={r.summary} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Rappel des règles non décidées qui bloquent certains calculs. */
export function PendingRulesNote() {
  const items = [PENDING_RULES.LATE_DURATION, PENDING_RULES.PAIRING, PENDING_RULES.SECONDS, PENDING_RULES.ABSENCE, PENDING_RULES.SYNC];
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <summary className="cursor-pointer font-medium">Règles en attente de décision (calculs bloqués, données brutes conservées)</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((r) => (
          <li key={r.code + r.message}>
            <span className="font-mono">{r.code}</span> — {r.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
