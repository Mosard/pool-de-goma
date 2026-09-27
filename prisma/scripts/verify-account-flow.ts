// Test de bout en bout du parcours des comptes (démo et officiel), à lancer
// UNIQUEMENT sur une base locale jetable seedée (npm run db:seed) et sans
// administrateur officiel : il crée des comptes et des demandes de test.
// Refuse toute base non locale.
//
// Usage : POSTGRES_URL=<url locale> npx tsx prisma/scripts/verify-account-flow.ts

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import {
  DEMO_ACCOUNT_REFUSAL,
  approveAccountRequest,
  createAccount,
  hasPendingRequestFor,
  issueAccessLink,
  rejectAccountRequest,
  setPasswordWithToken,
  submitAccountRequest,
  verifyCredentials,
} from "../../src/lib/accounts";
import {
  demoRefusal,
  isSuperAdmin,
  loadUserAccess,
  requireOfficialActorUnlessDemoTarget,
  requirePublicationAuthority,
} from "../../src/lib/permissions";
import { PERMISSION_CATALOG, RESTRICTED_ROLE_KEYS, ROLE_KEYS, SUPER_ADMIN_PERMISSIONS } from "../../src/lib/rbac-data";
import { accountRequestSchema } from "../../src/lib/validations";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base locale.");
  process.exit(2);
}

const BASE = "http://localhost:3000";
const RUN = Date.now().toString(36);
const BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ippnk1-test-sauvegardes-"));
let passed = 0;

