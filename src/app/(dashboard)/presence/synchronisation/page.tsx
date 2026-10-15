import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
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

  return (
    <div className="space-y-4">
      <PageHeader title="État de synchronisation" description="Contacts des pointeuses et pointages reçus. Une synchronisation incertaine ne vaut jamais absence." />
      <PresenceRefresher initialCursor={cursor} />
      <Card className="border-amber-200 bg-amber-50 text-xs text-amber-900">
        <p>{PENDING_RULES.SYNC.message}</p>
        <p className="mt-1">Seuil d&apos;alerte de décalage d&apos;horloge : non décidé — le décalage est affiché tel quel, sans classement.</p>
      </Card>

      {devices.length === 0 ? (
        <EmptyState message="Aucune pointeuse enregistrée. Les appareils s'ajoutent dans « Appareils et associations » après vérification du matériel acheté." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Appareil</th>
                <th className="px-4 py-3">État</th>
                <th className="px-4 py-3">Dernier contact</th>
                <th className="px-4 py-3">Dernier pointage reçu</th>
                <th className="px-4 py-3">Décalage d&apos;horloge</th>
                <th className="px-4 py-3">Pointages / lots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{d.label}</span> {d.isSimulator && <SimulatedBadge />}
                    <span className="block text-xs text-gray-500">{[d.siteLabel, d.vendor, d.model].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS[d.status].color}>{STATUS[d.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{when(d.lastContactAt)}</td>
                  <td className="px-4 py-3 text-xs">{when(d.lastEventReceivedAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    {d.lastClockOffsetSec === null ? "Non mesuré" : `${d.lastClockOffsetSec > 0 ? "+" : ""}${d.lastClockOffsetSec} s`}
                    {d.lastClockCheckAt && <span className="block text-gray-400">le {formatGomaDateTime(d.lastClockCheckAt)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d._count.punches} / {d._count.batches}
                    {d.protocol === "ADMS" && typeof (d.admsInfo as { attLogs?: unknown } | null)?.attLogs === "number" && (
                      <span className="block text-gray-400">en mémoire sur l&apos;appareil : {(d.admsInfo as { attLogs: number }).attLogs}</span>
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
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Signalements des pointeuses ({alerts.length})</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun signalement ouvert.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Badge color={a.kind === "TABLE_NON_ATTENDUE" || a.kind === "LIGNES_ILLISIBLES" ? "orange" : "red"}>{ALERT_LABEL[a.kind] ?? a.kind}</Badge>
                    <span className="ml-2 text-xs text-gray-600">
                      {a.deviceId ? labelOf.get(a.deviceId) ?? "appareil" : `série ${a.serialNumber ?? "?"}`} · {a.count} fois · dernière le {formatGomaDateTime(a.lastSeenAt)}
                    </span>
                    {a.detail && <code className="mt-1 block break-all text-xs text-gray-500">{JSON.stringify(a.detail)}</code>}
                  </span>
                  <ActionForm action={resolveAlertAction.bind(null, a.id)} submit="Marquer traité" variant="ghost" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Identifiants de pointage non associés ({unmapped.length})</h2>
        <p className="mb-3 text-xs text-gray-500">
          Pointages conservés tels quels ; aucune personne n&apos;est rapprochée par son nom. L&apos;association se fait explicitement, datée et journalisée.
        </p>
        {unmapped.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {unmapped.map((u) => (
              <li key={`${u.deviceId}-${u.deviceUserId}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-mono">{u.deviceUserId}</span> — {labelOf.get(u.deviceId)} · {u.count} pointage(s)
                  {u.partly && <span className="text-xs text-amber-700"> (en partie hors période d&apos;association)</span>}
                  <span className="block text-xs text-gray-500">
                    du {u.first ? formatGomaDateTime(u.first) : "?"} au {u.last ? formatGomaDateTime(u.last) : "?"}
                  </span>
                </span>
                {canEnroll && (
                  <Link
                    href={`/presence/appareils?deviceId=${u.deviceId}&deviceUserId=${encodeURIComponent(u.deviceUserId)}#associer`}
                    className="text-xs font-medium text-blue-700 underline"
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
