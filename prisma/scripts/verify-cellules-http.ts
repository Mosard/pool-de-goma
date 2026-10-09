// Test de bout en bout, PAR HTTP, des affectations aux cellules (décisions du
// 2026-10-09) : vraie connexion (Auth.js), session déjà ouverte, pages et
// appels directs aux routes (PDF, export Excel). Les affectations sont faites
// pendant que la session reste ouverte, par le module partagé de la Direction
// (src/lib/cells/assignments.ts).
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée, avec
// l'application démarrée sur cette même base (next start).
// Usage : POSTGRES_URL=<url locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-cellules-http.ts

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS as S } from "../../src/lib/rbac-data";
import { applyTrackAction, openIppTrack } from "../../src/lib/cells/server";
import { setCellIpa, setExploitantCell } from "../../src/lib/cells/assignments";
import { AWAITING_CELL_MESSAGE } from "../../src/lib/cells/rules";

const url = process.env.POSTGRES_URL ?? "";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) || !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
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
const PASSWORD = "Verif-Cellules-2026!";

/** Navigateur minimal : garde les cookies d'une session, comme un onglet resté ouvert. */
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
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  }
  /** Connexion par identifiants (Auth.js) : vrai si une session est créée. */
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

/** Page rendue : on juge le CONTENU (notFound() répond 200 en streaming). Apostrophes échappées par React. */
const shows = (html: string, marker: string) => html.includes(marker) || html.includes(marker.replace(/'/g, "&#x27;"));

async function main() {
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const status = new Map((await prisma.workflowStatus.findMany()).map((s) => [s.key, s]));
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const pool = await prisma.pool.create({ data: { organizationId: org.id, code: `H${RUN}`.toUpperCase(), name: `POOL HTTP ${RUN}` } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  async function user(slug: string, roleKey: string, poolId: string | null = null) {
    return prisma.user.create({
      data: {
        name: `${slug} ${RUN}`,
        username: `${slug}.${RUN}`.toLowerCase(),
        email: `${slug}.${RUN}@verif.test`.toLowerCase(),
        passwordHash,
        status: "ACTIVE",
        organizationId: org.id,
        roles: { create: [{ roleId: roles.get(roleKey)!.id, poolId }] },
      },
    });
  }
  const ipp = await user("ipp-http", ROLE_KEYS.IPP);
  const secretaire = await user("secr-http", ROLE_KEYS.SECRETAIRE_IPP);
  const inspecteur = await user("insp-http", ROLE_KEYS.INSPECTEUR, pool.id);
  const exploitant = await user("exploitant-http", ROLE_KEYS.EXPLOITANT_IPP);
  const ipa = await user("ipa-http", ROLE_KEYS.IPA);
  const cell = (code: string, name: string) => prisma.cell.create({ data: { organizationId: org.id, code: `${code}${RUN}`.toUpperCase(), name } });
  const vide = await cell("V", `Cellule Vide ${RUN}`);
  const cA = await cell("A", `Cellule Évaluation ${RUN}`);
  const cB = await cell("B", `Cellule Formation ${RUN}`);
  const admin = { id: ipp.id, organizationId: org.id };

  // Deux rapports soumis, envoyés l'un à la cellule A, l'autre à la cellule B.
  async function reportFor(cellId: string, schoolName: string) {
    const school = await prisma.school.create({ data: { poolId: pool.id, code: schoolName, name: schoolName, province: "Nord-Kivu", territoire: "Goma" } });
    const inspection = await prisma.inspection.create({ data: { schoolId: school.id, inspectorId: inspecteur.id, status: "RAPPORT_SOUMIS", completedAt: new Date() } });
    const report = await prisma.$transaction(async (tx) => {
      const r = await tx.report.create({ data: { inspectionId: inspection.id, statusId: status.get(S.SOUMIS)!.id, submittedAt: new Date(), authorId: inspecteur.id } });
      await openIppTrack(tx, { reportId: r.id, organizationId: org.id, actorId: inspecteur.id });
      return r;
    });
    await applyTrackAction(secretaire.id, report.id, { action: "assign", cellId });
    return report;
  }
  const schoolA = `Ecole-A-${RUN}`;
  const schoolB = `Ecole-B-${RUN}`;
  const rA = await reportFor(cA.id, schoolA);
  const rB = await reportFor(cB.id, schoolB);

  const ex = new Browser();
  const ip = new Browser();

  await check("Avant affectation : identifiants justes mais aucune session ; page de connexion avec le seul message d'attente", async () => {
    assert.equal(await ex.login(exploitant.username!), false, "exploitant : connexion refusée");
    assert.equal(await ip.login(ipa.username!), false, "IPA : connexion refusée");
    const login = await new Browser().get("/login?compte=attente-cellule");
    assert.ok(shows(login.text, AWAITING_CELL_MESSAGE), "message d'attente");
    const dash = await ex.get("/dashboard");
    assert.ok([302, 303, 307].includes(dash.status), `sans session : renvoi vers la connexion (${dash.status})`);
    assert.notEqual((await ex.get(`/rapports/${rA.id}/pdf`)).status, 200, "API directe refusée");
  });

  await check("Après affectation (cellule sans rapport) : connexion, fonction et cellule affichées, « Aucun rapport reçu »", async () => {
    await setExploitantCell(admin, { userId: exploitant.id, cellId: vide.id, via: "direction" });
    await setCellIpa(admin, { cellId: vide.id, ipaId: ipa.id, via: "direction" });
    assert.ok(await ex.login(exploitant.username!), "exploitant connecté");
    assert.ok(await ip.login(ipa.username!), "IPA connecté");
    const dE = await ex.get("/dashboard");
    assert.ok(shows(dE.text, `Exploitant — Cellule Vide ${RUN}`), "tableau de bord : « Exploitant — Cellule … »");
    assert.ok(shows(dE.text, "Aucun rapport reçu"));
    const dI = await ip.get("/dashboard");
    assert.ok(shows(dI.text, `IPA — Responsable de la cellule Vide ${RUN}`));
    assert.ok(shows(dI.text, "Aucun rapport reçu"));
    const prof = await ex.get("/profil");
    assert.ok(shows(prof.text, `Exploitant — Cellule Vide ${RUN}`), "profil");
    assert.ok(!shows(prof.text, "Niveau provincial"), "plus de mention « Niveau provincial »");
    const expl = await ex.get("/exploitation");
    assert.ok(shows(expl.text, `Exploitant — Cellule Vide ${RUN}`), "espace Exploitation");
    assert.ok(shows(expl.text, "Aucun rapport reçu"));
    assert.ok(!shows(expl.text, ">Tous les POOL<"), "plus de « Tous les POOL » pour une cellule");
    const list = (await ex.get("/rapports")).text;
    for (const s of [schoolA, schoolB]) assert.ok(!shows(list, s), `${s} invisible`);
  });

  await check("Deux cellules : affecté à A, la session ouverte voit A et jamais B (pages et appels directs)", async () => {
    await setExploitantCell(admin, { userId: exploitant.id, cellId: cA.id, via: "direction" });
    const list = await ex.get("/rapports");
    assert.ok(shows(list.text, schoolA), "rapport de A listé");
    assert.ok(!shows(list.text, schoolB), "rapport de B absent");
    assert.ok(shows((await ex.get(`/rapports/${rA.id}`)).text, schoolA));
    assert.ok(!shows((await ex.get(`/rapports/${rB.id}`)).text, schoolB), "page du rapport de B : introuvable");
    assert.equal((await ex.get(`/rapports/${rA.id}/pdf`)).status, 200, "PDF de A");
    assert.notEqual((await ex.get(`/rapports/${rB.id}/pdf`)).status, 200, "PDF de B refusé");
    assert.equal((await ex.get("/rapports/export.xlsx")).status, 200, "export de son périmètre");
    assert.ok(shows((await ex.get("/dashboard")).text, `Exploitant — Cellule Évaluation ${RUN}`));
  });

  await check("Changement A → B dans la même session : l'ancien accès disparaît, le nouveau s'ouvre", async () => {
    await setExploitantCell(admin, { userId: exploitant.id, cellId: cB.id, via: "direction" });
    assert.ok(!shows((await ex.get(`/rapports/${rA.id}`)).text, schoolA), "A : plus accessible");
    assert.notEqual((await ex.get(`/rapports/${rA.id}/pdf`)).status, 200, "PDF de A refusé");
    assert.ok(!shows((await ex.get("/rapports")).text, schoolA));
    assert.ok(shows((await ex.get(`/rapports/${rB.id}`)).text, schoolB), "B : accessible");
    assert.ok(!shows((await ex.get("/dashboard")).text, schoolA), "ni le tableau de bord ni les notifications ne citent A");
  });

  await check("Retrait dans la même session : seul le message d'attente ; plus aucune page ni API métier", async () => {
    await setExploitantCell(admin, { userId: exploitant.id, cellId: null, via: "direction" });
    await setCellIpa(admin, { cellId: vide.id, ipaId: null, via: "direction" });
    for (const b of [ex, ip]) {
      const d = await b.get("/dashboard");
      assert.ok(shows(d.text, AWAITING_CELL_MESSAGE), "message d'attente");
      assert.ok(!shows(d.text, "Rapports de la cellule"), "aucun tableau de bord métier");
      for (const path of ["/rapports", "/exploitation", "/profil", `/rapports/${rB.id}`]) {
        const t = (await b.get(path)).text;
        assert.ok(!shows(t, schoolB) && !shows(t, schoolA) && shows(t, AWAITING_CELL_MESSAGE), `${path} : message d'attente seulement`);
      }
      assert.equal((await b.get(`/rapports/${rB.id}/pdf`)).status, 403, "PDF : 403");
      assert.equal((await b.get("/rapports/export.xlsx")).status, 403, "export : 403");
    }
  });

  console.log(`\n${passed} vérifications HTTP réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
