import { AlertTriangle, ChevronDown } from "lucide-react";
import { Badge, Card, TABLE_HEAD } from "@/components/ui";
import { RecordPanelButton } from "./record-panel";
import { PENDING_RULES } from "@/lib/presence/settings";
import type { DaySummary } from "@/lib/presence/rules";
import type { PresenceRow } from "@/lib/presence/views";
import { formatDateKey } from "@/lib/presence/time";

// Affichage commun des présences : heures réelles, signalements validés,
// mentions explicites pour tout ce qui dépend d'une règle non décidée.

// Point de couleur de l'état du jour (le texte porte le sens ; la couleur ne fait que l'appuyer).
const STATUS_DOT: Record<string, string> = {
  ENTREE_SORTIE: "bg-emerald-500",
  ENTREE_SEULE: "bg-blue-500",
  SORTIE_SEULE: "bg-blue-500",
  POINTAGES_MULTIPLES: "bg-amber-500",
  SENS_INCONNU: "bg-amber-500",
  AUCUN_POINTAGE: "bg-gray-300",
  SANS_IDENTIFIANT: "bg-gray-300",
  JOUR_NON_TRAVAILLE: "bg-gray-300",
  A_VENIR: "bg-gray-300",
  HORAIRE_NON_CONFIGURE: "bg-red-500",
};

/**
 * Règles non décidées : le texte complet est long et identique sur toutes les
 * lignes. Dans le tableau, une étiquette courte (texte complet au survol) ;
 * l'explication figure une seule fois dans « Règles en attente de décision ».
 */
const RULE_SHORT: { rule: { code: string; message: string }; label: string }[] = [
  { rule: PENDING_RULES.SYNC, label: "synchronisation" },
  { rule: PENDING_RULES.ABSENCE, label: "absence" },
  { rule: PENDING_RULES.LATE_DURATION, label: "durée du retard" },
  { rule: PENDING_RULES.SECONDS, label: "secondes" },
  { rule: PENDING_RULES.PAIRING, label: "pointages multiples" },
  { rule: PENDING_RULES.UNKNOWN_DIRECTION, label: "sens du pointage" },
  { rule: PENDING_RULES.NON_WORKED_PUNCH, label: "jour non travaillé" },
];
const ruleOf = (note: string) => RULE_SHORT.find((r) => r.rule.message === note);

export function SimulatedBadge() {
  return <Badge color="orange">Simulation</Badge>;
}

export function StatusBadge({ s }: { s: DaySummary }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-baseline gap-2 text-sm font-medium text-gray-900">
        <span className={`relative top-[-1px] h-2 w-2 shrink-0 self-center rounded-full ${STATUS_DOT[s.status] ?? "bg-gray-300"}`} aria-hidden />
        {s.label}
      </span>
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
      <span className="whitespace-nowrap">
        <span className="font-medium text-red-700">Retard signalé</span>
        <span className="block text-xs text-gray-500" title={PENDING_RULES.LATE_DURATION.message}>
          durée non calculée
        </span>
      </span>
    );
  }
  return yesNo(s.late, "Retard signalé");
}

export function OvertimeCell({ s }: { s: DaySummary }) {
  if (s.overtimeProposedMin !== null) {
    return (
      <span className="whitespace-nowrap">
        <span className="font-medium tabular-nums text-gray-900">{s.overtimeProposedMin} min</span>
        <span className="block text-xs text-gray-500">proposées, non approuvées</span>
      </span>
    );
  }
  if (s.overtimePending) return <span className="whitespace-nowrap text-xs text-gray-500">proposé, durée non calculée</span>;
  return <span className="text-gray-400">—</span>;
}

export function EarlyCell({ s }: { s: DaySummary }) {
  if (!s.departure) return <span className="text-gray-400">—</span>;
  if (s.earlyDeparture) {
    return (
      <span className="whitespace-nowrap">
        <span className="font-medium text-red-700">Départ anticipé</span>
        <span className="block text-xs text-gray-500">sous réserve d&apos;autorisation</span>
      </span>
    );
  }
  return yesNo(s.earlyDeparture, "Départ anticipé");
}

const DIRECTION_LABELS = { IN: "entrée", OUT: "sortie", UNKNOWN: "sens non transmis" } as const;

/**
 * Détail du jour sous l'état : pointages, faits constatés (phrases courtes),
 * puis étiquettes des règles en attente. Les mentions déjà portées par une
 * colonne (retard, départ anticipé, temps supplémentaire) ne sont pas répétées.
 */
