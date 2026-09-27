// Attribution du rôle « Super Admin » (administration technique) à UN compte
// officiel existant — procédure serveur uniquement : ni le formulaire public,
// ni la validation de demande, ni la création de compte, ni un compte démo ne
// peuvent attribuer ce rôle (voir RESTRICTED_ROLE_KEYS).
//
// Le rôle « Informaticien de l'IPP » n'est jamais modifié : seul le
// rattachement du compte visé change.
//
// Toutes les commandes simulent par défaut (aucune écriture) ; --apply écrit.
// Avant toute écriture, une sauvegarde JSON de l'état touché est enregistrée
// hors du dépôt (dossier ~/ippnk1-sauvegardes, ou SAUVEGARDE_DIR).
//
//   npx tsx prisma/scripts/grant-super-admin.ts --email <adresse du compte>                 (état + plan)
//   npx tsx prisma/scripts/grant-super-admin.ts --email <adresse> --apply                   (attribue Super Admin)
//   npx tsx prisma/scripts/grant-super-admin.ts --email <adresse> --verify                  (droits effectifs)
//   npx tsx prisma/scripts/grant-super-admin.ts --email <adresse> --remove-informaticien [--apply]
//   npx tsx prisma/scripts/grant-super-admin.ts --email <adresse> --rollback [--apply]      (état antérieur)
//
// Connexion : DATABASE_URL_SCRIPT ou POSTGRES_URL (voir db-connection.ts). Ni
// l'URL, ni l'adresse complète, ni aucun identifiant interne n'est affiché.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scriptClient, describe, probePostgres, scrub } from "./db-connection";
import {
  PERMISSIONS,
  ROLE_KEYS,
  SUPER_ADMIN_DESCRIPTION,
  SUPER_ADMIN_LABEL,
  SUPER_ADMIN_PERMISSIONS,
} from "../../src/lib/rbac-data";

const { prisma, shape } = scriptClient();

// Liaison lente (~0,7 s par échange depuis Goma) : le délai par défaut d'une
// transaction (5 s) ne suffit pas. En cas d'expiration, tout est annulé.
const TX_OPTIONS = { maxWait: 20_000, timeout: 60_000 };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

class Refusal extends Error {}
const refuse = (message: string): never => {
  throw new Refusal(message);
};

