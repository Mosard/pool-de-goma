import { Badge } from "@/components/ui";
import { ADMS_PAIRING_MINUTES } from "@/lib/presence/devices";
import { formatGomaDateTime } from "@/lib/presence/time";
import { ActionForm } from "../action-form";
import { clearPathSecretAction, issuePathSecretAction, openPairingAction, verifyDeviceAction } from "../actions";

type Info = { firmware?: string | null; users?: number | null; fingerprints?: number | null; attLogs?: number | null; localIp?: string | null };

// Pointeuse ADMS (ZKTeco) : elle appelle elle-même https://<domaine>/iclock/…
// Appairage par fenêtre de 15 minutes, chemin secret facultatif, validation
// humaine « Vérifié » après le pilote. Aucune donnée biométrique n'est reçue :
// seuls les NOMBRES annoncés par l'appareil (utilisateurs, empreintes) s'affichent.
export function AdmsPanel({
  device: d,
  canManage,
  now,
}: {
  device: {
    id: string;
    status: "NON_VERIFIE" | "VERIFIE" | "DESACTIVE";
    serialNumber: string | null;
    firmware: string | null;
    admsPairingUntil: Date | null;
    admsPairedAt: Date | null;
    admsPushVersion: string | null;
    admsUserAgent: string | null;
    admsLocalIp: string | null;
    admsPublicIp: string | null;
    hasPathSecret: boolean;
    admsInfo: unknown;
    admsInfoAt: Date | null;
    received: number;
  };
  canManage: boolean;
  /** Instant de référence (ms), fourni par la page. */
  now: number;
}) {
  const pairingOpen = !d.admsPairedAt && d.admsPairingUntil && d.admsPairingUntil.getTime() > now;
  const info = (d.admsInfo ?? null) as Info | null;
  return (
    <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
      <h3 className="text-xs font-semibold uppercase text-gray-500">Pointeuse ADMS</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="inline text-gray-500">N° de série : </dt>
          <dd className="inline font-mono">{d.serialNumber}</dd>
        </div>
        <div>
          <dt className="inline text-gray-500">Appairage : </dt>
          <dd className="inline">
            {d.admsPairedAt ? (
              <>appairée le {formatGomaDateTime(d.admsPairedAt)}</>
            ) : pairingOpen ? (
              <Badge color="blue">ouvert jusqu&apos;à {formatGomaDateTime(d.admsPairingUntil!)}</Badge>
            ) : (
              <Badge color="orange">non appairée — la pointeuse est refusée</Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="inline text-gray-500">Micrologiciel : </dt>
          <dd className="inline">{d.firmware ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-gray-500">Protocole / client : </dt>
          <dd className="inline">
            {d.admsPushVersion ?? "—"} · {d.admsUserAgent ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="inline text-gray-500">IP publique (appairage) / locale : </dt>
          <dd className="inline font-mono">
            {d.admsPublicIp ?? "—"} / {d.admsLocalIp ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="inline text-gray-500">Chemin secret : </dt>
          <dd className="inline">{d.hasPathSecret ? "exigé" : "non défini (adresse /iclock simple)"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline text-gray-500">Annoncé par l&apos;appareil : </dt>
          <dd className="inline">
            {info ? (
              <>
                {info.users ?? "?"} utilisateur(s), {info.fingerprints ?? "?"} empreinte(s), <strong>{info.attLogs ?? "?"} pointage(s) en mémoire</strong> — reçus
                ici : <strong>{d.received}</strong>
                {d.admsInfoAt && <span className="text-gray-400"> (le {formatGomaDateTime(d.admsInfoAt)})</span>}
              </>
            ) : (
              "pas encore de compteurs"
            )}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-gray-500">
        Réglage de la pointeuse (Communication › Serveur cloud) : adresse du serveur = ce domaine, port 443, HTTPS activé
        {d.hasPathSecret ? ", chemin secret saisi avant /iclock" : ""}. Les pointages reçus avant l&apos;appairage restent sur l&apos;appareil.
      </p>
      {canManage && d.status !== "DESACTIVE" && (
        <div className="flex flex-wrap items-start gap-3">
          <ActionForm action={openPairingAction.bind(null, d.id)} submit={d.admsPairedAt ? `Réappairer (${ADMS_PAIRING_MINUTES} min)` : `Ouvrir l'appairage (${ADMS_PAIRING_MINUTES} min)`} variant="secondary" />
          <ActionForm action={issuePathSecretAction.bind(null, d.id)} submit={d.hasPathSecret ? "Nouveau chemin secret" : "Créer un chemin secret"} variant="secondary" />
          {d.hasPathSecret && <ActionForm action={clearPathSecretAction.bind(null, d.id)} submit="Supprimer le chemin secret" variant="ghost" />}
          {d.status === "VERIFIE" ? (
            <ActionForm action={verifyDeviceAction.bind(null, d.id, false)} submit="Retirer « vérifié »" variant="ghost" />
          ) : (
            d.admsPairedAt && <ActionForm action={verifyDeviceAction.bind(null, d.id, true)} submit="Marquer vérifié (après le pilote)" variant="secondary" />
          )}
        </div>
      )}
    </div>
  );
}
