// PDF de la fiche d'un agent : profils habilités seulement (contrôle serveur, 404 sinon).

import { personnelFilePdfResponse } from "@/lib/personnel-file/pdf-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return personnelFilePdfResponse(id);
}
