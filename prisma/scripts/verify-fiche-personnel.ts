// Vérification de bout en bout de la fiche individuelle du personnel
// (formulaire IGAP) : scénarios A à I de la mission du 2026-10-16.
//
// Partie 1 (toujours) : fonctions serveur sur une base LOCALE jetable, migrée
// et seedée — saisie progressive, gestionnaires, refus, entrées répétables,
// intégrité administrative, journal sans valeurs, version anti-écrasement.
// Partie 2 (si BASE_URL) : vraie connexion HTTP à l'application démarrée sur
// cette même base — pages, « Voir la fiche », PDF incomplet et volumineux.
//
// Données entièrement fictives (comptes @fiche.test).
// Usage : POSTGRES_URL=<url locale> [BASE_URL=http://localhost:3100] npx tsx prisma/scripts/verify-fiche-personnel.ts

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { ROLE_KEYS } from "../../src/lib/rbac-data";
import { setCellIpa } from "../../src/lib/cells/assignments";
import { loadUserAccess, ForbiddenError } from "../../src/lib/permissions";
import { FileConflictError, deleteEntry, loadFileView, resolveFileContext, saveEntry, saveGroup, saveObservation } from "../../src/lib/personnel-file/server";

const url = process.env.POSTGRES_URL ?? "";
const BASE = process.env.BASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) || (BASE && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE))) {
  console.error("Refus : ce test écrit des données et ne s'exécute que sur une base et une application locales.");
  process.exit(2);
}

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}
const RUN = Date.now().toString(36);
const PASSWORD = "Verif-Fiche-2026!";

async function rejects(p: Promise<unknown>, kind: typeof ForbiddenError | typeof FileConflictError) {
  await assert.rejects(p, (e: unknown) => e instanceof kind);
}

/** Navigateur minimal : garde les cookies d'une session. */
class Browser {
  jar = new Map<string, string>();
  private store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  private cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async get(path: string) {
    const res = await fetch(BASE + path, { headers: { cookie: this.cookie() }, redirect: "manual" });
    this.store(res);
    const type = res.headers.get("content-type") ?? "";
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, location: res.headers.get("location"), type, body, text: type.includes("pdf") ? "" : body.toString("utf8") };
  }
  async login(identifier: string) {
    const csrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: this.cookie() } });
    this.store(csrf);
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: this.cookie() },
      body: new URLSearchParams({ identifier, password: PASSWORD, csrfToken, callbackUrl: `${BASE}/dashboard` }),
      redirect: "manual",
    });
    this.store(res);
    return [...this.jar.keys()].some((k) => k.includes("session-token"));
  }
}

