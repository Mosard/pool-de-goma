// Appareils, identifiants techniques, associations d'identifiants de pointage
// et simulateur (lot 3). Droits relus en base à chaque appel :
//  - presence.devices.manage : appareils et jetons (IPP, Super Admins,
//    informaticien, secrétaires de l'IPP, IPA chargé du personnel) ;
//  - presence.enrollment.manage : associations (mêmes profils).
// Aucune capture d'empreinte par le navigateur : l'enrôlement biométrique se
// fait sur l'appareil ; l'application associe seulement l'identifiant de
// pointage (propre à l'appareil) à un compte existant, de façon datée et journalisée.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ForbiddenError, loadUserAccess, requireOfficialActorUnlessDemoTarget } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { holdsOrgPermission } from "@/lib/presence/config";
import { recomputeForMapping } from "@/lib/presence/daily";
import { gomaDayStartUtc, isDateKey } from "@/lib/presence/time";
import { forgetAdmsDevice } from "@/lib/presence/adms/handler";
import { enqueueCommand } from "@/lib/presence/adms/commands";
import {
  type DeviceUserEntry,
  USER_QUERY_COMMAND,
  cleanSn,
  enrollFingerprintCommand,
  hashPathSecret,
  isDeviceAdmin,
  userDeleteCommand,
  userUpsertCommand,
} from "@/lib/presence/adms/protocol";

type Actor = { id: string; organizationId: string };

async function requireOrgPermission(actor: Actor, key: string, message: string) {
  const { permissions } = await loadUserAccess(actor.id);
  if (!holdsOrgPermission(permissions, key, actor.organizationId)) throw new ForbiddenError(message);
}

const DEVICE_REFUSAL = "Seuls l'IPP, les Super Admins, l'informaticien, les secrétaires de l'IPP et l'IPA chargé du personnel administrent les appareils.";
const ENROLL_REFUSAL = "Seuls l'IPP, les Super Admins, l'informaticien, les secrétaires de l'IPP et l'IPA chargé du personnel associent les identifiants de pointage.";

// ─── Simulateur : développement local uniquement ───────────────────────────

/**
 * Le simulateur n'existe que si PRESENCE_SIMULATOR=1, hors de tout
 * déploiement Vercel (production ou aperçu) ET sur une base locale : ses
 * données ne peuvent jamais atteindre la base de production.
 */
export function presenceSimulatorEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.PRESENCE_SIMULATOR !== "1") return false;
  if (env.VERCEL || env.VERCEL_ENV) return false;
  const url = env.POSTGRES_URL ?? env.DATABASE_URL ?? "";
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url);
}

// ─── Jetons techniques ─────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Jeton aléatoire (256 bits) : « ppt_<préfixe>_<secret> ». */
export function generateDeviceToken(): { token: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString("hex");
  const token = `ppt_${prefix}_${randomBytes(32).toString("base64url")}`;
  return { token, prefix, hash: hashToken(token) };
}

/** Authentifie un appareil par « Authorization: Bearer <jeton> » ; null si inconnu, révoqué ou appareil désactivé. */
export async function authenticateDevice(authorization: string | null) {
  const m = /^Bearer (ppt_([0-9a-f]{8})_[A-Za-z0-9_-]{20,})$/.exec(authorization ?? "");
  if (!m) return null;
  const cred = await prisma.deviceCredential.findUnique({ where: { prefix: m[2] }, include: { device: true } });
  if (!cred || cred.revokedAt) return null;
  const a = Buffer.from(cred.tokenHash, "hex");
  const b = Buffer.from(hashToken(m[1]), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (cred.device.status === "DESACTIVE" || cred.device.isSimulator) return null;
  await prisma.deviceCredential.update({ where: { id: cred.id }, data: { lastUsedAt: new Date() } });
  return cred.device;
}

// ─── Appareils ─────────────────────────────────────────────────────────────

export async function createDevice(
  actor: Actor,
  p: { label: string; siteLabel: string; vendor?: string; model?: string; serialNumber?: string; simulator?: boolean; protocol?: "API" | "ADMS" }
) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const label = p.label.trim().slice(0, 80);
  const siteLabel = p.siteLabel.trim().slice(0, 80);
  if (label.length < 2 || siteLabel.length < 2) throw new ForbiddenError("Nom de l'appareil et bureau : au moins 2 caractères.");
  if (p.simulator && !presenceSimulatorEnabled()) throw new ForbiddenError("Simulateur indisponible dans cet environnement.");
  if (!p.simulator) await requireOfficialActorUnlessDemoTarget(actor.id, false);
  const protocol = p.simulator ? "API" : (p.protocol ?? "API");
  const serialNumber = p.serialNumber?.trim() || null;
  // ADMS : le numéro de série est l'identité annoncée par la pointeuse elle-même.
  if (protocol === "ADMS" && !cleanSn(serialNumber)) throw new ForbiddenError("Pointeuse ADMS : numéro de série exact requis (lettres et chiffres, tel qu'affiché par l'appareil).");
  if (serialNumber && (await prisma.attendanceDevice.findUnique({ where: { serialNumber }, select: { id: true } }))) {
    throw new ForbiddenError("Ce numéro de série est déjà enregistré.");
  }
  const device = await prisma.attendanceDevice.create({
    data: {
      organizationId: actor.organizationId,
      label: p.simulator ? `${label} (simulation)` : label,
      siteLabel,
      vendor: p.vendor?.trim() || null,
      model: p.model?.trim() || null,
      serialNumber,
      protocol,
      isSimulator: Boolean(p.simulator),
      createdById: actor.id,
    },
  });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.device_create",
    entityType: "AttendanceDevice",
    entityId: device.id,
    newValue: { label: device.label, siteLabel, isSimulator: device.isSimulator, protocol, serialNumber },
  });
  return device;
}

