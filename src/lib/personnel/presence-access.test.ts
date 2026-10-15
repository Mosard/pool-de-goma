// Présence du personnel — lot 1 (décisions du 2026-10-10,
// PRESENCES-BIOMETRIQUES-ANALYSE.md, Révision 2) : matrice des permissions,
// raccordement à la cellule du personnel, exclusions du Super Admin (réelles et
// simulées), ajustements individuels refusés, fiches en liste blanche, inconnu
// ≠ zéro, historique d'appartenance. Vérification sur base :
// prisma/scripts/verify-personnel.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "@/lib/demo-seed";
import {
  DEVICE_ADMIN_ROLE_KEYS,
  PERMISSIONS,
  PERSONNEL_HEAD_KEYS,
  PERSONNEL_RECORD_READER_ROLE_KEYS,
  PRESENCE_DEVICE_KEYS,
  ROLE_KEYS,
  SUPER_ADMIN_EXCLUDED_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  type PermissionKey,
  type RoleKey,
} from "@/lib/rbac-data";
import { hasPermission, type SessionPermission, type SessionRole } from "@/lib/permission-checks";
import { applyAdjustments, canAdjustPermission } from "@/lib/access-rules";
import {
  awaitingCellAssignment,
  bindPersonnelHeadPermissions,
  bindRecordReaderPermissions,
  bindRolePermissions,
  withoutReservedForSimulation,
} from "@/lib/cells/rules";
import { diffMemberships } from "@/lib/cells/history";
import { holdsPersonnelCellManage } from "@/lib/cells/personnel";
import { changedFieldNames } from "@/lib/audit-fields";
import { profileSchema } from "@/lib/validations";
import {
  FORBIDDEN_FIELDS,
  NOT_PROVIDED,
  RECORD_SELECT,
  SEARCH_SELECT,
  canReadPersonnelRecords,
  displayBirthDate,
  displaySex,
  displayText,
  displayYesNo,
  recordPanelView,
} from "@/lib/personnel/record";

const ORG = "org";
const P = PERMISSIONS;

function rolePerms(roleKey: RoleKey, opts: { poolId?: string | null; cellId?: string | null; ipaCellId?: string | null } = {}): SessionPermission[] {
  return bindRolePermissions({
    roleKey,
    permissionKeys: ROLE_PERMISSIONS[roleKey],
    poolId: opts.poolId ?? null,
    cellId: opts.cellId ?? null,
    ipaCellId: opts.ipaCellId ?? null,
    organizationId: ORG,
  });
}

const orgWide = (perms: SessionPermission[], key: string) => hasPermission(perms, key);
const personnelCell = { id: "cell-pers", active: true, mandate: "PERSONNEL", organizationId: ORG };
const otherCell = { id: "cell-ipaf", active: true, mandate: "GENERAL", organizationId: ORG };

// ─── Matrice R2.2 ──────────────────────────────────────────────────────────

const GLOBAL_VIEW: RoleKey[] = [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SECRETAIRE_IPP];
const NO_PRESENCE: RoleKey[] = [
  ROLE_KEYS.EXPLOITANT_IPP,
  ROLE_KEYS.AGENT_IPP,
  ROLE_KEYS.CHARGE_MEDIAS,
  ROLE_KEYS.INSPECTEUR,
  ROLE_KEYS.CHEF_POOL,
  ROLE_KEYS.EXPLOITANT_POOL,
  ROLE_KEYS.SECRETAIRE_POOL,
  ROLE_KEYS.AGENT_POOL,
];

test("vue globale des présences : IPP, Super Admin, informaticien, secrétaires de l'IPP", () => {
  for (const r of GLOBAL_VIEW) assert.ok(orgWide(rolePerms(r), P.PRESENCE_READ_ALL), r);
  for (const r of NO_PRESENCE) assert.equal(orgWide(rolePerms(r, { poolId: "pool-a", cellId: "c" }), P.PRESENCE_READ_ALL), false, r);
  // Un IPA (autre cellule) ne voit que sa cellule.
  const ipa = rolePerms(ROLE_KEYS.IPA, { ipaCellId: "c1" });
  assert.equal(orgWide(ipa, P.PRESENCE_READ_ALL), false);
  assert.ok(hasPermission(ipa, P.PRESENCE_READ_CELL, { cellId: "c1" }));
  assert.equal(hasPermission(ipa, P.PRESENCE_READ_CELL, { cellId: "c2" }), false);
});