const pageCount = (buf: Buffer) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  async function user(slug: string, roleKey: string | null) {
    const u = await prisma.user.create({
      data: { name: `Fiche ${slug} ${RUN}`, email: `${slug}.${RUN}@fiche.test`, username: `${slug}${RUN}`, passwordHash, status: "ACTIVE", organizationId: org.id, isDemo: false },
    });
    if (roleKey) await prisma.userRole.create({ data: { userId: u.id, roleId: roles.get(roleKey)!.id } });
    return u;
  }
  const agentA = await user("agenta", ROLE_KEYS.INSPECTEUR);
  const agentB = await user("agentb", ROLE_KEYS.INSPECTEUR);
  const ipp = await user("ipp", ROLE_KEYS.IPP);
  const info = await user("info", ROLE_KEYS.INFORMATICIEN);
  const head = await user("resp", ROLE_KEYS.IPA);
  const secr = await user("secr", ROLE_KEYS.SECRETAIRE_IPP);
  // Cellules laissées par une exécution précédente de CE script (code FP…, nom « Personnel … ») : archivées.
  await prisma.cell.updateMany({
    where: { organizationId: org.id, active: true, mandate: "PERSONNEL", code: { startsWith: "FP" }, name: { startsWith: "Personnel " } },
    data: { active: false },
  });
  assert.equal(await prisma.cell.count({ where: { organizationId: org.id, active: true, mandate: "PERSONNEL" } }), 0, "base de test non vierge");
  const cell = await prisma.cell.create({ data: { organizationId: org.id, code: `FP${RUN}`.toUpperCase().slice(0, 20), name: `Personnel ${RUN}`, mandate: "PERSONNEL" } });
  await setCellIpa({ id: ipp.id, organizationId: org.id }, { cellId: cell.id, ipaId: head.id, via: "direction" });

  console.log("Partie 1 — fonctions serveur");

  await check("A : l'agent saisit identité et contacts, revient plus tard, complète sa situation familiale ; rien n'est perdu", async () => {
    await saveGroup(agentA.id, agentA.id, "identite", 0, { sex: "F", nom: "FICTIF", postnom: "Postnom", prenom: "Prénom", dateNaissance: "1990-05-17", nationalite: "Exemple" });
    await saveGroup(agentA.id, agentA.id, "contacts", 0, { phone: "+243 000 000 001", email1: "contact@fiche.test" });
    // « Plus tard » : nouvelle lecture, nouvelle rubrique.
    const ctx = (await resolveFileContext(agentA.id, agentA.id))!;
    const before = await loadFileView(ctx);
    assert.equal(before.values.identite.nom, "FICTIF");
    assert.equal(before.values.identite.postnom, "Postnom"); // lu dans User
    await saveGroup(agentA.id, agentA.id, "etatCivil", 0, { etatCivil: "MARIE", acteNature: "Acte de mariage" });
    const after = await loadFileView(ctx);
    assert.deepEqual(after.values.identite, before.values.identite);
    assert.equal(after.values.contacts.email1, "contact@fiche.test");
    assert.equal(after.values.etatCivil.etatCivil, "MARIE");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: agentA.id } });
    assert.equal(u.postnom, "Postnom");
    assert.equal(u.sex, "F");
    assert.equal(u.phone, "+243 000 000 001");
    assert.equal(u.email, agentA.email, "l'identifiant de connexion ne change jamais");
    assert.ok(after.completeness.filled >= 9);
  });

  await check("Version : un enregistrement fondé sur une version périmée est refusé (aucun écrasement)", async () => {
    await rejects(saveGroup(agentA.id, agentA.id, "identite", 0, { nom: "ECRASE" }), FileConflictError);
    const v = await loadFileView((await resolveFileContext(agentA.id, agentA.id))!);
    assert.equal(v.values.identite.nom, "FICTIF");
  });

  await check("B : l'IPA du personnel corrige la fiche ; le journal garde l'auteur, la rubrique et les noms des champs, jamais les valeurs", async () => {
    const access = await resolveFileContext(head.id, agentA.id);
    assert.ok(access?.access.edit && access.access.observe);
    await saveGroup(head.id, agentA.id, "identite", 1, { sex: "F", nom: "FICTIF-CORRIGE", postnom: "Postnom", prenom: "Prénom", dateNaissance: "1990-05-17", nationalite: "Exemple" });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: head.id, action: "personnel.file.update", entityId: agentA.id }, orderBy: { createdAt: "desc" } });
    assert.deepEqual((log.metadata as { group: string; fields: string[] }).fields, ["nom"]);
    assert.equal((log.metadata as { group: string }).group, "identite");
    assert.equal(JSON.stringify(log).includes("FICTIF-CORRIGE"), false, "aucune valeur au journal");
    assert.equal(log.oldValue, null);
  });

  await check("C : l'IPP et l'informaticien consultent et modifient ; observations réservées aux gestionnaires", async () => {
    await saveGroup(ipp.id, agentA.id, "adresse", 0, { ville: "Ville fictive" });
    await saveGroup(info.id, agentA.id, "adresse", 1, { ville: "Ville fictive", commune: "Commune fictive" });
    await saveObservation(ipp.id, agentA.id, "identite", "Pièce justificative vue.");
    await rejects(saveObservation(agentA.id, agentA.id, "identite", "auto-observation"), ForbiddenError);
    const v = await loadFileView((await resolveFileContext(agentA.id, agentA.id))!);
    assert.equal(v.observations.identite, "Pièce justificative vue.");
    assert.equal(v.values.adresse.commune, "Commune fictive");
  });

  await check("D : un agent, une secrétaire de l'IPP n'ouvrent ni ne modifient la fiche d'autrui (refus serveur)", async () => {
    for (const intruder of [agentB, secr]) {
      assert.equal(await resolveFileContext(intruder.id, agentA.id), null);
      await rejects(saveGroup(intruder.id, agentA.id, "identite", 2, { nom: "INTRUS" }), ForbiddenError);
      await rejects(saveEntry(intruder.id, agentA.id, "children", null, { nom: "INTRUS" }), ForbiddenError);
    }
    // Identifiant forgé ou inexistant : même réponse.
    assert.equal(await resolveFileContext(agentB.id, "inexistant"), null);
    assert.equal(await resolveFileContext(agentB.id, "../etc"), null);
  });

  await check("H : plusieurs promotions, diplômes et enfants enregistrés, modifiés, retirés et restitués dans l'ordre", async () => {
    for (const g of ["Grade fictif 1", "Grade fictif 2", "Grade fictif 3"]) assert.ok((await saveEntry(agentA.id, agentA.id, "promotions", null, { grade: g, actSignedAt: "2015-01-10" })).ok);
    assert.ok((await saveEntry(agentA.id, agentA.id, "diplomas", null, { level: "LICENCE", field: "Option fictive", year: "2020" })).ok);
    assert.ok((await saveEntry(agentA.id, agentA.id, "diplomas", null, { level: "D6", institutionCommune: "Commune fictive" })).ok);
    const bad = await saveEntry(agentA.id, agentA.id, "diplomas", null, { field: "sans niveau" });
    assert.ok(!bad.ok && bad.errors.level);
    for (let i = 1; i <= 20; i++) assert.ok((await saveEntry(agentA.id, agentA.id, "children", null, { nom: `ENFANT${i}`, sex: i % 2 ? "M" : "F", relation: "BIOLOGIQUE" })).ok);
    let v = await loadFileView((await resolveFileContext(agentA.id, agentA.id))!);
    assert.deepEqual(v.promotions.map((p) => p.grade), ["Grade fictif 1", "Grade fictif 2", "Grade fictif 3"]);
    assert.equal(v.children.length, 20);
    assert.equal(v.children[0].nom, "ENFANT1");
    assert.equal(v.diplomas.length, 2);
    await saveEntry(agentA.id, agentA.id, "promotions", v.promotions[1].id, { grade: "Grade fictif 2 bis" });
    await deleteEntry(agentA.id, agentA.id, "children", v.children[19].id);
    v = await loadFileView((await resolveFileContext(agentA.id, agentA.id))!);
    assert.equal(v.promotions[1].grade, "Grade fictif 2 bis");
    assert.equal(v.children.length, 19);
    // Une entrée d'une autre fiche n'est jamais atteinte par l'identifiant seul.
    await saveEntry(agentB.id, agentB.id, "children", null, { nom: "ENFANT-B" });
    const other = (await loadFileView((await resolveFileContext(agentB.id, agentB.id))!)).children[0];
    await rejects(deleteEntry(agentA.id, agentA.id, "children", other.id), ForbiddenError);
    await rejects(saveEntry(ipp.id, agentA.id, "children", other.id, { nom: "DÉTOURNÉ" }), ForbiddenError);
  });

  await check("I : grade, affectation et commission déclarés ne changent ni fonctions, ni POOL, ni cellule, ni permissions", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: agentA.id }, include: { roles: true } });
    const permsBefore = (await loadUserAccess(agentA.id)).permissions.map((p) => `${p.permissionKey}|${p.poolId}|${p.cellId ?? ""}`).sort();
    await saveGroup(agentA.id, agentA.id, "gradeFonction", 0, { grade: "Inspecteur principal fictif" });
    await saveGroup(agentA.id, agentA.id, "affectation", 0, { ministere: "Ministère fictif", province: "Province fictive", direction: "Direction fictive" });
    await saveGroup(agentA.id, agentA.id, "commission", 0, { possede: "OUI", actReference: "COM-FICTIVE" });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: agentA.id }, include: { roles: true } });
    assert.equal(after.poolId, before.poolId);
    assert.equal(after.status, before.status);
    assert.deepEqual(after.roles.map((r) => [r.roleId, r.poolId, r.cellId]), before.roles.map((r) => [r.roleId, r.poolId, r.cellId]));
    const permsAfter = (await loadUserAccess(agentA.id)).permissions.map((p) => `${p.permissionKey}|${p.poolId}|${p.cellId ?? ""}`).sort();
    assert.deepEqual(permsAfter, permsBefore);
  });

  await check("Matricule : une seule valeur (celle du compte), modifiée depuis la fiche et journalisée", async () => {
    await saveGroup(agentA.id, agentA.id, "engagement", 0, { matricule: `MAT-${RUN}`, grade: "Attaché fictif" });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: agentA.id } })).matricule, `MAT-${RUN}`);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "personnel.file.update", entityId: agentA.id }, orderBy: { createdAt: "desc" } });
    assert.ok((log.metadata as { fields: string[] }).fields.includes("matricule"));
  });

  if (BASE) {
    console.log("Partie 2 — HTTP sur l'application démarrée");
    const a = new Browser();
    const b = new Browser();
    const h = new Browser();
    assert.ok(await a.login(agentA.username!), "connexion de l'agent A");
    assert.ok(await b.login(agentB.username!), "connexion de l'agent B");
    assert.ok(await h.login(head.username!), "connexion du responsable du personnel");

    await check("Profil : accès « Ma fiche personnelle » ; la fiche affiche les rubriques et les valeurs enregistrées", async () => {
      const p = await a.get("/profil");
      assert.equal(p.status, 200);
      assert.ok(p.text.includes("Ma fiche personnelle"));
      const f = await a.get("/profil/fiche");
      assert.equal(f.status, 200);
      for (const t of ["Identité de l", "Situation administrative", "Avancements dans différents grades", "Niveau d", "matériel roulant"]) {
        assert.ok(f.text.toLowerCase().includes(t.toLowerCase()), t);
      }
      assert.ok(f.text.includes("FICTIF-CORRIGE"));
    });

    await check("D (HTTP) : l'agent B ne lit pas la fiche de A par l'adresse, ni son PDF", async () => {
      const page = await b.get(`/personnel/${agentA.id}`);
      assert.equal(page.text.includes("FICTIF-CORRIGE"), false);
      const pdf = await b.get(`/personnel/${agentA.id}/fiche/pdf`);
      assert.equal(pdf.status, 404);
      assert.equal(pdf.type.includes("pdf"), false);
    });

    await check("E : le responsable ouvre la fiche de A (identifiant du compte) et peut la modifier ; un agent simple n'a pas « Voir la fiche »", async () => {
      const page = await h.get(`/personnel/${agentA.id}`);
      assert.equal(page.status, 200);
      assert.ok(page.text.includes("FICTIF-CORRIGE"));
      assert.ok(page.text.includes("Modifier"));
      const presence = await h.get("/presence/aujourdhui");
      assert.equal(presence.status, 200);
      const agentPresence = await a.get("/presence/moi");
      assert.equal(agentPresence.text.includes("Voir la fiche"), false, "pas de « Voir la fiche » pour un agent simple");
    });

    await check("F et H : PDF de A (rubriques remplies, 3 promotions, 19 enfants) et PDF presque vide de B", async () => {
      const full = await a.get("/profil/fiche/pdf");
      assert.equal(full.status, 200);
      assert.ok(full.type.includes("application/pdf"));
      assert.equal(full.body.subarray(0, 5).toString(), "%PDF-");
      const small = await b.get("/profil/fiche/pdf");
      assert.equal(small.status, 200);
      assert.ok(pageCount(full.body) > pageCount(small.body), `${pageCount(full.body)} pages contre ${pageCount(small.body)}`);
      const viaHead = await h.get(`/personnel/${agentA.id}/fiche/pdf`);
      assert.equal(viaHead.status, 200);
      const logged = await prisma.auditLog.count({ where: { action: "personnel.file.pdf", entityId: agentA.id } });
      assert.ok(logged >= 2);
    });
  }

  console.log(`\n${passed} vérification(s) réussie(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    // La cellule de test est archivée même en cas d'échec : la base reste prête pour les autres vérifications.
    await prisma.cell.updateMany({ where: { code: { startsWith: "FP" }, name: { startsWith: "Personnel " }, mandate: "PERSONNEL", active: true }, data: { active: false } });
    await prisma.$disconnect();
  });
