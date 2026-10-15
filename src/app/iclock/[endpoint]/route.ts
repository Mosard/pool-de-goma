// Réception ADMS directe des pointeuses ZKTeco (/iclock/cdata, /iclock/getrequest,
// /iclock/devicecmd). Hors middleware (exclu du matcher) : aucune session,
// contrôles faits dans src/lib/presence/adms/handler.ts.

import { handleAdms } from "@/lib/presence/adms/handler";
import { admsEndpoint } from "@/lib/presence/adms/protocol";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ endpoint: string }> };

async function handle(request: Request, { params }: Ctx) {
  const { endpoint } = await params;
  return handleAdms(request, admsEndpoint(endpoint), null);
}

export const GET = handle;
export const POST = handle;
