// Périmètre des tableaux de bord : un test par fonction. Les droits de chaque
// fonction sont ceux de la configuration réelle (ROLE_PERMISSIONS du seed,
// ajout Q8 de l'exploitant IPP compris). La vérification sur base (données
// vues / non vues) est dans prisma/scripts/verify-dashboard-scopes.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { ROLE_KEYS, WORKFLOW_STATUS_KEYS as S, type RoleKey } from "@/lib/rbac-data";
import type { SessionPermission, SessionRole } from "@/lib/permission-checks";
import { resolveDashboardScopes, scopeCoversPool, type DashboardScope } from "@/lib/dashboard/scope";
import {
  POOL_EXPLOITATION_BUCKETS,
  PROVINCIAL_EXPLOITATION_BUCKETS,
  PILOTAGE_BUCKETS,
  countByBucket,
  lastMonths,
  monthlyCounts,
} from "@/lib/dashboard/indicators";

const ORG = "org-nk1";
const POOL_A = "pool-a";
const POOL_B = "pool-b";

function subject(...grants: { role: RoleKey | string; poolId?: string | null; permissions?: string[] }[]) {
  const roles: SessionRole[] = [];
  const permissions: SessionPermission[] = [];
  for (const g of grants) {
    const poolId = g.poolId ?? null;
    roles.push({ key: g.role, label: g.role, poolId });
    const keys = g.permissions ?? ROLE_PERMISSIONS[g.role as RoleKey] ?? [];
    for (const k of keys) permissions.push({ permissionKey: k, poolId, organizationId: ORG });
  }
  return { id: "user-1", organizationId: ORG, roles, permissions };
}

function only(scopes: DashboardScope[]): DashboardScope {
  assert.equal(scopes.length, 1, `une seule section attendue, reçu ${scopes.map((s) => s.kind).join(", ")}`);
  return scopes[0];
}

const poolA = { id: POOL_A, organizationId: ORG };
const poolB = { id: POOL_B, organizationId: ORG };
const foreignPool = { id: "pool-x", organizationId: "autre-org" };

test("IPP : pilotage provincial, tous les POOL de son organisation seulement", () => {
  const s = only(resolveDashboardScopes(subject({ role: ROLE_KEYS.IPP })));
  assert.equal(s.kind, "pilotage_provincial");
  assert.equal(s.poolId, null);
  assert.ok(scopeCoversPool(s, poolA) && scopeCoversPool(s, poolB));
  assert.equal(scopeCoversPool(s, foreignPool), false);
});

test("Super Admin hors simulation : pilotage provincial", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.SUPER_ADMIN }))).kind, "pilotage_provincial");
});

test("Exploitant IPP : exploitation provinciale, jamais le pilotage de l'IPP", () => {
  const s = only(resolveDashboardScopes(subject({ role: ROLE_KEYS.EXPLOITANT_IPP })));
  assert.equal(s.kind, "exploitation_provinciale");
  assert.equal(s.poolId, null);
  assert.ok(scopeCoversPool(s, poolA) && scopeCoversPool(s, poolB));
  assert.equal(scopeCoversPool(s, foreignPool), false);
});

test("IPP adjoint : suivi provincial, pas le pilotage de l'IPP", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.IPA }))).kind, "suivi_adjoint");
});

test("Agent IPP (sans vue dédiée) : classé par ses permissions, jamais en pilotage", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.AGENT_IPP }))).kind, "exploitation_provinciale");
});

test("Informaticien : administration, aucune vue de rapports", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.INFORMATICIEN }))).kind, "administration");
});

test("Chargé des médias : ses contenus", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.CHARGE_MEDIAS }))).kind, "contenus");
});

test("Chef de POOL : son POOL seulement", () => {
  const s = only(resolveDashboardScopes(subject({ role: ROLE_KEYS.CHEF_POOL, poolId: POOL_A })));
  assert.equal(s.kind, "pilotage_pool");
  assert.equal(s.poolId, POOL_A);
  assert.ok(scopeCoversPool(s, poolA));
  assert.equal(scopeCoversPool(s, poolB), false);
});

