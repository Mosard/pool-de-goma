// Indicateurs des tableaux de bord : regroupement des statuts EXISTANTS du
// circuit des rapports (WORKFLOW_STATUS_KEYS, src/lib/workflow.ts) par
// étape utile à chaque fonction. Fonctions pures, testées dans
// dashboard.test.ts.

import { WORKFLOW_STATUS_KEYS as S } from "@/lib/rbac-data";

export type Bucket = { key: string; label: string; statuses: readonly string[]; hint?: string };

/** Exploitant de POOL et chef de POOL : étapes qui relèvent du POOL. */
export const POOL_EXPLOITATION_BUCKETS: readonly Bucket[] = [
  { key: "a_traiter", label: "À traiter", statuses: [S.SOUMIS, S.RECU], hint: "Soumis ou reçus, exploitation non démarrée" },
  { key: "en_cours", label: "En cours d'exploitation", statuses: [S.EN_EXPLOITATION] },
  { key: "corrections", label: "Corrections attendues", statuses: [S.A_CORRIGER], hint: "Renvoyés à l'inspecteur" },
  {
    key: "exploites",
    label: "Exploités",
    statuses: [S.TRANSMIS, S.EN_ATTENTE_VALIDATION, S.VALIDE, S.REJETE, S.CLOTURE],
    hint: "Transmis au bureau IPP et au-delà",
  },
];

/**
 * Exploitant IPP (décision Q8 : il agit dès la soumission, sur tous les
 * POOL) : volumes reçus et étapes de traitement. La validation reste à l'IPP.
 */
export const PROVINCIAL_EXPLOITATION_BUCKETS: readonly Bucket[] = [
  { key: "a_traiter", label: "À traiter", statuses: [S.SOUMIS, S.RECU], hint: "Soumis ou reçus, pas encore exploités" },
  { key: "en_cours", label: "En cours d'exploitation", statuses: [S.EN_EXPLOITATION] },
  { key: "transmis", label: "Transmis, à finaliser", statuses: [S.TRANSMIS], hint: "Exploitation du bureau IPP à finaliser" },
  { key: "corrections", label: "Corrections attendues", statuses: [S.A_CORRIGER] },
  { key: "attente_validation", label: "En attente de validation IPP", statuses: [S.EN_ATTENTE_VALIDATION] },
  { key: "clos", label: "Validés, rejetés ou clôturés", statuses: [S.VALIDE, S.REJETE, S.CLOTURE] },
];

/** IPP : pilotage. */
export const PILOTAGE_BUCKETS: readonly Bucket[] = [
  {
    key: "en_circuit",
    label: "Rapports dans le circuit",
    statuses: [S.SOUMIS, S.RECU, S.EN_EXPLOITATION, S.TRANSMIS],
    hint: "Soumis, reçus, en exploitation ou transmis",
  },
  { key: "a_valider", label: "À valider", statuses: [S.EN_ATTENTE_VALIDATION] },
  { key: "corrections", label: "En correction chez l'inspecteur", statuses: [S.A_CORRIGER] },
  { key: "valides", label: "Validés ou clôturés", statuses: [S.VALIDE, S.CLOTURE] },
  { key: "rejetes", label: "Rejetés", statuses: [S.REJETE] },
];

/** Rapports soumis au moins une fois (hors brouillons). */
export function isReceived(statusKey: string): boolean {
  return statusKey !== S.BROUILLON;
}

export function countByBucket(statusKeys: readonly string[], buckets: readonly Bucket[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(buckets.map((b) => [b.key, 0]));
  for (const k of statusKeys) {
    const bucket = buckets.find((b) => b.statuses.includes(k));
    if (bucket) counts[bucket.key]++;
  }
  return counts;
}

/** Les `count` derniers mois (le mois courant compris), clé « AAAA-MM ». */
export function lastMonths(now: Date, count = 6): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** Nombre de dates par mois, sur les mois demandés (les autres sont ignorées). */
export function monthlyCounts(dates: readonly (Date | null)[], months: readonly string[]): { month: string; count: number }[] {
  const counts = new Map(months.map((m) => [m, 0]));
  for (const d of dates) {
    if (!d) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return months.map((month) => ({ month, count: counts.get(month)! }));
}

const MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}
