// Fiche individuelle du personnel : accès serveur. Chaque appel relit les
// droits en base (loadUserAccess, « Voir comme » compris), refuse hors
// périmètre (ForbiddenError ou fiche introuvable) et journalise sans recopier
// aucune valeur : rubrique, noms des champs, entrée ajoutée ou retirée.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess } from "@/lib/permissions";
import { ALL_GROUPS, REPEAT_FIELDS, findFieldsGroup, type FieldDef, type UserColumn } from "./defs";
import {
  changedKeys,
  civilDateToDb,
  completeness,
  fileAccess,
  parseField,
  parseFieldsGroup,
  userColumnsToGroupValues,
  type FileAccess,
  type GroupData,
  type GroupValues,
  type StoredValue,
} from "./rules";

export class FileConflictError extends Error {
  constructor() {
    super("Cette rubrique a été modifiée entre-temps par une autre personne. Rechargez la page pour voir sa version avant de la modifier.");
  }
}

export type FileContext = { actorId: string; organizationId: string; targetId: string; access: FileAccess };

const TARGET_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  photoUrl: true,
  postnom: true,
  prenom: true,
  sex: true,
  dateNaissance: true,
  phone: true,
  matricule: true,
  nombreEnfants: true,
} as const;

/** Droits relus en base ; null = fiche introuvable pour ce compte (même réponse qu'une fiche inexistante). */
export async function resolveFileContext(actorId: string, targetId: string): Promise<FileContext | null> {
  if (typeof targetId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(targetId)) return null;
  const [actor, target, access] = await Promise.all([
    prisma.user.findUnique({ where: { id: actorId }, select: { id: true, organizationId: true, isDemo: true, status: true } }),
    prisma.user.findUnique({ where: { id: targetId }, select: { id: true, organizationId: true, isDemo: true } }),
    loadUserAccess(actorId),
  ]);
  if (!actor || actor.status !== "ACTIVE" || access.awaitingCell || !target) return null;
  const a = fileAccess({ ...actor, permissions: access.permissions }, target);
  return a ? { actorId: actor.id, organizationId: actor.organizationId, targetId: target.id, access: a } : null;
}

async function requireEdit(actorId: string, targetId: string): Promise<FileContext> {
  const ctx = await resolveFileContext(actorId, targetId);
  if (!ctx) throw new ForbiddenError("Fiche introuvable.");
  if (!ctx.access.edit) throw new ForbiddenError("Vous ne pouvez pas modifier cette fiche.");
  return ctx;
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export type FileView = Awaited<ReturnType<typeof loadFileView>>;

/** Fiche complète prête à afficher ; `ctx` provient de resolveFileContext (droits déjà vérifiés). */
export async function loadFileView(ctx: FileContext, opts: { audit?: "view" | "pdf" } = {}) {
  const [user, file] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.targetId }, select: TARGET_SELECT }),
    prisma.personnelFile.findUnique({
      where: { userId: ctx.targetId },
      include: {
        sections: true,
        promotions: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        diplomas: { orderBy: [{ level: "asc" }, { year: "desc" }, { createdAt: "asc" }] },
        children: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      },
    }),
  ]);
  const values: GroupValues = {};
  const versions: Record<string, number> = {};
  const observations: Record<string, string | null> = {};
  for (const s of file?.sections ?? []) {
    values[s.key] = (s.data ?? {}) as GroupData;
    versions[s.key] = s.version;
    observations[s.key] = s.observation;
  }
  // Champs du compte : une seule valeur, celle de User.
  for (const g of ALL_GROUPS) {
    if (g.kind !== "fields") continue;
    const fromUser = userColumnsToGroupValues(g, user);
    if (Object.keys(fromUser).length) values[g.key] = { ...(values[g.key] ?? {}), ...fromUser };
  }
  const counts = { promotions: file?.promotions.length ?? 0, diplomas: file?.diplomas.length ?? 0, children: file?.children.length ?? 0 };
  if (opts.audit) {
    await logAudit({
      actorId: ctx.actorId,
      organizationId: ctx.organizationId,
      action: opts.audit === "pdf" ? "personnel.file.pdf" : "personnel.file.view",
      entityType: "PersonnelFile",
      entityId: ctx.targetId,
      metadata: { self: ctx.access.self },
    });
  }
  return {
    user: { id: user.id, name: user.name, email: user.email, status: user.status, photoUrl: user.photoUrl },
    values,
    versions,
    observations,
    promotions: file?.promotions ?? [],
    diplomas: file?.diplomas ?? [],
    children: file?.children ?? [],
    completeness: completeness(values, counts),
    updatedAt: file?.updatedAt ?? null,
  };
}

