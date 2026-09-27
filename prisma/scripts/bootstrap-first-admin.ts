// Amorçage du PREMIER administrateur officiel — procédure serveur, à usage
// unique. Ni le formulaire public ni un compte de démonstration ne peuvent
// déclencher ce chemin : il faut l'URL de la base (secret serveur).
//
// Le script refuse d'agir dès qu'un administrateur officiel (compte non démo
// qui détient une fonction habilitée à valider les demandes) est actif. Il
// ne fixe AUCUN mot de passe : il crée le compte « en attente » et affiche un
// lien d'activation à usage unique (48 h) que le titulaire ouvre pour choisir
// lui-même son mot de passe.
//
// Simulation (par défaut, aucune écriture) :
//   POSTGRES_URL=<url> npx tsx prisma/scripts/bootstrap-first-admin.ts \
//     --email prenom.nom@domaine --name "Prénom Nom" --role informaticien [--username prenom.nom]
// Écriture effective : ajouter --apply
// Lien perdu ou expiré avant activation : --reissue --apply (même e-mail)
// Adresse du site pour le lien : --base-url https://ippnk1.online (défaut)

import { PrismaClient } from "@prisma/client";
import {
  ACTIVATION_TTL_HOURS,
  USERNAME_PATTERN,
  USERNAME_RULE,
  activationUrl,
  generateToken,
  normalizeUsername,
  unusablePasswordHash,
} from "../../src/lib/activation-token";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fail(message: string): never {
  console.error(`\nREFUS : ${message}\n`);
  process.exit(2);
}

function printLink(url: string, expiresAt: Date) {
  console.log("\nLien d'activation — à remettre au SEUL titulaire, ne pas copier dans un chat ni un ticket :");
  console.log(`  ${url}`);
  console.log(`Valable jusqu'au ${expiresAt.toISOString()} (UTC), utilisable une seule fois.`);
  console.log("Le titulaire y choisit son mot de passe ; personne d'autre ne le connaît.\n");
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const name = (arg("name") ?? "").trim();
  const roleKey = (arg("role") ?? "informaticien").trim();
  const username = arg("username") ? normalizeUsername(arg("username")!) : null;
  const baseUrl = arg("base-url") ?? process.env.APP_URL ?? "https://ippnk1.online";
  const apply = flag("apply");
  const reissue = flag("reissue");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("--email invalide ou manquant.");
  if (email.endsWith(".test")) fail("une adresse en .test désigne un compte de démonstration.");
  if (!reissue && name.length < 2) fail("--name manquant.");
  if (username && !USERNAME_PATTERN.test(username)) fail(`--username invalide : ${USERNAME_RULE}`);

  const role = await prisma.roleDefinition.findUnique({
    where: { key: roleKey },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) fail(`fonction « ${roleKey} » introuvable (attendu : informaticien ou ipp).`);
  if (role.scope !== "PROVINCE" || !role.rolePermissions.some((rp) => rp.permission.key === "accounts.manage")) {
    fail(`la fonction « ${roleKey} » ne permet pas de valider les demandes de compte.`);
  }

  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) fail("aucune organisation en base.");

  // Administrateurs officiels existants (actifs ou en attente d'activation).
  const officialAdmins = await prisma.user.findMany({
    where: {
      isDemo: false,
      status: { in: ["ACTIVE", "PENDING"] },
      roles: { some: { role: { rolePermissions: { some: { permission: { key: "accounts.manage" } } } } } },
    },
    select: { id: true, email: true, status: true },
  });
  if (officialAdmins.some((u) => u.status === "ACTIVE")) {
    fail(
      "un administrateur officiel actif existe déjà. Les comptes suivants se créent depuis l'application (Inspecteurs → Nouvel utilisateur, ou Demandes de compte)."
    );
  }

  if (reissue) {
    const target = officialAdmins.find((u) => u.email === email);
    if (!target) fail("--reissue ne vaut que pour l'administrateur officiel en attente d'activation créé par ce script.");
    console.log("Nouveau lien d'activation pour le compte administrateur en attente. Les liens précédents seront révoqués.");
    if (!apply) {
      console.log("\nSimulation : rien n'a été écrit. Relancer avec --apply.");
      return;
    }
    const { rawToken, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 3600 * 1000);
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { userId: target.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.create({ data: { userId: target.id, tokenHash, expiresAt } }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          organizationId: organization.id,
          action: "bootstrap.first_admin.reissue",
          entityType: "User",
          entityId: target.id,
        },
      }),
    ]);
    printLink(activationUrl(baseUrl, rawToken), expiresAt);
    return;
  }

  if (officialAdmins.length > 0) {
    fail(
      "un administrateur officiel est déjà créé et attend son activation. Utilisez --reissue avec son adresse si son lien est perdu ou expiré."
    );
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    fail("un compte existe déjà avec cette adresse (démo ou autre) : choisissez l'adresse officielle de la personne.");
  }
  if (
    username &&
    ((await prisma.user.findUnique({ where: { username }, select: { id: true } })) ||
      (await prisma.accountRequest.findFirst({ where: { username, status: "PENDING" }, select: { id: true } })))
  ) {
    fail(`l'identifiant « ${username} » est déjà pris.`);
  }

  console.log("Données qui seront écrites :");
  console.log(
    `  User               : 1 ligne — statut PENDING, isDemo=false, organisation ${organization.code}, sans POOL, ${username ? `identifiant ${username}` : "connexion par e-mail"}`
  );
  console.log(`  UserRole           : 1 ligne — fonction ${role.key} (${role.label}), portée province`);
  console.log(`  PasswordResetToken : 1 ligne — empreinte SHA-256 du lien, expiration ${ACTIVATION_TTL_HOURS} h`);
  console.log("  AuditLog           : 1 ligne — action bootstrap.first_admin");
  console.log("  Aucune autre table n'est modifiée ; aucun compte existant n'est touché.");
  if (!apply) {
    console.log("\nSimulation : rien n'a été écrit. Relancer avec --apply pour créer le compte.");
    return;
  }

  const { rawToken, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 3600 * 1000);
  const passwordHash = await unusablePasswordHash();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        username,
        passwordHash,
        status: "PENDING",
        isDemo: false,
        organizationId: organization.id,
        roles: { create: { roleId: role.id, poolId: null } },
      },
    });
    await tx.passwordResetToken.create({ data: { userId: created.id, tokenHash, expiresAt } });
    await tx.auditLog.create({
      data: {
        actorId: null,
        organizationId: organization.id,
        action: "bootstrap.first_admin",
        entityType: "User",
        entityId: created.id,
        newValue: { roleKey: role.key },
      },
    });
    return created;
  });

  console.log(`\nCompte créé (id ${user.id}), en attente d'activation.`);
  printLink(activationUrl(baseUrl, rawToken), expiresAt);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
