// Réception des pointages d'un appareil ou d'une passerelle locale (format
// canonique, src/lib/presence/ingest.ts). Authentification TECHNIQUE par jeton
// d'appareil (jamais une session utilisateur) ; route déclarée publique dans
// le middleware, le contrôle est fait ici.
//
// POST /api/presence/v1/ingest
//   Authorization: Bearer <jeton>   Idempotency-Key: <identifiant unique du lot>
//   { "sentAt"?: ISO, "events": [{ "externalEventId"?, "deviceUserId", "localTime": "AAAA-MM-JJTHH:MM:SS", "direction"?: "IN"|"OUT"|"UNKNOWN", "verifyMode"? }] }
// → 200 { batchId, accepted, duplicates, rejected[], clockSuspect, replayed, serverTime }
//   401 jeton invalide · 409 clé réutilisée, contenu différent · 413 trop d'événements · 422 format

import { authenticateDevice } from "@/lib/presence/devices";
import { IngestConflictError, MAX_EVENTS_PER_BATCH, batchSchema, ingestBatch } from "@/lib/presence/ingest";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) return json({ error: "Jeton d'appareil invalide, révoqué ou appareil désactivé." }, 401);
  const key = (request.headers.get("idempotency-key") ?? "").trim();
  if (!/^[A-Za-z0-9_.:-]{8,100}$/.test(key)) return json({ error: "En-tête Idempotency-Key requis (8 à 100 caractères)." }, 422);
  if (Number(request.headers.get("content-length") ?? 0) > 512 * 1024) return json({ error: "Lot trop volumineux." }, 413);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 422);
  }
  const events = (body as { events?: unknown[] } | null)?.events;
  if (Array.isArray(events) && events.length > MAX_EVENTS_PER_BATCH) return json({ error: `Au plus ${MAX_EVENTS_PER_BATCH} événements par lot.` }, 413);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Format de lot invalide." }, 422);
  try {
    return json(await ingestBatch(device, { idempotencyKey: key, events: parsed.data.events, source: "DEVICE" }));
  } catch (e) {
    if (e instanceof IngestConflictError) return json({ error: e.message }, 409);
    throw e;
  }
}
