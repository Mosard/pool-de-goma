// Paramètres de la présence du personnel. Les seuils VALIDÉS (horaire du lundi
// au vendredi, 8 h – 15 h, retard après 8 h 15, départ normal jusqu'à 15 h 15,
// temps supplémentaire compté depuis 15 h 15) sont posés par la migration et
// modifiables par presence.schedule.manage (IPP principal, IPA chargé du
// personnel). Les règles NON TRANCHÉES restent explicitement non définies :
// aucune valeur provisoire, seul le calcul qui en dépend est bloqué.

import { parseClock } from "@/lib/presence/time";

/** Seuils validés (heure de Goma) et jours travaillés (1 = lundi … 7 = dimanche). */
export type ValidatedSchedule = {
  workdays: number[];
  /** Début de journée (8 h) : affiché ; base éventuelle de la durée de retard (Q-CALC-1). */
  start: string;
  /** Arrivée jusqu'à cette heure INCLUSE : aucun retard (8 h 15). */
  lateAfter: string;
  /** Départ avant cette heure : départ anticipé (15 h). */
  end: string;
  /** Départ jusqu'à cette heure INCLUSE : départ normal (15 h 15). */
  normalDepartureUntil: string;
  /** Temps supplémentaire proposé, compté depuis cette heure (15 h 15). */
  overtimeFrom: string;
};

export const VALIDATED_SCHEDULE_DEFAULTS: ValidatedSchedule = {
  workdays: [1, 2, 3, 4, 5],
  start: "08:00",
  lateAfter: "08:15",
  end: "15:00",
  normalDepartureUntil: "15:15",
  overtimeFrom: "15:15",
};

/** Clé de paramètre en base (AttendanceSetting.key) pour l'horaire validé. */
export const SCHEDULE_SETTING_KEY = "schedule";

/** Décisions en attente : chaque calcul concerné reste bloqué avec ce message. */
export const PENDING_RULES = {
  LATE_DURATION: {
    code: "Q-CALC-1",
    message: "Durée du retard non calculée — règle à configurer (depuis 8 h ou depuis 8 h 15, et arrondi).",
  },
  SECONDS: {
    code: "Q-PREC-1",
    message: "Heure à la seconde dans la minute du seuil — règle à configurer (secondes prises en compte ou ignorées).",
  },
  PAIRING: {
    code: "Q-PUNCH-1",
    message: "Plusieurs entrées ou sorties le même jour — règle à configurer : heures réelles affichées, sans retard ni départ calculé.",
  },
  UNKNOWN_DIRECTION: {
    code: "Q-PUNCH-1",
    message: "Sens du pointage (entrée ou sortie) non transmis — règle à configurer : aucune entrée ni sortie déduite.",
  },
  ABSENCE: {
    code: "Q-ABS-1",
    message: "Aucune absence n'est qualifiée : la règle de qualification n'est pas décidée.",
  },
  SYNC: {
    code: "Q-SYNC-1",
    message: "Synchronisation non confirmée — règle à configurer : l'absence de pointage ne vaut pas absence.",
  },
  NON_WORKED_PUNCH: {
    code: "Q-CAL-1",
    message: "Pointage un jour non travaillé — règle à configurer : heures affichées, sans retard ni temps supplémentaire.",
  },
} as const;

export type PendingRuleKey = keyof typeof PENDING_RULES;

export type ScheduleSeconds = {
  workdays: number[];
  start: number;
  lateAfter: number;
  end: number;
  normalDepartureUntil: number;
  overtimeFrom: number;
};

export type ScheduleValidation = { ok: true; value: ValidatedSchedule } | { ok: false; error: string };

const CLOCK_KEYS = ["start", "lateAfter", "end", "normalDepartureUntil", "overtimeFrom"] as const;

/** Contrôle d'un horaire saisi : heures « HH:MM » valides et cohérentes, jours 1 à 7. */
export function validateSchedule(input: ValidatedSchedule): ScheduleValidation {
  const days = [...new Set(input.workdays)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days.length === 0 || days.length !== input.workdays.length) return { ok: false, error: "Jours travaillés : choisissez au moins un jour, chacun une seule fois." };
  for (const k of CLOCK_KEYS) {
    if (!/^\d{2}:\d{2}$/.test(input[k])) return { ok: false, error: "Heures : format HH:MM (sans secondes)." };
  }
  const s = toSeconds(input);
  if (!s) return { ok: false, error: "Heures : format HH:MM attendu." };
  if (!(s.start <= s.lateAfter && s.lateAfter < s.end && s.end <= s.normalDepartureUntil && s.end <= s.overtimeFrom)) {
    return { ok: false, error: "Heures incohérentes : début ≤ seuil de retard < fin ≤ fin du départ normal, et fin ≤ début du temps supplémentaire." };
  }
  return { ok: true, value: { ...input, workdays: days } };
}

export function toSeconds(s: ValidatedSchedule): ScheduleSeconds | null {
  const v = {
    start: parseClock(s.start),
    lateAfter: parseClock(s.lateAfter),
    end: parseClock(s.end),
    normalDepartureUntil: parseClock(s.normalDepartureUntil),
    overtimeFrom: parseClock(s.overtimeFrom),
  };
  if (Object.values(v).some((x) => x === null)) return null;
  return { workdays: s.workdays, ...(v as Omit<ScheduleSeconds, "workdays">) };
}

/** Lit un horaire enregistré (JSON) ; null s'il est absent ou invalide (calculs bloqués). */
export function readSchedule(raw: unknown): ValidatedSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const candidate: ValidatedSchedule = {
    workdays: Array.isArray(r.workdays) ? (r.workdays as number[]) : [],
    start: String(r.start ?? ""),
    lateAfter: String(r.lateAfter ?? ""),
    end: String(r.end ?? ""),
    normalDepartureUntil: String(r.normalDepartureUntil ?? ""),
    overtimeFrom: String(r.overtimeFrom ?? ""),
  };
  const v = validateSchedule(candidate);
  return v.ok ? v.value : null;
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};
