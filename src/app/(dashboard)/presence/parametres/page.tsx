import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, PageHeader } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission, loadSchedule } from "@/lib/presence/config";
import { PENDING_RULES, WEEKDAY_LABELS } from "@/lib/presence/settings";
import { dbDateToKey, formatDateKey, formatGomaDateTime, gomaDateKey } from "@/lib/presence/time";
import { loadPresenceViewer } from "@/lib/presence/views";
import { ActionForm } from "../action-form";
import { addCalendarDayAction, removeCalendarDayAction, saveScheduleAction } from "../actions";

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
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Horaire validé</h2>
        <p className="mb-3 text-xs text-gray-500">{setAt ? `Dernière modification : ${formatGomaDateTime(setAt)}.` : "Aucun horaire enregistré : les calculs sont bloqués."}</p>
        {schedule && !canEdit && (
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-500">Jours travaillés</dt>
              <dd>{schedule.workdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Journée</dt>
              <dd>
                {schedule.start} – {schedule.end}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Retard signalé après</dt>
              <dd>{schedule.lateAfter} (incluse : pas de retard)</dd>
            </div>
            <div>
              <dt className="text-gray-500">Départ anticipé avant</dt>
              <dd>{schedule.end}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Départ normal jusqu&apos;à</dt>
              <dd>{schedule.normalDepartureUntil} (incluse)</dd>
            </div>
            <div>
              <dt className="text-gray-500">Temps supplémentaire proposé depuis</dt>
              <dd>{schedule.overtimeFrom}</dd>
            </div>
          </dl>
        )}
        {canEdit && (
          <ActionForm action={saveScheduleAction} submit="Enregistrer l'horaire" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <fieldset className="sm:col-span-3">
              <legend className="text-sm text-gray-700">Jours travaillés</legend>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <label key={d} className="flex items-center gap-1">
                    <input type="checkbox" name="workdays" value={d} defaultChecked={schedule?.workdays.includes(d) ?? false} /> {WEEKDAY_LABELS[d]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm text-gray-700">
              Début de journée
              <Input type="time" name="start" defaultValue={schedule?.start} required className="mt-1" />
            </label>
            <label className="text-sm text-gray-700">
              Retard signalé après (incluse : pas de retard)
              <Input type="time" name="lateAfter" defaultValue={schedule?.lateAfter} required className="mt-1" />
            </label>
            <label className="text-sm text-gray-700">
              Fin de journée (départ anticipé avant)
              <Input type="time" name="end" defaultValue={schedule?.end} required className="mt-1" />
            </label>
            <label className="text-sm text-gray-700">
              Départ normal jusqu&apos;à (incluse)
              <Input type="time" name="normalDepartureUntil" defaultValue={schedule?.normalDepartureUntil} required className="mt-1" />
            </label>
            <label className="text-sm text-gray-700">
              Temps supplémentaire proposé depuis
              <Input type="time" name="overtimeFrom" defaultValue={schedule?.overtimeFrom} required className="mt-1" />
            </label>
          </ActionForm>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Règles non décidées (non configurables)</h2>
        <ul className="space-y-1 text-sm text-amber-900">
          {Object.values(PENDING_RULES).map((r) => (
            <li key={r.code + r.message}>
              <span className="font-mono text-xs">{r.code}</span> — {r.message}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Calendrier : jours non travaillés</h2>
        <p className="mb-3 text-xs text-gray-500">Aucun calendrier officiel n&apos;est préchargé. Un jour inscrit ici n&apos;entraîne ni retard ni temps supplémentaire.</p>
        {days.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun jour inscrit pour cette année.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {days.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatDateKey(dbDateToKey(d.date))} — {d.label}
                </span>
                {canEdit && <ActionForm action={removeCalendarDayAction.bind(null, d.id)} submit="Retirer" variant="ghost" />}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <ActionForm action={addCalendarDayAction} submit="Ajouter au calendrier" className="mt-3 flex flex-wrap items-end gap-3">
            <Input type="date" name="date" required aria-label="Date" />
            <Input name="label" required placeholder="Motif (ex. décision de l'Inspection)" aria-label="Motif" />
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
