import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Field, Input, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission, loadSchedule } from "@/lib/presence/config";
import { PENDING_RULES, WEEKDAY_LABELS } from "@/lib/presence/settings";
import { dbDateToKey, formatDateKey, formatGomaDateTime, gomaDateKey } from "@/lib/presence/time";
import { loadPresenceViewer } from "@/lib/presence/views";
import { ActionForm } from "../action-form";
import { addCalendarDayAction, removeCalendarDayAction, saveScheduleAction } from "../actions";

function Slot({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value}</dd>
      {note && <dd className="text-xs text-gray-500">{note}</dd>}
    </div>
  );
}

// Horaires et calendrier : consultation (vue globale des présences) ;
// modification SEULEMENT par presence.schedule.manage (IPP principal, IPA chargé
// du personnel), revérifiée par le serveur. Les règles non décidées sont
// affichées comme telles : aucune valeur ne peut être choisie ici.
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) redirect("/login");
  const org = viewer.organizationId;
  const canEdit = holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_SCHEDULE_MANAGE, org);
  if (!canEdit && !holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_READ_ALL, org)) redirect("/presence/moi");
  const yearStart = new Date(`${gomaDateKey(new Date()).slice(0, 4)}-01-01T00:00:00Z`);
  const [{ schedule, setAt }, days] = await Promise.all([
    loadSchedule(org),
    prisma.calendarDay.findMany({ where: { organizationId: org, date: { gte: yearStart } }, orderBy: { date: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horaires et calendrier"
        description={
          canEdit
            ? "Vous pouvez modifier l'horaire validé et le calendrier ; chaque changement est journalisé et recalcule les synthèses."
            : "Consultation seule : seuls l'IPP principal et l'IPA chargé du personnel les modifient."
        }
      />

      <Card>
        <SectionTitle
          title="Horaire validé"
          description={setAt ? `Dernière modification : ${formatGomaDateTime(setAt)}.` : "Aucun horaire enregistré : les calculs sont bloqués."}
        />
        {schedule && !canEdit && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs text-gray-500">Jours travaillés</p>
              <ul className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const on = schedule.workdays.includes(d);
                  return (
                    <li
                      key={d}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-400 line-through"}`}
                    >
                      {WEEKDAY_LABELS[d]}
                    </li>
                  );
                })}
              </ul>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Slot label="Début de journée" value={schedule.start} />
              <Slot label="Retard signalé après" value={schedule.lateAfter} note="incluse : pas de retard" />
              <Slot label="Départ anticipé avant" value={schedule.end} />
              <Slot label="Départ normal jusqu'à" value={schedule.normalDepartureUntil} note="incluse" />
              <Slot label="Temps suppl. proposé depuis" value={schedule.overtimeFrom} />
            </dl>
          </div>
        )}
        {canEdit && (
          <ActionForm action={saveScheduleAction} submit="Enregistrer l'horaire" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <fieldset className="sm:col-span-2 lg:col-span-5">
              <legend className="text-sm font-medium text-gray-700">Jours travaillés</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <label key={d} className="cursor-pointer">
                    <input type="checkbox" name="workdays" value={d} defaultChecked={schedule?.workdays.includes(d) ?? false} className="peer sr-only" />
                    <span className="inline-flex min-h-10 items-center rounded-full border border-gray-200 px-4 text-sm text-gray-600 transition-colors hover:border-gray-300 peer-checked:border-blue-300 peer-checked:bg-blue-50 peer-checked:font-medium peer-checked:text-blue-800 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1">
                      {WEEKDAY_LABELS[d]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Début de journée">
              <Input type="time" name="start" defaultValue={schedule?.start} required />
            </Field>
            <Field label="Retard signalé après" hint="Heure incluse : pas de retard.">
              <Input type="time" name="lateAfter" defaultValue={schedule?.lateAfter} required />
            </Field>
            <Field label="Fin de journée" hint="Départ anticipé avant cette heure.">
              <Input type="time" name="end" defaultValue={schedule?.end} required />
            </Field>
            <Field label="Départ normal jusqu'à" hint="Heure incluse.">
              <Input type="time" name="normalDepartureUntil" defaultValue={schedule?.normalDepartureUntil} required />
            </Field>
            <Field label="Temps suppl. proposé depuis">
              <Input type="time" name="overtimeFrom" defaultValue={schedule?.overtimeFrom} required />
            </Field>
          </ActionForm>
        )}
      </Card>

      <Notice tone="warning" title="Règles non décidées (non configurables)">
        <ul className="space-y-1.5">
          {Object.values(PENDING_RULES).map((r) => (
            <li key={r.code + r.message} className="flex gap-2">
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px]">{r.code}</span>
              <span>{r.message}</span>
            </li>
          ))}
        </ul>
      </Notice>

      <Card>
        <SectionTitle
          title="Calendrier : jours non travaillés"
          description="Aucun calendrier officiel n'est préchargé. Un jour inscrit ici n'entraîne ni retard ni temps supplémentaire."
        />
        {days.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun jour inscrit pour cette année.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
            {days.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium tabular-nums text-gray-900">{formatDateKey(dbDateToKey(d.date))}</span>
                  <span className="text-gray-600"> — {d.label}</span>
                </span>
                {canEdit && <ActionForm action={removeCalendarDayAction.bind(null, d.id)} submit="Retirer" variant="ghost" />}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <ActionForm action={addCalendarDayAction} submit="Ajouter au calendrier" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <Field label="Date">
              <Input type="date" name="date" required />
            </Field>
            <Field label="Motif">
              <Input name="label" required placeholder="ex. décision de l'Inspection" />
            </Field>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
