import { isYesNoField, type AiReport } from "@/lib/ai/reports";

// Étage 1 (sans IA) : comptages, pourcentages et tendances calculés sur les
// champs structurés des fiches. Chaque valeur porte son effectif (n) : une
// moyenne ou un pourcentage ne s'affiche jamais sans son dénominateur.

export type AiIndicator = {
  key: string;
  label: string;
  /** "number" : moyenne des valeurs ; "yes" : part des réponses « Oui ». */
  kind: "number" | "yes";
};

export type AiStatPoint = {
  label: string;
  rapports: number;
  /** Valeur de l'indicateur choisi (null si aucune réponse). */
  valeur: number | null;
  /** Nombre de rapports ayant renseigné l'indicateur. */
  n: number;
};

export type AiStats = {
  totals: { rapports: number; sites: number; pools: number };
  indicators: AiIndicator[];
  indicator: AiIndicator | null;
  trend: AiStatPoint[];
  byPool: AiStatPoint[];
  bySchool: (AiStatPoint & { pool: string })[];
};

// Goma : UTC+2 toute l'année (pas d'heure d'été).
const GOMA_OFFSET_MS = 2 * 3600_000;
const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" });

function gomaMonth(d: Date): { key: string; label: string } {
  const g = new Date(d.getTime() + GOMA_OFFSET_MS);
  const first = new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), 1));
  return { key: `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`, label: MONTH.format(first) };
}

function listIndicators(reports: AiReport[]): AiIndicator[] {
  const found = new Map<string, AiIndicator>();
  for (const r of reports) {
    for (const f of r.fields) {
      if (found.has(f.key)) continue;
      if (f.type === "number") found.set(f.key, { key: f.key, label: f.label, kind: "number" });
      else if (isYesNoField(f)) found.set(f.key, { key: f.key, label: `${f.label} (% « Oui »)`, kind: "yes" });
    }
  }
  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

type Acc = { label: string; rapports: number; sum: number; n: number; extra?: string };

function measure(r: AiReport, indicator: AiIndicator | null): number | null {
  if (!indicator) return null;
  const f = r.fields.find((x) => x.key === indicator.key);
  if (!f || f.value === null) return null;
  if (indicator.kind === "number") return typeof f.value === "number" ? f.value : null;
  return String(f.value).toLowerCase() === "oui" ? 100 : 0;
}

function add(map: Map<string, Acc>, key: string, label: string, v: number | null, extra?: string) {
  const acc = map.get(key) ?? { label, rapports: 0, sum: 0, n: 0, extra };
  acc.rapports += 1;
  if (v !== null) {
    acc.sum += v;
    acc.n += 1;
  }
  map.set(key, acc);
}

function toPoint(a: Acc): AiStatPoint {
  return { label: a.label, rapports: a.rapports, n: a.n, valeur: a.n ? Math.round((a.sum / a.n) * 10) / 10 : null };
}

export function computeAiStats(reports: AiReport[], indicatorKey: string | null, range: { from: Date; to: Date }): AiStats {
  const indicators = listIndicators(reports);
  const indicator = indicators.find((i) => i.key === indicatorKey) ?? indicators[0] ?? null;

  // Tous les mois de la période, même sans rapport : une absence se voit.
  const months = new Map<string, Acc>();
  const last = gomaMonth(new Date(range.to.getTime() - 1)).key;
  for (let m = gomaMonth(range.from); ; ) {
    months.set(m.key, { label: m.label, rapports: 0, sum: 0, n: 0 });
    if (m.key >= last) break;
    const [y, mo] = m.key.split("-").map(Number);
    m = gomaMonth(new Date(Date.UTC(y, mo, 1) - GOMA_OFFSET_MS + 3600_000));
  }
  const pools = new Map<string, Acc>();
  const schools = new Map<string, Acc>();

  for (const r of reports) {
    const v = measure(r, indicator);
    const m = gomaMonth(r.date);
    add(months, m.key, m.label, v);
    add(pools, r.pool.id, r.pool.name, v);
    add(schools, r.school.id, r.school.name, v, r.pool.name);
  }

  return {
    totals: { rapports: reports.length, sites: schools.size, pools: pools.size },
    indicators,
    indicator,
    trend: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, a]) => toPoint(a)),
    byPool: [...pools.values()].sort((a, b) => a.label.localeCompare(b.label, "fr")).map(toPoint),
    bySchool: [...schools.values()]
      .sort((a, b) => b.rapports - a.rapports || a.label.localeCompare(b.label, "fr"))
      .slice(0, 15)
      .map((a) => ({ ...toPoint(a), pool: a.extra ?? "" })),
  };
}
