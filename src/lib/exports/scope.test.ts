import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFilters, filtersQuery, parseFilters, reviewPools } from "@/lib/exports/scope";

const ORG = "org1";
const perm = (permissionKey: string, poolId: string | null = null) => ({ permissionKey, poolId, organizationId: ORG });
const subject = (permissions: ReturnType<typeof perm>[]) => ({ id: "me", organizationId: ORG, isDemo: false, roles: [], permissions });

const inspecteur = subject([perm("inspections.conduct", "p1")]);
const chef = subject([perm("reports.review_pool", "p1"), perm("schools.manage", "p1")]);
const exploitantIpp = subject([perm("reports.review_province"), perm("reports.review_pool")]);
const mediasAvecPermissionProvinciale = subject([perm("content.write"), perm("inspections.conduct", "p1")]);

test("périmètre par fonction : POOL exploités, toute la province, ou rien", () => {
  assert.deepEqual(reviewPools(inspecteur), []);
  assert.deepEqual(reviewPools(chef), ["p1"]);
  assert.equal(reviewPools(exploitantIpp), "ALL");
  // Une permission provinciale SANS rapport avec l'exploitation ne donne pas la province (correction Q3).
  assert.deepEqual(reviewPools(mediasAvecPermissionProvinciale), []);
});

test("filtres forgés hors périmètre refusés, jamais élargis", () => {
  assert.equal(checkFilters(chef, { poolId: "p1" }, ORG), null);
  assert.match(checkFilters(chef, { poolId: "p2" }, ORG)!, /hors de votre périmètre/);
  assert.match(checkFilters(inspecteur, { poolId: "p1" }, ORG)!, /hors de votre périmètre/);
  assert.match(checkFilters(inspecteur, { inspecteurId: "autre" }, ORG)!, /vos propres rapports/);
  assert.equal(checkFilters(inspecteur, { inspecteurId: "me" }, ORG), null);
  assert.equal(checkFilters(exploitantIpp, { poolId: "p9" }, ORG), null);
  assert.match(checkFilters(exploitantIpp, { poolId: "p9" }, "autre-org")!, /hors de votre périmètre/);
});

test("lecture des paramètres : dates mal formées ignorées ; lien d'export identique", () => {
  const f = parseFilters({ ecole: " EP Kahembe ", du: "2026-10-01", au: "01/10/2026", fiche: "C3", pool: "p1" });
  assert.deepEqual(f, { ecole: "EP Kahembe", inspecteurId: undefined, poolId: "p1", du: "2026-10-01", au: undefined, statut: undefined, code: "C3" });
  assert.equal(filtersQuery(f), "?ecole=EP+Kahembe&pool=p1&du=2026-10-01&fiche=C3");
});
