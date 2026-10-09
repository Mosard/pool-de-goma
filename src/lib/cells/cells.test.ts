// Cellules de l'IPP et branche IPP des rapports (décisions du 2026-10-08,
// docs/exploitants-ipp-cellules.md § 6) : règles pures, droits rattachés comme
// en base. Vérification sur base (écritures, traçabilité, appels directs) :
// prisma/scripts/verify-cellules.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import { PERMISSIONS, ROLE_KEYS, type RoleKey } from "@/lib/rbac-data";
import { hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { applyAdjustments, canAdjustPermission } from "@/lib/access-rules";
import { scopeWhere } from "@/lib/exports/scope";
import {
  awaitingCellAssignment,
  cellAssignmentLabel,
  roleDisplayLabel,
  availableTrackActions,
  bindRolePermissions,
  canActOnTrack,
  canReadReport,
  canWorkOnReport,
  withoutProvincialFallback,
  type CellActor,
  type IppTrackInfo,
} from "@/lib/cells/rules";

const ORG = "org";
const A = "pool-a";
const C1 = "cell-1";
const C2 = "cell-2";

function actor(id: string, ...grants: { role: RoleKey; poolId?: string | null; cellId?: string | null }[]): CellActor {
  const roles: SessionRole[] = [];
  const permissions: SessionPermission[] = [];
  for (const g of grants) {
    const poolId = g.poolId ?? null;
    const cellId = g.cellId ?? null;
    roles.push({ key: g.role, label: g.role, poolId, cellId });
    permissions.push(...bindRolePermissions({ roleKey: g.role, permissionKeys: ROLE_PERMISSIONS[g.role], poolId, cellId, ipaCellId: cellId, organizationId: ORG }));
  }
  return { id, organizationId: ORG, roles, permissions };
}

const exploitC1 = actor("exploitC1", { role: ROLE_KEYS.EXPLOITANT_IPP, cellId: C1 });
const exploitC2 = actor("exploitC2", { role: ROLE_KEYS.EXPLOITANT_IPP, cellId: C2 });
const sansCellule = actor("sans", { role: ROLE_KEYS.EXPLOITANT_IPP });
const ipaC1 = actor("ipaC1", { role: ROLE_KEYS.IPA, cellId: C1 });
const ipaSansCellule = actor("ipaSans", { role: ROLE_KEYS.IPA });
const secretaire = actor("secr", { role: ROLE_KEYS.SECRETAIRE_IPP });
const ipp = actor("ipp", { role: ROLE_KEYS.IPP });
const superAdmin = actor("sa", { role: ROLE_KEYS.SUPER_ADMIN });
const agentIpp = actor("agent", { role: ROLE_KEYS.AGENT_IPP });
const exploitPoolA = actor("exploitA", { role: ROLE_KEYS.EXPLOITANT_POOL, poolId: A });
const chefA = actor("chefA", { role: ROLE_KEYS.CHEF_POOL, poolId: A });
const inspA = actor("inspA", { role: ROLE_KEYS.INSPECTEUR, poolId: A });

const scope = { poolId: A, organizationId: ORG, authorId: "inspA" };
const track = (stage: IppTrackInfo["stage"], cellId: string | null, legacy = false): IppTrackInfo => ({ stage, cellId, legacy, organizationId: ORG });

test("Droits : une permission de cellule n'existe qu'avec la cellule ; sans cellule, rien (aucun repli provincial)", () => {
  assert.deepEqual(
    exploitC1.permissions.map((p) => [p.permissionKey, p.poolId, p.cellId]),
    [[PERMISSIONS.REPORTS_REVIEW_CELL, null, C1]]
  );
  assert.deepEqual(sansCellule.permissions, [], "exploitant sans cellule : aucune permission");
  assert.ok(ipaC1.permissions.some((p) => p.permissionKey === PERMISSIONS.REPORTS_SIGN_CELL && p.cellId === C1));
  assert.ok(ipaC1.permissions.some((p) => p.permissionKey === PERMISSIONS.AI_ANALYZE && p.cellId === C1), "D4 : l'IA de l'IPA bornée à sa cellule");
  assert.equal(ipaC1.permissions.some((p) => p.permissionKey === PERMISSIONS.REPORTS_REVIEW_PROVINCE), false, "D4 : plus de province");
  assert.equal(ipaSansCellule.permissions.some((p) => p.cellId || p.permissionKey === PERMISSIONS.AI_ANALYZE), false);
  // Les retraits Q8 : plus de review_pool, review_province ni ai.analyze pour l'exploitant de l'IPP.
  for (const k of [PERMISSIONS.REPORTS_REVIEW_POOL, PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.AI_ANALYZE]) {
    assert.equal((ROLE_PERMISSIONS[ROLE_KEYS.EXPLOITANT_IPP] as string[]).includes(k), false, k);
  }
  // Une permission de cellule ne vaut jamais pour un POOL ni pour une autre cellule.
  assert.equal(hasPermission(exploitC1.permissions, PERMISSIONS.REPORTS_REVIEW_CELL, { cellId: C2 }), false);
  assert.equal(hasPermission(exploitC1.permissions, PERMISSIONS.REPORTS_REVIEW_CELL, { poolId: A, organizationId: ORG }), false);
});

test("Ajustements : un ajout individuel ne redonne jamais d'accès provincial à une personne rattachée à une cellule", () => {
  const fromRoles = exploitC1.permissions;
  const adjusted = applyAdjustments(fromRoles, [{ permissionKey: PERMISSIONS.REPORTS_REVIEW_PROVINCE, poolId: null, effect: "GRANT" }], ORG);
  const effective = withoutProvincialFallback(exploitC1.roles, fromRoles, adjusted);
  assert.equal(effective.some((p) => p.permissionKey === PERMISSIONS.REPORTS_REVIEW_PROVINCE), false);
  // Un retrait individuel ne touche pas une permission de cellule.
  const revoked = applyAdjustments(fromRoles, [{ permissionKey: PERMISSIONS.REPORTS_REVIEW_CELL, poolId: null, effect: "REVOKE" }], ORG);
  assert.equal(revoked.length, 1);

  // Écran « Gérer les accès » : refus explicite, même pour l'IPP.
  const v = canAdjustPermission(ipp, PERMISSIONS.REPORTS_REVIEW_PROVINCE, null, "GRANT", { roles: [{ key: ROLE_KEYS.EXPLOITANT_IPP }] });
  assert.equal(v.ok, false);
  assert.equal(canAdjustPermission(ipp, PERMISSIONS.REPORTS_REVIEW_POOL, null, "GRANT", { roles: [{ key: ROLE_KEYS.IPA }] }).ok, false);
  assert.equal(canAdjustPermission(superAdmin, PERMISSIONS.REPORTS_REVIEW_CELL, null, "GRANT", { roles: [] }).ok, false, "permission de cellule : jamais à la main");
  assert.ok(canAdjustPermission(ipp, PERMISSIONS.REPORTS_REVIEW_PROVINCE, null, "GRANT", { roles: [{ key: ROLE_KEYS.CHARGE_MEDIAS }] }).ok, "autres fonctions inchangées");
});

const transmitted = (t: IppTrackInfo): IppTrackInfo => ({ ...t, transmitted: true });
const locked = (t: IppTrackInfo): IppTrackInfo => ({ ...t, locked: true });

test("Lecture : un exploitant ne lit que les rapports AFFECTÉS à sa cellule, jamais ceux d'une autre", () => {
  assert.ok(canReadReport(exploitC1, scope, track("AFFECTE", C1)));
  assert.ok(canReadReport(exploitC1, scope, transmitted(track("EXPLOITE", C1))));
  assert.equal(canReadReport(exploitC1, scope, track("AFFECTE", C2)), false, "autre cellule");
  assert.equal(canReadReport(exploitC2, scope, track("EXPLOITE", C1)), false, "autre cellule");
  assert.equal(canReadReport(exploitC2, scope, transmitted(track("EXPLOITE", C1))), false, "autre cellule, même transmis");
  assert.equal(canReadReport(exploitC1, scope, track("AU_SECRETARIAT", null)), false, "pas encore affecté");
  assert.equal(canReadReport(exploitC1, scope, null), false, "rapport hors branche IPP");
  assert.equal(canReadReport(exploitC1, { ...scope, organizationId: "autre-org" }, { ...track("AFFECTE", C1), organizationId: "autre-org" }), false);
  for (const t of [track("AFFECTE", C1), transmitted(track("EXPLOITE", C1)), track("AU_SECRETARIAT", null, true)]) {
    assert.equal(canReadReport(sansCellule, scope, t), false, "sans cellule : aucun accès de repli");
    assert.equal(canReadReport(ipaSansCellule, scope, t), false, "IPA sans cellule : aucun accès");
  }
  assert.ok(canReadReport(ipaC1, scope, track("EXPLOITE", C1)), "l'IPA lit sa cellule");
  assert.equal(canReadReport(ipaC1, scope, track("EXPLOITE", C2)), false, "D4 : jamais une autre cellule");
});

test("Lecture : secrétariat (branche IPP), IPP (sources d'une synthèse transmise, historique), Agent IPP plus rien, Super Admin tout", () => {
  for (const t of [track("AU_SECRETARIAT", null), track("AFFECTE", C2), track("EXPLOITE", C1)]) assert.ok(canReadReport(secretaire, scope, t));
  assert.equal(canReadReport(secretaire, scope, null), false, "hors branche IPP");
  assert.ok(canReadReport(ipp, scope, transmitted(track("EXPLOITE", C1))), "source d'une synthèse validée par l'IPA et transmise");
  assert.ok(canReadReport(ipp, scope, track("AU_SECRETARIAT", null, true)), "historique antérieur");
  for (const t of [track("AU_SECRETARIAT", null), track("AFFECTE", C1), track("EXPLOITE", C1)]) assert.equal(canReadReport(ipp, scope, t), false, t.stage);
  assert.ok(canReadReport(ipp, scope, null, { visit: true }), "pilotage : pages de visite");
  for (const t of [track("AFFECTE", C1), transmitted(track("EXPLOITE", C1)), null]) {
    assert.equal(canReadReport(agentIpp, scope, t), false, "Agent IPP : ne lit plus toute la province (2026-10-09)");
    assert.ok(canReadReport(superAdmin, scope, t), "Super Admin : assistance technique");
  }
});

test("Branche POOL inchangée : exploitants et chef du POOL, auteur ; indépendante de la branche IPP", () => {
  for (const t of [null, track("AU_SECRETARIAT", null), track("AFFECTE", C1), transmitted(track("EXPLOITE", C2))]) {
    assert.ok(canReadReport(exploitPoolA, scope, t), "exploitant du POOL");
    assert.ok(canReadReport(chefA, scope, t), "chef du POOL");
    assert.ok(canReadReport(inspA, scope, t), "auteur");
    assert.ok(canWorkOnReport(exploitPoolA, scope, t), "le POOL exploite, quel que soit le stade IPP");
  }
  assert.equal(canReadReport(exploitPoolA, { ...scope, poolId: "pool-b" }, null), false, "pas un autre POOL");
});

test("Exploiter (commenter, partie réservée) : POOL ou cellule destinataire ; jamais le secrétariat", () => {
  assert.ok(canWorkOnReport(exploitC1, scope, track("AFFECTE", C1)));
  assert.equal(canWorkOnReport(exploitC2, scope, track("AFFECTE", C1)), false);
  assert.equal(canWorkOnReport(secretaire, scope, track("AFFECTE", C1)), false, "le secrétariat oriente, il n'exploite pas");
  assert.equal(canWorkOnReport(sansCellule, scope, track("AFFECTE", C1)), false);
});

test("Étapes : secrétariat envoie et réaffecte ; exploitant termine ; la cellule rouvre ; validation et signature portées par la synthèse", () => {
  assert.deepEqual(availableTrackActions(secretaire, track("AU_SECRETARIAT", null)), ["assign"]);
  assert.deepEqual(availableTrackActions(secretaire, track("AFFECTE", C1)), ["reassign"]);
  assert.deepEqual(availableTrackActions(secretaire, locked(track("EXPLOITE", C1))), [], "source d'une synthèse soumise : plus de réaffectation");
  assert.deepEqual(availableTrackActions(exploitC1, track("AFFECTE", C1)), ["exploit"]);
  assert.deepEqual(availableTrackActions(exploitC2, track("AFFECTE", C1)), [], "autre cellule");
  assert.deepEqual(availableTrackActions(ipaC1, track("EXPLOITE", C1)), ["return"]);
  assert.deepEqual(availableTrackActions(ipaC1, locked(track("EXPLOITE", C1))), [], "verrouillé par la synthèse");
  assert.equal(canActOnTrack(ipaC1, track("EXPLOITE", C2), "return"), false, "autre cellule");
  for (const a of [agentIpp, exploitPoolA, sansCellule, ipaSansCellule]) {
    for (const t of [track("AU_SECRETARIAT", null), track("AFFECTE", C1), track("EXPLOITE", C1)]) {
      assert.deepEqual(availableTrackActions(a, t), [], `${a.id} ${t.stage}`);
    }
  }
  for (const t of [track("AU_SECRETARIAT", null), track("AFFECTE", C1), track("EXPLOITE", C1)]) assert.deepEqual(availableTrackActions(ipp, t), [], `IPP ${t.stage}`);
  assert.equal(canActOnTrack(secretaire, { ...track("AU_SECRETARIAT", null), organizationId: "autre-org" }, "assign"), false);
});

test("Listes et exports : même périmètre que la lecture (cellule, secrétariat, IPP signé seulement)", () => {
  const where = (a: CellActor) => JSON.stringify(scopeWhere({ ...a, isDemo: false }));
  assert.match(where(exploitC1), /"cellId":\{"in":\["cell-1"\]\}/);
  assert.doesNotMatch(where(exploitC1), /cell-2/);
  assert.doesNotMatch(where(sansCellule), /ippTrack/, "sans cellule : ses propres rapports seulement");
  assert.match(where(ipp), /"synthesisSources":\{"some":\{"synthesis":\{"cellId":\{"not":null\},"status":\{"in":\["VALIDE","SIGNE"\]\}/);
  assert.match(where(secretaire), /"ippTrack":\{"isNot":null\}/);
  assert.equal(where(agentIpp), where({ ...agentIpp, permissions: [] }), "Agent IPP : plus de portée provinciale, ses propres rapports seulement");
});

test("Affectation obligatoire : IPA et exploitant de l'IPP sans cellule en attente ; exploitant de POOL jamais concerné", () => {
  assert.equal(awaitingCellAssignment(sansCellule.roles), true);
  assert.equal(awaitingCellAssignment(ipaSansCellule.roles), true);
  assert.equal(awaitingCellAssignment(exploitC1.roles), false);
  assert.equal(awaitingCellAssignment(ipaC1.roles), false);
  for (const a of [exploitPoolA, chefA, inspA, secretaire, ipp, superAdmin, agentIpp]) assert.equal(awaitingCellAssignment(a.roles), false, a.id);
  // Cumul : la fonction de cellule sans cellule bloque, même avec une autre fonction (point signalé, sans exception).
  assert.equal(awaitingCellAssignment([...exploitPoolA.roles, ...sansCellule.roles]), true);
  assert.equal(awaitingCellAssignment([...superAdmin.roles, ...ipaSansCellule.roles]), true);
  // Plusieurs rattachements d'exploitant : une cellule suffit.
  assert.equal(awaitingCellAssignment([...sansCellule.roles, ...exploitC1.roles]), false);
});

test("Libellés : fonction et cellule réelles, jamais « tous les POOL » pour une cellule", () => {
  assert.equal(cellAssignmentLabel({ key: ROLE_KEYS.IPA, cellName: "Évaluation" }), "IPA — Responsable de la cellule Évaluation");
  assert.equal(cellAssignmentLabel({ key: ROLE_KEYS.EXPLOITANT_IPP, cellName: "Cellule Évaluation" }), "Exploitant — Cellule Évaluation");
  assert.equal(cellAssignmentLabel({ key: ROLE_KEYS.EXPLOITANT_IPP, cellName: "cellule de l'IPAF" }), "Exploitant — Cellule de l'IPAF");
  assert.equal(cellAssignmentLabel({ key: ROLE_KEYS.IPA }), "IPA — en attente d'affectation à une cellule");
  assert.equal(cellAssignmentLabel({ key: ROLE_KEYS.EXPLOITANT_POOL, cellName: "X" }), null);
  assert.equal(roleDisplayLabel({ key: ROLE_KEYS.EXPLOITANT_POOL, label: "Exploitant de pool" }, "Goma"), "Exploitant de pool — POOL Goma");
});
