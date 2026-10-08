"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { revalidatePublicPools } from "@/lib/public-pools";
import { MAX_IMPORT_BYTES } from "@/lib/schools-import/columns";
import { importSchools, type SchoolImportReport } from "@/lib/schools-import/server";
import { ImportFileError } from "@/lib/schools-import/workbook";

export type SchoolImportState = { formError?: string; report?: SchoolImportReport };

export async function importSchoolsAction(_prev: SchoolImportState, formData: FormData): Promise<SchoolImportState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const poolId = formData.get("poolId");
  const file = formData.get("file");
  if (typeof poolId !== "string" || !poolId) return { formError: "Choisissez le POOL dans lequel importer." };
  if (!(file instanceof File) || file.size === 0) return { formError: "Choisissez le fichier Excel rempli." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { formError: "Le fichier doit être au format Excel .xlsx (le canevas)." };
  if (file.size > MAX_IMPORT_BYTES) return { formError: "Fichier trop volumineux (4 Mo au plus) : découpez-le en plusieurs fichiers." };

  try {
    // Le droit sur le POOL choisi est revérifié en base dans importSchools.
    const report = await importSchools({
      actorId: session.user.id,
      poolId,
      fileName: file.name,
      data: await file.arrayBuffer(),
    });
    if (report.created.length + report.updated.length > 0) {
      revalidatePath("/ecoles");
      revalidatePublicPools();
    }
    return { report };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ImportFileError) return { formError: e.message };
    throw e;
  }
}
