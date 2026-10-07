import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  isDemoActor,
  requireOfficialActorUnlessDemoTarget,
  requireAuthorityOverAccount,
  requirePermission,
  requireRoleGrant,
} from "@/lib/permissions";
import { PERMISSIONS, RESTRICTED_ROLE_KEYS, ROLE_KEYS } from "@/lib/rbac-data";
import { logAudit } from "@/lib/audit";
import { emailChannel } from "@/lib/notifications/channels/email";
import {
  ACTIVATION_TTL_HOURS,
  ASSISTED_RESET_TTL_HOURS,
  activationUrl,
  generateToken,
  hashToken,
  normalizeUsername,
  passwordResetUrl,
  unusablePasswordHash,
} from "@/lib/activation-token";

// ---------------------------------------------------------------------------
// Cycle de vie des comptes : approbation d'une demande, création directe,
// lien d'activation, définition du mot de passe par le titulaire.
//
// Règle : aucun mot de passe n'est jamais choisi, vu ni transmis par un
// administrateur.
// - Parcours ordinaire : le demandeur choisit son identifiant et son mot de
//   passe dans sa demande (seule l'empreinte bcrypt est stockée). Aucun compte
//   n'existe tant que la demande n'est pas validée ; à la validation, le
//   compte est créé ACTIF et la personne se connecte directement.
// - Compte créé par un administrateur (ou demande antérieure sans mot de
//   passe) : compte « PENDING » au mot de passe inutilisable, activé par son
//   titulaire via un lien à usage unique (ACTIVATION_TTL_HOURS heures).
//
// Isolation de la démo : un compte de démonstration ne traite que des comptes
// de démonstration (adresse en .test). Tout le contrôle est fait ici, côté
// serveur, quelle que soit l'interface.
// ---------------------------------------------------------------------------

/** Refus métier dont le message peut être montré tel quel à l'utilisateur. */
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

export const DEMO_ACCOUNT_REFUSAL =
  "Action refusée : vous êtes connecté avec un compte de démonstration. Il ne peut traiter que des comptes de démonstration (adresse en .test). Une demande ou un compte réel doit être traité depuis un compte officiel de l'IPP ou de l'informaticien.";

/** Message affichable pour un refus attendu ; relance toute autre erreur. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AccountError || error instanceof ForbiddenError) return error.message;
  throw error;
}

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(".test");
}

// Identifiants qui feraient passer une demande pour un compte institutionnel.
// Réservés au formulaire public ; un administrateur peut les attribuer.
const RESERVED_USERNAMES = new Set([
  "admin", "administrateur", "administration", "root", "support", "system", "systeme",
  "ipp", "ipp-nk1", "ippnk1", "informaticien", "inspection", "inspecteur", "officiel", "inuka",
]);

/** Identifiant déjà porté par un compte, ou réservé par une demande en attente. */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const u = normalizeUsername(username);
  const [user, request] = await Promise.all([
    prisma.user.findUnique({ where: { username: u }, select: { id: true } }),
    prisma.accountRequest.findFirst({ where: { username: u, status: "PENDING" }, select: { id: true } }),
  ]);
  return Boolean(user || request);
}

async function suggestUsername(base: string): Promise<string | null> {
  const stem = base.replace(/[^a-z0-9._-]/g, "").slice(0, 28) || "agent";
  for (let i = 0; i < 20; i++) {
    const candidate = `${stem}${Math.floor(10 + Math.random() * 990)}`;
    if (!RESERVED_USERNAMES.has(candidate) && !(await isUsernameTaken(candidate))) return candidate;
  }
  return null;
}

function usernameTakenMessage(username: string, suggestion: string | null) {
  return `L'identifiant « ${username} » est déjà pris. Choisissez-en un autre${suggestion ? ` (par exemple « ${suggestion} »)` : ""}.`;
}

function isUniqueViolation(e: unknown, field: string): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002" &&
    JSON.stringify(e.meta?.target ?? "").includes(field)
  );
}

