"use server";

// Saisie des fiches de l'inspection itinérante, une fiche = un rapport qui
// suit son propre circuit (décision Q3, docs/inventaire-fiches-inspection.md § 10).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notify, notifyUsersWithPermission } from "@/lib/notifications/dispatcher";
import { canWorkOnReport } from "@/lib/cells/rules";
import { loadCellActor, openIppTrack, secretariatHolders, trackInfo } from "@/lib/cells/server";
import { ForbiddenError, demoRefusal, hasPermission, loadUserAccess, requireOfficialActorUnlessDemoTarget } from "@/lib/permissions";
import { PERMISSIONS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { applyTransition, getWorkflowStatusByKey, refreshInspectionStatus } from "@/lib/workflow";
import { computeFiche, visibleBlocks } from "@/lib/fiches/calculs";
import { commonHeaderFields, resolveFicheDef } from "@/lib/fiches/defs/index";
import { hasErrors, validateFiche, type Issue } from "@/lib/fiches/validation";
import {
  FORM_INCLUDE,
  ficheData,
  formAuthorId,
  formIsDemo,
  formPool,
  isFormEditable,
  nextReportNumber,
  prefillValues,
  type FormWithContext,
} from "@/lib/fiches/server";
import type { FicheData } from "@/lib/fiches/types";

export type FicheActionResult = { ok: boolean; error?: string; issues?: Issue[]; savedAt?: string };

/** Taille maximale d'une fiche enregistrée (signatures comprises). */
const MAX_PAYLOAD = 3_000_000;

const rowSchema = z.record(z.string(), z.string());
const payloadSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.array(rowSchema)])),
  signatures: z.record(
    z.string(),
    z.object({
      image: z.string().optional(),
      name: z.string(),
      place: z.string().optional(),
      date: z.string().optional(),
      refused: z.boolean().optional(),
      witnesses: z.array(z.object({ name: z.string(), image: z.string().optional() })).optional(),
      signedAt: z.string(),
    })
  ),
});

function parsePayload(raw: string): FicheData | string {
  if (raw.length > MAX_PAYLOAD) return "La fiche est trop volumineuse.";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return "Données de la fiche illisibles.";
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return "Données de la fiche invalides.";
  return { format: 2, values: parsed.data.values as FicheData["values"], signatures: parsed.data.signatures };
}

/** Retire les champs que l'auteur ne remplit pas (partie réservée au service destinataire). */
function keepReservedParts(def: NonNullable<ReturnType<typeof resolveFicheDef>>, incoming: FicheData, stored: FicheData): FicheData {
  const out: FicheData = { format: 2, values: { ...incoming.values }, signatures: { ...incoming.signatures } };
  for (const block of def.sections.flatMap((s) => s.blocks)) {
    if (block.kind === "field" && block.notForAuthor) out.values[block.id] = stored.values[block.id];
    if (block.kind === "signature" && block.notForAuthor) {
      if (stored.signatures[block.id]) out.signatures[block.id] = stored.signatures[block.id];
      else delete out.signatures[block.id];
    }
  }
  return out;
}

async function sessionUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

async function loadForm(formId: string): Promise<FormWithContext | null> {
  return prisma.form.findUnique({ where: { id: formId }, include: FORM_INCLUDE });
}

/** Fiche de l'utilisateur, encore modifiable ; sinon message de refus. */
async function ownEditableForm(formId: string, userId: string): Promise<FormWithContext | string> {
  const form = await loadForm(formId);
  if (!form) return "Fiche introuvable.";
  if (formAuthorId(form) !== userId) return "Seul l'auteur de la fiche peut la modifier.";
  if (!isFormEditable(form)) return "Cette fiche a été soumise : elle n'est plus modifiable, sauf si elle vous est renvoyée pour correction.";
  const refusal = await demoRefusal(userId, formIsDemo(form));
  if (refusal) return refusal;
  return form;
}

function revalidateForm(form: FormWithContext) {
  revalidatePath(`/fiches/${form.id}`);
  if (form.inspectionId) revalidatePath(`/inspections/${form.inspectionId}`);
  else revalidatePath("/fiches");
  revalidatePath("/rapports");
}