export function Notes({ s }: { s: DaySummary }) {
  const repeated = (n: string) =>
    n.startsWith("Retard signalé") || n.startsWith("Temps supplémentaire proposé") || n.startsWith("Départ anticipé") || n === PENDING_RULES.LATE_DURATION.message;
  const rest = s.notes.filter((n) => !repeated(n));
  const facts = rest.filter((n) => !ruleOf(n));
  const rules = [...new Map(rest.flatMap((n) => (ruleOf(n) ? [ruleOf(n)!] : [])).map((r) => [r.label, r])).values()];
  if (s.punches.length === 0 && facts.length === 0 && rules.length === 0) return null;
  return (
    <div className="space-y-1.5 text-xs text-gray-600">
      {s.punches.length > 0 && (
        <p className="tabular-nums">
          {s.punches.map((p, i) => (
            <span key={`${p.clock}-${i}`} className="whitespace-nowrap">
              {i > 0 && ", "}
              <span className="font-medium text-gray-800">{p.clock}</span> {DIRECTION_LABELS[p.direction]}
            </span>
          ))}
        </p>
      )}
      {facts.map((n) => (
        <p key={n} className="text-pretty">
          {n}
        </p>
      ))}
      {rules.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Règles en attente de décision">
          {rules.map((r) => (
            <li
              key={r.label}
              title={r.rule.message}
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
            >
              <span className="sr-only">Règle en attente : </span>
              {r.label}
              <span className="font-mono font-normal text-amber-600">{r.rule.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Heure de pointage : chiffres tabulaires, alignés d'une ligne à l'autre. */
function Clock({ value }: { value: string | null }) {
  return value ? <span className="font-medium tabular-nums text-gray-900">{value}</span> : <span className="text-gray-400">—</span>;
}

function agentContext(r: PresenceRow) {
  return [...r.cells.map((c) => `Cellule ${c}`), ...r.sites].join(" · ") || r.functions.join(", ");
}

/**
 * Présences : tableau sur ordinateur, liste de fiches sur téléphone (huit
 * colonnes ne tiennent pas sur un petit écran). Aucune coordonnée, aucune
 * donnée familiale.
 */
export function PresenceTable({ rows, showDate, canOpenRecord }: { rows: PresenceRow[]; showDate: boolean; canOpenRecord: boolean }) {
  const th = "px-4 py-3 whitespace-nowrap";
  return (
    <>
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              {showDate && <th className={th}>Date</th>}
              <th className={th}>Agent</th>
              <th className={th}>État</th>
              <th className={th}>Arrivée</th>
              <th className={th}>Retard</th>
              <th className={th}>Départ</th>
              <th className={th}>Départ anticipé</th>
              <th className={th}>Temps suppl.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {rows.map((r) => (
              <tr key={`${r.userId}-${r.dateKey}`} className="transition-colors hover:bg-gray-50/70">
                {showDate && <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600">{formatDateKey(r.dateKey)}</td>}
                <td className="min-w-44 px-4 py-3">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="block text-xs text-gray-500">{agentContext(r)}</span>
                  {canOpenRecord && <RecordPanelButton userId={r.userId} name={r.name} />}
                </td>
                <td className="w-[22rem] min-w-64 px-4 py-3">
                  <StatusBadge s={r.summary} />
                  <div className="mt-1.5 empty:hidden">
                    <Notes s={r.summary} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Clock value={r.summary.arrival} />
                </td>
                <td className="px-4 py-3">
                  <LateCell s={r.summary} />
                </td>
                <td className="px-4 py-3">
                  <Clock value={r.summary.departure} />
                </td>
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

      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={`${r.userId}-${r.dateKey}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {showDate && <p className="text-xs font-medium tabular-nums text-gray-500">{formatDateKey(r.dateKey)}</p>}
                <p className="font-medium text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-500">{agentContext(r)}</p>
              </div>
              <StatusBadge s={r.summary} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Arrivée</dt>
                <dd>
                  <Clock value={r.summary.arrival} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Départ</dt>
                <dd>
                  <Clock value={r.summary.departure} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Retard</dt>
                <dd>
                  <LateCell s={r.summary} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Départ anticipé</dt>
                <dd>
                  <EarlyCell s={r.summary} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-gray-500">Temps supplémentaire</dt>
                <dd>
                  <OvertimeCell s={r.summary} />
                </dd>
              </div>
            </dl>
            <div className="mt-3 empty:hidden">
              <Notes s={r.summary} />
            </div>
            {canOpenRecord && <RecordPanelButton userId={r.userId} name={r.name} />}
          </li>
        ))}
      </ul>
    </>
  );
}

export type Stat = { label: string; value: number; hint?: string; tone?: "neutral" | "attention" };

/**
 * Chiffres du jour en un seul bandeau (et non huit cartes) : les signalements
 * ne prennent de la couleur que s'ils sont non nuls.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <dl className={`grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4 ${stats.length > 4 ? "xl:grid-cols-8" : ""}`}>
        {stats.map((s) => {
          const flagged = s.tone === "attention" && s.value > 0;
          return (
            <div key={s.label} className="bg-white px-4 py-3.5">
              <dt className="text-xs font-medium text-gray-500">{s.label}</dt>
              <dd className={`mt-1 text-2xl font-semibold tabular-nums ${flagged ? "text-amber-700" : "text-gray-900"}`}>{s.value}</dd>
              {s.hint && <dd className="text-[11px] leading-tight text-gray-500">{s.hint}</dd>}
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

/** Rappel des règles non décidées qui bloquent certains calculs. */
export function PendingRulesNote() {
  const items = RULE_SHORT.map((r) => r.rule);
  return (
    <details className="group rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 [&::-webkit-details-marker]:hidden">
        <AlertTriangle size={16} aria-hidden className="shrink-0 text-amber-600" />
        <span className="flex-1">
          Règles en attente de décision (étiquettes ambre du tableau) : certains calculs sont bloqués, les données brutes sont conservées
        </span>
        <ChevronDown size={16} aria-hidden className="shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ul className="space-y-1.5 border-t border-amber-200 px-4 py-3">
        {items.map((r) => (
          <li key={r.code + r.message} className="flex gap-2">
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px]">{r.code}</span>
            <span className="text-pretty">{r.message}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