/**
 * Demande publique : le demandeur choisit son identifiant et son mot de passe.
 * Rien n'est accordé — ni compte, ni fonction — tant qu'un administrateur n'a
 * pas validé. La fonction et le POOL demandés ne sont qu'indicatifs.
 */
export async function submitAccountRequest(params: {
  organizationId: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  phone: string | null;
  requestedRoleId: string | null;
  poolId: string | null;
  message: string | null;
}): Promise<{ requestId: string }> {
  const email = params.email.trim().toLowerCase();
  const username = normalizeUsername(params.username);

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AccountError("Un compte existe déjà avec cet e-mail. Utilisez « Mot de passe oublié » si vous avez perdu l'accès.");
  }
  if (await prisma.accountRequest.findFirst({ where: { email, status: "PENDING" }, select: { id: true } })) {
    throw new AccountError("Une demande est déjà en attente pour cet e-mail. Elle sera examinée par l'informaticien de l'Inspection.");
  }
  if (RESERVED_USERNAMES.has(username)) {
    throw new AccountError(`L'identifiant « ${username} » est réservé. Choisissez-en un autre.`);
  }
  if (await isUsernameTaken(username)) {
    throw new AccountError(usernameTakenMessage(username, await suggestUsername(username)));
  }

  const [role, pool] = await Promise.all([
    params.requestedRoleId ? prisma.roleDefinition.findUnique({ where: { id: params.requestedRoleId } }) : null,
    params.poolId ? prisma.pool.findUnique({ where: { id: params.poolId } }) : null,
  ]);
  if (params.requestedRoleId && (!role || RESTRICTED_ROLE_KEYS.includes(role.key))) throw new AccountError("Fonction inconnue.");
  if (params.poolId && (!pool || !pool.active || pool.organizationId !== params.organizationId)) {
    throw new AccountError("POOL inconnu.");
  }

  const request = await prisma.accountRequest.create({
    data: {
      name: params.name.trim(),
      email,
      username,
      passwordHash: params.passwordHash,
      phone: params.phone,
      requestedRoleId: role?.id ?? null,
      organizationId: params.organizationId,
      poolId: pool?.id ?? null,
      message: params.message,
    },
  });
  return { requestId: request.id };
}

/**
 * Connexion par identifiant (jamais de « @ ») ou par e-mail (comptes
 * antérieurs à l'identifiant). Seul un compte ACTIF se connecte : une demande
 * en attente ou refusée n'a pas de compte.
 */
export async function verifyCredentials(identifier: string, password: string) {
  const id = identifier.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: id.includes("@") ? { email: id } : { username: id } });
  if (!user || user.status !== "ACTIVE") return null;
  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}

/**
 * Connexion refusée : si l'identifiant et le mot de passe correspondent à une
 * demande EN ATTENTE, on peut le dire à son auteur (lui seul connaît ce mot
 * de passe). Aucun renseignement sinon.
 */
export async function hasPendingRequestFor(identifier: string, password: string): Promise<boolean> {
  const id = identifier.trim().toLowerCase();
  const requests = await prisma.accountRequest.findMany({
    where: { status: "PENDING", passwordHash: { not: null }, OR: [{ username: id }, { email: id }] },
    select: { passwordHash: true },
    take: 3,
  });
  for (const r of requests) {
    if (await bcrypt.compare(password, r.passwordHash!)) return true;
  }
  return false;
}

async function requireOfficialForRealAccount(actorId: string, targetIsDemo: boolean) {
  try {
    await requireOfficialActorUnlessDemoTarget(actorId, targetIsDemo);
  } catch (e) {
    if (e instanceof ForbiddenError) throw new AccountError(DEMO_ACCOUNT_REFUSAL);
    throw e;
  }
}

/**
 * Fonction et rattachement choisis par l'administrateur, revérifiés en base.
 * La fonction de chef de POOL ne s'attribue que par nomination (un seul chef
 * par POOL, inspecteur du POOL) : jamais à la création d'un compte.
 */