function mask(email: string): string {
  const [local, domain = ""] = email.split("@");
  const [host, ...rest] = domain.split(".");
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***.${rest.join(".")}`;
}

async function loadAccount(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      status: true,
      isDemo: true,
      organizationId: true,
      roles: { select: { id: true, roleId: true, poolId: true, role: { select: { key: true, label: true } } } },
    },
  });
  if (!user) refuse("aucun compte ne porte cette adresse.");
  return user!;
}

async function loadRole() {
  return prisma.roleDefinition.findUnique({
    where: { key: ROLE_KEYS.SUPER_ADMIN },
    include: { rolePermissions: { include: { permission: { select: { key: true } } } }, _count: { select: { userRoles: true } } },
  });
}

async function effectivePermissions(userId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { userRoles: { some: { userId } } } },
    select: { permission: { select: { key: true } } },
  });
  return [...new Set(rows.map((r) => r.permission.key))].sort();
}

function backup(kind: string, data: object): string {
  const dir = process.env.SAUVEGARDE_DIR ?? path.join(os.homedir(), "ippnk1-sauvegardes");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `super-admin-${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ kind, takenAt: new Date().toISOString(), ...data }, null, 2));
  return file;
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const apply = flag("apply");
  if (!email.includes("@")) refuse("--email manquant.");
  if (email.endsWith(".test")) refuse("une adresse en .test désigne un compte de démonstration.");

  console.log(`Base : ${describe(shape)}`);
  // Connexion directe (port 5432) : vérifier d'abord que le réseau laisse
  // passer le protocole Postgres, sinon échouer vite avec la marche à suivre.
  if (shape.scheme.startsWith("postgres") && !["localhost", "127.0.0.1"].includes(shape.host)) {
    const probe = await probePostgres(shape.host, Number(shape.port));
    if (!probe.startsWith("OK")) {
      refuse(
        `connexion directe ${shape.host}:${shape.port} impossible depuis ce réseau (${probe}). ` +
          "Définissez DATABASE_URL_SCRIPT avec l'adresse qui commence par prisma+postgres://accelerate.prisma-data.net/?api_key=… (elle passe par HTTPS)."
      );
    }
  }
  const user = await loadAccount(email);
  const roleKeys = user.roles.map((r) => r.role.key).sort();
  console.log(`Compte ${mask(email)} : statut ${user.status}, ${user.isDemo ? "DÉMO" : "officiel"}, fonctions [${roleKeys.join(", ") || "aucune"}]`);
  if (user.isDemo) refuse("compte de démonstration : le rôle Super Admin est réservé à un compte officiel.");
  if (user.status !== "ACTIVE") refuse(`compte ${user.status} : il doit être actif.`);

  const role = await loadRole();
  const hasSuper = roleKeys.includes(ROLE_KEYS.SUPER_ADMIN);
  const hasInfo = user.roles.some((r) => r.role.key === ROLE_KEYS.INFORMATICIEN && r.poolId === null);
  const wanted: string[] = [...SUPER_ADMIN_PERMISSIONS].sort();

  if (role && !role.isSystem) {
    refuse("une fonction « super_admin » a été créée manuellement : à examiner avant toute attribution.");
  }
  if (role) {
    const current = role.rolePermissions.map((rp) => rp.permission.key).sort();
    console.log(`Rôle Super Admin existant : permissions [${current.join(", ")}], ${role._count.userRoles} titulaire(s).`);
  } else {
    console.log("Rôle Super Admin : absent, sera créé.");
  }

  // --- Vérification des droits effectifs
  if (flag("verify")) {
    const perms = await effectivePermissions(user.id);
    console.log(`Droits effectifs : [${perms.join(", ")}]`);
    console.log(`  Super Admin : ${hasSuper ? "oui" : "non"} | Informaticien : ${hasInfo ? "oui" : "non"}`);
    console.log(`  Valider les demandes (accounts.manage) : ${perms.includes(PERMISSIONS.ACCOUNTS_MANAGE) ? "oui" : "NON"}`);
    console.log(`  Gérer les comptes (users.manage)       : ${perms.includes(PERMISSIONS.USERS_MANAGE) ? "oui" : "NON"}`);
    console.log(`  Journal d'audit (audit.view)           : ${perms.includes(PERMISSIONS.AUDIT_VIEW) ? "oui" : "NON"}`);
    console.log(`  Publication (publication.manage)       : ${perms.includes(PERMISSIONS.PUBLICATION_MANAGE) ? "oui" : "NON"}`);
    console.log(`  Inspections (inspections.conduct)      : ${perms.includes(PERMISSIONS.INSPECTIONS_CONDUCT) ? "oui" : "NON"}`);
    console.log(`  Toutes les permissions du catalogue    : ${wanted.every((k) => perms.includes(k)) ? "oui" : "NON"}`);
    return;
  }

  // --- Retrait du rôle d'informaticien, une fois Super Admin vérifié
  if (flag("remove-informaticien")) {
    if (!hasSuper) refuse("le compte ne détient pas encore Super Admin : attribuez-le et vérifiez-le d'abord.");
    const superPerms = role!.rolePermissions.map((rp) => rp.permission.key).sort();
    if (JSON.stringify(superPerms) !== JSON.stringify(wanted)) refuse("les permissions du rôle Super Admin ne sont pas celles prévues.");
    if (!hasInfo) {
      console.log("Rien à faire : le compte ne détient pas la fonction d'informaticien.");
      return;
    }
    console.log("Écriture prévue : suppression de 1 ligne UserRole (fonction informaticien de CE compte) + 1 AuditLog.");
    console.log("Le rôle « Informaticien de l'IPP » lui-même et ses autres titulaires ne sont pas touchés.");
    if (!apply) {
      console.log("\nSimulation : rien n'a été écrit. Relancer avec --apply.");
      return;
    }
    const file = backup("avant-retrait-informaticien", { user: { id: user.id, roles: user.roles } });
    const infoRole = user.roles.find((r) => r.role.key === ROLE_KEYS.INFORMATICIEN && r.poolId === null)!;
    await prisma.$transaction([
      prisma.userRole.delete({ where: { id: infoRole.id } }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          organizationId: user.organizationId,
          action: "user.role_remove",
          entityType: "User",
          entityId: user.id,
          oldValue: { roleKey: ROLE_KEYS.INFORMATICIEN },
          metadata: { via: "script serveur grant-super-admin", reason: "remplacé par Super Admin" },
        },
      }),
    ]);
    console.log(`Fonction d'informaticien retirée de ce compte. Sauvegarde : ${file}`);
    return;
  }

  // --- Retour arrière : état antérieur (informaticien, sans Super Admin)
  if (flag("rollback")) {
    console.log("Écritures prévues :");
    console.log(`  ${hasInfo ? "(déjà présente)" : "+1 UserRole"} fonction informaticien pour ce compte`);
    console.log(`  ${hasSuper ? "-1 UserRole" : "(absent)"} Super Admin pour ce compte`);
    console.log("  +1 AuditLog. La définition du rôle Super Admin est conservée (sans titulaire, elle n'accorde rien).");
    if (!apply) {
      console.log("\nSimulation : rien n'a été écrit. Relancer avec --apply.");
      return;
    }
    const file = backup("avant-retour-arriere", { user: { id: user.id, roles: user.roles } });
    const informaticien = await prisma.roleDefinition.findUniqueOrThrow({ where: { key: ROLE_KEYS.INFORMATICIEN } });
    await prisma.$transaction(async (tx) => {
      if (!hasInfo) await tx.userRole.create({ data: { userId: user.id, roleId: informaticien.id, poolId: null } });
      if (hasSuper) await tx.userRole.deleteMany({ where: { userId: user.id, role: { key: ROLE_KEYS.SUPER_ADMIN } } });
      await tx.auditLog.create({
        data: {
          actorId: null,
          organizationId: user.organizationId,
          action: "role.super_admin.rollback",
          entityType: "User",
          entityId: user.id,
          oldValue: { roleKeys },
          metadata: { via: "script serveur grant-super-admin" },
        },
      });
    }, TX_OPTIONS);
    console.log(`Retour arrière effectué. Sauvegarde : ${file}`);
    return;
  }

  // --- Attribution (par défaut : plan)
  const permissionRows = await prisma.permission.findMany({ where: { key: { in: wanted } }, select: { id: true, key: true } });
  if (permissionRows.length !== wanted.length) refuse("permissions de référence manquantes en base.");
  const missingPerms = role ? wanted.filter((k) => !role.rolePermissions.some((rp) => rp.permission.key === k)) : wanted;
  const extraPerms = role ? role.rolePermissions.map((rp) => rp.permission.key).filter((k) => !wanted.includes(k)) : [];

  console.log("\nÉcritures prévues :");
  console.log(`  RoleDefinition : ${role ? "aucune (existe déjà)" : `+1 « ${SUPER_ADMIN_LABEL} », portée province, système`}`);
  console.log(
    `  RolePermission : ${missingPerms.length ? `+${missingPerms.length} [${missingPerms.join(", ")}]` : "aucune"}${extraPerms.length ? ` ; -${extraPerms.length} [${extraPerms.join(", ")}]` : ""}`
  );
  console.log(`  UserRole       : ${hasSuper ? "aucune (déjà titulaire)" : "+1 Super Admin pour ce compte"}`);
  console.log("  AuditLog       : +1 role.super_admin.grant");
  console.log("  Aucune autre ligne n'est modifiée ; la fonction d'informaticien est conservée à cette étape.");
  if (!apply) {
    console.log("\nSimulation : rien n'a été écrit. Relancer avec --apply.");
    return;
  }

  const file = backup("avant-attribution", {
    user: { id: user.id, roles: user.roles },
    superAdminRole: role ? { id: role.id, permissions: role.rolePermissions.map((rp) => rp.permission.key) } : null,
  });

  await prisma.$transaction(async (tx) => {
    const r =
      role ??
      (await tx.roleDefinition.create({
        data: { key: ROLE_KEYS.SUPER_ADMIN, label: SUPER_ADMIN_LABEL, description: SUPER_ADMIN_DESCRIPTION, scope: "PROVINCE", isSystem: true },
      }));
    // Une seule requête pour toutes les permissions (liaison lente).
    const toAdd = permissionRows.filter((p) => missingPerms.includes(p.key));
    if (toAdd.length) {
      await tx.rolePermission.createMany({ data: toAdd.map((p) => ({ roleId: r.id, permissionId: p.id })) });
    }
    if (extraPerms.length) {
      await tx.rolePermission.deleteMany({ where: { roleId: r.id, permission: { key: { in: extraPerms } } } });
    }
    if (!hasSuper) await tx.userRole.create({ data: { userId: user.id, roleId: r.id, poolId: null } });
    await tx.auditLog.create({
      data: {
        actorId: null,
        organizationId: user.organizationId,
        action: "role.super_admin.grant",
        entityType: "User",
        entityId: user.id,
        newValue: { roleKey: ROLE_KEYS.SUPER_ADMIN, permissions: wanted },
        metadata: { via: "script serveur grant-super-admin" },
      },
    });
  }, TX_OPTIONS);
  console.log(`\nSuper Admin attribué. Sauvegarde de l'état antérieur : ${file}`);
  console.log("Déconnectez-vous puis reconnectez-vous (Google) pour que le menu reflète les nouveaux droits, puis lancez --verify.");
}

main()
  .catch((e) => {
    if (e instanceof Refusal) {
      console.error(`\nREFUS : ${e.message}\n`);
      process.exitCode = 2;
    } else {
      console.error(`\nErreur : ${scrub(e instanceof Error ? e.message : String(e))}`);
      process.exitCode = 1;
    }
  })
  .finally(() => prisma.$disconnect());
