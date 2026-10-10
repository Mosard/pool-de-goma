import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission } from "@/lib/presence/config";
import { presenceSimulatorEnabled } from "@/lib/presence/devices";
import { gomaDateKey } from "@/lib/presence/time";
import { loadPresenceViewer } from "@/lib/presence/views";
import { ActionForm } from "../action-form";
import { createSimulatorDeviceAction, simulatePunchAction } from "../actions";

// Simulateur de DÉVELOPPEMENT : introuvable hors base locale avec
// PRESENCE_SIMULATOR=1 (jamais sur Vercel). Ses pointages passent par le même
// circuit que les appareils et restent marqués « Simulation » partout.
export default async function SimulatorPage() {
  if (!presenceSimulatorEnabled()) notFound();
  const session = await auth();
  if (!session?.user) redirect("/login");
  const viewer = await loadPresenceViewer(session.user.id);
  if (!viewer || !holdsOrgPermission(viewer.permissions, PERMISSIONS.PRESENCE_DEVICES_MANAGE, viewer.organizationId)) redirect("/presence/moi");
  const devices = await prisma.attendanceDevice.findMany({ where: { organizationId: viewer.organizationId, isSimulator: true }, orderBy: { label: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Simulateur de pointages" description="Développement local uniquement — données de test, jamais présentées comme réelles, indisponibles en production." />
      <Card className="border-orange-300 bg-orange-50 text-sm text-orange-900">
        SIMULATION : chaque pointage créé ici est marqué « Simulation » dans toutes les vues. Le sens (entrée / sortie) est transmis explicitement, comme le ferait un
        appareil ; le moteur n&apos;en déduit jamais aucun.
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Appareil de simulation</h2>
        <ActionForm action={createSimulatorDeviceAction} submit="Créer un appareil simulé" className="flex flex-wrap items-end gap-3">
          <Input name="label" placeholder="Pointeuse simulée" aria-label="Nom" />
          <Input name="siteLabel" placeholder="Bureau simulé" aria-label="Bureau" />
        </ActionForm>
      </Card>

      {devices.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Envoyer un lot de pointages</h2>
          <p className="mb-3 text-xs text-gray-500">
            Pour rejouer un lot (idempotence), recopiez sa clé ; pour renvoyer les mêmes pointages comme un appareil après coupure, laissez la clé vide (doublons ignorés).
          </p>
          <ActionForm action={simulatePunchAction} submit="Envoyer" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <Select name="deviceId" required aria-label="Appareil simulé">
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} — {d.siteLabel}
                </option>
              ))}
            </Select>
            <Input name="deviceUserId" required placeholder="Identifiant sur l'appareil (ex. 101)" aria-label="Identifiant" />
            <Input type="date" name="date" defaultValue={gomaDateKey(new Date())} required aria-label="Date" />
            <Input name="times" required placeholder="08:20, 16:00" aria-label="Heures" />
            <Select name="direction" defaultValue="ALTERNE" aria-label="Sens transmis">
              <option value="ALTERNE">Entrée puis sortie (sens transmis)</option>
              <option value="IN">Entrée</option>
              <option value="OUT">Sortie</option>
              <option value="UNKNOWN">Sens non transmis</option>
            </Select>
            <Input name="replayKey" placeholder="Clé d'un lot à rejouer (facultatif)" aria-label="Clé" />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