test("appareils et associations (directive du 2026-10-15) : Super Admin, Admin, IPP principal, informaticien SEULEMENT", () => {
  const allowed: RoleKey[] = [ROLE_KEYS.IPP, ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN, ROLE_KEYS.INFORMATICIEN];
  for (const r of allowed) {
    assert.ok(orgWide(rolePerms(r), P.PRESENCE_DEVICES_MANAGE), r);
    assert.ok(orgWide(rolePerms(r), P.PRESENCE_ENROLLMENT_MANAGE), r);
    assert.ok(DEVICE_ADMIN_ROLE_KEYS.includes(r), r);
  }
  for (const r of [...NO_PRESENCE, ROLE_KEYS.IPA, ROLE_KEYS.SECRETAIRE_IPP]) {
    const perms = rolePerms(r, { ipaCellId: "c1", cellId: "c1", poolId: "pool-a" });
    assert.equal(orgWide(perms, P.PRESENCE_DEVICES_MANAGE), false, r);
    assert.equal(orgWide(perms, P.PRESENCE_ENROLLMENT_MANAGE), false, r);
    assert.equal(DEVICE_ADMIN_ROLE_KEYS.includes(r), false, r);
  }
  // Le responsable du personnel garde ses pouvoirs administratifs, sans les appareils.
  for (const k of PRESENCE_DEVICE_KEYS) assert.equal(PERSONNEL_HEAD_KEYS.includes(k), false, k);
  assert.ok(PERSONNEL_HEAD_KEYS.includes(P.PRESENCE_READ_ALL));
  // Les secrétaires de l'IPP gardent la consultation des présences.
  assert.ok(orgWide(rolePerms(ROLE_KEYS.SECRETAIRE_IPP), P.PRESENCE_READ_ALL));
});

test("seuils et calendrier : seulement l'IPP (fonction) et le responsable du personnel (cellule)", () => {
  const holders = (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).filter((r) => ROLE_PERMISSIONS[r].includes(P.PRESENCE_SCHEDULE_MANAGE));
  assert.deepEqual(holders, [ROLE_KEYS.IPP]);
  assert.equal(orgWide(rolePerms(ROLE_KEYS.SUPER_ADMIN), P.PRESENCE_SCHEDULE_MANAGE), false);
  assert.ok(PERSONNEL_HEAD_KEYS.includes(P.PRESENCE_SCHEDULE_MANAGE));
});

test("demandes des agents sans cellule : responsable du personnel, Super Admin, informaticien, secrétaires — sans pouvoir de décision", () => {
  for (const r of [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SECRETAIRE_IPP] as RoleKey[]) {
    const perms = rolePerms(r);
    assert.ok(orgWide(perms, P.PRESENCE_REQUESTS_INITIATE_UNCELLED), r);
    for (const decision of [P.PRESENCE_REQUESTS_VERIFY, P.PRESENCE_REQUESTS_APPROVE_FINAL, P.PRESENCE_OVERTIME_DECIDE]) {
      assert.equal(orgWide(perms, decision), false, `${r} ${decision}`);
    }
  }
  assert.equal(orgWide(rolePerms(ROLE_KEYS.IPP), P.PRESENCE_REQUESTS_INITIATE_UNCELLED), false);
  assert.ok(PERSONNEL_HEAD_KEYS.includes(P.PRESENCE_REQUESTS_INITIATE_UNCELLED));
});

