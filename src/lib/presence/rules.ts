// Moteur des règles horaires (fonction PURE, testée dans rules.test.ts).
// Applique UNIQUEMENT les règles validées :
//  - arrivée jusqu'à 8 h 15 incluse : aucun retard ; après : retard signalé ;
//  - départ avant 15 h : départ anticipé (sous réserve d'une autorisation) ;
//  - départ de 15 h à 15 h 15 inclus : départ normal ;
//  - départ après 15 h 15 : temps supplémentaire PROPOSÉ, compté depuis 15 h 15.
// Tout ce qui dépend d'une décision non prise reste bloqué, avec un message :
// durée du retard, secondes dans la minute d'un seuil, entrées / sorties
// multiples, sens non transmis, pointage un jour non travaillé, qualification
// d'une absence, confirmation de la synchronisation. Une donnée inconnue ne
// vaut jamais zéro ; l'absence de pointage ne vaut jamais absence.

import { PENDING_RULES, toSeconds, type PendingRuleKey, type ValidatedSchedule } from "@/lib/presence/settings";
import { gomaIsoWeekday, gomaSecondsOfDay, secondsToClock } from "@/lib/presence/time";

export type PunchDirection = "IN" | "OUT" | "UNKNOWN";
export type DayPunch = { at: Date; direction: PunchDirection; simulated: boolean };

export type DayStatus =
  | "A_VENIR"
  | "HORAIRE_NON_CONFIGURE"
  | "JOUR_NON_TRAVAILLE"
  | "SANS_IDENTIFIANT"
  | "AUCUN_POINTAGE"
  | "ENTREE_SEULE"
  | "SORTIE_SEULE"
  | "ENTREE_SORTIE"
  | "POINTAGES_MULTIPLES"
  | "SENS_INCONNU";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  A_VENIR: "À venir",
  HORAIRE_NON_CONFIGURE: "Horaire non configuré — calculs bloqués",
  JOUR_NON_TRAVAILLE: "Jour non travaillé",
  SANS_IDENTIFIANT: "Aucun identifiant de pointage associé",
  AUCUN_POINTAGE: "Aucun pointage reçu",
  ENTREE_SEULE: "Entrée enregistrée, sortie non enregistrée",
  SORTIE_SEULE: "Sortie enregistrée, entrée non enregistrée",
  ENTREE_SORTIE: "Entrée et sortie enregistrées",
  POINTAGES_MULTIPLES: "Plusieurs entrées ou sorties",
  SENS_INCONNU: "Sens du pointage non transmis",
};

export type DaySummary = {
  status: DayStatus;
  label: string;
  /** Heures réelles (Goma), dans l'ordre, avec leur sens tel que transmis. */
  punches: { clock: string; direction: PunchDirection; simulated: boolean }[];
  arrival: string | null;
  departure: string | null;
  /** true : retard signalé ; false : pas de retard ; null : non déterminé. */
  late: boolean | null;
  /** Toujours null tant que Q-CALC-1 n'est pas tranchée. */
  lateMinutes: number | null;
  earlyDeparture: boolean | null;
  /** Temps supplémentaire PROPOSÉ en minutes (jamais approuvé ici) ; null : non calculé ou sans objet. */
  overtimeProposedMin: number | null;
  /** Vrai si un temps supplémentaire existe mais que sa durée n'est pas calculable. */
  overtimePending: boolean;
  notes: string[];
  pending: PendingRuleKey[];
  simulated: boolean;
};

export type DayInput = {
  dateKey: string;
  todayKey: string;
  punches: DayPunch[];
  schedule: ValidatedSchedule | null;
  /** Libellé d'un jour non travaillé du calendrier, sinon null. */
  calendarNonWorked: string | null;
  /** La personne a au moins un identifiant de pointage associé ce jour-là. */
  hasMapping: boolean;
};

function base(input: DayInput, status: DayStatus): DaySummary {
  const punches = [...input.punches]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((p) => ({ clock: secondsToClock(gomaSecondsOfDay(p.at)), direction: p.direction, simulated: p.simulated }));
  return {
    status,
    label: DAY_STATUS_LABELS[status],
    punches,
    arrival: null,
    departure: null,
    late: null,
    lateMinutes: null,
    earlyDeparture: null,
    overtimeProposedMin: null,
    overtimePending: false,
    notes: [],
    pending: [],
    simulated: input.punches.some((p) => p.simulated),
  };
}

function block(s: DaySummary, key: PendingRuleKey) {
  if (!s.pending.includes(key)) s.pending.push(key);
  const msg = PENDING_RULES[key].message;
  if (!s.notes.includes(msg)) s.notes.push(msg);
}

/** Retard : seuil inclus ; dans la minute du seuil avec des secondes, non déterminé (Q-PREC-1). */
export function lateVerdict(arrivalSecs: number, lateAfter: number): boolean | null {
  if (arrivalSecs <= lateAfter) return false;
  if (arrivalSecs < lateAfter + 60) return null;
  return true;
}

