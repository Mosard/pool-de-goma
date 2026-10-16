import Link from "next/link";
import { redirect } from "next/navigation";
import { Fingerprint, KeyRound, Link2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, Field, Input, Notice, PageHeader, SectionTitle, Select, SubHeading } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission } from "@/lib/presence/config";
import { holdsDeviceAdminRole, presenceSimulatorEnabled } from "@/lib/presence/devices";
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
  // Directive du 2026-10-15 : permission ET fonction réelle (Super Admin, Admin,
  // IPP principal, informaticien), revérifiées par chaque action côté serveur.
  const deviceAdmin = await holdsDeviceAdminRole(session.user.id);
  const canDevices = deviceAdmin && holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_DEVICES_MANAGE, org);
  const canEnroll = deviceAdmin && holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, org);
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
          select: { id: true, seq: true, kind: true, pin: true, status: true, returnCode: true, createdAt: true, doneAt: true, notBefore: true },
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
        <Notice tone="warning" title="Simulateur de développement disponible (base locale uniquement)">
          <Link href="/presence/simulateur" className="font-medium underline underline-offset-2">
            Ouvrir le simulateur
          </Link>
        </Notice>
      )}

      {canDevices && (
        <Card>
          <SectionTitle title="Enregistrer une pointeuse" description="Le numéro de série est obligatoire en ADMS : la pointeuse s'identifie avec lui à chaque appel." />
          <ActionForm action={createDeviceAction} submit="Enregistrer l'appareil" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <Field label="Nom" className="lg:col-span-2">
              <Input name="label" required placeholder="ex. Pointeuse entrée" />
            </Field>
            <Field label="Bureau" className="lg:col-span-2">
              <Input name="siteLabel" required placeholder="ex. Bureau de l'IPP" />
            </Field>
            <Field label="Fabricant (si connu)">
              <Input name="vendor" placeholder="ex. ZKTeco" />
            </Field>
            <Field label="Modèle exact (si connu)">
              <Input name="model" placeholder="ex. UA300" />
            </Field>
            <Field label="Numéro de série" className="lg:col-span-2">
              <Input name="serialNumber" placeholder="obligatoire en ADMS" className="font-mono" />
            </Field>
            <Field label="Mode de transmission" className="lg:col-span-2">
              <Select name="protocol" defaultValue="API">
                <option value="API">Passerelle (jeton technique)</option>
                <option value="ADMS">ADMS — la pointeuse envoie elle-même (ZKTeco)</option>
              </Select>
            </Field>
          </ActionForm>
        </Card>
      )}

      {devices.length === 0 ? (
        <EmptyState message="Aucune pointeuse enregistrée pour l'instant." />
      ) : (
        devices.map((d) => (
          <Card key={d.id} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-balance text-base font-semibold text-gray-900">{d.label}</h2>
                <p className="text-sm text-gray-500">{[d.siteLabel, d.vendor, d.model].filter(Boolean).join(" · ")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge color={STATUS_BADGE[d.status].color}>{STATUS_BADGE[d.status].label}</Badge>
                  {d.protocol === "ADMS" ? <Badge color="blue">ADMS</Badge> : <Badge color="gray">Passerelle</Badge>}
                  {d.isSimulator && <SimulatedBadge />}
                </div>
              </div>
              {canDevices && !d.isSimulator && (
                <ActionForm
                  action={toggleDeviceAction.bind(null, d.id, d.status !== "DESACTIVE")}
                  submit={d.status === "DESACTIVE" ? "Réactiver" : "Désactiver"}
                  variant={d.status === "DESACTIVE" ? "outline" : "ghost"}
                />
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
              <section className="space-y-3 rounded-xl border border-gray-200 p-4">
                <SubHeading className="flex items-center gap-1.5">
                  <KeyRound size={14} aria-hidden /> Jetons techniques (stockés hachés)
                </SubHeading>
                {d.credentials.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucun jeton.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 text-xs">
                    {d.credentials.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="font-mono text-sm text-gray-900">ppt_{c.prefix}_…</span>
                          <span className="block text-gray-500">
                            créé le {formatGomaDateTime(c.createdAt)} · {c.lastUsedAt ? `utilisé le ${formatGomaDateTime(c.lastUsedAt)}` : "jamais utilisé"}
                          </span>
                        </span>
                        {c.revokedAt ? <Badge color="gray">Révoqué</Badge> : <ActionForm action={revokeTokenAction.bind(null, c.id)} submit="Révoquer" variant="danger" />}
                      </li>
                    ))}
                  </ul>
                )}
                <ActionForm action={issueTokenAction.bind(null, d.id)} submit="Créer un jeton" variant="secondary" />
              </section>
            )}

            <section className="space-y-2">
              <SubHeading className="flex items-center gap-1.5">
                <Fingerprint size={14} aria-hidden /> Identifiants associés ({d.mappings.filter((m) => !m.validTo).length} en cours)
              </SubHeading>
              {d.mappings.length === 0 ? (
                <p className="text-xs text-gray-500">Aucune association.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
                  {d.mappings.map((m) => (
                    <li key={m.id} className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${m.validTo ? "bg-gray-50/60" : ""}`}>
                      <span className="min-w-0">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs tabular-nums text-gray-800">PIN {m.deviceUserId}</span>
                          <span className={m.validTo ? "text-gray-500" : "font-medium text-gray-900"}>{m.user.name}</span>
                          {!m.validTo && <Badge color="green">en cours</Badge>}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          depuis le {formatGomaDateTime(m.validFrom)}
                          {m.validTo ? ` jusqu'au ${formatGomaDateTime(m.validTo)} (exclu)${m.endReason ? ` — ${m.endReason}` : ""}` : ""}
                        </span>
                      </span>
                      {canEnroll && !m.validTo && d.protocol === "ADMS" && d.status !== "DESACTIVE" && <AdmsMappingActions mappingId={m.id} pin={m.deviceUserId} name={m.user.name} />}
                      {canEnroll && !m.validTo && (d.protocol !== "ADMS" || d.status === "DESACTIVE") && (
                        <ActionForm
                          action={endMappingAction.bind(null, m.id)}
                          submit="Terminer"
                          variant="outline"
                          className="grid w-full grid-cols-1 items-end gap-2 sm:w-[32rem] sm:grid-cols-3"
                        >
                          <Field label="Fin (exclue)">
                            <Input type="date" name="end" defaultValue={today} />
                          </Field>
                          <Field label="Motif">
                            <Input name="reason" />
                          </Field>
                        </ActionForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Card>
        ))
      )}

      {canEnroll && devices.length > 0 && (
        <Card id="associer" className="scroll-mt-6">
          <SectionTitle
            title={
              <span className="inline-flex items-center gap-2">
                <Link2 size={16} aria-hidden className="text-gray-500" /> Associer un identifiant de pointage à un compte
              </span>
            }
            description="L'identifiant est celui que la pointeuse attribue lors de l'enrôlement (il peut être propre à chaque appareil). Choisissez le compte explicitement : aucun rapprochement par le nom. Association datée et journalisée."
          />
          <ActionForm action={createMappingAction} submit="Associer" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Field label="Appareil">
              <Select name="deviceId" defaultValue={sp.deviceId ?? ""} required>
                <option value="">— Choisir —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} — {d.siteLabel}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Identifiant sur l'appareil">
              <Input name="deviceUserId" required defaultValue={sp.deviceUserId ?? ""} inputMode="numeric" className="font-mono" />
            </Field>
            <Field label="Compte">
              <Select name="userId" required defaultValue="">
                <option value="">— Choisir —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valable à partir du">
              <Input type="date" name="from" defaultValue={today} required />
            </Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
