// Moteur des règles horaires (lot 2) : seuils validés aux bornes exactes,
// exemple de 16 h → 45 min, règles ouvertes bloquées sans calcul arbitraire,
// fuseau de Goma indépendant du serveur, calendrier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDay, departureVerdict, lateVerdict, type DayPunch, type PunchDirection } from "@/lib/presence/rules";
import { VALIDATED_SCHEDULE_DEFAULTS, readSchedule, toSeconds, validateSchedule } from "@/lib/presence/settings";
import { GOMA_OFFSET_MINUTES, GOMA_TIME_ZONE, addDays, dateRange, gomaClock, gomaDateKey, gomaIsoWeekday, gomaLocalToUtc } from "@/lib/presence/time";

const DAY = "2026-10-12"; // lundi
const S = toSeconds(VALIDATED_SCHEDULE_DEFAULTS)!;
const at = (clock: string, day = DAY) => gomaLocalToUtc(`${day}T${clock}`)!;
const p = (clock: string, direction: PunchDirection = "IN", day = DAY): DayPunch => ({ at: at(clock, day), direction, simulated: false });
const day = (punches: DayPunch[], extra: Partial<Parameters<typeof computeDay>[0]> = {}) =>
  computeDay({ dateKey: DAY, todayKey: "2026-10-20", punches, schedule: VALIDATED_SCHEDULE_DEFAULTS, calendarNonWorked: null, hasMapping: true, ...extra });

