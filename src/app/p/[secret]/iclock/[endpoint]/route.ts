// Variante à chemin secret propre à l'appareil : /p/<secret>/iclock/... Le
// secret n'est exigé que s'il a été défini pour l'appareil (stocké haché).

import { handleAdms } from "@/lib/presence/adms/handler";
import { admsEndpoint } from "@/lib/presence/adms/protocol";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ secret: string; endpoint: string }> };

async function handle(request: Request, { params }: Ctx) {
  const { secret, endpoint } = await params;
  return handleAdms(request, admsEndpoint(endpoint), secret);
}

export const GET = handle;
export const POST = handle;
