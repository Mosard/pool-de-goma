"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inspectionSchema, reportSchema } from "@/lib/validations";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { PERMISSIONS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { getWorkflowStatusByKey } from "@/lib/workflow";
import { notifyUsersWithPermission } from "@/lib/notifications/dispatcher";

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
  const user = session.user;

  const isSelf = hasPermission(user.permissions, PERMISSIONS.INSPECTIONS_CONDUCT, { poolId: user.poolId });

  const parsed = inspectionSchema.safeParse({
    schoolId: formData.get("schoolId"),
    inspectorId: isSelf ? user.id : formData.get("inspectorId"),
    scheduledDate: formData.get("scheduledDate"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const school = await prisma.school.findUnique({ where: { id: parsed.data.schoolId } });
  if (!school) return { formError: "École introuvable." };

  if (!isSelf) {
    await requirePermission(user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, { poolId: school.poolId });
  } else {
    const assigned = await prisma.assignment.findFirst({
      where: { schoolId: parsed.data.schoolId, inspectorId: user.id, active: true },
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

export async function saveFicheAction(inspectionId: string, formTemplateId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { school: true },
  });
  if (!inspection) return;

  if (inspection.inspectorId !== session.user.id) {
    await requirePermission(session.user.id, PERMISSIONS.ASSIGNMENTS_MANAGE, { poolId: inspection.school.poolId });
  }

  const template = await prisma.formTemplate.findUnique({ where: { id: formTemplateId } });
  if (!template) return;

  const fields = Array.isArray(template.fieldsSchema) ? (template.fieldsSchema as { name: string }[]) : [];
  const data: Record<string, string> = {};
  for (const field of fields) {
    data[field.name] = String(formData.get(field.name) ?? "");
  }

  await prisma.form.upsert({
    where: { inspectionId_formTemplateId: { inspectionId, formTemplateId } },
    update: { data, completed: true },
    create: { inspectionId, formTemplateId, data, completed: true },
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

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { school: true },
  });
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

  const soumisStatus = await getWorkflowStatusByKey(WORKFLOW_STATUS_KEYS.SOUMIS);

  await prisma.report.upsert({
    where: { inspectionId },
    update: {
      summary: parsed.data.summary,
      recommendations: parsed.data.recommendations || null,
      statusId: soumisStatus.id,
      submittedAt: new Date(),
    },
    create: {
      inspectionId,
      summary: parsed.data.summary,
      recommendations: parsed.data.recommendations || null,
      statusId: soumisStatus.id,
      submittedAt: new Date(),
    },
  });

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: "RAPPORT_SOUMIS", completedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    action: "report.submit",
    entityType: "Report",
    entityId: inspectionId,
    newValue: { status: WORKFLOW_STATUS_KEYS.SOUMIS },
  });

  await notifyUsersWithPermission({
    permissionKey: PERMISSIONS.REPORTS_REVIEW_POOL,
    poolId: inspection.school.poolId,
    event: "report.submitted",
    title: `Nouveau rapport — ${inspection.school.name}`,
    body: "Un rapport d'inspection a été soumis et attend d'être exploité.",
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath("/rapports");
  redirect(`/inspections/${inspectionId}`);
}
