// Période d'analyse saisie en jours (AAAA-MM-JJ, heure de Goma = UTC+2).
// Bornes internes : début inclus, fin EXCLUE (lendemain du dernier jour).

const GOMA_OFFSET_MS = 2 * 3600_000;
const DAY_MS = 24 * 3600_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type AiPeriod = { from: Date; to: Date; du: string; au: string };

function gomaToday(): string {
  return new Date(Date.now() + GOMA_OFFSET_MS).toISOString().slice(0, 10);
}

function startOf(day: string): Date | null {
  const m = ISO_DAY.exec(day);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - GOMA_OFFSET_MS);
  return Number.isNaN(d.getTime()) || new Date(d.getTime() + GOMA_OFFSET_MS).toISOString().slice(0, 10) !== day ? null : d;
}

/** Par défaut : les six derniers mois, jusqu'à aujourd'hui inclus. */
export function defaultAiPeriod(): { du: string; au: string } {
  const au = gomaToday();
  const [y, m] = au.split("-").map(Number);
  const du = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);
  return { du, au };
}

/** null si une date est invalide, si la fin précède le début ou dépasse deux ans. */
export function parseAiPeriod(du: string | null | undefined, au: string | null | undefined): AiPeriod | null {
  const fallback = defaultAiPeriod();
  const d1 = du || fallback.du;
  const d2 = au || fallback.au;
  const from = startOf(d1);
  const last = startOf(d2);
  if (!from || !last || last < from) return null;
  const to = new Date(last.getTime() + DAY_MS);
  if (to.getTime() - from.getTime() > 731 * DAY_MS) return null;
  return { from, to, du: d1, au: d2 };
}

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lubumbashi" });

export function formatAiDay(d: Date): string {
  return DAY_LABEL.format(d);
}

export function formatAiRange(from: Date, to: Date): string {
  return `du ${formatAiDay(from)} au ${formatAiDay(new Date(to.getTime() - 1))}`;
}
