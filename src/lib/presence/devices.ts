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
import { cleanSn, hashPathSecret } from "@/lib/presence/adms/protocol";

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
