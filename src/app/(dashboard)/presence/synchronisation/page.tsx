import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertOctagon, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { Badge, Card, EmptyState, Notice, PageHeader, SectionTitle, TABLE_HEAD } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission } from "@/lib/presence/config";
import { holdsDeviceAdminRole } from "@/lib/presence/devices";
import { PENDING_RULES } from "@/lib/presence/settings";
import { formatGomaDateTime } from "@/lib/presence/time";
import { loadChangeCursor, loadPresenceViewer, loadSyncState } from "@/lib/presence/views";
import { ActionForm } from "../action-form";
import { resolveAlertAction } from "../actions";
import { PresenceRefresher } from "../refresher";
import { SimulatedBadge } from "../presence-ui";

const STATUS: Record<string, { label: string; color: "gray" | "orange" | "green" }> = {
  NON_VERIFIE: { label: "Non vérifié sur l'appareil réel", color: "orange" },
  VERIFIE: { label: "Vérifié", color: "green" },
  DESACTIVE: { label: "Désactivé", color: "gray" },
};

const when = (d: Date | null) => (d ? formatGomaDateTime(d) : "Jamais");

// Signalements des pointeuses ADMS (src/lib/presence/adms/handler.ts).
const ALERT_LABEL: Record<string, string> = {
  SERIE_INCONNUE: "Numéro de série inconnu — appel refusé",
  APPAREIL_REFUSE: "Appareil désactivé ou non déclaré en ADMS — appel refusé",
  APPAIRAGE_REQUIS: "Pointeuse non appairée — appel refusé (ouvrez l'appairage)",
  CHEMIN_SECRET_INVALIDE: "Chemin secret absent ou faux — appel refusé",
  EMPREINTE_MODIFIEE: "Empreinte de l'appareil modifiée (protocole ou client)",
  IP_PUBLIQUE_CHANGEE: "IP publique différente de celle de l'appairage",
  TABLE_NON_ATTENDUE: "Envoi d'une table non demandée — ignoré sans lecture",
  LIGNES_ILLISIBLES: "Lignes de pointage illisibles",
  HORLOGE_EN_AVANCE: "Horloge de l'appareil en avance — pointages en quarantaine",
  POINTAGE_NON_AUTORISE: "Pointage d'un PIN sans association valide — conservé, non compté",
  UTILISATEUR_NON_ASSOCIE_SUR_APPAREIL: "Utilisateur présent sur la pointeuse sans association",
  ADMINISTRATEUR_SUR_APPAREIL: "Administrateur(s) déclaré(s) sur la pointeuse — à vérifier",
  MENU_NON_PROTEGE: "Aucun administrateur sur la pointeuse : menu accessible à tous",
  COMMANDE_EN_ECHEC: "Commande refusée par la pointeuse",
};

// Signalements sans conséquence sur les données comptées : avertissement, et non alerte.
const MINOR_ALERTS = new Set(["TABLE_NON_ATTENDUE", "LIGNES_ILLISIBLES"]);