test("fiches détaillées : aucune ligne de fonction ne les donne ; fonction réelle (4 profils) ou responsable du personnel", () => {
  for (const r of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
    assert.equal(ROLE_PERMISSIONS[r].includes(P.PERSONNEL_RECORDS_READ_ALL), false, r);
  }
  assert.equal(orgWide(rolePerms(ROLE_KEYS.SUPER_ADMIN), P.PERSONNEL_RECORDS_READ_ALL), false);
  // Directive du 2026-10-15 : Super Admin, Admin, IPP principal, informaticien.
  for (const r of [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN, ROLE_KEYS.IPP, ROLE_KEYS.INFORMATICIEN]) {
    assert.ok(canReadPersonnelRecords(bindRecordReaderPermissions([r], ORG), ORG), r);
  }
  assert.deepEqual([...PERSONNEL_RECORD_READER_ROLE_KEYS].sort(), ["admin", "informaticien", "ipp", "super_admin"]);
  // Tout autre profil : refus (secrétaires de l'IPP, IPA, chef de POOL, inspecteur…).
  for (const r of (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).filter((k) => !PERSONNEL_RECORD_READER_ROLE_KEYS.includes(k))) {
    assert.deepEqual(bindRecordReaderPermissions([r], ORG), [], r);
  }
  // Lecture seule : aucune autre permission n'est ajoutée.
  assert.deepEqual(bindRecordReaderPermissions([ROLE_KEYS.IPP], ORG), [{ permissionKey: P.PERSONNEL_RECORDS_READ_ALL, poolId: null, organizationId: ORG }]);
  // Un retrait individuel reste possible.
  const revoked = applyAdjustments(bindRecordReaderPermissions([ROLE_KEYS.INFORMATICIEN], ORG), [{ permissionKey: P.PERSONNEL_RECORDS_READ_ALL, poolId: null, effect: "REVOKE" }], ORG);
  assert.equal(canReadPersonnelRecords(revoked, ORG), false);
  // En « Voir comme » agissant, le pouvoir réservé n'est jamais simulé.
  assert.equal(canReadPersonnelRecords(withoutReservedForSimulation(bindRecordReaderPermissions([ROLE_KEYS.IPP], ORG)), ORG), false);
});

test("panneau « Voir la fiche » : uniquement des textes de la liste blanche, aucun secret", () => {
  const row = {
    id: "u1",
    name: "Agent Test",
    postnom: null,
    prenom: "",
    sex: "F",
    dateNaissance: null,
    photoUrl: null,
    email: "agent@exemple.test",
    phone: null,
    nombreEnfants: 0,
    matricule: null,
    statutAdministratif: null,
    mecanise: null,
    status: "ACTIVE",
    pool: null,
    cellLed: null,
    roles: [],
    // Champs interdits glissés par erreur : ils ne doivent jamais ressortir.
    passwordHash: "secret-x",
    username: "login-y",
  };
  const view = recordPanelView(row);
  const json = JSON.stringify(view);
  for (const f of FORBIDDEN_FIELDS) assert.equal(json.includes(`"${f}"`), false, f);
  assert.equal(json.includes("secret-x") || json.includes("login-y"), false);
  const fields = Object.fromEntries(view.sections.flatMap((s) => s.fields.map((f) => [f.label, f.value])));
  assert.equal(fields["Nombre d'enfants"], "0");
  assert.equal(fields["Prénom"], NOT_PROVIDED);
  assert.equal(fields["Sexe"], "Féminin");
  assert.equal(view.statusLabel, "Actif");
});

test("approbation finale et délégation : IPP seulement ; intérim : Super Admin et Admin seulement", () => {
  const holders = (k: PermissionKey) => (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).filter((r) => ROLE_PERMISSIONS[r].includes(k));
  assert.deepEqual(holders(P.PRESENCE_REQUESTS_APPROVE_FINAL), [ROLE_KEYS.IPP]);
  assert.deepEqual(holders(P.PRESENCE_DELEGATIONS_MANAGE), [ROLE_KEYS.IPP]);
  assert.deepEqual(holders(P.CELLS_INTERIM_MANAGE), [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN]);
  assert.equal(PERSONNEL_HEAD_KEYS.includes(P.PRESENCE_REQUESTS_APPROVE_FINAL), false);
  assert.equal(PERSONNEL_HEAD_KEYS.includes(P.CELLS_INTERIM_MANAGE), false);
});

