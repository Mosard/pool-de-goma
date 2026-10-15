import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission } from "@/lib/presence/config";
import { presenceSimulatorEnabled } from "@/lib/presence/devices";
import { formatGomaDateTime, gomaDateKey } from "@/lib/presence/time";
import { loadPresenceViewer } from "@/lib/presence/views";
import { ActionForm } from "../action-form";
import { SimulatedBadge } from "../presence-ui";
import { AdmsPanel } from "./adms-panel";
import { AdmsEnrollment, AdmsMappingActions } from "./adms-enrollment";
import { createDeviceAction, createMappingAction, endMappingAction, issueTokenAction, revokeTokenAction, toggleDeviceAction } from "../actions";

const STATUS_BADGE = {
  NON_VERIFIE: { label: "Non vérifié", color: "orange" },
  VERIFIE: { label: "Vérifié", color: "green" },
  DESACTIVE: { label: "Désactivé", color: "gray" },
} as const;

// Appareils et associations. Administration des appareils et des jetons :
// presence.devices.manage ; associations d'identifiants : presence.enrollment.manage.
// L'empreinte s'enregistre sur la pointeuse ; ici, seulement l'identifiant.
export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ deviceId?: string; deviceUserId?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer) redirect("/login");
  const org = viewer.organizationId;
  const canDevices = holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_DEVICES_MANAGE, org);
  const canEnroll = holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, org);
  if (!canDevices && !canEnroll) redirect("/presence/moi");
  const sp = await searchParams;
  const nowDate = new Date();
  const today = gomaDateKey(nowDate);

  const [devices, accounts] = await Promise.all([
    prisma.attendanceDevice.findMany({
      where: { organizationId: org },
      orderBy: [{ isSimulator: "asc" }, { siteLabel: "asc" }, { label: "asc" }],
      include: {
        credentials: { orderBy: { createdAt: "desc" }, select: { id: true, prefix: true, createdAt: true, revokedAt: true, lastUsedAt: true } },
        mappings: { orderBy: [{ validTo: "asc" }, { validFrom: "desc" }], include: { user: { select: { name: true } } } },
        _count: { select: { punches: true } },
        commands: {
          orderBy: { seq: "desc" },
          take: 15,
          select: { id: true, seq: true, kind: true, pin: true, status: true, returnCode: true, createdAt: true, doneAt: true },
        },
      },
    }),
    canEnroll
      ? prisma.user.findMany({ where: { organizationId: org, isDemo: viewer.isDemo, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [],
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appareils et associations"
        description="Aucune pointeuse réelle n'est présentée comme opérationnelle avant vérification sur l'appareil acheté. Aucune empreinte n'est saisie ici."
      />
      {presenceSimulatorEnabled() && canDevices && (
        <Card className="border-orange-200 bg-orange-50 text-sm text-orange-900">
          Simulateur de développement disponible (base locale uniquement) :{" "}
          <Link href="/presence/simulateur" className="font-medium underline">
            ouvrir le simulateur
          </Link>
          .
        </Card>
      )}

      {canDevices && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Enregistrer une pointeuse</h2>
          <ActionForm action={createDeviceAction} submit="Enregistrer l'appareil" className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
            <Input name="label" required placeholder="Nom (ex. Pointeuse entrée)" aria-label="Nom" className="sm:col-span-2" />
            <Input name="siteLabel" required placeholder="Bureau (ex. Bureau de l'IPP)" aria-label="Bureau" className="sm:col-span-2" />
            <Input name="vendor" placeholder="Fabricant (si connu)" aria-label="Fabricant" />
            <Input name="model" placeholder="Modèle exact (si connu)" aria-label="Modèle" />
            <Input name="serialNumber" placeholder="N° de série (obligatoire en ADMS)" aria-label="Numéro de série" className="sm:col-span-2" />
            <Select name="protocol" defaultValue="API" aria-label="Mode de transmission" className="sm:col-span-2">
              <option value="API">Passerelle (jeton technique)</option>
              <option value="ADMS">ADMS — la pointeuse envoie elle-même (ZKTeco)</option>
            </Select>
          </ActionForm>
        </Card>
      )}

      {devices.length === 0 ? (
        <EmptyState message="Aucune pointeuse enregistrée pour l'instant." />
      ) : (
        devices.map((d) => (
          <Card key={d.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {d.label} — {d.siteLabel} {d.isSimulator && <SimulatedBadge />}{" "}
                <Badge color={STATUS_BADGE[d.status].color}>{STATUS_BADGE[d.status].label}</Badge>{" "}
                {d.protocol === "ADMS" && <Badge color="blue">ADMS</Badge>}
              </h2>
              {canDevices && !d.isSimulator && (
                <ActionForm action={toggleDeviceAction.bind(null, d.id, d.status !== "DESACTIVE")} submit={d.status === "DESACTIVE" ? "Réactiver" : "Désactiver"} variant="ghost" />
              )}
            </div>

            {d.protocol === "ADMS" && (
              <AdmsPanel
                device={{
                  id: d.id,
                  status: d.status,
                  serialNumber: d.serialNumber,
                  firmware: d.firmware,
                  admsPairingUntil: d.admsPairingUntil,
                  admsPairedAt: d.admsPairedAt,
                  admsPushVersion: d.admsPushVersion,
                  admsUserAgent: d.admsUserAgent,
                  admsLocalIp: d.admsLocalIp,
                  admsPublicIp: d.admsPublicIp,
                  hasPathSecret: Boolean(d.admsPathSecretHash),
                  admsInfo: d.admsInfo,
                  admsInfoAt: d.admsInfoAt,
                  received: d._count.punches,
                }}
                canManage={canDevices}
                now={nowDate.getTime()}
              />
            )}

            {d.protocol === "ADMS" && canEnroll && d.status !== "DESACTIVE" && (
              <AdmsEnrollment
                deviceId={d.id}
                accounts={accounts}
                inscribedUserIds={d.mappings.filter((m) => !m.validTo).map((m) => m.userId)}
                activePins={d.mappings.filter((m) => !m.validTo).map((m) => m.deviceUserId)}
                inventory={Array.isArray(d.admsUsers) ? (d.admsUsers as { pin: string; privilege: number }[]) : null}
                inventoryAt={d.admsUsersAt}
                commands={d.commands}
                today={today}
              />
            )}

            {canDevices && !d.isSimulator && d.protocol !== "ADMS" && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-gray-500">Jetons techniques (stockés hachés)</h3>
                {d.credentials.length === 0 && <p className="text-xs text-gray-500">Aucun jeton.</p>}
                <ul className="space-y-1 text-xs">
                  {d.credentials.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3">
                      <span className="font-mono">ppt_{c.prefix}_…</span>
                      <span className="text-gray-500">créé le {formatGomaDateTime(c.createdAt)}</span>
                      <span className="text-gray-500">{c.lastUsedAt ? `utilisé le ${formatGomaDateTime(c.lastUsedAt)}` : "jamais utilisé"}</span>
                      {c.revokedAt ? <Badge color="gray">Révoqué</Badge> : <ActionForm action={revokeTokenAction.bind(null, c.id)} submit="Révoquer" variant="danger" />}
                    </li>
                  ))}
                </ul>
                <ActionForm action={issueTokenAction.bind(null, d.id)} submit="Créer un jeton" variant="secondary" />
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-500">Identifiants associés</h3>
              {d.mappings.length === 0 ? (
                <p className="text-xs text-gray-500">Aucune association.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {d.mappings.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-mono">{m.deviceUserId}</span> → {m.user.name}
                        <span className="block text-xs text-gray-500">
                          depuis le {formatGomaDateTime(m.validFrom)}
                          {m.validTo ? ` jusqu'au ${formatGomaDateTime(m.validTo)} (exclu)${m.endReason ? ` — ${m.endReason}` : ""}` : " — en cours"}
                        </span>
                      </span>
                      {canEnroll && !m.validTo && d.protocol === "ADMS" && d.status !== "DESACTIVE" && <AdmsMappingActions mappingId={m.id} pin={m.deviceUserId} today={today} />}
                      {canEnroll && !m.validTo && (d.protocol !== "ADMS" || d.status === "DESACTIVE") && (
                        <ActionForm action={endMappingAction.bind(null, m.id)} submit="Terminer" variant="ghost" className="grid w-full grid-cols-1 items-end gap-2 sm:w-[30rem] sm:grid-cols-3">
                          <Input type="date" name="end" defaultValue={today} aria-label="Fin (exclue)" />
                          <Input name="reason" placeholder="Motif" aria-label="Motif" />
                        </ActionForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))
      )}

      {canEnroll && devices.length > 0 && (
        <Card id="associer">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Associer un identifiant de pointage à un compte</h2>
          <p className="mb-3 text-xs text-gray-500">
            L&apos;identifiant est celui que la pointeuse attribue lors de l&apos;enrôlement (il peut être propre à chaque appareil). Choisissez le compte explicitement :
            aucun rapprochement par le nom. Association datée et journalisée.
          </p>
          <ActionForm action={createMappingAction} submit="Associer" className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
            <Select name="deviceId" defaultValue={sp.deviceId ?? ""} required aria-label="Appareil">
              <option value="">— Appareil —</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} — {d.siteLabel}
                </option>
              ))}
            </Select>
            <Input name="deviceUserId" required defaultValue={sp.deviceUserId ?? ""} placeholder="Identifiant sur l'appareil" aria-label="Identifiant sur l'appareil" />
            <Select name="userId" required defaultValue="" aria-label="Compte">
              <option value="">— Compte —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <label className="text-xs text-gray-600">
              Valable à partir du
              <Input type="date" name="from" defaultValue={today} required className="mt-1" />
            </label>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