// État de synchronisation : dernier contact, dernier pointage reçu, décalage
// d'horloge BRUT (aucun seuil d'alerte décidé), identifiants non associés.
export default async function SyncPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) redirect("/login");
  const org = viewer.organizationId;
  const allowed = [PERMISSIONS.PRESENCE_READ_ALL, PERMISSIONS.PRESENCE_DEVICES_MANAGE, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE].some((k) =>
    holdsOrgPermission(viewer.permissions, k, org)
  );
  if (!allowed) redirect("/presence/moi");
  // Signalements des appareils et liens d'association : trois profils seulement
  // (directive du 2026-10-15) ; la consultation de l'état reste ouverte à presence.read_all.
  const deviceAdmin = await holdsDeviceAdminRole(session.user.id);
  const canEnroll = deviceAdmin && holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, org);
  const canDevices = deviceAdmin && holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_DEVICES_MANAGE, org);
  const [{ devices, unmapped, alerts }, cursor] = await Promise.all([loadSyncState(org), loadChangeCursor(org)]);
  const labelOf = new Map(devices.map((d) => [d.id, `${d.label} — ${d.siteLabel}`]));
  const th = "px-4 py-3 whitespace-nowrap";

  return (
    <div className="space-y-5">
      <PageHeader
        title="État de synchronisation"
        description="Contacts des pointeuses et pointages reçus. Une synchronisation incertaine ne vaut jamais absence."
        actions={<PresenceRefresher initialCursor={cursor} />}
      />
      <Notice tone="warning">
        <p>{PENDING_RULES.SYNC.message}</p>
        <p>Seuil d&apos;alerte de décalage d&apos;horloge : non décidé — le décalage est affiché tel quel, sans classement.</p>
      </Notice>

      {devices.length === 0 ? (
        <EmptyState message="Aucune pointeuse enregistrée. Les appareils s'ajoutent dans « Appareils et associations » après vérification du matériel acheté." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={th}>Appareil</th>
                <th className={th}>État</th>
                <th className={th}>Dernier contact</th>
                <th className={th}>Dernier pointage reçu</th>
                <th className={th}>Décalage d&apos;horloge</th>
                <th className={th}>Pointages / lots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 align-top">
              {devices.map((d) => (
                <tr key={d.id}>
                  <td className="min-w-48 px-4 py-3">
                    <span className="font-medium text-gray-900">{d.label}</span> {d.isSimulator && <SimulatedBadge />}
                    <span className="block text-xs text-gray-500">{[d.siteLabel, d.vendor, d.model].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS[d.status].color}>{STATUS[d.status].label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-700">{when(d.lastContactAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-700">{when(d.lastEventReceivedAt)}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    <span className="font-medium text-gray-900">
                      {d.lastClockOffsetSec === null ? "Non mesuré" : `${d.lastClockOffsetSec > 0 ? "+" : ""}${d.lastClockOffsetSec} s`}
                    </span>
                    {d.lastClockCheckAt && <span className="block text-gray-500">le {formatGomaDateTime(d.lastClockCheckAt)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    <span className="font-medium text-gray-900">
                      {d._count.punches} / {d._count.batches}
                    </span>
                    {d.protocol === "ADMS" && typeof (d.admsInfo as { attLogs?: unknown } | null)?.attLogs === "number" && (
                      <span className="block text-gray-500">en mémoire sur l&apos;appareil : {(d.admsInfo as { attLogs: number }).attLogs}</span>
                    )}
                    {d.clockSuspect > 0 && <span className="block text-amber-700">{d.clockSuspect} en quarantaine (horloge)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {canDevices && (
        <Card>
          <SectionTitle title={`Signalements des pointeuses (${alerts.length})`} description="Chaque signalement regroupe les répétitions d'un même problème sur un appareil." />
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun signalement ouvert.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {alerts.map((a) => {
                const minor = MINOR_ALERTS.has(a.kind);
                const Icon = minor ? AlertTriangle : AlertOctagon;
                return (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <Icon size={18} aria-hidden className={`mt-0.5 shrink-0 ${minor ? "text-amber-600" : "text-red-600"}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          <span className="sr-only">{minor ? "Avertissement : " : "Alerte : "}</span>
                          {ALERT_LABEL[a.kind] ?? a.kind}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-gray-500">
                          {a.deviceId ? labelOf.get(a.deviceId) ?? "appareil" : `série ${a.serialNumber ?? "?"}`} · {a.count} fois · dernière le {formatGomaDateTime(a.lastSeenAt)}
                        </p>
                        {a.detail && (
                          <code className="mt-1.5 block break-all rounded-lg bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] text-gray-600 ring-1 ring-gray-100">{JSON.stringify(a.detail)}</code>
                        )}
                      </div>
                    </div>
                    <ActionForm action={resolveAlertAction.bind(null, a.id)} submit="Marquer traité" variant="outline" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle
          title={`Identifiants de pointage non associés (${unmapped.length})`}
          description="Pointages conservés tels quels ; aucune personne n'est rapprochée par son nom. L'association se fait explicitement, datée et journalisée."
        />
        {unmapped.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {unmapped.map((u) => (
              <li key={`${u.deviceId}-${u.deviceUserId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs tabular-nums text-gray-800">PIN {u.deviceUserId}</span>
                    <span className="text-gray-900">{labelOf.get(u.deviceId)}</span>
                    <span className="tabular-nums text-gray-500">· {u.count} pointage(s)</span>
                  </span>
                  {u.partly && <span className="block text-xs text-amber-700">En partie hors période d&apos;association</span>}
                  <span className="block text-xs tabular-nums text-gray-500">
                    du {u.first ? formatGomaDateTime(u.first) : "?"} au {u.last ? formatGomaDateTime(u.last) : "?"}
                  </span>
                </span>
                {canEnroll && (
                  <Link
                    href={`/presence/appareils?deviceId=${u.deviceId}&deviceUserId=${encodeURIComponent(u.deviceUserId)}#associer`}
                    className="inline-flex min-h-9 items-center rounded-full border border-gray-200 px-3.5 text-xs font-medium text-gray-800 hover:border-gray-300 hover:bg-gray-50"
                  >
                    Associer à un compte
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