test("cellule du personnel (Q-A) : vocation et responsable gérés par IPP, Super Admin, informaticien, secrétaires et l'IPA du personnel", () => {
  for (const r of GLOBAL_VIEW) assert.ok(holdsPersonnelCellManage(rolePerms(r), ORG), r);
  for (const r of [...NO_PRESENCE, ROLE_KEYS.IPA]) {
    assert.equal(holdsPersonnelCellManage(rolePerms(r, { ipaCellId: "c1", cellId: "c1", poolId: "pool-a" }), ORG), false, r);
  }
  const head = bindPersonnelHeadPermissions({ ipaCell: personnelCell, activePersonnelCellCount: 1, organizationId: ORG });
  assert.ok(holdsPersonnelCellManage(head, ORG));
  // Ce pouvoir de gestion ne donne ni fiches, ni calendrier, ni approbation.
  for (const r of [ROLE_KEYS.INFORMATICIEN, ROLE_KEYS.SECRETAIRE_IPP] as RoleKey[]) {
    for (const k of [P.PERSONNEL_RECORDS_READ_ALL, P.PRESENCE_SCHEDULE_MANAGE, P.PRESENCE_REQUESTS_APPROVE_FINAL]) {
      assert.equal(orgWide(rolePerms(r), k), false, `${r} ${k}`);
    }
  }
  // Portée organisation exigée.
  assert.equal(holdsPersonnelCellManage([{ permissionKey: P.CELLS_PERSONNEL_MANAGE, poolId: "pool-a", organizationId: ORG }], ORG), false);
  assert.equal(holdsPersonnelCellManage([{ permissionKey: P.CELLS_PERSONNEL_MANAGE, poolId: null, organizationId: "autre" }], ORG), false);
});

// ─── Super Admin : catalogue moins les exclusions ──────────────────────────

test("Super Admin : les pouvoirs métier réservés sont exclus du catalogue et du rattachement", () => {
  for (const k of SUPER_ADMIN_EXCLUDED_PERMISSIONS) assert.equal(SUPER_ADMIN_PERMISSIONS.includes(k), false, k);
  // Même si une ligne RolePermission les lui donnait en base, bindRolePermissions les écarte.
  const forced = bindRolePermissions({
    roleKey: ROLE_KEYS.SUPER_ADMIN,
    permissionKeys: [...SUPER_ADMIN_PERMISSIONS, ...SUPER_ADMIN_EXCLUDED_PERMISSIONS],
    poolId: null,
    cellId: null,
    ipaCellId: null,
    organizationId: ORG,
  });
  for (const k of SUPER_ADMIN_EXCLUDED_PERMISSIONS) assert.equal(hasPermission(forced, k), false, k);
  // Ses droits existants ne changent pas.
  for (const k of [P.USERS_MANAGE, P.PUBLICATION_MANAGE, P.REPORTS_VALIDATE, P.AI_ANALYZE]) assert.ok(hasPermission(forced, k), k);
});

test("« Voir comme » : simuler l'IPP ou un IPA ne donne aucun pouvoir réservé", () => {
  const ippSimulated = withoutReservedForSimulation(rolePerms(ROLE_KEYS.IPP));
  for (const k of [P.PRESENCE_SCHEDULE_MANAGE, P.PRESENCE_REQUESTS_APPROVE_FINAL, P.PRESENCE_DELEGATIONS_MANAGE, P.PRESENCE_OVERTIME_DECIDE]) {
    assert.equal(hasPermission(ippSimulated, k), false, k);
  }
  assert.ok(hasPermission(ippSimulated, P.PRESENCE_READ_ALL));
  assert.ok(hasPermission(ippSimulated, P.USERS_MANAGE));
  // L'IPA simulé n'a jamais les pouvoirs du personnel (non ajoutés en simulation) ni ses permissions de cellule réservées.
  const ipaSimulated = withoutReservedForSimulation(rolePerms(ROLE_KEYS.IPA, { ipaCellId: personnelCell.id }));
  for (const k of PERSONNEL_HEAD_KEYS) assert.equal(hasPermission(ipaSimulated, k), false, k);
});

// ─── Raccordement à la cellule du personnel ────────────────────────────────