// ─── Rubriques à valeurs uniques ─────────────────────────────────────────────

async function ensureFile(tx: Prisma.TransactionClient, ctx: FileContext) {
  return tx.personnelFile.upsert({
    where: { userId: ctx.targetId },
    create: { userId: ctx.targetId, organizationId: ctx.organizationId, updatedById: ctx.actorId },
    update: { updatedById: ctx.actorId },
    select: { id: true },
  });
}

export type SaveResult = { ok: true; changed: number } | { ok: false; errors: Record<string, string> };

/**
 * Enregistre une rubrique entière. `expectedVersion` (0 si jamais enregistrée)
 * refuse d'écraser une modification faite entre-temps (FileConflictError).
 */
export async function saveGroup(actorId: string, targetId: string, groupKey: string, expectedVersion: number, input: Record<string, unknown>): Promise<SaveResult> {
  const group = findFieldsGroup(groupKey);
  if (!group) throw new ForbiddenError("Rubrique inconnue.");
  const ctx = await requireEdit(actorId, targetId);
  const parsed = parseFieldsGroup(group, input);
  if (!parsed.ok) return parsed;
  const userCols = Object.keys(parsed.user) as UserColumn[];

  const changed = await prisma.$transaction(async (tx) => {
    const file = await ensureFile(tx, ctx);
    const current = await tx.personnelFileSection.findUnique({ where: { fileId_key: { fileId: file.id, key: groupKey } } });
    if ((current?.version ?? 0) !== expectedVersion) throw new FileConflictError();
    const beforeUser = userCols.length
      ? ((await tx.user.findUniqueOrThrow({ where: { id: ctx.targetId }, select: Object.fromEntries(userCols.map((c) => [c, true])) })) as Record<string, unknown>)
      : {};
    const fields = [...changedKeys((current?.data ?? {}) as Record<string, unknown>, parsed.data), ...changedKeys(beforeUser, parsed.user as Record<string, unknown>)];
    const data = parsed.data as Prisma.InputJsonValue;
    if (current) {
      await tx.personnelFileSection.update({ where: { id: current.id }, data: { data, version: { increment: 1 }, updatedById: ctx.actorId } });
    } else {
      await tx.personnelFileSection.create({ data: { fileId: file.id, key: groupKey, data, updatedById: ctx.actorId } });
    }
    if (userCols.length) await tx.user.update({ where: { id: ctx.targetId }, data: parsed.user });
    return fields;
  });

  await logAudit({
    actorId: ctx.actorId,
    organizationId: ctx.organizationId,
    action: "personnel.file.update",
    entityType: "PersonnelFile",
    entityId: ctx.targetId,
    metadata: { group: groupKey, fields: changed, self: ctx.access.self },
  });
  return { ok: true, changed: changed.length };
}

/** Colonne « OBS. » d'une rubrique : gestionnaires du personnel, sur la fiche d'un autre agent. */
export async function saveObservation(actorId: string, targetId: string, groupKey: string, text: string): Promise<void> {
  if (!ALL_GROUPS.some((g) => g.key === groupKey)) throw new ForbiddenError("Rubrique inconnue.");
  const ctx = await requireEdit(actorId, targetId);
  if (!ctx.access.observe) throw new ForbiddenError("Les observations sont réservées aux gestionnaires du personnel.");
  const value = text.trim().slice(0, 2000) || null;
  await prisma.$transaction(async (tx) => {
    const file = await ensureFile(tx, ctx);
    await tx.personnelFileSection.upsert({
      where: { fileId_key: { fileId: file.id, key: groupKey } },
      create: { fileId: file.id, key: groupKey, observation: value, updatedById: ctx.actorId },
      update: { observation: value, updatedById: ctx.actorId },
    });
  });
  await logAudit({
    actorId: ctx.actorId,
    organizationId: ctx.organizationId,
    action: "personnel.file.observation",
    entityType: "PersonnelFile",
    entityId: ctx.targetId,
    metadata: { group: groupKey, cleared: value === null },
  });
}

// ─── Entrées répétables (promotions, diplômes, enfants) ──────────────────────

export type RepeatKind = keyof typeof REPEAT_FIELDS;
export const REPEAT_KINDS = Object.keys(REPEAT_FIELDS) as RepeatKind[];

function toColumnValue(f: FieldDef, v: StoredValue | null): unknown {
  if (v === null) return null;
  if (f.kind === "date") return civilDateToDb(v as string);
  return v;
}