export async function setDeviceDisabled(actor: Actor, deviceId: string, disabled: boolean) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const device = await prisma.attendanceDevice.findFirst({ where: { id: deviceId, organizationId: actor.organizationId } });
  if (!device) throw new ForbiddenError("Appareil introuvable.");
  const status = disabled ? "DESACTIVE" : "NON_VERIFIE";
  if (device.status === status) return;
  await prisma.attendanceDevice.update({ where: { id: device.id }, data: { status } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: disabled ? "presence.device_disable" : "presence.device_enable",
    entityType: "AttendanceDevice",
    entityId: device.id,
    oldValue: { status: device.status },
    newValue: { status },
  });
}

/** Nouveau jeton (renouvellement : l'ancien reste valide jusqu'à sa révocation explicite). Affiché UNE fois. */
export async function issueDeviceToken(actor: Actor, deviceId: string): Promise<string> {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const device = await prisma.attendanceDevice.findFirst({ where: { id: deviceId, organizationId: actor.organizationId } });
  if (!device) throw new ForbiddenError("Appareil introuvable.");
  if (device.isSimulator) throw new ForbiddenError("L'appareil de simulation n'utilise pas de jeton.");
  await requireOfficialActorUnlessDemoTarget(actor.id, false);
  const t = generateDeviceToken();
  const cred = await prisma.deviceCredential.create({ data: { deviceId: device.id, prefix: t.prefix, tokenHash: t.hash, createdById: actor.id } });
  // Journal : préfixe seulement, jamais le jeton.
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.token_issue", entityType: "DeviceCredential", entityId: cred.id, newValue: { deviceId: device.id, prefix: t.prefix } });
  return t.token;
}

export async function revokeDeviceToken(actor: Actor, credentialId: string) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const cred = await prisma.deviceCredential.findFirst({ where: { id: credentialId, device: { organizationId: actor.organizationId } } });
  if (!cred) throw new ForbiddenError("Jeton introuvable.");
  if (cred.revokedAt) return;
  await prisma.deviceCredential.update({ where: { id: cred.id }, data: { revokedAt: new Date(), revokedById: actor.id } });
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.token_revoke", entityType: "DeviceCredential", entityId: cred.id, oldValue: { prefix: cred.prefix } });
}

// ─── Associations d'identifiants ───────────────────────────────────────────

/** Fonction pure : deux périodes [from, to) se chevauchent-elles ? */
export function periodsOverlap(a: { validFrom: Date; validTo: Date | null }, b: { validFrom: Date; validTo: Date | null }): boolean {
  const aEnd = a.validTo?.getTime() ?? Infinity;
  const bEnd = b.validTo?.getTime() ?? Infinity;
  return a.validFrom.getTime() < bEnd && b.validFrom.getTime() < aEnd;
}