test("pouvoirs du responsable : IPA de la cellule active PERSONNEL, et seulement elle", () => {
  const ok = bindPersonnelHeadPermissions({ ipaCell: personnelCell, activePersonnelCellCount: 1, organizationId: ORG });
  assert.deepEqual(ok.map((p) => p.permissionKey).sort(), [...PERSONNEL_HEAD_KEYS].sort());
  assert.ok(ok.every((p) => p.poolId === null && !p.cellId && p.organizationId === ORG));
  assert.ok(canReadPersonnelRecords(ok, ORG));

  const none = (ipaCell: typeof personnelCell | null, count = 1, org = ORG) =>
    bindPersonnelHeadPermissions({ ipaCell, activePersonnelCellCount: count, organizationId: org });
  assert.deepEqual(none(null), [], "IPA sans cellule");
  assert.deepEqual(none(otherCell), [], "vocation générale (nom ou code sans effet)");
  assert.deepEqual(none({ ...personnelCell, active: false }), [], "cellule archivée");
  assert.deepEqual(none(personnelCell, 2), [], "deux cellules PERSONNEL actives : aucun responsable");
  assert.deepEqual(none(personnelCell, 1, "autre-org"), [], "autre organisation");
});

test("la vocation ne se déduit ni du nom ni du code", () => {
  const named = { id: "x", active: true, mandate: "GENERAL", organizationId: ORG, name: "Cellule du personnel", code: "PERSONNEL" };
  assert.deepEqual(bindPersonnelHeadPermissions({ ipaCell: named, activePersonnelCellCount: 0, organizationId: ORG }), []);
});

test("IPA sans cellule active : toujours aucun droit (règle existante inchangée)", () => {
  assert.equal(awaitingCellAssignment([{ key: ROLE_KEYS.IPA, cellId: null }]), true);
  assert.equal(awaitingCellAssignment([{ key: ROLE_KEYS.IPA, cellId: personnelCell.id }]), false);
});

test("les exploitants de la cellule du personnel n'ont aucun pouvoir du responsable", () => {
  const exp = rolePerms(ROLE_KEYS.EXPLOITANT_IPP, { cellId: personnelCell.id });
  for (const k of PERSONNEL_HEAD_KEYS) assert.equal(hasPermission(exp, k), false, k);
  assert.ok(hasPermission(exp, P.REPORTS_REVIEW_CELL, { cellId: personnelCell.id }));
});

// ─── Ajustements individuels (« Gérer les accès ») ─────────────────────────

test("aucun ajout individuel des permissions du module, même par l'IPP ; retrait possible", () => {
  const ipp = { organizationId: ORG, roles: [{ key: ROLE_KEYS.IPP, label: "IPP", poolId: null }] as SessionRole[], permissions: rolePerms(ROLE_KEYS.IPP) };
  for (const k of [P.PRESENCE_SCHEDULE_MANAGE, P.PRESENCE_READ_ALL, P.PRESENCE_DEVICES_MANAGE, P.PRESENCE_REQUESTS_APPROVE_FINAL]) {
    const v = canAdjustPermission(ipp, k, null, "GRANT", { roles: [{ key: ROLE_KEYS.SECRETAIRE_IPP }] });
    assert.equal(v.ok, false, k);
    assert.equal(canAdjustPermission(ipp, k, null, "REVOKE", { roles: [{ key: ROLE_KEYS.SECRETAIRE_IPP }] }).ok, true, k);
  }
  // Un ajout déjà en base reste sans effet sur les droits calculés.
  const after = applyAdjustments(rolePerms(ROLE_KEYS.SECRETAIRE_IPP), [{ permissionKey: P.PRESENCE_SCHEDULE_MANAGE, poolId: null, effect: "GRANT" }], ORG);
  assert.equal(hasPermission(after, P.PRESENCE_SCHEDULE_MANAGE), false);
  const records = applyAdjustments([], [{ permissionKey: P.PERSONNEL_RECORDS_READ_ALL, poolId: null, effect: "GRANT" }], ORG);
  assert.equal(canReadPersonnelRecords(records, ORG), false);
});

// ─── Fiches : liste blanche, inconnu ≠ zéro ────────────────────────────────