type EntryParse = { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

export function parseEntry(kind: RepeatKind, input: Record<string, unknown>): EntryParse {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of REPEAT_FIELDS[kind]) {
    const r = parseField(f, input[f.key]);
    if (!r.ok) errors[f.key] = r.error;
    else data[f.key] = toColumnValue(f, r.value);
  }
  if (kind === "diplomas" && !data.level) errors.level = "Choisir le niveau.";
  else if (Object.values(data).every((v) => v === null)) errors._form = "Renseignez au moins un champ.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

const GROUP_OF: Record<RepeatKind, string> = { promotions: "promotions", diplomas: "diplomes", children: "enfants" };

async function writeEntry(tx: Prisma.TransactionClient, kind: RepeatKind, fileId: string, entryId: string | null, data: Record<string, unknown>): Promise<string | null> {
  const where = { id: entryId ?? "-", fileId };
  if (kind === "promotions") {
    if (entryId) return (await tx.personnelPromotion.updateMany({ where, data: data as Prisma.PersonnelPromotionUpdateManyMutationInput })).count ? entryId : null;
    const max = await tx.personnelPromotion.aggregate({ where: { fileId }, _max: { position: true } });
    return (await tx.personnelPromotion.create({ data: { ...(data as object), fileId, position: (max._max.position ?? 0) + 1 } })).id;
  }
  if (kind === "children") {
    if (entryId) return (await tx.personnelChild.updateMany({ where, data: data as Prisma.PersonnelChildUpdateManyMutationInput })).count ? entryId : null;
    const max = await tx.personnelChild.aggregate({ where: { fileId }, _max: { position: true } });
    return (await tx.personnelChild.create({ data: { ...(data as object), fileId, position: (max._max.position ?? 0) + 1 } })).id;
  }
  if (entryId) return (await tx.personnelDiploma.updateMany({ where, data: data as Prisma.PersonnelDiplomaUpdateManyMutationInput })).count ? entryId : null;
  return (await tx.personnelDiploma.create({ data: { ...(data as Omit<Prisma.PersonnelDiplomaUncheckedCreateInput, "fileId">), fileId } })).id;
}

/** Ajoute (entryId null) ou modifie une entrée ; l'entrée doit appartenir à la fiche visée. */
export async function saveEntry(actorId: string, targetId: string, kind: RepeatKind, entryId: string | null, input: Record<string, unknown>): Promise<SaveResult> {
  if (!REPEAT_KINDS.includes(kind)) throw new ForbiddenError("Rubrique inconnue.");
  const ctx = await requireEdit(actorId, targetId);
  const parsed = parseEntry(kind, input);
  if (!parsed.ok) return parsed;
  const id = await prisma.$transaction(async (tx) => {
    const file = await ensureFile(tx, ctx);
    return writeEntry(tx, kind, file.id, entryId, parsed.data);
  });
  if (!id) throw new ForbiddenError("Entrée introuvable.");
  await logAudit({
    actorId: ctx.actorId,
    organizationId: ctx.organizationId,
    action: entryId ? "personnel.file.entry.update" : "personnel.file.entry.add",
    entityType: "PersonnelFile",
    entityId: ctx.targetId,
    metadata: { group: GROUP_OF[kind], entryId: id, self: ctx.access.self },
  });
  return { ok: true, changed: 1 };
}

export async function deleteEntry(actorId: string, targetId: string, kind: RepeatKind, entryId: string): Promise<void> {
  if (!REPEAT_KINDS.includes(kind)) throw new ForbiddenError("Rubrique inconnue.");
  const ctx = await requireEdit(actorId, targetId);
  const file = await prisma.personnelFile.findUnique({ where: { userId: ctx.targetId }, select: { id: true } });
  const where = { id: entryId, fileId: file?.id ?? "-" };
  const r =
    kind === "promotions"
      ? await prisma.personnelPromotion.deleteMany({ where })
      : kind === "children"
        ? await prisma.personnelChild.deleteMany({ where })
        : await prisma.personnelDiploma.deleteMany({ where });
  if (r.count === 0) throw new ForbiddenError("Entrée introuvable.");
  await logAudit({
    actorId: ctx.actorId,
    organizationId: ctx.organizationId,
    action: "personnel.file.entry.remove",
    entityType: "PersonnelFile",
    entityId: ctx.targetId,
    metadata: { group: GROUP_OF[kind], entryId, self: ctx.access.self },
  });
}
