// Temps de la présence du personnel : instants stockés en UTC, règles métier
// appliquées dans le fuseau de Goma (Africa/Lubumbashi, UTC+2, sans heure
// d'été), indépendamment du navigateur et du serveur. Fonctions PURES.

export const GOMA_TIME_ZONE = "Africa/Lubumbashi";
/** Décalage fixe de Goma (vérifié par les tests contre la base IANA). */
export const GOMA_OFFSET_MINUTES = 120;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Date civile de Goma « AAAA-MM-JJ » d'un instant. */
export function gomaDateKey(at: Date): string {
  const d = new Date(at.getTime() + GOMA_OFFSET_MINUTES * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Heure de Goma d'un instant, en secondes depuis minuit. */
export function gomaSecondsOfDay(at: Date): number {
  const d = new Date(at.getTime() + GOMA_OFFSET_MINUTES * 60_000);
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

/** Jour de la semaine d'une date civile : 1 = lundi … 7 = dimanche. */
export function gomaIsoWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** « HH:MM:SS » (heure de Goma) d'un instant. */
export function gomaClock(at: Date): string {
  return secondsToClock(gomaSecondsOfDay(at));
}

export function secondsToClock(s: number): string {
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** « HH:MM » ou « HH:MM:SS » → secondes depuis minuit ; null si invalide. */
export function parseClock(value: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value ?? "");
  if (!m) return null;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const [y, m, d] = (value as string).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Heure locale transmise par un appareil (« AAAA-MM-JJTHH:MM:SS », heure de
 * Goma, sans fuseau) → instant UTC. null si la valeur est invalide.
 */
export function gomaLocalToUtc(local: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(local.trim());
  if (!m || !isDateKey(m[1])) return null;
  const secs = parseClock(m[2]);
  if (secs === null) return null;
  const [y, mo, d] = m[1].split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d) + secs * 1000 - GOMA_OFFSET_MINUTES * 60_000);
}

/** Minuit de Goma (instant UTC) d'une date civile. */
export function gomaDayStartUtc(dateKey: string): Date {
  return gomaLocalToUtc(`${dateKey}T00:00:00`) as Date;
}

/** Date civile décalée de `delta` jours. */
export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Dates civiles de `from` à `to` inclus (vide si `to` < `from`). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Date civile → objet Date à minuit UTC (colonnes `@db.Date`). */
export function dateKeyToDbDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dbDateToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Libellé long d'une date civile, en français, sans décalage. */
export function formatDateKey(dateKey: string): string {
  return dateKeyToDbDate(dateKey).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Instant affiché à l'heure de Goma, quel que soit le fuseau du navigateur ou du serveur. */
export function formatGomaDateTime(at: Date): string {
  return at.toLocaleString("fr-FR", { timeZone: GOMA_TIME_ZONE, dateStyle: "short", timeStyle: "medium" });
}