async function step(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

async function rejects(fn: () => Promise<unknown>, message: string | RegExp) {
  await assert.rejects(fn, (e: unknown) => {
    assert.ok(e instanceof Error);
    if (typeof message === "string") assert.equal(e.message, message);
    else assert.match(e.message, message);
    return true;
  });
}

const tokenOf = (link: string) => new URL(link).searchParams.get("token")!;

function grant(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync("npx", ["tsx", "prisma/scripts/grant-super-admin.ts", ...args], {
      encoding: "utf8",
      env: { ...process.env, SAUVEGARDE_DIR: BACKUP_DIR },
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const role = async (key: string) => prisma.roleDefinition.findUniqueOrThrow({ where: { key } });
  const [ipp, informaticien, inspecteur, chef] = await Promise.all([
    role(ROLE_KEYS.IPP),
    role(ROLE_KEYS.INFORMATICIEN),
    role(ROLE_KEYS.INSPECTEUR),
    role(ROLE_KEYS.CHEF_POOL),
  ]);
  const goma = await prisma.pool.findFirstOrThrow({ where: { code: "GOMA" } });
  const demoInfo = await prisma.user.findUniqueOrThrow({ where: { email: "informaticien@ipp-nordkivu1.test" } });
  assert.ok(demoInfo.isDemo);

  // Demande publique telle que la soumet le formulaire (mot de passe haché).
  const request = async (p: { name: string; email: string; username: string; password: string; roleId?: string; poolId?: string }) =>
    submitAccountRequest({
      organizationId: org.id,
      name: p.name,
      email: p.email,
      username: p.username,
      passwordHash: await bcrypt.hash(p.password, 10),
      phone: null,
      requestedRoleId: p.roleId ?? null,
      poolId: p.poolId ?? null,
      message: null,
    });

  console.log("\nDemande publique");

  await step("validation du formulaire : identifiant, confirmation, mot de passe ≠ identifiant", async () => {
    const base = { name: "Jean Kambale", email: "j@exemple.cd", password: "motdepasse-1", confirmation: "motdepasse-1" };
    assert.ok(accountRequestSchema.safeParse({ ...base, username: "Jean.Kambale" }).success, "majuscules normalisées");
    assert.equal(accountRequestSchema.safeParse({ ...base, username: "jean kambale" }).success, false, "espace refusé");
    assert.equal(accountRequestSchema.safeParse({ ...base, username: "jk@x" }).success, false, "« @ » refusé");
    assert.equal(accountRequestSchema.safeParse({ ...base, username: "jean", confirmation: "autre-chose" }).success, false);
    assert.equal(accountRequestSchema.safeParse({ ...base, username: "jean", password: "court", confirmation: "court" }).success, false);
    assert.equal(
      accountRequestSchema.safeParse({ ...base, username: "jean.kambale", password: "jean.kambale", confirmation: "jean.kambale" }).success,
      false
    );
  });

  const alice = { name: "Alice Muhindo", email: `alice.${RUN}@exemple.cd`, username: `alice.${RUN}`, password: `Alice-mdp-${RUN}` };

  await step("demande réelle enregistrée : empreinte seulement, aucun compte créé", async () => {
    const { requestId } = await request({ ...alice, roleId: inspecteur.id, poolId: goma.id });
    const r = await prisma.accountRequest.findUniqueOrThrow({ where: { id: requestId } });
    assert.equal(r.username, alice.username);
    assert.notEqual(r.passwordHash, alice.password);
    assert.ok(await bcrypt.compare(alice.password, r.passwordHash!));
    assert.equal(await prisma.user.count({ where: { email: alice.email } }), 0);
  });

  await step("demande en attente : connexion impossible, message « en attente » pour son seul auteur", async () => {
    assert.equal(await verifyCredentials(alice.username, alice.password), null);
    assert.equal(await hasPendingRequestFor(alice.username, alice.password), true);
    assert.equal(await hasPendingRequestFor(alice.username, "mauvais-mdp"), false, "rien n'est révélé sans le bon mot de passe");
  });

  await step("identifiant déjà pris (demande en attente) → refus avec suggestion", async () => {
    await rejects(
      () => request({ name: "Alice Muhindo", email: `homonyme.${RUN}@exemple.cd`, username: alice.username, password: "Autre-mdp-123" }),
      /déjà pris\. Choisissez-en un autre \(par exemple « alice\./
    );
  });

  await step("même nom complet, identifiant différent → accepté (homonymes)", async () => {
    await request({ name: "Alice Muhindo", email: `alice2.${RUN}@exemple.cd`, username: `alice.m.${RUN}`, password: "Autre-mdp-123" });
  });

  await step("identifiant réservé et e-mail en double refusés", async () => {
    await rejects(() => request({ name: "X", email: `x.${RUN}@exemple.cd`, username: "admin", password: "Motdepasse-9" }), /réservé/);
    await rejects(
      () => request({ name: "X", email: alice.email, username: `autre.${RUN}`, password: "Motdepasse-9" }),
      /déjà en attente pour cet e-mail/
    );
  });

  console.log("\nIsolation des comptes démo");
  const aliceReq = await prisma.accountRequest.findFirstOrThrow({ where: { email: alice.email } });

  await step("un informaticien démo NE PEUT PAS valider ni refuser une demande réelle (rien d'écrit)", async () => {
    await rejects(
      () => approveAccountRequest({
        actorId: demoInfo.id, organizationId: org.id, requestId: aliceReq.id, roleId: inspecteur.id, poolId: goma.id, baseUrl: BASE,
      }),
      DEMO_ACCOUNT_REFUSAL
    );
    await rejects(() => rejectAccountRequest({ actorId: demoInfo.id, organizationId: org.id, requestId: aliceReq.id }), DEMO_ACCOUNT_REFUSAL);
    const r = await prisma.accountRequest.findUniqueOrThrow({ where: { id: aliceReq.id } });
    assert.equal(r.status, "PENDING");
    assert.equal(await prisma.user.count({ where: { email: alice.email } }), 0);
  });

  await step("un informaticien démo valide une demande démo (.test) → compte démo actif, connexion directe", async () => {
    const demo = { name: "Démo Test", email: `demo.${RUN}@example.test`, username: `demo.${RUN}`, password: `Demo-mdp-${RUN}` };
    const { requestId } = await request({ ...demo, roleId: inspecteur.id, poolId: goma.id });
    const res = await approveAccountRequest({
      actorId: demoInfo.id, organizationId: org.id, requestId, roleId: inspecteur.id, poolId: goma.id, baseUrl: BASE,
    });
    assert.ok(res.isDemo && res.activated && !res.activation);
    const logged = await verifyCredentials(demo.username, demo.password);
    assert.ok(logged?.isDemo);
  });

  await step("un informaticien démo NE PEUT PAS créer un compte réel, ni émettre de lien pour un compte réel", async () => {
    await rejects(
      () => createAccount({
        actorId: demoInfo.id, organizationId: org.id, name: "X", email: `vrai.${RUN}@exemple.cd`, phone: null, sex: null,
        roleId: informaticien.id, poolId: null, baseUrl: BASE,
      }),
      DEMO_ACCOUNT_REFUSAL
    );
    const real = await prisma.user.create({
      data: { name: "R", email: `r.${RUN}@exemple.cd`, passwordHash: "x", status: "ACTIVE", organizationId: org.id },
    });
    await rejects(() => issueAccessLink({ actorId: demoInfo.id, organizationId: org.id, userId: real.id, baseUrl: BASE }), DEMO_ACCOUNT_REFUSAL);
  });

  await step("garde serveur commune : données officielles refusées au compte démo", async () => {
    assert.match((await demoRefusal(demoInfo.id))!, /compte de démonstration/);
    assert.equal(await demoRefusal(demoInfo.id, true), null);
    await rejects(() => requireOfficialActorUnlessDemoTarget(demoInfo.id, false), /compte de démonstration/);
  });

  console.log("\nCompte officiel existant (informaticien actif, connexion Google)");
  const adminEmail = `admin.${RUN}@exemple.cd`;
  const admin = await prisma.user.create({
    data: {
      name: "Admin Officiel",
      email: adminEmail,
      passwordHash: await bcrypt.hash(`Admin-${RUN}`, 10),
      status: "ACTIVE",
      organizationId: org.id,
      roles: { create: { roleId: informaticien.id, poolId: null } },
    },
  });
  await step("le compte officiel détient accounts.manage", async () => {
    assert.ok((await loadUserAccess(admin.id)).permissions.some((p) => p.permissionKey === "accounts.manage"));
  });

  console.log("\nValidation, refus et connexion (administrateur officiel)");

  await step("validation : compte ACTIF d'emblée, aucun lien, empreinte retirée de la demande", async () => {
    const res = await approveAccountRequest({
      actorId: admin.id, organizationId: org.id, requestId: aliceReq.id, roleId: inspecteur.id, poolId: goma.id, baseUrl: BASE,
    });
    assert.ok(res.activated && !res.isDemo && !res.activation);
    assert.equal(res.username, alice.username);
    const r = await prisma.accountRequest.findUniqueOrThrow({ where: { id: aliceReq.id } });
    assert.equal(r.status, "APPROVED");
    assert.equal(r.passwordHash, null);
  });

  await step("connexion directe avec identifiant + mot de passe choisi ; droits et POOL attribués", async () => {
    const u = await verifyCredentials(alice.username, alice.password);
    assert.ok(u && u.status === "ACTIVE");
    assert.equal((await verifyCredentials(alice.username.toUpperCase(), alice.password))?.id, u.id, "insensible à la casse");
    assert.equal(await verifyCredentials(alice.username, "mauvais"), null);
    const access = await loadUserAccess(u.id);
    assert.ok(access.roles.some((r) => r.key === ROLE_KEYS.INSPECTEUR && r.poolId === goma.id));
  });

  await step("identifiant d'un compte existant → nouvelle demande refusée", async () => {
    await rejects(
      () => request({ name: "Autre", email: `autre2.${RUN}@exemple.cd`, username: alice.username, password: "Motdepasse-9" }),
      /déjà pris/
    );
  });

  await step("identifiant pris entre-temps par un compte → validation refusée avec message clair", async () => {
    const bob = { name: "Bob", email: `bob.${RUN}@exemple.cd`, username: `bob.${RUN}`, password: "Bob-motdepasse-1" };
    const { requestId } = await request(bob);
    await prisma.user.create({
      data: { name: "Autre Bob", email: `autrebob.${RUN}@exemple.cd`, username: bob.username, passwordHash: "x", status: "PENDING", organizationId: org.id },
    });
    await rejects(
      () => approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId, roleId: ipp.id, poolId: null, baseUrl: BASE }),
      /désormais porté par un autre compte/
    );
  });

  await step("refus : demande REJECTED, empreinte effacée, connexion toujours impossible", async () => {
    const carol = { name: "Carol", email: `carol.${RUN}@exemple.cd`, username: `carol.${RUN}`, password: "Carol-motdepasse-1" };
    const { requestId } = await request(carol);
    await rejectAccountRequest({ actorId: admin.id, organizationId: org.id, requestId });
    const r = await prisma.accountRequest.findUniqueOrThrow({ where: { id: requestId } });
    assert.equal(r.status, "REJECTED");
    assert.equal(r.passwordHash, null);
    assert.equal(await verifyCredentials(carol.username, carol.password), null);
    assert.equal(await hasPendingRequestFor(carol.username, carol.password), false);
    // L'identifiant d'une demande refusée redevient disponible.
    await request({ ...carol, email: `carol2.${RUN}@exemple.cd` });
  });

  await step("demande traitée deux fois → refusée ; chef de POOL jamais accordé ; POOL exigé", async () => {
    await rejects(
      () => approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId: aliceReq.id, roleId: ipp.id, poolId: null, baseUrl: BASE }),
      "Cette demande a déjà été traitée."
    );
    const d = await request({ name: "D", email: `d.${RUN}@exemple.cd`, username: `d.${RUN}`, password: "Dddddddd-1" });
    await rejects(
      () => approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId: d.requestId, roleId: chef.id, poolId: goma.id, baseUrl: BASE }),
      /nommez-le chef/
    );
    await rejects(
      () => approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId: d.requestId, roleId: inspecteur.id, poolId: null, baseUrl: BASE }),
      /exige un rattachement à un POOL/
    );
  });

  await step("plusieurs informaticiens officiels : l'administrateur valide un second informaticien", async () => {
    const info2 = { name: "Info Deux", email: `info2.${RUN}@exemple.cd`, username: `info2.${RUN}`, password: "Info2-motdepasse" };
    const { requestId } = await request({ ...info2, roleId: informaticien.id });
    await approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId, roleId: informaticien.id, poolId: null, baseUrl: BASE });
    const u = (await verifyCredentials(info2.username, info2.password))!;
    assert.ok((await loadUserAccess(u.id)).roles.some((r) => r.key === ROLE_KEYS.INFORMATICIEN));
    const holders = await prisma.userRole.count({
      where: { roleId: informaticien.id, user: { isDemo: false, status: "ACTIVE", email: { contains: RUN } } },
    });
    assert.equal(holders, 2);
  });

  console.log("\nMot de passe oublié (réinitialisation assistée) et demandes antérieures");

  await step("lien de réinitialisation remis par l'administrateur : nouveau mot de passe choisi par le titulaire", async () => {
    const u = (await verifyCredentials(alice.username, alice.password))!;
    const res = await issueAccessLink({ actorId: admin.id, organizationId: org.id, userId: u.id, baseUrl: BASE });
    assert.equal(res.kind, "reset");
    assert.ok(res.link!.url.startsWith(`${BASE}/reinitialiser-mot-de-passe?token=`));
    const hours = (res.link!.expiresAt.getTime() - Date.now()) / 3600e3;
    assert.ok(hours > 23 && hours <= 24);
    await setPasswordWithToken(tokenOf(res.link!.url), await bcrypt.hash("Nouveau-mdp-Alice", 10));
    assert.equal(await verifyCredentials(alice.username, alice.password), null, "ancien mot de passe invalide");
    assert.ok(await verifyCredentials(alice.username, "Nouveau-mdp-Alice"));
    await rejects(() => setPasswordWithToken(tokenOf(res.link!.url), "x"), /invalide, déjà utilisé ou expiré/);
  });

  await step("demande antérieure sans mot de passe → compte en attente + lien d'activation (compatibilité)", async () => {
    const legacy = await prisma.accountRequest.create({
      data: { name: "Ancienne", email: `ancienne.${RUN}@exemple.cd`, organizationId: org.id, requestedRoleId: ipp.id },
    });
    const res = await approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId: legacy.id, roleId: ipp.id, poolId: null, baseUrl: BASE });
    assert.equal(res.activated, false);
    assert.ok(res.activation);
    await setPasswordWithToken(tokenOf(res.activation!.url), await bcrypt.hash("Ancienne-mdp-1", 10));
    assert.ok(await verifyCredentials(legacy.email, "Ancienne-mdp-1"), "connexion par e-mail");
  });

  await step("compte suspendu : ni connexion ni lien de réinitialisation", async () => {
    const u = (await verifyCredentials(alice.username, "Nouveau-mdp-Alice"))!;
    await prisma.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    assert.equal(await verifyCredentials(alice.username, "Nouveau-mdp-Alice"), null);
    await rejects(() => issueAccessLink({ actorId: admin.id, organizationId: org.id, userId: u.id, baseUrl: BASE }), /suspendu/);
  });

  console.log("\nRôle Super Admin");
  const superAdmin = await prisma.roleDefinition.findUniqueOrThrow({ where: { key: ROLE_KEYS.SUPER_ADMIN } });

  await step("Super Admin : clé réservée, ni demandable, ni attribuable depuis l'application", async () => {
    assert.ok(RESTRICTED_ROLE_KEYS.includes(ROLE_KEYS.SUPER_ADMIN));
    await rejects(
      () => request({ name: "Pirate", email: `pirate.${RUN}@exemple.cd`, username: `pirate.${RUN}`, password: "Pirate-mdp-1", roleId: superAdmin.id }),
      "Fonction inconnue."
    );
    const r = await request({ name: "Normal", email: `normal.${RUN}@exemple.cd`, username: `normal.${RUN}`, password: "Normal-mdp-1" });
    await rejects(
      () => approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId: r.requestId, roleId: superAdmin.id, poolId: null, baseUrl: BASE }),
      /ne s'attribue pas depuis l'application/
    );
    await rejects(
      () => createAccount({
        actorId: admin.id, organizationId: org.id, name: "X", email: `sa.${RUN}@exemple.cd`, phone: null, sex: null,
        roleId: superAdmin.id, poolId: null, baseUrl: BASE,
      }),
      /ne s'attribue pas depuis l'application/
    );
    await rejects(
      () => createAccount({
        actorId: demoInfo.id, organizationId: org.id, name: "X", email: `sa2.${RUN}@example.test`, phone: null, sex: null,
        roleId: superAdmin.id, poolId: null, baseUrl: BASE,
      }),
      /ne s'attribue pas depuis l'application/
    );
    assert.equal(await prisma.userRole.count({ where: { roleId: superAdmin.id } }), 0);
  });

  await step("script : refuse un compte démo, un compte inconnu, une adresse .test", async () => {
    assert.equal(grant(["--email", "informaticien@ipp-nordkivu1.test"]).code, 2);
    assert.equal(grant(["--email", `inconnu.${RUN}@exemple.cd`]).code, 2);
    const demoReal = await prisma.user.create({
      data: { name: "D", email: `demoreel.${RUN}@exemple.cd`, passwordHash: "x", status: "ACTIVE", isDemo: true, organizationId: org.id },
    });
    const r = grant(["--email", demoReal.email, "--apply"]);
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /compte de démonstration/);
  });

  await step("script : simulation par défaut, n'écrit rien et n'affiche pas l'adresse complète", async () => {
    const r = grant(["--email", adminEmail]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Simulation : rien n'a été écrit/);
    assert.ok(!r.out.includes(adminEmail));
    assert.equal(await prisma.userRole.count({ where: { userId: admin.id, roleId: superAdmin.id } }), 0);
  });

  await step("script : retrait de l'informaticien refusé tant que Super Admin n'est pas attribué", async () => {
    assert.equal(grant(["--email", adminEmail, "--remove-informaticien", "--apply"]).code, 2);
  });

  await step("attribution : Super Admin ajouté, informaticien conservé, sauvegarde + audit", async () => {
    const before = fs.readdirSync(BACKUP_DIR).length;
    const r = grant(["--email", adminEmail, "--apply"]);
    assert.equal(r.code, 0, r.out);
    assert.equal(fs.readdirSync(BACKUP_DIR).length, before + 1, "sauvegarde écrite");
    const keys = (await loadUserAccess(admin.id)).roles.map((x) => x.key).sort();
    assert.deepEqual(keys, [ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SUPER_ADMIN].sort());
    assert.equal(await prisma.auditLog.count({ where: { entityId: admin.id, action: "role.super_admin.grant" } }), 1);
    assert.equal(grant(["--email", adminEmail, "--apply"]).code, 0, "réapplication sans effet (idempotente)");
    assert.equal(await prisma.userRole.count({ where: { userId: admin.id, roleId: superAdmin.id } }), 1);
  });

  await step("rôle Informaticien de l'IPP inchangé (libellé, permissions, autres titulaires)", async () => {
    const info = await prisma.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.INFORMATICIEN },
      include: { rolePermissions: { include: { permission: true } } },
    });
    assert.equal(info.label, informaticien.label);
    assert.ok(info.rolePermissions.some((rp) => rp.permission.key === "publication.manage"));
    assert.ok(await prisma.userRole.findFirst({ where: { roleId: info.id, userId: demoInfo.id } }));
  });

  await step("retrait de l'informaticien : droits = exactement ceux du Super Admin", async () => {
    const r = grant(["--email", adminEmail, "--remove-informaticien", "--apply"]);
    assert.equal(r.code, 0, r.out);
    const access = await loadUserAccess(admin.id);
    assert.deepEqual(access.roles.map((x) => x.key), [ROLE_KEYS.SUPER_ADMIN]);
    assert.deepEqual([...new Set(access.permissions.map((p) => p.permissionKey))].sort(), [...SUPER_ADMIN_PERMISSIONS].sort());
    assert.match(grant(["--email", adminEmail, "--verify"]).out, /Valider les demandes \(accounts\.manage\) : oui/);
  });

  await step("Super Admin : toutes les permissions, sur tous les POOL, et l'autorité de publication", async () => {
    const r = await request({ name: "Après", email: `apres.${RUN}@exemple.cd`, username: `apres.${RUN}`, password: "Apres-mdp-1" });
    const res = await approveAccountRequest({ actorId: admin.id, organizationId: org.id, requestId: r.requestId, roleId: ipp.id, poolId: null, baseUrl: BASE });
    assert.ok(res.activated);
    const access = await loadUserAccess(admin.id);
    assert.ok(access.superAdmin && access.viewMode === null);
    const perms = new Set(access.permissions.map((p) => p.permissionKey));
    for (const p of PERMISSION_CATALOG) assert.ok(perms.has(p.key), p.key);
    assert.ok(access.permissions.every((p) => p.poolId === null), "portée : tous les POOL de l'organisation");
    await requirePublicationAuthority(admin.id);
  });

  await step("« Voir comme » chef de POOL (Goma) : uniquement les droits du chef, sur Goma seulement", async () => {
    const a = await loadUserAccess(admin.id, { viewMode: { role: ROLE_KEYS.CHEF_POOL, poolId: goma.id } });
    assert.equal(a.viewMode?.label, chef.label);
    assert.equal(a.viewMode?.poolName, goma.name);
    assert.deepEqual(a.roles.map((x) => x.key), [ROLE_KEYS.CHEF_POOL]);
    assert.ok(a.permissions.length > 0 && a.permissions.every((p) => p.poolId === goma.id));
    assert.ok(!a.permissions.some((p) => p.permissionKey === "accounts.manage"), "pas de gestion des comptes en mode chef");
    assert.ok(a.superAdmin, "le rôle réel reste Super Admin (retour possible)");
  });

  await step("« Voir comme » IPP / informaticien / itinérant : droits exacts de chaque fonction", async () => {
    const asIpp = await loadUserAccess(admin.id, { viewMode: { role: ROLE_KEYS.IPP, poolId: null } });
    assert.deepEqual(asIpp.roles.map((x) => x.key), [ROLE_KEYS.IPP]);
    assert.ok(asIpp.permissions.some((p) => p.permissionKey === "reports.validate"));
    assert.ok(!asIpp.permissions.some((p) => p.permissionKey === "inspections.conduct"));
    const asInfo = await loadUserAccess(admin.id, { viewMode: { role: ROLE_KEYS.INFORMATICIEN, poolId: null } });
    assert.ok(asInfo.permissions.some((p) => p.permissionKey === "accounts.manage"));
    assert.ok(!asInfo.permissions.some((p) => p.permissionKey === "reports.validate"));
    const asInsp = await loadUserAccess(admin.id, { viewMode: { role: ROLE_KEYS.INSPECTEUR, poolId: goma.id } });
    assert.deepEqual(asInsp.permissions.map((p) => [p.permissionKey, p.poolId]), [["inspections.conduct", goma.id]]);
  });

  await step("« Voir comme » refusé : Super Admin simulé, fonction de POOL sans POOL, POOL ou fonction inconnus", async () => {
    for (const mode of [
      { role: ROLE_KEYS.SUPER_ADMIN, poolId: null },
      { role: ROLE_KEYS.CHEF_POOL, poolId: null },
      { role: ROLE_KEYS.CHEF_POOL, poolId: "inexistant" },
      { role: "fonction_inconnue", poolId: null },
    ]) {
      const a = await loadUserAccess(admin.id, { viewMode: mode });
      assert.equal(a.viewMode, null, JSON.stringify(mode));
      assert.ok(a.permissions.some((p) => p.permissionKey === "accounts.manage"), "retour aux droits réels");
    }
  });

  await step("« Voir comme » sans effet pour un compte qui n'est pas Super Admin (démo compris)", async () => {
    const other = await verifyCredentials(`info2.${RUN}`, "Info2-motdepasse");
    for (const actor of [demoInfo.id, other!.id]) {
      const before = await loadUserAccess(actor, { viewMode: null });
      const after = await loadUserAccess(actor, { viewMode: { role: ROLE_KEYS.IPP, poolId: null } });
      assert.deepEqual(after.permissions, before.permissions);
      assert.equal(after.viewMode, null);
      assert.equal(after.superAdmin, false);
    }
    assert.equal(await isSuperAdmin(admin.id), true);
    assert.equal(await isSuperAdmin(demoInfo.id), false);
  });

  await step("retour arrière : informaticien rétabli, Super Admin retiré ; puis réattribution", async () => {
    assert.equal(grant(["--email", adminEmail, "--rollback", "--apply"]).code, 0);
    assert.deepEqual((await loadUserAccess(admin.id)).roles.map((x) => x.key), [ROLE_KEYS.INFORMATICIEN]);
    assert.equal(grant(["--email", adminEmail, "--apply"]).code, 0);
    assert.equal(grant(["--email", adminEmail, "--remove-informaticien", "--apply"]).code, 0);
    assert.deepEqual((await loadUserAccess(admin.id)).roles.map((x) => x.key), [ROLE_KEYS.SUPER_ADMIN]);
  });

  await step("aucun jeton, mot de passe ni empreinte dans le journal d'audit", async () => {
    const logs = await prisma.auditLog.findMany({ where: { createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } } });
    const dump = JSON.stringify(logs);
    assert.doesNotMatch(dump, /token=|[0-9a-f]{64}|\$2[aby]\$/);
    assert.doesNotMatch(dump, /Alice-mdp|Admin-|Demo-mdp|motdepasse|Nouveau-mdp/i);
    const superLogs = logs.filter((l) => l.action.startsWith("role.super_admin") || (l.action === "user.role_remove" && l.entityId === admin.id));
    assert.ok(superLogs.length >= 4, "trace d'audit de chaque étape Super Admin");
  });

  console.log(`\n${passed} vérifications réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