export async function createMapping(actor: Actor, p: { deviceId: string; deviceUserId: string; userId: string; fromDateKey: string }) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, ENROLL_REFUSAL);
  const deviceUserId = p.deviceUserId.trim();
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(deviceUserId)) throw new ForbiddenError("Identifiant de pointage : 1 à 64 caractères (lettres, chiffres, . _ -).");
  if (!isDateKey(p.fromDateKey)) throw new ForbiddenError("Date de début invalide.");
  const [device, user] = await Promise.all([
    prisma.attendanceDevice.findFirst({ where: { id: p.deviceId, organizationId: actor.organizationId } }),
    prisma.user.findFirst({ where: { id: p.userId, organizationId: actor.organizationId }, select: { id: true, isDemo: true, status: true } }),
  ]);
  if (!device) throw new ForbiddenError("Appareil introuvable.");
  if (!user) throw new ForbiddenError("Compte introuvable.");
  if (!device.isSimulator) await requireOfficialActorUnlessDemoTarget(actor.id, user.isDemo);
  const validFrom = gomaDayStartUtc(p.fromDateKey);
  const candidate = { validFrom, validTo: null };
  const existing = await prisma.deviceUserMapping.findMany({ where: { deviceId: device.id, deviceUserId } });
  if (existing.some((m) => periodsOverlap(m, candidate))) {
    throw new ForbiddenError("Cet identifiant est déjà associé à un compte sur cette période : terminez d'abord l'association en cours.");
  }
  const mapping = await prisma.deviceUserMapping.create({ data: { deviceId: device.id, deviceUserId, userId: user.id, validFrom, createdById: actor.id } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.mapping_create",
    entityType: "DeviceUserMapping",
    entityId: mapping.id,
    newValue: { deviceId: device.id, deviceUserId, userId: user.id, validFrom: p.fromDateKey },
  });
  await recomputeForMapping(actor.organizationId, { ...mapping });
  return mapping;
}

export async function endMapping(actor: Actor, p: { mappingId: string; endDateKey: string; reason: string }) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, ENROLL_REFUSAL);
  if (!isDateKey(p.endDateKey)) throw new ForbiddenError("Date de fin invalide.");
  const mapping = await prisma.deviceUserMapping.findFirst({ where: { id: p.mappingId, device: { organizationId: actor.organizationId } } });
  if (!mapping) throw new ForbiddenError("Association introuvable.");
  if (mapping.validTo) throw new ForbiddenError("Association déjà terminée.");
  // Fin exclue : l'association cesse au début du jour choisi.
  const validTo = gomaDayStartUtc(p.endDateKey);
  if (validTo.getTime() <= mapping.validFrom.getTime()) throw new ForbiddenError("La fin doit être postérieure au début.");
  const reason = p.reason.trim().slice(0, 200) || null;
  await prisma.deviceUserMapping.update({ where: { id: mapping.id }, data: { validTo, endedById: actor.id, endReason: reason } });
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.mapping_end",
    entityType: "DeviceUserMapping",
    entityId: mapping.id,
    oldValue: { validTo: null },
    newValue: { validTo: p.endDateKey, ...(reason ? { reason } : {}) },
  });
  await recomputeForMapping(actor.organizationId, { ...mapping, validTo });
}

// ─── Pointeuses ADMS : appairage, chemin secret, vérification, signalements ─

export const ADMS_PAIRING_MINUTES = 15;

async function loadAdmsDevice(actor: Actor, deviceId: string) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const device = await prisma.attendanceDevice.findFirst({ where: { id: deviceId, organizationId: actor.organizationId } });
  if (!device) throw new ForbiddenError("Appareil introuvable.");
  if (device.protocol !== "ADMS") throw new ForbiddenError("Action réservée aux pointeuses ADMS.");
  await requireOfficialActorUnlessDemoTarget(actor.id, false);
  return device;
}

/**
 * Ouvre une fenêtre d'appairage de 15 minutes : le premier contact de la
 * pointeuse (numéro de série enregistré) fixera son empreinte. Un nouvel
 * appairage remplace l'empreinte précédente (changement de carte réseau,
 * mise à jour du micrologiciel…).
 */
export async function openAdmsPairing(actor: Actor, deviceId: string) {
  const device = await loadAdmsDevice(actor, deviceId);
  const until = new Date(Date.now() + ADMS_PAIRING_MINUTES * 60_000);
  await prisma.attendanceDevice.update({ where: { id: device.id }, data: { admsPairingUntil: until, admsPairedAt: null } });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.adms_pairing_open",
    entityType: "AttendanceDevice",
    entityId: device.id,
    oldValue: { pairedAt: device.admsPairedAt, pushVersion: device.admsPushVersion, userAgent: device.admsUserAgent, publicIp: device.admsPublicIp },
    newValue: { until: until.toISOString() },
  });
  return until;
}