test("fuseau : Africa/Lubumbashi = UTC+2 sans heure d'été (base IANA), indépendant du serveur", () => {
  for (const iso of ["2026-01-15T12:00:00.000Z", "2026-07-15T12:00:00.000Z", "2026-10-12T22:30:00.000Z"]) {
    const d = new Date(iso);
    const local = d.toLocaleString("sv-SE", { timeZone: GOMA_TIME_ZONE }).replace(" ", "T");
    assert.equal(gomaLocalToUtc(local)!.toISOString(), iso);
  }
  assert.equal(GOMA_OFFSET_MINUTES, 120);
  // 22 h 30 UTC le 12 = 0 h 30 le 13 à Goma.
  assert.equal(gomaDateKey(new Date("2026-10-12T22:30:00Z")), "2026-10-13");
  assert.equal(gomaClock(new Date("2026-10-12T06:15:00Z")), "08:15:00");
  assert.equal(gomaIsoWeekday("2026-10-12"), 1);
  assert.equal(gomaIsoWeekday("2026-10-18"), 7);
  assert.deepEqual(dateRange("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("arrivée : 8 h 14 59 et 8 h 15 00 sans retard ; 8 h 16 00 retard ; 8 h 15 01 non déterminé (secondes)", () => {
  assert.equal(lateVerdict(S.lateAfter - 1, S.lateAfter), false);
  assert.equal(lateVerdict(S.lateAfter, S.lateAfter), false);
  assert.equal(lateVerdict(S.lateAfter + 1, S.lateAfter), null);
  assert.equal(lateVerdict(S.lateAfter + 59, S.lateAfter), null);
  assert.equal(lateVerdict(S.lateAfter + 60, S.lateAfter), true);
  assert.equal(day([p("08:14:59")]).late, false);
  assert.equal(day([p("08:15:00")]).late, false);
  assert.equal(day([p("08:16:00")]).late, true);
  const sec = day([p("08:15:01")]);
  assert.equal(sec.late, null);
  assert.ok(sec.pending.includes("SECONDS"));
});

test("arrivée à 8 h 20 : retard signalé, heure réelle visible, durée NON calculée (Q-CALC-1)", () => {
  const s = day([p("08:20:00")]);
  assert.equal(s.late, true);
  assert.equal(s.arrival, "08:20:00");
  assert.equal(s.lateMinutes, null);
  assert.ok(s.pending.includes("LATE_DURATION"));
  assert.ok(s.notes.some((n) => n.includes("Durée du retard non calculée")));
  assert.equal(s.status, "ENTREE_SEULE");
  assert.equal(s.label, "Entrée enregistrée, sortie non enregistrée");
});

test("départ : 14 h 59 59 anticipé ; 15 h 00 et 15 h 15 00 normaux ; 15 h 15 01 non déterminé ; 15 h 16 00 → 1 min", () => {
  assert.deepEqual(departureVerdict(S.end - 1, S), { early: true, overtimeMin: null, overtimePending: false, undetermined: false });
  assert.equal(departureVerdict(S.end, S).early, false);
  assert.deepEqual(departureVerdict(S.normalDepartureUntil, S), { early: false, overtimeMin: null, overtimePending: false, undetermined: false });
  assert.equal(departureVerdict(S.normalDepartureUntil + 1, S).undetermined, true);
  assert.equal(departureVerdict(S.normalDepartureUntil + 60, S).overtimeMin, 1);
  assert.equal(day([p("08:00:00", "IN"), p("14:59:59", "OUT")]).earlyDeparture, true);
  assert.equal(day([p("08:00:00", "IN"), p("15:15:00", "OUT")]).overtimeProposedMin, null);
});

test("exemple validé : départ à 16 h 00 → 45 minutes supplémentaires PROPOSÉES (non approuvées)", () => {
  const s = day([p("08:00:00", "IN"), p("16:00:00", "OUT")]);
  assert.equal(s.status, "ENTREE_SORTIE");
  assert.equal(s.overtimeProposedMin, 45);
  assert.equal(s.departure, "16:00:00");
  assert.ok(s.notes.some((n) => n.includes("non approuvé")));
  assert.equal(s.late, false);
  assert.equal(s.earlyDeparture, false);
});

test("départ à 16 h 00 30 : temps supplémentaire signalé, durée non calculée (aucun arrondi inventé)", () => {
  const s = day([p("08:00:00", "IN"), p("16:00:30", "OUT")]);
  assert.equal(s.overtimeProposedMin, null);
  assert.equal(s.overtimePending, true);
  assert.ok(s.pending.includes("SECONDS"));
});

test("entrées / sorties multiples, sens non transmis, ordre incohérent : heures affichées, rien de déduit", () => {
  const multi = day([p("08:00:00", "IN"), p("12:00:00", "OUT"), p("13:00:00", "IN"), p("16:00:00", "OUT")]);
  assert.equal(multi.status, "POINTAGES_MULTIPLES");
  assert.equal(multi.late, null);
  assert.equal(multi.overtimeProposedMin, null);
  assert.equal(multi.punches.length, 4);
  assert.ok(multi.pending.includes("PAIRING"));
  const unknown = day([p("08:30:00", "UNKNOWN"), p("16:00:00", "UNKNOWN")]);
  assert.equal(unknown.status, "SENS_INCONNU");
  assert.equal(unknown.late, null);
  assert.equal(unknown.arrival, null);
  // Jamais de « premier = entrée, dernier = sortie » : un pointage sans sens reste sans sens.
  assert.equal(day([p("08:30:00", "UNKNOWN")]).arrival, null);
  const reversed = day([p("16:00:00", "IN"), p("08:00:00", "OUT")]);
  assert.equal(reversed.status, "POINTAGES_MULTIPLES");
  assert.equal(reversed.overtimeProposedMin, null);
});

test("aucun pointage : jamais une absence ; synchronisation non confirmée ; sans identifiant distingué", () => {
  const none = day([]);
  assert.equal(none.status, "AUCUN_POINTAGE");
  assert.ok(none.pending.includes("SYNC"));
  assert.ok(none.pending.includes("ABSENCE"));
  assert.equal(none.label.toLowerCase().includes("absen"), false);
  assert.equal(day([], { hasMapping: false }).status, "SANS_IDENTIFIANT");
  assert.equal(day([], { todayKey: DAY }).label, "Aucun pointage reçu pour l'instant");
  assert.equal(day([], { todayKey: "2026-10-11" }).status, "A_VENIR");
});

test("calendrier et jours non travaillés : aucun retard ni temps supplémentaire ; pointage signalé", () => {
  const holiday = day([p("08:30:00", "IN")], { calendarNonWorked: "Journée non travaillée (test)" });
  assert.equal(holiday.status, "JOUR_NON_TRAVAILLE");
  assert.equal(holiday.late, null);
  assert.ok(holiday.pending.includes("NON_WORKED_PUNCH"));
  const sunday = computeDay({ dateKey: "2026-10-18", todayKey: "2026-10-20", punches: [], schedule: VALIDATED_SCHEDULE_DEFAULTS, calendarNonWorked: null, hasMapping: true });
  assert.equal(sunday.status, "JOUR_NON_TRAVAILLE");
  assert.equal(sunday.pending.length, 0);
});

test("horaire absent ou invalide : calculs bloqués, données brutes conservées", () => {
  const s = day([p("09:00:00")], { schedule: null });
  assert.equal(s.status, "HORAIRE_NON_CONFIGURE");
  assert.equal(s.late, null);
  assert.equal(s.punches.length, 1);
  assert.equal(readSchedule({ workdays: [1], start: "8h" }), null);
});

test("paramètres : valeurs validées acceptées ; saisies incohérentes refusées", () => {
  assert.equal(validateSchedule(VALIDATED_SCHEDULE_DEFAULTS).ok, true);
  assert.equal(validateSchedule({ ...VALIDATED_SCHEDULE_DEFAULTS, lateAfter: "15:30" }).ok, false);
  assert.equal(validateSchedule({ ...VALIDATED_SCHEDULE_DEFAULTS, workdays: [] }).ok, false);
  assert.equal(validateSchedule({ ...VALIDATED_SCHEDULE_DEFAULTS, workdays: [1, 1] }).ok, false);
  assert.equal(validateSchedule({ ...VALIDATED_SCHEDULE_DEFAULTS, end: "15:00:30" }).ok, false);
  assert.deepEqual(readSchedule(VALIDATED_SCHEDULE_DEFAULTS), VALIDATED_SCHEDULE_DEFAULTS);
});

test("données simulées : signalées sur la journée", () => {
  assert.equal(day([{ at: at("08:00:00"), direction: "IN", simulated: true }]).simulated, true);
  assert.equal(day([p("08:00:00")]).simulated, false);
});
