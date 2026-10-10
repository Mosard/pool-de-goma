// Contact périodique d'un appareil : heure de l'appareil comparée à celle du
// serveur (décalage brut ; aucun seuil d'alerte n'est décidé, Q-SYNC-1).
// POST { "deviceTime"?: "AAAA-MM-JJTHH:MM:SS" (heure de Goma) } → { serverTime, clockOffsetSec }

import { authenticateDevice } from "@/lib/presence/devices";
import { recordHeartbeat } from "@/lib/presence/ingest";

export async function POST(request: Request) {
  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) return Response.json({ error: "Jeton d'appareil invalide, révoqué ou appareil désactivé." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { deviceTime?: unknown } | null;
  const deviceTime = typeof body?.deviceTime === "string" ? body.deviceTime.slice(0, 25) : null;
  return Response.json(await recordHeartbeat(device, deviceTime), { headers: { "cache-control": "no-store" } });
}