/** Chemin secret « /p/<secret>/iclock » : affiché UNE fois, stocké haché ; l'ancien cesse aussitôt. */
export async function issueAdmsPathSecret(actor: Actor, deviceId: string): Promise<string> {
  const device = await loadAdmsDevice(actor, deviceId);
  const secret = randomBytes(24).toString("base64url");
  await prisma.attendanceDevice.update({ where: { id: device.id }, data: { admsPathSecretHash: hashPathSecret(secret) } });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_secret_issue", entityType: "AttendanceDevice", entityId: device.id });
  return secret;
}

export async function clearAdmsPathSecret(actor: Actor, deviceId: string) {
  const device = await loadAdmsDevice(actor, deviceId);
  if (!device.admsPathSecretHash) return;
  await prisma.attendanceDevice.update({ where: { id: device.id }, data: { admsPathSecretHash: null } });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_secret_clear", entityType: "AttendanceDevice", entityId: device.id });
}

/** Validation humaine après le pilote : « Vérifié » (ou retour à « Non vérifié »). */
export async function setDeviceVerified(actor: Actor, deviceId: string, verified: boolean) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const device = await prisma.attendanceDevice.findFirst({ where: { id: deviceId, organizationId: actor.organizationId } });
  if (!device) throw new ForbiddenError("Appareil introuvable.");
  if (device.isSimulator) throw new ForbiddenError("L'appareil de simulation ne peut pas être vérifié.");
  if (device.status === "DESACTIVE") throw new ForbiddenError("Réactivez d'abord l'appareil.");
  if (verified && device.protocol === "ADMS" && !device.admsPairedAt) throw new ForbiddenError("Appairez d'abord la pointeuse.");
  await requireOfficialActorUnlessDemoTarget(actor.id, false);
  const status = verified ? "VERIFIE" : "NON_VERIFIE";
  if (device.status === status) return;
  await prisma.attendanceDevice.update({ where: { id: device.id }, data: { status } });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: verified ? "presence.device_verify" : "presence.device_unverify",
    entityType: "AttendanceDevice",
    entityId: device.id,
    oldValue: { status: device.status },
    newValue: { status },
  });
}

/** Signalement traité (il se rouvre s'il se reproduit). Numéros de série inconnus : visibles par toute l'organisation. */
export async function resolveDeviceAlert(actor: Actor, alertId: string) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_DEVICES_MANAGE, DEVICE_REFUSAL);
  const alert = await prisma.attendanceDeviceAlert.findFirst({ where: { id: alertId, OR: [{ organizationId: actor.organizationId }, { organizationId: null }] } });
  if (!alert) throw new ForbiddenError("Signalement introuvable.");
  if (alert.resolvedAt) return;
  await prisma.attendanceDeviceAlert.update({ where: { id: alert.id }, data: { resolvedAt: new Date(), resolvedById: actor.id } });
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.alert_resolve", entityType: "AttendanceDeviceAlert", entityId: alert.id, newValue: { kind: alert.kind } });
}

// ─── Pointeuses ADMS : enrôlement géré depuis l'application ────────────────
// L'application décide QUI est inscrit sur la pointeuse et sous quel PIN :
// association datée (createMapping) + commande d'inscription envoyée à
// l'appareil. L'empreinte est capturée SUR la pointeuse (commande de capture
// ou menu de l'appareil) et n'est jamais transmise à l'application.

/** Fonction pure : PIN numérique libre (au-dessus du plus grand utilisé), au moins 1. */
export function nextFreePin(used: string[]): string {
  const nums = used.filter((p) => /^\d{1,9}$/.test(p)).map(Number);
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

async function loadEnrollDevice(actor: Actor, deviceId: string) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, ENROLL_REFUSAL);
  const device = await prisma.attendanceDevice.findFirst({ where: { id: deviceId, organizationId: actor.organizationId } });
  if (!device) throw new ForbiddenError("Appareil introuvable.");
  if (device.protocol !== "ADMS") throw new ForbiddenError("Gestion à distance réservée aux pointeuses ADMS.");
  if (device.status === "DESACTIVE") throw new ForbiddenError("Appareil désactivé.");
  await requireOfficialActorUnlessDemoTarget(actor.id, false);
  return device;
}

function inventoryOf(device: { admsUsers: unknown }): DeviceUserEntry[] {
  return Array.isArray(device.admsUsers) ? (device.admsUsers as DeviceUserEntry[]) : [];
}

