"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inspectionSchema, reportSchema } from "@/lib/validations";
import { assertRole } from "@/lib/permissions";
import { FICHE_DEFINITIONS, type FicheType } from "@/lib/fiches";

export type ActionState = {
  errors?: Record<string, string>;
  formError?: string;
};

export async function createInspectionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["CHEF_POOL", "INSPECTEUR"]);

  const parsed = inspectionSchema.safeParse({
    schoolId: formData.get("schoolId"),
    inspectorId: session.user.role === "INSPECTEUR" ? session.user.id : formData.get("inspectorId"),
    scheduledDate: formData.get("scheduledDate"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  if (session.user.role === "INSPECTEUR") {
    const assigned = await prisma.assignment.findFirst({
      where: { schoolId: parsed.data.schoolId, inspectorId: session.user.id, active: true },
    });
    if (!assigned) {
      return { formError: "Vous n'êtes pas assigné à cette école." };
    }
  }

  const inspection = await prisma.inspection.create({
    data: {
      schoolId: parsed.data.schoolId,
      inspectorId: parsed.data.inspectorId,
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null,
    },
  });

  revalidatePath("/inspections");
  redirect(`/inspections/${inspection.id}`);
}

export async function saveFicheAction(
  inspectionId: string,
  type: FicheType,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["INSPECTEUR", "CHEF_POOL"]);

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) return;
  if (session.user.role === "INSPECTEUR" && inspection.inspectorId !== session.user.id) {
    throw new Error("Action non autorisée.");
  }

  const def = FICHE_DEFINITIONS[type];
  const data: Record<string, string> = {};
  for (const field of def.fields) {
    data[field.name] = String(formData.get(field.name) ?? "");
  }

  await prisma.form.upsert({
    where: { inspectionId_type: { inspectionId, type } },
    update: { data, completed: true },
    create: { inspectionId, type, data, completed: true },
  });

  if (inspection.status === "PLANIFIEE") {
    await prisma.inspection.update({ where: { id: inspectionId }, data: { status: "EN_COURS" } });
  }

  revalidatePath(`/inspections/${inspectionId}`);
}

export async function submitReportAction(
  inspectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["INSPECTEUR"]);

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.inspectorId !== session.user.id) {
    return { formError: "Action non autorisée." };
  }

  const parsed = reportSchema.safeParse({
    summary: formData.get("summary"),
    recommendations: formData.get("recommendations"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await prisma.report.upsert({
    where: { inspectionId },
    update: {
      summary: parsed.data.summary,
      recommendations: parsed.data.recommendations || null,
      status: "SOUMIS",
      submittedAt: new Date(),
    },
    create: {
      inspectionId,
      summary: parsed.data.summary,
      recommendations: parsed.data.recommendations || null,
      status: "SOUMIS",
      submittedAt: new Date(),
    },
  });

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: "RAPPORT_SOUMIS", completedAt: new Date() },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath("/rapports");
  redirect(`/inspections/${inspectionId}`);
}
