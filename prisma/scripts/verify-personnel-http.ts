// Test de bout en bout, PAR HTTP, des fiches du personnel (lot 1, décisions du
// 2026-10-10) : vraie connexion (Auth.js), pages /personnel et /personnel/[id]
// pour le responsable de la cellule du personnel et pour un profil non
// autorisé ; retrait de la responsabilité pendant que la session reste ouverte.
//
// À lancer UNIQUEMENT sur une base locale jetable, migrée et seedée, avec
// l'application démarrée sur cette même base (next start).
// Usage : POSTGRES_URL=<url locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-personnel-http.ts

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { ROLE_KEYS } from "../../src/lib/rbac-data";
import { setCellIpa } from "../../src/lib/cells/assignments";

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
let createdCellId: string | null = null;
const PASSWORD = "Verif-Personnel-2026!";

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
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
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

const shows = (html: string, marker: string) => html.includes(marker) || html.includes(marker.replace(/'/g, "&#x27;"));
/** Refus : redirection vers le tableau de bord, sans aucune donnée de la fiche. */
const deniedTo = (r: { status: number; location: string | null; text: string }) => r.status >= 300 && r.status < 400 && (r.location ?? "").includes("/dashboard");

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const roles = new Map((await prisma.roleDefinition.findMany()).map((r) => [r.key, r]));
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  async function user(slug: string, roleKey: string | null, extra: Record<string, unknown> = {}) {
    const u = await prisma.user.create({
      data: { name: `HTTP ${slug} ${RUN}`, email: `${slug}.${RUN}@http.test`, username: `${slug}${RUN}`, passwordHash, status: "ACTIVE", organizationId: org.id, isDemo: false, ...extra },
    });
    if (roleKey) await prisma.userRole.create({ data: { userId: u.id, roleId: roles.get(roleKey)!.id } });
    return u;
  }
  const ipp = await user("ipp", ROLE_KEYS.IPP);
  const head = await user("resp", ROLE_KEYS.IPA);
  const secr = await user("secr", ROLE_KEYS.SECRETAIRE_IPP);
  const agent = await user("agent", ROLE_KEYS.AGENT_IPP);
  const zero = await user("zero", null, { nombreEnfants: 0, matricule: `MAT-${RUN}` });
  const unknown = await user("inconnu", null);
  assert.equal(await prisma.cell.count({ where: { organizationId: org.id, active: true, mandate: "PERSONNEL" } }), 0, "une cellule active PERSONNEL existe déjà : base de test non vierge");
  const cell = await prisma.cell.create({ data: { organizationId: org.id, code: `HP${RUN}`.toUpperCase().slice(0, 20), name: `Personnel ${RUN}`, mandate: "PERSONNEL" } });
  createdCellId = cell.id;
  await setCellIpa({ id: ipp.id, organizationId: org.id }, { cellId: cell.id, ipaId: head.id, via: "direction" });

  const h = new Browser();
  const s = new Browser();
  assert.ok(await h.login(head.username!), "connexion du responsable");
  assert.ok(await s.login(secr.username!), "connexion de la secrétaire");

  await check("responsable : recherche et onglet « Fiches du personnel »", async () => {
    const r = await h.get(`/personnel?q=${RUN}`);
    assert.equal(r.status, 200, `redirigé vers ${r.location}`);
    assert.ok(shows(r.text, "Fiches du personnel"));
    assert.ok(shows(r.text, zero.name));
    // La liste ne montre pas les données de la fiche.
    assert.equal(r.text.includes(`MAT-${RUN}`), false);
    assert.equal(r.text.includes(zero.email), false);
  });

  // Fiche individuelle IGAP (2026-10-16) : le responsable du personnel consulte ET modifie.
  await check("responsable : fiche individuelle modifiable, « 0 » conservé, champ inconnu laissé vide", async () => {
    const z = await h.get(`/personnel/${zero.id}`);
    assert.equal(z.status, 200);
    assert.ok(shows(z.text, "consultation et modification"));
    assert.ok(z.text.includes(`MAT-${RUN}`));
    assert.match(z.text, /En chiffres<\/dt><dd[^>]*><span[^>]*>0<\/span><\/dd>/);
    const n = await h.get(`/personnel/${unknown.id}`);
    assert.match(n.text, /En chiffres<\/dt><dd[^>]*><span[^>]*aria-label="Non renseigné"[^>]*>—<\/span><\/dd>/);
    assert.equal(z.text.includes(passwordHash), false);
  });

  await check("secrétaire de l'IPP (vue globale des présences) : aucune fiche, ni recherche, ni onglet", async () => {
    const list = await s.get(`/personnel?q=${RUN}`);
    assert.ok(deniedTo(list), `statut ${list.status}`);
    assert.equal(list.text.includes(zero.name), false);
    // Fiche d'autrui hors droits : « introuvable » (même réponse qu'une fiche inexistante).
    const one = await s.get(`/personnel/${zero.id}`);
    assert.equal(one.text.includes(`MAT-${RUN}`), false);
    assert.equal(shows(one.text, "Fiche individuelle"), false, `statut ${one.status}`);
    const dash = await s.get("/dashboard");
    assert.equal(dash.text.includes('href="/personnel"'), false);
  });

  await check("secrétaire : Paramètres mène aux cellules ; vocation et responsable modifiables, sans gestion des cellules", async () => {
    const root = await s.get("/parametres");
    assert.ok(root.status >= 300 && root.status < 400 && (root.location ?? "").includes("/parametres/cellules"), `statut ${root.status} ${root.location}`);
    const page = await s.get("/parametres/cellules");
    assert.equal(page.status, 200);
    assert.ok(shows(page.text, "Enregistrer la vocation"));
    assert.ok(shows(page.text, "Enregistrer le responsable"));
    assert.equal(shows(page.text, "Nouvelle cellule"), false);
    assert.equal(shows(page.text, "Archiver"), false);
  });

  await check("agent IPP : ni Paramètres ni cellules", async () => {
    const a = new Browser();
    assert.ok(await a.login(agent.username!));
    const page = await a.get("/parametres/cellules");
    assert.ok(deniedTo(page), `statut ${page.status}`);
    assert.equal(shows(page.text, "Enregistrer la vocation"), false);
  });

  await check("fin de responsabilité, session ouverte : accès retiré dès la requête suivante", async () => {
    await setCellIpa({ id: ipp.id, organizationId: org.id }, { cellId: cell.id, ipaId: null, via: "direction" });
    const r = await h.get(`/personnel/${zero.id}`);
    assert.equal(r.text.includes(`MAT-${RUN}`), false);
    assert.equal(shows(r.text, "Fiche individuelle"), false);
  });

  // Archivage de la cellule de test : fait dans finally, même en cas d'échec.
  console.log(`\n${passed} vérifications HTTP réussies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Une seule cellule active PERSONNEL : la cellule de test ne doit jamais rester active.
    if (createdCellId) await prisma.cell.update({ where: { id: createdCellId }, data: { active: false, ipaId: null } });
    await prisma.$disconnect();
  });