/**
 * Inscrit un agent sur une pointeuse : PIN choisi ou attribué, association
 * datée, commande d'inscription (utilisateur ordinaire) et, si demandé,
 * capture d'empreinte sur l'appareil.
 */
export async function enrollAgentOnDevice(
  actor: Actor,
  p: { deviceId: string; userId: string; pin?: string; fromDateKey: string; captureFingerprint?: boolean; fingerIndex?: number }
) {
  const device = await loadEnrollDevice(actor, p.deviceId);
  const user = await prisma.user.findFirst({ where: { id: p.userId, organizationId: actor.organizationId }, select: { id: true, name: true, status: true } });
  if (!user) throw new ForbiddenError("Compte introuvable.");
  if (user.status !== "ACTIVE") throw new ForbiddenError("Seul un compte actif peut être inscrit sur une pointeuse.");
  const mappings = await prisma.deviceUserMapping.findMany({ where: { deviceId: device.id }, select: { deviceUserId: true, userId: true, validTo: true } });
  if (mappings.some((m) => m.userId === user.id && m.validTo === null)) throw new ForbiddenError("Cet agent est déjà inscrit sur cette pointeuse.");
  const inventory = inventoryOf(device);
  // PIN déjà présents sur l'appareil : associés, inventoriés, ou ayant pointé.
  const punched = await prisma.rawPunch.findMany({ where: { deviceId: device.id }, distinct: ["deviceUserId"], select: { deviceUserId: true } });
  const onDevice = new Set([...inventory.map((u) => u.pin), ...punched.map((x) => x.deviceUserId)]);
  const pin = p.pin?.trim() || nextFreePin([...mappings.map((m) => m.deviceUserId), ...onDevice]);
  // Un PIN administrateur de l'appareil ne doit jamais être réécrit en utilisateur ordinaire.
  if (inventory.some((u) => u.pin === pin && isDeviceAdmin(u.privilege))) throw new ForbiddenError("Ce PIN est un administrateur de la pointeuse : choisissez-en un autre.");
  // Un PIN déjà utilisé sur l'appareil par une personne non associée : jamais réattribué
  // (ses pointages futurs seraient comptés pour un autre agent).
  if (onDevice.has(pin) && !mappings.some((m) => m.deviceUserId === pin)) {
    throw new ForbiddenError("Ce PIN est déjà utilisé sur la pointeuse par une personne non associée : associez-la, retirez-la, ou choisissez un autre PIN.");
  }
  const mapping = await createMapping(actor, { deviceId: device.id, deviceUserId: pin, userId: user.id, fromDateKey: p.fromDateKey });
  await enqueueCommand({ deviceId: device.id, kind: "USER_UPSERT", command: userUpsertCommand(pin, user.name), pin, userId: user.id, createdById: actor.id });
  if (p.captureFingerprint) {
    await enqueueCommand({ deviceId: device.id, kind: "ENROLL_FP", command: enrollFingerprintCommand(pin, p.fingerIndex ?? 0), pin, userId: user.id, createdById: actor.id });
  }
  forgetAdmsDevice(device.serialNumber);
  await logAudit({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: "presence.adms_enroll",
    entityType: "DeviceUserMapping",
    entityId: mapping.id,
    newValue: { deviceId: device.id, pin, userId: user.id, captureFingerprint: Boolean(p.captureFingerprint) },
  });
  return { mapping, pin };
}