async function resolveRoleAndPool(actorId: string, roleId: string, poolId: string | null, organizationId: string) {
  const role = roleId ? await prisma.roleDefinition.findUnique({ where: { id: roleId } }) : null;
  if (!role) throw new AccountError("Choisissez une fonction valide pour ce compte.");
  if (RESTRICTED_ROLE_KEYS.includes(role.key)) {
    throw new AccountError(`La fonction « ${role.label} » ne s'attribue pas depuis l'application.`);
  }
  if (role.key === ROLE_KEYS.CHEF_POOL) {
    throw new AccountError("Créez le compte comme inspecteur, puis nommez-le chef depuis la fiche du POOL.");
  }
  let pool = null;
  if (poolId) {
    pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool || pool.organizationId !== organizationId || !pool.active) {
      throw new AccountError("POOL introuvable ou inactif.");
    }
  }
  if (role.scope === "POOL" && !pool) {
    throw new AccountError(`La fonction « ${role.label} » exige un rattachement à un POOL.`);
  }
  // Qui peut donner cette fonction (ROLE_GRANTORS).
  await requireRoleGrant(actorId, {
    roleKey: role.key,
    poolId: role.scope === "POOL" ? pool!.id : null,
    organizationId,
  });
  return { role, pool };
}

export type ActivationLink = { url: string; expiresAt: Date };

/**
 * Émet un nouveau lien d'activation (les liens précédents non utilisés sont
 * révoqués). Seule l'empreinte du jeton est conservée en base.
 */
export async function issueActivationLink(userId: string, baseUrl: string): Promise<ActivationLink> {
  const { rawToken, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
  ]);
  return { url: activationUrl(baseUrl, rawToken), expiresAt };
}

/**
 * Tente l'envoi du lien au titulaire. Tant qu'aucun fournisseur e-mail n'est
 * branché, renvoie false : le lien est alors remis à l'administrateur, qui
 * le transmet au seul titulaire (ce n'est pas un mot de passe : il expire,
 * ne sert qu'une fois et laisse le titulaire choisir son mot de passe).
 */
async function deliverActivationLink(userId: string, email: string, link: ActivationLink): Promise<boolean> {
  if (!emailChannel.isConfigured()) return false;
  const result = await emailChannel.send(`activation-${userId}`, {
    userId,
    event: "account.activation",
    title: "Activez votre compte — IPP Nord-Kivu 1",
    body: `Votre compte (${email}) a été créé. Définissez votre mot de passe avec ce lien, valable ${ACTIVATION_TTL_HOURS} h et utilisable une seule fois : ${link.url}`,
  });
  return result.ok;
}

export type AccountCreationResult = {
  userId: string;
  email: string;
  username: string | null;
  isDemo: boolean;
  /** Vrai si le compte est actif d'emblée (mot de passe choisi dans la demande). */
  activated: boolean;
  /** Nommé chef du POOL lors de la validation. */
  chief?: boolean;
  emailed: boolean;
  /** Présent seulement si le lien n'a pas pu être envoyé directement au titulaire. */
  activation?: ActivationLink;
};

async function finishCreation(
  user: { id: string; email: string; username: string | null; isDemo: boolean },
  baseUrl: string
): Promise<AccountCreationResult> {
  const link = await issueActivationLink(user.id, baseUrl);
  const emailed = await deliverActivationLink(user.id, user.email, link);
  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    isDemo: user.isDemo,
    activated: false,
    emailed,
    activation: emailed ? undefined : link,
  };
}