// ---------------------------------------------------------------------------
// Ajouter une fiche
// ---------------------------------------------------------------------------

export async function addFicheAction(formData: FormData) {
  const user = await sessionUser();
  const templateId = String(formData.get("templateId") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "") || null;

  const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.active) throw new Error("Fiche inconnue.");
  const def = resolveFicheDef(template);

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, postnom: true, prenom: true, sex: true, phone: true, email: true, isDemo: true },
  });

  let poolId: string;
  let poolName: string | null;
  let school: { name: string; director: string | null } | null = null;

  if (inspectionId) {
    if (template.scope !== "visite") throw new Error("Cette fiche ne se remplit pas lors d'une visite d'école.");
    const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId }, include: { school: { include: { pool: true } } } });
    if (!inspection) throw new Error("Inspection introuvable.");
    if (inspection.inspectorId !== user.id) throw new ForbiddenError("Seul l'inspecteur de cette visite peut y ajouter une fiche.");
    await requireOfficialActorUnlessDemoTarget(user.id, inspection.school.isDemo);
    poolId = inspection.school.poolId;
    poolName = inspection.school.pool.name;
    school = { name: inspection.school.name, director: inspection.school.director };
  } else {
    if (template.scope !== "periode") throw new Error("Cette fiche se remplit lors d'une visite d'école.");
    const scopedPoolId = user.viewMode?.poolId ?? user.poolId;
    if (!scopedPoolId) throw new ForbiddenError("Aucun POOL n'est rattaché à votre compte.");
    const { permissions } = await loadUserAccess(user.id);
    const pool = await prisma.pool.findUniqueOrThrow({ where: { id: scopedPoolId } });
    if (!hasPermission(permissions, PERMISSIONS.INSPECTIONS_CONDUCT, { poolId: pool.id, organizationId: pool.organizationId })) {
      throw new ForbiddenError("Seuls les inspecteurs remplissent les fiches de période.");
    }
    await requireOfficialActorUnlessDemoTarget(user.id, dbUser.isDemo);
    poolId = pool.id;
    poolName = pool.name;
  }

  const data = def
    ? ({ format: 2, values: prefillValues(def, { user: dbUser, poolName, school }), signatures: {} } satisfies FicheData)
    : {};
  const form = await prisma.form.create({
    data: {
      inspectionId,
      formTemplateId: template.id,
      authorId: user.id,
      poolId,
      data: data as Prisma.InputJsonValue,
      completed: false,
    },
  });

  if (inspectionId) {
    await prisma.inspection.updateMany({ where: { id: inspectionId, status: "PLANIFIEE" }, data: { status: "EN_COURS" } });
    await refreshInspectionStatus(inspectionId);
    revalidatePath(`/inspections/${inspectionId}`);
  } else {
    revalidatePath("/fiches");
  }
  redirect(`/fiches/${form.id}`);
}

// ---------------------------------------------------------------------------
// Brouillon
// ---------------------------------------------------------------------------

export async function saveFicheAction(formId: string, payload: string): Promise<FicheActionResult> {
  const user = await sessionUser();
  const form = await ownEditableForm(formId, user.id);
  if (typeof form === "string") return { ok: false, error: form };
  const def = resolveFicheDef(form.formTemplate);
  if (!def) return { ok: false, error: "Ancienne fiche : utilisez son formulaire d'origine." };

  const incoming = parsePayload(payload);
  if (typeof incoming === "string") return { ok: false, error: incoming };
  const data = keepReservedParts(def, incoming, ficheData(form));
  const issues = validateFiche(def, data);

  const updated = await prisma.form.update({
    where: { id: form.id },
    data: { data: data as unknown as Prisma.InputJsonValue, completed: !hasErrors(issues) },
  });
  revalidateForm(form);
  return { ok: true, issues, savedAt: updated.updatedAt.toISOString() };
}