async function loadActiveAdmsMapping(actor: Actor, mappingId: string) {
  const mapping = await prisma.deviceUserMapping.findFirst({
    where: { id: mappingId, device: { organizationId: actor.organizationId } },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!mapping) throw new ForbiddenError("Association introuvable.");
  const device = await loadEnrollDevice(actor, mapping.deviceId);
  if (mapping.validTo) throw new ForbiddenError("Association terminée.");
  return { mapping, device };
}

/** Renvoie l'inscription (nom, PIN) à la pointeuse, par exemple après une réinitialisation de l'appareil. */
export async function resendEnrollment(actor: Actor, mappingId: string) {
  const { mapping, device } = await loadActiveAdmsMapping(actor, mappingId);
  await enqueueCommand({ deviceId: device.id, kind: "USER_UPSERT", command: userUpsertCommand(mapping.deviceUserId, mapping.user.name), pin: mapping.deviceUserId, userId: mapping.userId, createdById: actor.id });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_resend", entityType: "DeviceUserMapping", entityId: mapping.id, newValue: { pin: mapping.deviceUserId } });
}

/** Lance la capture d'une empreinte sur la pointeuse (l'agent doit être devant l'appareil). */
export async function requestFingerprintCapture(actor: Actor, mappingId: string, fingerIndex = 0) {
  const { mapping, device } = await loadActiveAdmsMapping(actor, mappingId);
  await enqueueCommand({ deviceId: device.id, kind: "ENROLL_FP", command: enrollFingerprintCommand(mapping.deviceUserId, fingerIndex), pin: mapping.deviceUserId, userId: mapping.userId, createdById: actor.id });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_fp_request", entityType: "DeviceUserMapping", entityId: mapping.id, newValue: { pin: mapping.deviceUserId, fingerIndex } });
  return { pin: mapping.deviceUserId, name: mapping.user.name };
}

/**
 * Retire un agent : fin d'association datée et, par défaut, suppression de
 * l'utilisateur sur la pointeuse (il ne peut plus pointer). Les pointages
 * passés restent conservés et attribués selon l'association.
 */
export async function removeAgentFromDevice(actor: Actor, p: { mappingId: string; endDateKey: string; reason: string; deleteFromDevice: boolean }) {
  const { mapping, device } = await loadActiveAdmsMapping(actor, p.mappingId);
  await endMapping(actor, { mappingId: mapping.id, endDateKey: p.endDateKey, reason: p.reason });
  if (p.deleteFromDevice) {
    await enqueueCommand({ deviceId: device.id, kind: "USER_DELETE", command: userDeleteCommand(mapping.deviceUserId), pin: mapping.deviceUserId, userId: mapping.userId, createdById: actor.id });
    forgetAdmsDevice(device.serialNumber);
  }
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_remove", entityType: "DeviceUserMapping", entityId: mapping.id, newValue: { pin: mapping.deviceUserId, deleteFromDevice: p.deleteFromDevice } });
}

/** Demande à la pointeuse la liste de ses utilisateurs (PIN et privilège seulement). */
export async function requestDeviceInventory(actor: Actor, deviceId: string) {
  const device = await loadEnrollDevice(actor, deviceId);
  await enqueueCommand({ deviceId: device.id, kind: "USER_QUERY", command: USER_QUERY_COMMAND, createdById: actor.id });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_inventory_request", entityType: "AttendanceDevice", entityId: device.id });
}

/**
 * Supprime de la pointeuse un utilisateur SANS association en cours (pointages
 * non autorisés). Un administrateur de l'appareil n'est jamais supprimé à
 * distance (risque de verrouiller le menu) : à faire sur l'appareil.
 */
export async function deleteUnmappedDeviceUser(actor: Actor, deviceId: string, pin: string) {
  const device = await loadEnrollDevice(actor, deviceId);
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(pin)) throw new ForbiddenError("PIN invalide.");
  const active = await prisma.deviceUserMapping.findFirst({ where: { deviceId: device.id, deviceUserId: pin, validTo: null } });
  if (active) throw new ForbiddenError("Ce PIN est associé à un agent : terminez d'abord l'association.");
  if (inventoryOf(device).some((u) => u.pin === pin && isDeviceAdmin(u.privilege))) {
    throw new ForbiddenError("Administrateur de la pointeuse : à retirer sur l'appareil lui-même.");
  }
  await enqueueCommand({ deviceId: device.id, kind: "USER_DELETE", command: userDeleteCommand(pin), pin, createdById: actor.id });
  forgetAdmsDevice(device.serialNumber);
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_delete_unmapped", entityType: "AttendanceDevice", entityId: device.id, newValue: { pin } });
}

/** Annule une commande pas encore remise à la pointeuse. */
export async function cancelDeviceCommand(actor: Actor, commandId: string) {
  await requireOrgPermission(actor, PERMISSIONS.PRESENCE_ENROLLMENT_MANAGE, ENROLL_REFUSAL);
  const cmd = await prisma.deviceCommand.findFirst({ where: { id: commandId, device: { organizationId: actor.organizationId } } });
  if (!cmd) throw new ForbiddenError("Commande introuvable.");
  if (cmd.status !== "PENDING") throw new ForbiddenError("Commande déjà remise à la pointeuse : elle ne peut plus être annulée.");
  await prisma.deviceCommand.update({ where: { id: cmd.id }, data: { status: "CANCELLED", doneAt: new Date() } });
  await logAudit({ actorId: actor.id, organizationId: actor.organizationId, action: "presence.adms_command_cancel", entityType: "DeviceCommand", entityId: cmd.id, newValue: { kind: cmd.kind, pin: cmd.pin } });
}
