import { Badge, Input, Select } from "@/components/ui";
import { formatGomaDateTime } from "@/lib/presence/time";
import { ActionForm } from "../action-form";
import {
  cancelCommandAction,
  deleteDeviceUserAction,
  enrollAgentAction,
  fingerprintAction,
  inventoryAction,
  removeAgentAction,
  resendEnrollmentAction,
} from "../actions";

// Enrôlement géré depuis l'application (pointeuses ADMS) : l'application
// décide qui est inscrit et sous quel PIN, la pointeuse reçoit les commandes
// à sa prochaine interrogation. L'empreinte reste capturée et stockée SUR la
// pointeuse ; l'application ne reçoit ni n'affiche aucune donnée biométrique.

const FINGERS = ["Pouce droit", "Index droit", "Majeur droit", "Annulaire droit", "Auriculaire droit", "Pouce gauche", "Index gauche", "Majeur gauche", "Annulaire gauche", "Auriculaire gauche"];

const KIND_LABEL: Record<string, string> = {
  USER_UPSERT: "Inscription",
  USER_DELETE: "Retrait",
  ENROLL_FP: "Capture d'empreinte",
  USER_QUERY: "Inventaire",
  INFO: "Informations",
};

const STATUS: Record<string, { label: string; color: "gray" | "blue" | "green" | "orange" | "red" }> = {
  PENDING: { label: "en attente", color: "blue" },
  SENT: { label: "remise, sans réponse", color: "orange" },
  OK: { label: "réussie", color: "green" },
  ERROR: { label: "échec", color: "red" },
  CANCELLED: { label: "annulée", color: "gray" },
  EXPIRED: { label: "expirée", color: "red" },
};

export function FingerSelect() {
  return (
    <Select name="finger" defaultValue="1" aria-label="Doigt">
      {FINGERS.map((f, i) => (
        <option key={f} value={i}>
          {f}
        </option>
      ))}
    </Select>
  );
}

/** Actions sur une association en cours d'une pointeuse ADMS. */
export function AdmsMappingActions({ mappingId, today }: { mappingId: string; today: string }) {
  return (
    <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
      <ActionForm action={resendEnrollmentAction.bind(null, mappingId)} submit="Renvoyer l'inscription" variant="ghost" />
      <ActionForm action={fingerprintAction.bind(null, mappingId)} submit="Capturer une empreinte" variant="ghost" className="flex items-end gap-2">
        <FingerSelect />
      </ActionForm>
      <ActionForm action={removeAgentAction.bind(null, mappingId)} submit="Retirer" variant="danger" className="grid w-full grid-cols-1 items-end gap-2 sm:w-[34rem] sm:grid-cols-4">
        <Input type="date" name="end" defaultValue={today} aria-label="Fin (exclue)" />
        <Input name="reason" placeholder="Motif" aria-label="Motif" />
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input type="checkbox" name="deleteFromDevice" defaultChecked /> retirer de la pointeuse
        </label>
      </ActionForm>
    </div>
  );
}

type Command = { id: string; seq: number; kind: string; pin: string | null; status: string; returnCode: number | null; createdAt: Date; doneAt: Date | null };

export function AdmsEnrollment({
  deviceId,
  accounts,
  inscribedUserIds,
  activePins,
  inventory,
  inventoryAt,
  commands,
  today,
}: {
  deviceId: string;
  accounts: { id: string; name: string }[];
  inscribedUserIds: string[];
  activePins: string[];
  inventory: { pin: string; privilege: number }[] | null;
  inventoryAt: Date | null;
  commands: Command[];
  today: string;
}) {
  const candidates = accounts.filter((a) => !inscribedUserIds.includes(a.id));
  const known = new Set(activePins);
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-3">
      <div>
        <h3 className="text-xs font-semibold uppercase text-gray-500">Inscrire un agent sur cette pointeuse</h3>
        <p className="mb-2 text-xs text-gray-500">
          PIN attribué automatiquement (ou saisi). La pointeuse reçoit l&apos;inscription en 1 à 2 minutes ; l&apos;empreinte se capture ensuite sur l&apos;appareil, l&apos;agent
          devant la pointeuse. Seuls les agents inscrits ici voient leurs pointages comptés.
        </p>
        <ActionForm action={enrollAgentAction.bind(null, deviceId)} submit="Inscrire" className="grid grid-cols-1 gap-2 sm:grid-cols-6 sm:items-end">
          <Select name="userId" required defaultValue="" aria-label="Agent" className="sm:col-span-2">
            <option value="">— Agent —</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input name="pin" placeholder="PIN (auto)" aria-label="PIN" />
          <label className="text-xs text-gray-600">
            À partir du
            <Input type="date" name="from" defaultValue={today} required className="mt-1" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input type="checkbox" name="capture" defaultChecked /> capturer l&apos;empreinte
          </label>
          <FingerSelect />
        </ActionForm>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Utilisateurs présents sur la pointeuse</h3>
          <ActionForm action={inventoryAction.bind(null, deviceId)} submit="Demander l'inventaire" variant="secondary" />
        </div>
        {!inventory ? (
          <p className="text-xs text-gray-500">Aucun inventaire reçu.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {inventory.length} utilisateur(s) le {inventoryAt ? formatGomaDateTime(inventoryAt) : "?"} — PIN et privilège seulement.
              {inventory.length > 0 && !inventory.some((u) => u.privilege > 0) && (
                <span className="font-medium text-red-700"> Aucun administrateur : le menu de la pointeuse est accessible à tous.</span>
              )}
            </p>
            <ul className="mt-1 divide-y divide-gray-100 text-sm">
              {inventory.map((u) => (
                <li key={u.pin} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <span>
                    <span className="font-mono">{u.pin}</span>{" "}
                    {u.privilege > 0 && <Badge color="orange">administrateur de l&apos;appareil</Badge>}{" "}
                    {known.has(u.pin) ? <Badge color="green">associé</Badge> : <Badge color="red">non associé — pointages non comptés</Badge>}
                  </span>
                  {!known.has(u.pin) && u.privilege === 0 && <ActionForm action={deleteDeviceUserAction.bind(null, deviceId, u.pin)} submit="Retirer de la pointeuse" variant="danger" />}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-gray-500">Dernières commandes envoyées</h3>
        {commands.length === 0 ? (
          <p className="text-xs text-gray-500">Aucune.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-xs">
            {commands.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span>
                  n° {c.seq} · {KIND_LABEL[c.kind] ?? c.kind}
                  {c.pin ? ` · PIN ${c.pin}` : ""} · <Badge color={STATUS[c.status]?.color ?? "gray"}>{STATUS[c.status]?.label ?? c.status}</Badge>
                  {c.returnCode !== null && c.returnCode < 0 && <span className="text-red-700"> (code {c.returnCode})</span>}
                  <span className="text-gray-400"> — {formatGomaDateTime(c.createdAt)}</span>
                </span>
                {c.status === "PENDING" && <ActionForm action={cancelCommandAction.bind(null, c.id)} submit="Annuler" variant="ghost" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
