import { Badge, SubHeading } from "@/components/ui";
import { ADMS_PAIRING_MINUTES } from "@/lib/presence/devices";
import { formatGomaDateTime } from "@/lib/presence/time";
import { ActionForm } from "../action-form";
import { clearPathSecretAction, issuePathSecretAction, openPairingAction, verifyDeviceAction } from "../actions";

type Info = { firmware?: string | null; users?: number | null; fingerprints?: number | null; attLogs?: number | null; localIp?: string | null };

function Item({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-gray-900 ${mono ? "font-mono text-[13px]" : ""}`}>{children}</dd>
    </div>
  );
}

function Counter({ label, value, strong = false }: { label: string; value: number | null | undefined; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
      <p className={`text-lg tabular-nums ${strong ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>{value ?? "?"}</p>
      <p className="text-[11px] leading-tight text-gray-500">{label}</p>
    </div>
  );
}

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
    <section className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubHeading>Pointeuse ADMS</SubHeading>
        {d.admsPairedAt ? (
          <Badge color="green">Appairée le {formatGomaDateTime(d.admsPairedAt)}</Badge>
        ) : pairingOpen ? (
          <Badge color="blue">Appairage ouvert jusqu&apos;à {formatGomaDateTime(d.admsPairingUntil!)}</Badge>
        ) : (
          <Badge color="orange">Non appairée — la pointeuse est refusée</Badge>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Item label="N° de série" mono>
          {d.serialNumber ?? "—"}
        </Item>
        <Item label="Micrologiciel">{d.firmware ?? "—"}</Item>
        <Item label="Chemin secret">{d.hasPathSecret ? "Exigé" : "Non défini (adresse /iclock simple)"}</Item>
        <Item label="Protocole / client">
          {d.admsPushVersion ?? "—"} · {d.admsUserAgent ?? "—"}
        </Item>
        <Item label="IP publique (appairage) / locale" mono>
          {d.admsPublicIp ?? "—"} / {d.admsLocalIp ?? "—"}
        </Item>
      </dl>

      <div>
        <p className="mb-2 text-xs text-gray-500">
          Annoncé par l&apos;appareil
          {d.admsInfoAt ? <> le {formatGomaDateTime(d.admsInfoAt)}</> : null}
          {info ? "" : " : pas encore de compteurs"}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Counter label="utilisateurs" value={info?.users} />
          <Counter label="empreintes" value={info?.fingerprints} />
          <Counter label="pointages en mémoire" value={info?.attLogs} strong />
          <Counter label="pointages reçus ici" value={d.received} strong />
        </div>
      </div>

      <p className="text-pretty text-xs text-gray-600">
        Réglage de la pointeuse (Communication › Serveur cloud) : adresse du serveur = ce domaine, port 443, HTTPS activé
        {d.hasPathSecret ? ", chemin secret saisi avant /iclock" : ""}. Les pointages reçus avant l&apos;appairage restent sur l&apos;appareil.
      </p>

      {canManage && d.status !== "DESACTIVE" && (
        <div className="flex flex-wrap items-start gap-2 border-t border-blue-100 pt-4">
          <ActionForm
            action={openPairingAction.bind(null, d.id)}
            submit={d.admsPairedAt ? `Réappairer (${ADMS_PAIRING_MINUTES} min)` : `Ouvrir l'appairage (${ADMS_PAIRING_MINUTES} min)`}
            variant="secondary"
          />
          <ActionForm action={issuePathSecretAction.bind(null, d.id)} submit={d.hasPathSecret ? "Nouveau chemin secret" : "Créer un chemin secret"} variant="outline" />
          {d.hasPathSecret && <ActionForm action={clearPathSecretAction.bind(null, d.id)} submit="Supprimer le chemin secret" variant="ghost" />}
          {d.status === "VERIFIE" ? (
            <ActionForm action={verifyDeviceAction.bind(null, d.id, false)} submit="Retirer « vérifié »" variant="ghost" />
          ) : (
            d.admsPairedAt && <ActionForm action={verifyDeviceAction.bind(null, d.id, true)} submit="Marquer vérifié (après le pilote)" variant="outline" />
          )}
        </div>
      )}
    </section>
  );
}