test("fiche et recherche : aucun secret ni identifiant de connexion sélectionné", () => {
  for (const f of FORBIDDEN_FIELDS) {
    assert.equal(f in RECORD_SELECT, false, f);
    assert.equal(f in SEARCH_SELECT, false, f);
  }
  // La recherche ne lit ni coordonnées ni données familiales.
  for (const f of ["email", "phone", "nombreEnfants", "dateNaissance", "matricule", "photoUrl"]) assert.equal(f in SEARCH_SELECT, false, f);
});

test("donnée inconnue : « Non renseigné » ; zéro réellement saisi : « 0 »", () => {
  assert.equal(displayText(null), NOT_PROVIDED);
  assert.equal(displayText(undefined), NOT_PROVIDED);
  assert.equal(displayText("  "), NOT_PROVIDED);
  assert.equal(displayText(0), "0");
  assert.equal(displayText(3), "3");
  assert.equal(displayYesNo(null), NOT_PROVIDED);
  assert.equal(displayYesNo(false), "Non");
  assert.equal(displaySex(null), NOT_PROVIDED);
  assert.equal(displayBirthDate(null), NOT_PROVIDED);
  assert.match(displayBirthDate(new Date("1980-03-01T00:00:00Z")), /1 mars 1980|01 mars 1980/);
});

test("consultation des fiches : portée organisation exigée (ni POOL, ni cellule, ni autre organisation)", () => {
  const k = P.PERSONNEL_RECORDS_READ_ALL;
  assert.ok(canReadPersonnelRecords([{ permissionKey: k, poolId: null, organizationId: ORG }], ORG));
  assert.equal(canReadPersonnelRecords([{ permissionKey: k, poolId: "pool-a", organizationId: ORG }], ORG), false);
  assert.equal(canReadPersonnelRecords([{ permissionKey: k, poolId: null, organizationId: ORG, cellId: "c" }], ORG), false);
  assert.equal(canReadPersonnelRecords([{ permissionKey: k, poolId: null, organizationId: "autre" }], ORG), false);
  assert.equal(canReadPersonnelRecords([{ permissionKey: P.PRESENCE_READ_ALL, poolId: null, organizationId: ORG }], ORG), false);
});

test("profil : nombre d'enfants entier positif ou nul ; vide accepté ; « 0 » conservé", () => {
  const base = { prenom: "", postnom: "", sex: "", phone: "", dateNaissance: "" };
  assert.equal(profileSchema.safeParse({ ...base, nombreEnfants: "0" }).success, true);
  assert.equal(profileSchema.safeParse({ ...base, nombreEnfants: "" }).success, true);
  assert.equal(profileSchema.safeParse({ ...base, nombreEnfants: "-1" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, nombreEnfants: "2,5" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, nombreEnfants: "abc" }).success, false);
  const parsed = profileSchema.parse({ ...base, nombreEnfants: "0" });
  assert.equal(parsed.nombreEnfants ? Number(parsed.nombreEnfants) : null, 0);
});

test("journal du profil : noms des champs modifiés, jamais leurs valeurs", () => {
  const before = { phone: "+243 000", nombreEnfants: null, dateNaissance: new Date("1980-01-01T00:00:00Z") };
  const after = { phone: "+243 111", nombreEnfants: 0, dateNaissance: new Date("1980-01-01T00:00:00Z") };
  const fields = changedFieldNames(before, after);
  assert.deepEqual(fields, ["phone", "nombreEnfants"]);
  assert.equal(JSON.stringify(fields).includes("111"), false);
});

// ─── Historique d'appartenance ─────────────────────────────────────────────

test("historique : appartenances closes, ouvertes, doublons fermés, rien de réécrit", () => {
  const open = [
    { id: "t1", cellId: "c1", roleKey: "exploitant_ipp" },
    { id: "t2", cellId: "c1", roleKey: "exploitant_ipp" },
    { id: "t3", cellId: "c9", roleKey: "ipa" },
  ];
  const d = diffMemberships(open, [
    { cellId: "c1", roleKey: "exploitant_ipp" },
    { cellId: "c2", roleKey: "ipa" },
  ]);
  assert.deepEqual(d.close.sort(), ["t2", "t3"]);
  assert.deepEqual(d.start, [{ cellId: "c2", roleKey: "ipa" }]);
  assert.deepEqual(diffMemberships([], []), { close: [], start: [] });
});