/** Fiches simulées (ancien format plat) : enregistrement comme auparavant. */
export async function saveLegacyFicheAction(formId: string, formData: FormData) {
  const user = await sessionUser();
  const form = await ownEditableForm(formId, user.id);
  if (typeof form === "string") throw new ForbiddenError(form);
  const fields = Array.isArray(form.formTemplate.fieldsSchema) ? (form.formTemplate.fieldsSchema as { name: string }[]) : [];
  const data: Record<string, string> = {};
  for (const field of fields) data[field.name] = String(formData.get(field.name) ?? "");
  await prisma.form.update({ where: { id: form.id }, data: { data, completed: true } });
  revalidateForm(form);
}

// ---------------------------------------------------------------------------
// Soumission
// ---------------------------------------------------------------------------

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function submitFicheAction(formId: string, payload: string | null): Promise<FicheActionResult> {
  const user = await sessionUser();
  const form = await ownEditableForm(formId, user.id);
  if (typeof form === "string") return { ok: false, error: form };
  const pool = formPool(form);
  if (!pool) return { ok: false, error: "POOL de la fiche introuvable." };
  const def = resolveFicheDef(form.formTemplate);

  let data: Prisma.InputJsonValue = form.data as Prisma.InputJsonValue;
  let computed: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (def) {
    const incoming = payload ? parsePayload(payload) : ficheData(form);
    if (typeof incoming === "string") return { ok: false, error: incoming };
    const fiche = keepReservedParts(def, incoming, ficheData(form));
    const issues = validateFiche(def, fiche);
    if (hasErrors(issues)) {
      await prisma.form.update({ where: { id: form.id }, data: { data: fiche as unknown as Prisma.InputJsonValue, completed: false } });
      return { ok: false, issues, error: "La fiche contient des erreurs : corrigez-les avant de la soumettre." };
    }
    data = fiche as unknown as Prisma.InputJsonValue;
    computed = computeFiche(def, fiche.values) as unknown as Prisma.InputJsonValue;
  } else if (!form.completed) {
    return { ok: false, error: "Enregistrez la fiche avant de la soumettre." };
  }

  const authorId = user.id;
  const now = new Date();

  if (form.report) {
    // Resoumission après « À corriger » : même numéro, même rapport, circuit normal.
    await prisma.form.update({ where: { id: form.id }, data: { data, computed, completed: true, submittedAt: now } });
    const { permissions } = await loadUserAccess(user.id);
    try {
      await applyTransition({
        reportId: form.report.id,
        toStatusKey: WORKFLOW_STATUS_KEYS.SOUMIS,
        actorId: user.id,
        actorPermissions: permissions,
        actorPoolId: user.poolId,
        actorOrganizationId: user.organizationId,
        comment: "Fiche corrigée et resoumise.",
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Resoumission impossible." };
    }
    revalidateForm(form);
    return { ok: true };
  }

  const soumis = await getWorkflowStatusByKey(WORKFLOW_STATUS_KEYS.SOUMIS);
  const author = await prisma.user.findUniqueOrThrow({ where: { id: authorId }, select: { name: true, postnom: true, prenom: true } });
  let reportId = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      reportId = await prisma.$transaction(async (tx) => {
        const numbering = form.number
          ? {}
          : await nextReportNumber(tx, { authorId, code: form.formTemplate.code, poolCode: pool.code, author, now });
        await tx.form.update({
          where: { id: form.id },
          data: { data, computed, completed: true, submittedAt: now, authorId, poolId: pool.id, ...numbering },
        });
        const report = await tx.report.create({
          data: { formId: form.id, poolId: pool.id, authorId, statusId: soumis.id, submittedAt: now },
        });
        await tx.reportStatusHistory.create({ data: { reportId: report.id, toStatusId: soumis.id, changedById: authorId } });
        // Branche IPP, indépendante du POOL : le rapport arrive directement au secrétariat (décision D1).
        await openIppTrack(tx, { reportId: report.id, organizationId: pool.organizationId, actorId: authorId });
        return report.id;
      });
      break;
    } catch (e) {
      // Numéro universel pris par une soumission simultanée : nouvel essai.
      if (isUniqueViolation(e) && attempt < 2) continue;
      throw e;
    }
  }

  if (form.inspectionId) await refreshInspectionStatus(form.inspectionId);

  await logAudit({
    actorId: authorId,
    organizationId: pool.organizationId,
    action: "report.submit",
    entityType: "Report",
    entityId: reportId,
    newValue: { status: WORKFLOW_STATUS_KEYS.SOUMIS, code: form.formTemplate.code },
  });
  await notifyUsersWithPermission({
    permissionKey: PERMISSIONS.REPORTS_REVIEW_POOL,
    poolId: pool.id,
    organizationId: pool.organizationId,
    event: "report.submitted",
    title: `Nouvelle fiche ${form.formTemplate.code} — ${form.inspection?.school.name ?? pool.name}`,
    body: "Une fiche d'inspection a été soumise et attend d'être exploitée.",
  });
  // Secrétariat de l'IPP : un nouveau rapport à envoyer à une cellule.
  for (const userId of await secretariatHolders(pool.organizationId, formIsDemo(form))) {
    await notify({
      userId,
      event: "report.ipp_arrived",
      title: `Nouveau rapport au secrétariat — ${form.formTemplate.code} · ${form.inspection?.school.name ?? pool.name}`,
      body: "Un rapport soumis attend d'être envoyé à la cellule correspondante.",
      data: { reportId },
    });
  }

  revalidateForm(form);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Suppression d'un brouillon jamais soumis
// ---------------------------------------------------------------------------

export async function deleteDraftFicheAction(formId: string) {
  const user = await sessionUser();
  const form = await ownEditableForm(formId, user.id);
  if (typeof form === "string") throw new ForbiddenError(form);
  if (form.report || form.number) throw new ForbiddenError("Une fiche déjà soumise ne se supprime pas.");
  await prisma.form.delete({ where: { id: form.id } });
  if (form.inspectionId) {
    await refreshInspectionStatus(form.inspectionId);
    revalidatePath(`/inspections/${form.inspectionId}`);
    redirect(`/inspections/${form.inspectionId}`);
  }
  revalidatePath("/fiches");
  redirect("/fiches");
}

// ---------------------------------------------------------------------------
// Partie réservée au service destinataire (A5 « Réservé à l'administration »,
// A6 « Récépissé ») : remplie par l'exploitant qui traite le rapport.
// ---------------------------------------------------------------------------

export async function saveReservedPartAction(formId: string, payload: string): Promise<FicheActionResult> {
  const user = await sessionUser();
  const form = await loadForm(formId);
  if (!form?.report) return { ok: false, error: "Rapport introuvable." };
  const def = resolveFicheDef(form.formTemplate);
  const pool = formPool(form);
  if (!def || !pool) return { ok: false, error: "Fiche sans partie réservée." };
  // Exploitants du POOL ou de la cellule destinataire (règle centrale, droits relus en base).
  const actor = await loadCellActor(user.id);
  const scope = { poolId: pool.id, organizationId: pool.organizationId, authorId: formAuthorId(form) };
  const canTreat = canWorkOnReport(actor, scope, trackInfo(form.report.ippTrack));
  if (!canTreat || formAuthorId(form) === user.id) return { ok: false, error: "Action non autorisée." };
  const refusal = await demoRefusal(user.id, formIsDemo(form));
  if (refusal) return { ok: false, error: refusal };

  const incoming = parsePayload(payload);
  if (typeof incoming === "string") return { ok: false, error: incoming };
  const stored = ficheData(form);
  const next: FicheData = { format: 2, values: { ...stored.values }, signatures: { ...stored.signatures } };
  for (const { block } of visibleBlocks(def, stored.values)) {
    if (block.kind === "field" && block.notForAuthor) next.values[block.id] = incoming.values[block.id];
    if (block.kind === "signature" && block.notForAuthor && incoming.signatures[block.id]) next.signatures[block.id] = incoming.signatures[block.id];
  }
  // L'en-tête et le contenu de l'auteur ne bougent pas.
  for (const f of commonHeaderFields(def)) next.values[f.id] = stored.values[f.id];

  await prisma.form.update({ where: { id: form.id }, data: { data: next as unknown as Prisma.InputJsonValue } });
  await logAudit({
    actorId: user.id,
    organizationId: pool.organizationId,
    action: "report.reserved_part",
    entityType: "Report",
    entityId: form.report.id,
  });
  revalidatePath(`/rapports/${form.report.id}`);
  return { ok: true };
}
