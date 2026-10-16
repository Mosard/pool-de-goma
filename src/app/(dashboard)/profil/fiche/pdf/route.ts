// PDF de « Ma fiche personnelle » : la fiche du compte connecté uniquement.

import { personnelFilePdfResponse } from "@/lib/personnel-file/pdf-response";

export async function GET() {
  return personnelFilePdfResponse("self");
}
