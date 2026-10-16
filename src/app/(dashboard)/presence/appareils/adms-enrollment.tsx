import { ShieldAlert, Trash2 } from "lucide-react";
import { Badge, Field, Input, Select, SubHeading } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";
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

const checkbox = "flex min-h-[42px] items-center gap-2 text-sm font-normal text-gray-700";

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

/**
 * Actions sur une association en cours d'une pointeuse ADMS. Chaque bouton
 * porte le PIN visé : la capture d'empreinte s'adresse à un utilisateur précis
 * de l'appareil (test réel du 15/10 : capture lancée par erreur sur un autre PIN).
 */
export function AdmsMappingActions({ mappingId, pin, name }: { mappingId: string; pin: string; name: string }) {
  return (
    <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:justify-end">
      <ActionForm action={resendEnrollmentAction.bind(null, mappingId)} submit={`Renvoyer l'inscription (PIN ${pin})`} variant="outline" />
      <ActionForm action={fingerprintAction.bind(null, mappingId)} submit={`Capturer une empreinte — PIN ${pin}`} variant="outline" className="flex flex-wrap items-end gap-2">
        <FingerSelect />
      </ActionForm>
      <details className="group w-full rounded-xl border border-red-100 bg-red-50/30 sm:w-[36rem]">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 [&::-webkit-details-marker]:hidden">
          <Trash2 size={14} aria-hidden />
          Retirer {name} (PIN {pin})…
        </summary>
        <div className="border-t border-red-100 px-3 pb-3 pt-2">
          <p className="text-pretty text-xs text-gray-700">
            L&apos;association prend fin <strong>immédiatement</strong> : ses pointages suivants ne comptent plus. La suppression sur la pointeuse (utilisateur et
            empreintes) part dans 10 minutes et reste annulable jusque-là. Un nouvel enrôlement demandera la présence de l&apos;agent devant l&apos;appareil.
          </p>
          <ActionForm
            action={removeAgentAction.bind(null, mappingId)}
            submit={`Retirer ${name} (PIN ${pin})`}
            variant="danger"
            className="mt-3 grid grid-cols-1 items-end gap-2 sm:grid-cols-3"
          >
            <Field label="Motif (obligatoire)">
              <Input name="reason" required minLength={3} />
            </Field>
            <Field label={`Ressaisir le PIN ${pin}`}>
              <Input name="confirmPin" required autoComplete="off" inputMode="numeric" className="font-mono" />
            </Field>
            <label className={`${checkbox} sm:col-span-3`}>
              <input type="checkbox" name="deleteFromDevice" defaultChecked className="h-4 w-4" /> Supprimer aussi de la pointeuse
            </label>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}

type Command = {
  id: string;
  seq: number;
  kind: string;
  pin: string | null;
  status: string;
  returnCode: number | null;
  createdAt: Date;
  doneAt: Date | null;
  notBefore: Date | null;
};

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
  const noAdmin = Boolean(inventory && inventory.length > 0 && !inventory.some((u) => u.privilege > 0));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-xl border border-gray-200 p-4 xl:col-span-2">
        <SubHeading>Inscrire un agent sur cette pointeuse</SubHeading>
        <p className="mb-3 mt-1 text-pretty text-xs text-gray-500">
          PIN attribué automatiquement (ou saisi). La pointeuse reçoit l&apos;inscription en 1 à 2 minutes ; l&apos;empreinte se capture ensuite sur l&apos;appareil, l&apos;agent
          devant la pointeuse. Seuls les agents inscrits ici voient leurs pointages comptés.
        </p>
        <ActionForm action={enrollAgentAction.bind(null, deviceId)} submit="Inscrire" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <Field label="Agent" className="lg:col-span-2">
            <SearchSelect name="userId" required placeholder="Rechercher un agent…" options={candidates.map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
          <Field label="PIN (101 à 8999)">
            <Input name="pin" inputMode="numeric" placeholder="automatique" className="font-mono" />
          </Field>
          <Field label="À partir du">
            <Input type="date" name="from" defaultValue={today} required />
          </Field>
          <Field label="Doigt à capturer">
            <FingerSelect />
          </Field>
          <label className={checkbox}>
            <input type="checkbox" name="capture" defaultChecked className="h-4 w-4" /> Capturer l&apos;empreinte
          </label>
        </ActionForm>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SubHeading>Utilisateurs présents sur la pointeuse</SubHeading>
          <ActionForm action={inventoryAction.bind(null, deviceId)} submit="Demander l'inventaire" variant="outline" />
        </div>
        {!inventory ? (
          <p className="mt-2 text-xs text-gray-500">Aucun inventaire reçu.</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-gray-500">
              {inventory.length} utilisateur(s) le {inventoryAt ? formatGomaDateTime(inventoryAt) : "?"} — PIN et privilège seulement.
            </p>
            {noAdmin && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                <ShieldAlert size={14} aria-hidden className="mt-0.5 shrink-0" /> Aucun administrateur : le menu de la pointeuse est accessible à tous.
              </p>
            )}
            <ul className="mt-2 divide-y divide-gray-100 text-sm">
              {inventory.map((u) => (
                <li key={u.pin} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs tabular-nums text-gray-800">PIN {u.pin}</span>
                    {u.privilege > 0 && <Badge color="orange">administrateur de l&apos;appareil</Badge>}
                    {known.has(u.pin) ? (
                      <Badge color="green">associé</Badge>
                    ) : (
                      <>
                        <Badge color="red">non associé</Badge>
                        <span className="text-xs text-gray-500">pointages non comptés</span>
                      </>
                    )}
                  </span>
                  {!known.has(u.pin) && u.privilege === 0 && Number(u.pin) < 9000 && (
                    <ActionForm
                      action={deleteDeviceUserAction.bind(null, deviceId, u.pin)}
                      submit={`Supprimer le PIN ${u.pin}`}
                      variant="danger"
                      className="flex flex-wrap items-end gap-2"
                    >
                      <Input
                        name="confirmPin"
                        required
                        autoComplete="off"
                        inputMode="numeric"
                        placeholder={`Ressaisir ${u.pin}`}
                        aria-label={`Ressaisir le PIN ${u.pin} pour confirmer`}
                        className="w-32 font-mono"
                      />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <SubHeading>Dernières commandes envoyées</SubHeading>
        {commands.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">Aucune.</p>
        ) : (
          <ol className="mt-2 divide-y divide-gray-100 text-xs">
            {commands.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="tabular-nums text-gray-500">n° {c.seq}</span>
                    <span className="font-medium text-gray-900">{KIND_LABEL[c.kind] ?? c.kind}</span>
                    {c.pin && <span className="font-mono tabular-nums text-gray-600">PIN {c.pin}</span>}
                    <Badge color={STATUS[c.status]?.color ?? "gray"}>{STATUS[c.status]?.label ?? c.status}</Badge>
                    {c.returnCode !== null && c.returnCode < 0 && <span className="text-red-700">code {c.returnCode}</span>}
                  </span>
                  <span className="mt-0.5 block text-gray-500">
                    {formatGomaDateTime(c.createdAt)}
                    {c.status === "PENDING" && c.notBefore && <span className="font-medium text-red-700"> · envoi prévu à {formatGomaDateTime(c.notBefore)}</span>}
                  </span>
                </span>
                {c.status === "PENDING" && <ActionForm action={cancelCommandAction.bind(null, c.id)} submit="Annuler" variant="ghost" />}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