export async function approveAccountRequest(params: {
  actorId: string;
  organizationId: string;
  requestId: string;
  roleId: string;
  poolId: string | null;
  baseUrl: string;
  /** Demande « chef de pool » : valider comme inspecteur du POOL ET nommer chef. */
  designateChief?: boolean;
}): Promise<AccountCreationResult> {
  await requirePermission(params.actorId, PERMISSIONS.ACCOUNTS_MANAGE);

  const request = await prisma.accountRequest.findUnique({ where: { id: params.requestId } });
  if (!request || request.organizationId !== params.organizationId) {
    throw new AccountError("Demande introuvable.");
  }
  if (request.status !== "PENDING") throw new AccountError("Cette demande a déjà été traitée.");

  // Seules les demandes de test (adresse en .test) peuvent être traitées par
  // un compte de démonstration ; le compte créé est alors lui-même de démo.
  const email = request.email.toLowerCase();
  const isDemo = isDemoEmail(email);
  await requireOfficialForRealAccount(params.actorId, isDemo);

  const { role, pool } = await resolveRoleAndPool(params.actorId, params.roleId, params.poolId, params.organizationId);

  // Chef de POOL (décision de l'Inspection) : un inspecteur du POOL nommé à
  // cette fonction, un seul chef à la fois. On ne remplace jamais un chef
  // existant depuis cet écran : cela se fait, en connaissance de cause, depuis
  // la fiche du POOL.
  let chiefRoleId: string | null = null;
  if (params.designateChief) {
    if (role.key !== ROLE_KEYS.INSPECTEUR || !pool) {
      throw new AccountError("Pour nommer un chef, validez la demande comme « Inspecteur itinérant » d'un POOL.");
    }
    try {
      await requirePermission(params.actorId, PERMISSIONS.USERS_MANAGE);
      await requireRoleGrant(params.actorId, { roleKey: ROLE_KEYS.CHEF_POOL, poolId: pool.id, organizationId: params.organizationId });
    } catch (e) {
      if (e instanceof ForbiddenError) throw new AccountError("Nommer un chef de POOL est réservé à l'IPP, à l'informaticien et au Super Admin.");
      throw e;
    }
    const chiefRole = await prisma.roleDefinition.findUnique({ where: { key: ROLE_KEYS.CHEF_POOL } });
    if (!chiefRole) throw new AccountError("La fonction « Chef de pool » n'existe pas dans le référentiel.");
    // Seuls les chefs du même type comptent : un chef de démonstration n'est
    // jamais publié et n'empêche pas de nommer le chef officiel.
    const current = await prisma.userRole.findFirst({
      where: { poolId: pool.id, roleId: chiefRole.id, user: { isDemo } },
      select: { user: { select: { name: true } } },
    });
    if (current) {
      throw new AccountError(
        `Le POOL ${pool.name} a déjà un chef (${current.user.name}). Validez la demande sans « Nommer chef », puis changez le chef depuis la fiche du POOL si nécessaire.`
      );
    }
    chiefRoleId = chiefRole.id;
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AccountError("Un compte existe déjà avec cette adresse e-mail : refusez la demande ou traitez le compte existant.");
  }
  const takenMessage = request.username
    ? `L'identifiant « ${request.username} » est désormais porté par un autre compte : refusez cette demande et invitez la personne à en refaire une avec un autre identifiant.`
    : "";
  if (request.username && (await prisma.user.findUnique({ where: { username: request.username }, select: { id: true } }))) {
    throw new AccountError(takenMessage);
  }

  // Mot de passe choisi dans la demande : compte actif d'emblée. Sinon
  // (demande antérieure à ce parcours) : activation par lien.
  const chosenHash = request.passwordHash;
  const passwordHash = chosenHash ?? (await unusablePasswordHash());
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      // Garde contre un double traitement simultané de la même demande.
      const claimed = await tx.accountRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        // L'empreinte quitte la demande : elle ne vit plus que sur le compte.
        data: { status: "APPROVED", reviewedById: params.actorId, reviewedAt: new Date(), passwordHash: null },
      });
      if (claimed.count !== 1) throw new AccountError("Cette demande a déjà été traitée.");
      return tx.user.create({
        data: {
          name: request.name,
          email,
          username: request.username,
          passwordHash,
          phone: request.phone,
          status: chosenHash ? "ACTIVE" : "PENDING",
          isDemo,
          organizationId: request.organizationId,
          poolId: pool?.id ?? null,
          roles: {
            create: [
              { roleId: role.id, poolId: role.scope === "POOL" ? pool!.id : null },
              ...(chiefRoleId ? [{ roleId: chiefRoleId, poolId: pool!.id }] : []),
            ],
          },
        },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e, "username")) throw new AccountError(takenMessage);
    if (isUniqueViolation(e, "email")) throw new AccountError("Un compte existe déjà avec cette adresse e-mail.");
    throw e;
  }

  await logAudit({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: "account_request.approve",
    entityType: "AccountRequest",
    entityId: request.id,
    newValue: {
      userId: user.id,
      roleKey: role.key,
      poolId: pool?.id ?? null,
      requestedRoleId: request.requestedRoleId,
      activated: Boolean(chosenHash),
      chief: Boolean(chiefRoleId),
    },
  });
  if (chiefRoleId) {
    await logAudit({
      actorId: params.actorId,
      organizationId: params.organizationId,
      action: "pool.chief_designate",
      entityType: "Pool",
      entityId: pool!.id,
      newValue: { chiefUserId: user.id },
      metadata: { via: "validation de demande de compte" },
    });
  }

  if (chosenHash) {
    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      isDemo: user.isDemo,
      activated: true,
      emailed: false,
      chief: Boolean(chiefRoleId),
    };
  }
  return finishCreation(user, params.baseUrl);
}