/**
 * Départ : anticipé avant `end` ; normal jusqu'à `normalDepartureUntil` inclus ;
 * au-delà, temps supplémentaire proposé depuis `overtimeFrom`, en minutes
 * entières seulement (secondes non nulles : durée non calculée, Q-PREC-1).
 */
export function departureVerdict(
  departureSecs: number,
  s: { end: number; normalDepartureUntil: number; overtimeFrom: number }
): { early: boolean | null; overtimeMin: number | null; overtimePending: boolean; undetermined: boolean } {
  if (departureSecs < s.end) return { early: true, overtimeMin: null, overtimePending: false, undetermined: false };
  if (departureSecs <= s.normalDepartureUntil) return { early: false, overtimeMin: null, overtimePending: false, undetermined: false };
  if (departureSecs < s.normalDepartureUntil + 60) return { early: false, overtimeMin: null, overtimePending: false, undetermined: true };
  const elapsed = departureSecs - s.overtimeFrom;
  if (elapsed % 60 !== 0) return { early: false, overtimeMin: null, overtimePending: true, undetermined: false };
  return { early: false, overtimeMin: elapsed / 60, overtimePending: false, undetermined: false };
}

export function computeDay(input: DayInput): DaySummary {
  if (input.dateKey > input.todayKey) return base(input, "A_VENIR");
  const sched = input.schedule ? toSeconds(input.schedule) : null;
  const hasPunches = input.punches.length > 0;
  if (!sched || !input.schedule) {
    const s = base(input, "HORAIRE_NON_CONFIGURE");
    s.notes.push("L'horaire validé n'est pas enregistré : aucun retard, départ ni temps supplémentaire n'est calculé.");
    return s;
  }

  const nonWorked = input.calendarNonWorked !== null || !input.schedule.workdays.includes(gomaIsoWeekday(input.dateKey));
  if (nonWorked) {
    const s = base(input, "JOUR_NON_TRAVAILLE");
    if (input.calendarNonWorked) s.notes.push(`Calendrier : ${input.calendarNonWorked}.`);
    if (hasPunches) block(s, "NON_WORKED_PUNCH");
    return s;
  }

  if (!hasPunches) {
    const s = base(input, input.hasMapping ? "AUCUN_POINTAGE" : "SANS_IDENTIFIANT");
    if (input.hasMapping) {
      if (input.dateKey === input.todayKey) s.label = "Aucun pointage reçu pour l'instant";
      block(s, "SYNC");
      block(s, "ABSENCE");
    }
    return s;
  }

  const ins = input.punches.filter((p) => p.direction === "IN");
  const outs = input.punches.filter((p) => p.direction === "OUT");
  if (ins.length + outs.length < input.punches.length) {
    const s = base(input, "SENS_INCONNU");
    block(s, "UNKNOWN_DIRECTION");
    return s;
  }
  if (ins.length > 1 || outs.length > 1) {
    const s = base(input, "POINTAGES_MULTIPLES");
    block(s, "PAIRING");
    return s;
  }
  const inP = ins[0] ?? null;
  const outP = outs[0] ?? null;
  // Une sortie antérieure à l'entrée : ordre incohérent, rien n'est déduit.
  if (inP && outP && outP.at.getTime() < inP.at.getTime()) {
    const s = base(input, "POINTAGES_MULTIPLES");
    s.notes.push("Sortie enregistrée avant l'entrée : ordre incohérent.");
    block(s, "PAIRING");
    return s;
  }

  const s = base(input, inP && outP ? "ENTREE_SORTIE" : inP ? "ENTREE_SEULE" : "SORTIE_SEULE");
  if (inP) {
    const secs = gomaSecondsOfDay(inP.at);
    s.arrival = secondsToClock(secs);
    s.late = lateVerdict(secs, sched.lateAfter);
    if (s.late === null) block(s, "SECONDS");
    if (s.late) {
      s.notes.push(`Retard signalé (arrivée ${s.arrival}).`);
      block(s, "LATE_DURATION");
    }
  }
  if (outP) {
    const secs = gomaSecondsOfDay(outP.at);
    s.departure = secondsToClock(secs);
    const d = departureVerdict(secs, sched);
    s.earlyDeparture = d.early;
    s.overtimeProposedMin = d.overtimeMin;
    s.overtimePending = d.overtimePending;
    if (d.early) s.notes.push("Départ anticipé — sous réserve d'une autorisation.");
    if (d.undetermined || d.overtimePending) block(s, "SECONDS");
    if (d.overtimeMin !== null) s.notes.push(`Temps supplémentaire proposé : ${d.overtimeMin} min (non approuvé, sans effet sur la rémunération).`);
    if (d.overtimePending) s.notes.push("Temps supplémentaire proposé — durée non calculée.");
  }
  return s;
}