test("Exploitant de POOL : exploitation de son POOL seulement", () => {
  const s = only(resolveDashboardScopes(subject({ role: ROLE_KEYS.EXPLOITANT_POOL, poolId: POOL_B })));
  assert.equal(s.kind, "exploitation_pool");
  assert.equal(s.poolId, POOL_B);
  assert.equal(scopeCoversPool(s, poolA), false);
});

test("Secrétaire de POOL : écoles de son POOL", () => {
  const s = only(resolveDashboardScopes(subject({ role: ROLE_KEYS.SECRETAIRE_POOL, poolId: POOL_A })));
  assert.equal(s.kind, "ecoles_pool");
  assert.equal(scopeCoversPool(s, poolB), false);
});

test("Inspecteur itinérant : vue personnelle, aucun POOL entier", () => {
  const s = only(resolveDashboardScopes(subject({ role: ROLE_KEYS.INSPECTEUR, poolId: POOL_A })));
  assert.equal(s.kind, "itinerant");
  assert.equal(s.userId, "user-1");
  // Même sans POOL, une vue personnelle ne couvre aucun POOL entier.
  assert.equal(scopeCoversPool({ ...s, poolId: null }, poolA), false);
});

test("Agent de POOL (aucune permission) : pas de tableau de bord défini", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.AGENT_POOL, poolId: POOL_A }))).kind, "aucun");
});

test("Fonction créée sans permission de suivi : aucun tableau, jamais le pilotage", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: "conseiller", permissions: ["audit.view"] }))).kind, "aucun");
});

test("Fonction de POOL rattachée sans POOL : rien n'est montré", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.CHEF_POOL, poolId: null }))).kind, "aucun");
});

test("Fonction connue privée de ses droits en base : rien n'est montré", () => {
  assert.equal(only(resolveDashboardScopes(subject({ role: ROLE_KEYS.IPP, permissions: [] }))).kind, "aucun");
});

test("Cumul : une section par fonction, chacune à son périmètre", () => {
  const scopes = resolveDashboardScopes(
    subject(
      { role: ROLE_KEYS.CHEF_POOL, poolId: POOL_A },
      { role: ROLE_KEYS.INSPECTEUR, poolId: POOL_A },
      { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: POOL_B }
    )
  );
  assert.deepEqual(
    scopes.map((s) => [s.kind, s.poolId]),
    [
      ["pilotage_pool", POOL_A],
      ["exploitation_pool", POOL_B],
      ["itinerant", POOL_A],
    ]
  );
});

test("Cumul : itinérant dans deux POOL → une seule section personnelle", () => {
  const scopes = resolveDashboardScopes(
    subject({ role: ROLE_KEYS.INSPECTEUR, poolId: POOL_A }, { role: ROLE_KEYS.INSPECTEUR, poolId: POOL_B })
  );
  assert.equal(scopes.length, 1);
});

test("Regroupement des statuts : chaque statut reçu tombe dans une seule étape", () => {
  const received = Object.values(S).filter((k) => k !== S.BROUILLON);
  for (const buckets of [POOL_EXPLOITATION_BUCKETS, PROVINCIAL_EXPLOITATION_BUCKETS]) {
    for (const k of received) assert.equal(buckets.filter((b) => b.statuses.includes(k)).length, 1, k);
  }
  for (const k of received) assert.ok(PILOTAGE_BUCKETS.filter((b) => b.statuses.includes(k)).length <= 1, k);
  assert.deepEqual(countByBucket([S.SOUMIS, S.RECU, S.A_CORRIGER, S.TRANSMIS, S.BROUILLON], POOL_EXPLOITATION_BUCKETS), {
    a_traiter: 2,
    en_cours: 0,
    corrections: 1,
    exploites: 1,
  });
});

test("Tendance : six mois glissants, dates hors période ignorées", () => {
  const months = lastMonths(new Date(Date.UTC(2026, 9, 7)));
  assert.deepEqual(months, ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  const counts = monthlyCounts(
    [new Date(Date.UTC(2026, 9, 1)), new Date(Date.UTC(2026, 9, 30)), new Date(Date.UTC(2025, 0, 1)), null],
    months
  );
  assert.equal(counts.at(-1)!.count, 2);
  assert.equal(
    counts.reduce((n, c) => n + c.count, 0),
    2
  );
});