export async function rejectAccountRequest(params: { actorId: string; organizationId: string; requestId: string }) {
  await requirePermission(params.actorId, PERMISSIONS.ACCOUNTS_MANAGE);

  const request = await prisma.accountRequest.findUnique({ where: { id: params.requestId } });
  if (!request || request.organizationId !== params.organizationId) throw new AccountError("Demande introuvable.");
  if (request.status !== "PENDING") throw new AccountError("Cette demande a déjà été traitée.");
  await requireOfficialForRealAccount(params.actorId, isDemoEmail(request.email));

  const claimed = await prisma.accountRequest.updateMany({
    where: { id: request.id, status: "PENDING" },
    // L'empreinte du mot de passe choisi est effacée : elle ne sert plus.
    data: { status: "REJECTED", reviewedById: params.actorId, reviewedAt: new Date(), passwordHash: null },
  });
  if (claimed.count !== 1) throw new AccountError("Cette demande a déjà été traitée.");

  await logAudit({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: "account_request.reject",
    entityType: "AccountRequest",
    entityId: request.id,
  });

  if (emailChannel.isConfigured()) {
    await emailChannel.send(`guest-${request.id}`, {
      userId: "guest",
      event: "account.rejected",
      title: "Demande de compte refusée — IPP Nord-Kivu 1",
      body: `Votre demande de compte (${request.email}) n'a pas été approuvée. Contactez l'informaticien de l'Inspection pour plus d'informations.`,
    });
  }
}

export async function createAccount(params: {
  actorId: string;
  organizationId: string;
  name: string;
  email: string;
  username?: string | null;
  phone: string | null;
  sex: "M" | "F" | null;
  roleId: string;
  poolId: string | null;
  baseUrl: string;
}): Promise<AccountCreationResult> {
  await requirePermission(params.actorId, PERMISSIONS.USERS_MANAGE);
  const username = params.username ? normalizeUsername(params.username) : null;

  const email = params.email.trim().toLowerCase();
  // Un compte de démonstration ne crée que des comptes de démonstration, et
  // seulement en .test : il ne peut pas réserver l'adresse d'une vraie personne.
  const actorIsDemo = await isDemoActor(params.actorId);
  if (actorIsDemo && !isDemoEmail(email)) throw new AccountError(DEMO_ACCOUNT_REFUSAL);
  const isDemo = actorIsDemo || isDemoEmail(email);

  const { role, pool } = await resolveRoleAndPool(params.actorId, params.roleId, params.poolId, params.organizationId);

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AccountError("Cette adresse e-mail est déjà utilisée.");
  }
  if (username && (await isUsernameTaken(username))) {
    throw new AccountError(usernameTakenMessage(username, await suggestUsername(username)));
  }

  const user = await prisma.user.create({
    data: {
      name: params.name,
      email,
      username,
      passwordHash: await unusablePasswordHash(),
      isDemo,
      phone: params.phone,
      sex: params.sex,
      status: "PENDING",
      organizationId: params.organizationId,
      poolId: pool?.id ?? null,
      roles: { create: { roleId: role.id, poolId: role.scope === "POOL" ? pool!.id : null } },
    },
  });

  await logAudit({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, roleKey: role.key, poolId: pool?.id ?? null },
  });

  return finishCreation(user, params.baseUrl);
}

export type AccessLinkResult = {
  kind: "activation" | "reset";
  email: string;
  username: string | null;
  isDemo: boolean;
  emailed: boolean;
  link?: ActivationLink;
};

/**
 * Lien à usage unique remis par un administrateur :
 * - compte en attente → lien d'activation (lien perdu ou expiré) ;
 * - compte actif → lien de réinitialisation (« Mot de passe oublié » tant que
 *   l'envoi d'e-mails n'est pas branché), après vérification d'identité.
 * Dans les deux cas le titulaire choisit lui-même son mot de passe ; les
 * liens précédents non utilisés sont révoqués.
 */
export async function issueAccessLink(params: {
  actorId: string;
  organizationId: string;
  userId: string;
  baseUrl: string;
}): Promise<AccessLinkResult> {
  await requirePermission(params.actorId, PERMISSIONS.USERS_MANAGE);

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user || user.organizationId !== params.organizationId) throw new AccountError("Compte introuvable.");
  await requireOfficialForRealAccount(params.actorId, user.isDemo);
  await requireAuthorityOverAccount(params.actorId, {
    targetUserId: user.id,
    organizationId: params.organizationId,
    allowSelf: true,
  });
  if (user.status === "SUSPENDED" || user.status === "DISABLED") {
    throw new AccountError("Ce compte est suspendu : réactivez-le d'abord.");
  }

  const kind = user.status === "PENDING" ? "activation" : "reset";
  let link: ActivationLink;
  let emailed = false;
  if (kind === "activation") {
    link = await issueActivationLink(user.id, params.baseUrl);
    emailed = await deliverActivationLink(user.id, user.email, link);
  } else {
    const { rawToken, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + ASSISTED_RESET_TTL_HOURS * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
    ]);
    link = { url: passwordResetUrl(params.baseUrl, rawToken), expiresAt };
  }

  await logAudit({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: kind === "activation" ? "user.activation_link_issued" : "user.reset_link_issued",
    entityType: "User",
    entityId: user.id,
  });

  return {
    kind,
    email: user.email,
    username: user.username,
    isDemo: user.isDemo,
    emailed,
    link: emailed ? undefined : link,
  };
}

/**
 * Le titulaire définit son mot de passe avec un lien d'activation ou de
 * réinitialisation. Un compte en attente devient actif ; un compte suspendu
 * ou désactivé ne peut pas être réactivé par ce biais.
 */
export async function setPasswordWithToken(rawToken: string, passwordHash: string): Promise<{ activated: boolean }> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, status: true, organizationId: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AccountError("Ce lien est invalide, déjà utilisé ou expiré. Demandez un nouveau lien à l'informaticien de l'Inspection.");
  }
  const { user } = record;
  if (user.status === "SUSPENDED" || user.status === "DISABLED") {
    throw new AccountError("Ce compte est suspendu. Contactez l'informaticien de l'Inspection.");
  }
  const activated = user.status === "PENDING";

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AccountError("Ce lien a déjà été utilisé.");
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, ...(activated ? { status: "ACTIVE" as const } : {}) },
    });
  });

  await logAudit({
    actorId: user.id,
    organizationId: user.organizationId,
    action: activated ? "user.activate" : "user.password_reset",
    entityType: "User",
    entityId: user.id,
  });

  return { activated };
}
