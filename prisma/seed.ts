import { PrismaClient, type RoleScope } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  ROLE_KEYS,
  WORKFLOW_STATUS_KEYS,
  type PermissionKey,
  type RoleKey,
} from "../src/lib/rbac-data";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Référentiel RBAC — données de démonstration/configuration initiale.
// Modifiable ensuite depuis la base sans redéploiement (voir §6 du cahier
// des charges : rôles et permissions doivent rester configurables).
// ---------------------------------------------------------------------------

const ROLE_DEFINITIONS: { key: RoleKey; label: string; description: string; scope: RoleScope }[] = [
  { key: ROLE_KEYS.IPP, label: "Inspecteur Principal Provincial", description: "Responsable provincial de l'Inspection.", scope: "PROVINCE" },
  { key: ROLE_KEYS.IPA, label: "Inspecteur Principal Adjoint", description: "Adjoint de l'IPP sur un domaine (formation, évaluations, titres, administration/finances, ...).", scope: "PROVINCE" },
  { key: ROLE_KEYS.INSPECTEUR, label: "Inspecteur itinérant", description: "Réalise les inspections sur le terrain.", scope: "POOL" },
  { key: ROLE_KEYS.EXPLOITANT_POOL, label: "Exploitant de pool", description: "Exploite les rapports reçus au niveau du pool.", scope: "POOL" },
  { key: ROLE_KEYS.CHEF_POOL, label: "Chef de pool", description: "Responsable d'un pool : écoles, affectations, exploitation.", scope: "POOL" },
  { key: ROLE_KEYS.EXPLOITANT_IPP, label: "Exploitant IPP (Bureau d'exploitation)", description: "Exploite les rapports transmis au niveau provincial.", scope: "PROVINCE" },
  { key: ROLE_KEYS.AGENT_IPP, label: "Agent IPP", description: "Agent administratif du bureau provincial.", scope: "PROVINCE" },
  { key: ROLE_KEYS.AGENT_POOL, label: "Agent de pool", description: "Agent administratif (caisse, secrétariat, ...) au sein d'un pool.", scope: "POOL" },
  { key: ROLE_KEYS.SECRETAIRE_POOL, label: "Secrétaire de pool", description: "Gestion administrative des écoles au sein d'un pool.", scope: "POOL" },
  { key: ROLE_KEYS.INFORMATICIEN, label: "Informaticien de l'Inspection", description: "Administration de la plateforme, validation des comptes.", scope: "PROVINCE" },
  { key: ROLE_KEYS.CHARGE_MEDIAS, label: "Chargé des médias", description: "Gestion des contenus du site public (à venir avec le back-office éditorial).", scope: "PROVINCE" },
];

const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  [ROLE_KEYS.IPP]: [
    PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.POOLS_MANAGE,
    PERMISSIONS.SCHOOLS_MANAGE,
    PERMISSIONS.ASSIGNMENTS_MANAGE,
    PERMISSIONS.REPORTS_REVIEW_PROVINCE,
    PERMISSIONS.REPORTS_VALIDATE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.FORM_TEMPLATES_MANAGE,
  ],
  [ROLE_KEYS.IPA]: [PERMISSIONS.REPORTS_REVIEW_PROVINCE, PERMISSIONS.AUDIT_VIEW],
  [ROLE_KEYS.INSPECTEUR]: [PERMISSIONS.INSPECTIONS_CONDUCT],
  [ROLE_KEYS.EXPLOITANT_POOL]: [PERMISSIONS.REPORTS_REVIEW_POOL],
  [ROLE_KEYS.CHEF_POOL]: [PERMISSIONS.SCHOOLS_MANAGE, PERMISSIONS.ASSIGNMENTS_MANAGE, PERMISSIONS.REPORTS_REVIEW_POOL],
  [ROLE_KEYS.EXPLOITANT_IPP]: [PERMISSIONS.REPORTS_REVIEW_PROVINCE],
  [ROLE_KEYS.AGENT_IPP]: [PERMISSIONS.REPORTS_REVIEW_PROVINCE],
  [ROLE_KEYS.AGENT_POOL]: [],
  [ROLE_KEYS.SECRETAIRE_POOL]: [PERMISSIONS.SCHOOLS_MANAGE],
  [ROLE_KEYS.INFORMATICIEN]: [
    PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.POOLS_MANAGE,
    PERMISSIONS.FORM_TEMPLATES_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  [ROLE_KEYS.CHARGE_MEDIAS]: [],
};

// Pools cités au §7. "Karisimbi 2" est explicitement signalé comme incertain
// dans le document source : omis pour l'instant, à ajouter/corriger depuis
// l'administration une fois confirmé.
const POOLS = [
  { code: "GOMA", name: "Goma" },
  { code: "KARISIMBI", name: "Karisimbi" },
  { code: "NYIRAGONGO", name: "Nyiragongo" },
  { code: "RUTSHURU-1", name: "Rutshuru 1" },
  { code: "RUTSHURU-2", name: "Rutshuru 2" },
  { code: "RUTSHURU-3", name: "Rutshuru 3" },
  { code: "RUTSHURU-4", name: "Rutshuru 4" },
  { code: "RUTSHURU-5", name: "Rutshuru 5" },
];

const WORKFLOW_STATUSES: { key: string; label: string; order: number; isTerminal?: boolean }[] = [
  { key: WORKFLOW_STATUS_KEYS.BROUILLON, label: "Brouillon", order: 1 },
  { key: WORKFLOW_STATUS_KEYS.SOUMIS, label: "Soumis", order: 2 },
  { key: WORKFLOW_STATUS_KEYS.RECU, label: "Reçu par le pool", order: 3 },
  { key: WORKFLOW_STATUS_KEYS.EN_EXPLOITATION, label: "En exploitation (pool)", order: 4 },
  { key: WORKFLOW_STATUS_KEYS.A_CORRIGER, label: "À corriger", order: 5 },
  { key: WORKFLOW_STATUS_KEYS.TRANSMIS, label: "Transmis au bureau IPP", order: 6 },
  { key: WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION, label: "En attente de validation", order: 7 },
  { key: WORKFLOW_STATUS_KEYS.VALIDE, label: "Validé", order: 8 },
  { key: WORKFLOW_STATUS_KEYS.REJETE, label: "Rejeté", order: 9 },
  { key: WORKFLOW_STATUS_KEYS.CLOTURE, label: "Clôturé", order: 10, isTerminal: true },
];

const WORKFLOW_TRANSITIONS: { from: string; to: string; label: string; permission: PermissionKey }[] = [
  { from: WORKFLOW_STATUS_KEYS.BROUILLON, to: WORKFLOW_STATUS_KEYS.SOUMIS, label: "Soumettre", permission: PERMISSIONS.INSPECTIONS_CONDUCT },
  { from: WORKFLOW_STATUS_KEYS.SOUMIS, to: WORKFLOW_STATUS_KEYS.RECU, label: "Accuser réception", permission: PERMISSIONS.REPORTS_REVIEW_POOL },
  { from: WORKFLOW_STATUS_KEYS.RECU, to: WORKFLOW_STATUS_KEYS.EN_EXPLOITATION, label: "Démarrer l'exploitation", permission: PERMISSIONS.REPORTS_REVIEW_POOL },
  { from: WORKFLOW_STATUS_KEYS.EN_EXPLOITATION, to: WORKFLOW_STATUS_KEYS.A_CORRIGER, label: "Renvoyer pour correction", permission: PERMISSIONS.REPORTS_REVIEW_POOL },
  { from: WORKFLOW_STATUS_KEYS.A_CORRIGER, to: WORKFLOW_STATUS_KEYS.SOUMIS, label: "Resoumettre", permission: PERMISSIONS.INSPECTIONS_CONDUCT },
  { from: WORKFLOW_STATUS_KEYS.EN_EXPLOITATION, to: WORKFLOW_STATUS_KEYS.TRANSMIS, label: "Transmettre au bureau IPP", permission: PERMISSIONS.REPORTS_REVIEW_POOL },
  { from: WORKFLOW_STATUS_KEYS.TRANSMIS, to: WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION, label: "Finaliser l'exploitation IPP", permission: PERMISSIONS.REPORTS_REVIEW_PROVINCE },
  { from: WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION, to: WORKFLOW_STATUS_KEYS.VALIDE, label: "Valider", permission: PERMISSIONS.REPORTS_VALIDATE },
  { from: WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION, to: WORKFLOW_STATUS_KEYS.REJETE, label: "Rejeter", permission: PERMISSIONS.REPORTS_VALIDATE },
  { from: WORKFLOW_STATUS_KEYS.REJETE, to: WORKFLOW_STATUS_KEYS.A_CORRIGER, label: "Renvoyer pour correction", permission: PERMISSIONS.REPORTS_REVIEW_PROVINCE },
  { from: WORKFLOW_STATUS_KEYS.VALIDE, to: WORKFLOW_STATUS_KEYS.CLOTURE, label: "Clôturer", permission: PERMISSIONS.REPORTS_VALIDATE },
];

// Fiches provisoires (§10, §24) — véritables modèles à fournir plus tard.
const CATEGORIES = [
  { code: "A", label: "Administration" },
  { code: "E", label: "Évaluation" },
  { code: "F", label: "Finances / contrôle financier" },
];

const FORM_TEMPLATES = [
  {
    code: "A1",
    categoryCode: "A",
    title: "Fiche A1 — Identification & administration (provisoire)",
    fieldsSchema: [
      { name: "regime", label: "Régime", type: "select", options: ["Public", "Privé", "Conventionné"] },
      { name: "effectifGarcons", label: "Effectif garçons", type: "number" },
      { name: "effectifFilles", label: "Effectif filles", type: "number" },
      { name: "nombreEnseignants", label: "Nombre d'enseignants", type: "number" },
      { name: "nombreSalles", label: "Nombre de salles de classe", type: "number" },
      { name: "accesEau", label: "Accès à l'eau potable", type: "select", options: ["Oui", "Non"] },
      { name: "accesElectricite", label: "Accès à l'électricité", type: "select", options: ["Oui", "Non"] },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
  {
    code: "C101",
    categoryCode: "E",
    title: "Fiche C101 — Contrôle pédagogique (provisoire)",
    fieldsSchema: [
      { name: "presenceEnseignant", label: "Présence de l'enseignant", type: "select", options: ["Oui", "Non"] },
      { name: "cahierPreparation", label: "Cahier de préparation à jour", type: "select", options: ["Oui", "Non", "Partiel"] },
      { name: "respectProgramme", label: "Respect du programme officiel", type: "select", options: ["Oui", "Non", "Partiel"] },
      { name: "qualitePedagogie", label: "Qualité pédagogique observée (1-5)", type: "number" },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
  {
    code: "T1",
    categoryCode: "E",
    title: "Fiche T1 — Évaluation des résultats (provisoire)",
    fieldsSchema: [
      { name: "elevesPresentes", label: "Élèves présentés (examens)", type: "number" },
      { name: "elevesAdmis", label: "Élèves admis", type: "number" },
      { name: "tauxReussite", label: "Taux de réussite (%)", type: "number" },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
  {
    code: "F1",
    categoryCode: "F",
    title: "Fiche F1 — Contrôle financier (provisoire)",
    fieldsSchema: [
      { name: "regimeBudgetaire", label: "Régime budgétaire", type: "select", options: ["Public", "Privé", "Mixte"] },
      { name: "recettesMensuelles", label: "Recettes mensuelles (estimation)", type: "number" },
      { name: "depensesMensuelles", label: "Dépenses mensuelles (estimation)", type: "number" },
      { name: "ecartsConstates", label: "Écarts constatés", type: "textarea" },
      { name: "observations", label: "Observations", type: "textarea" },
    ],
  },
];

async function seedRbac() {
  const permissionRows = await Promise.all(
    PERMISSION_CATALOG.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: { label: p.label, category: p.category },
        create: { key: p.key, label: p.label, category: p.category },
      })
    )
  );
  const permissionByKey = new Map(permissionRows.map((p) => [p.key, p]));

  const roleRows = await Promise.all(
    ROLE_DEFINITIONS.map((r) =>
      prisma.roleDefinition.upsert({
        where: { key: r.key },
        update: { label: r.label, description: r.description, scope: r.scope },
        create: { key: r.key, label: r.label, description: r.description, scope: r.scope, isSystem: true },
      })
    )
  );
  const roleByKey = new Map(roleRows.map((r) => [r.key, r]));

  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByKey.get(roleKey);
    if (!role) continue;
    for (const permissionKey of permissionKeys) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  return roleByKey;
}

async function seedPools() {
  const rows = await Promise.all(
    POOLS.map((p) =>
      prisma.pool.upsert({
        where: { code: p.code },
        update: { name: p.name },
        create: { code: p.code, name: p.name },
      })
    )
  );
  return new Map(rows.map((p) => [p.code, p]));
}

async function seedWorkflow() {
  const statusRows = await Promise.all(
    WORKFLOW_STATUSES.map((s) =>
      prisma.workflowStatus.upsert({
        where: { key: s.key },
        update: { label: s.label, order: s.order, isTerminal: s.isTerminal ?? false },
        create: { key: s.key, label: s.label, order: s.order, isTerminal: s.isTerminal ?? false },
      })
    )
  );
  const statusByKey = new Map(statusRows.map((s) => [s.key, s]));

  for (const t of WORKFLOW_TRANSITIONS) {
    const fromStatus = statusByKey.get(t.from);
    const toStatus = statusByKey.get(t.to);
    if (!fromStatus || !toStatus) continue;
    await prisma.workflowTransition.upsert({
      where: { fromStatusId_toStatusId: { fromStatusId: fromStatus.id, toStatusId: toStatus.id } },
      update: { label: t.label, allowedPermissionKey: t.permission },
      create: {
        fromStatusId: fromStatus.id,
        toStatusId: toStatus.id,
        label: t.label,
        allowedPermissionKey: t.permission,
      },
    });
  }

  return statusByKey;
}

async function seedFormTemplates() {
  const categoryRows = await Promise.all(
    CATEGORIES.map((c) =>
      prisma.inspectionCategory.upsert({
        where: { code: c.code },
        update: { label: c.label },
        create: { code: c.code, label: c.label },
      })
    )
  );
  const categoryByCode = new Map(categoryRows.map((c) => [c.code, c]));

  for (const t of FORM_TEMPLATES) {
    const category = categoryByCode.get(t.categoryCode);
    if (!category) continue;
    await prisma.formTemplate.upsert({
      where: { code: t.code },
      update: { title: t.title, fieldsSchema: t.fieldsSchema, categoryId: category.id },
      create: { code: t.code, title: t.title, fieldsSchema: t.fieldsSchema, categoryId: category.id },
    });
  }
}

async function upsertDemoUser(params: {
  email: string;
  name: string;
  passwordHash: string;
  poolId?: string | null;
  roleId: string;
  roleScopedToPool: boolean;
}) {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: { name: params.name, status: "ACTIVE", poolId: params.poolId ?? null },
    create: {
      email: params.email,
      name: params.name,
      passwordHash: params.passwordHash,
      status: "ACTIVE",
      poolId: params.poolId ?? null,
    },
  });

  // UserRole a une contrainte unique (userId, roleId, poolId) où poolId peut
  // être NULL — Postgres ne déduplique pas les NULL sur une contrainte
  // unique, donc on recrée l'attribution à chaque seed plutôt que d'upsert
  // dessus, pour rester idempotent.
  await prisma.userRole.deleteMany({ where: { userId: user.id, roleId: params.roleId } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: params.roleId,
      poolId: params.roleScopedToPool ? params.poolId ?? null : null,
    },
  });

  return user;
}

async function main() {
  const password = await bcrypt.hash("Demo1234!", 10);

  const roleByKey = await seedRbac();
  const poolByCode = await seedPools();
  await seedWorkflow();
  await seedFormTemplates();

  const goma = poolByCode.get("GOMA")!;
  const karisimbi = poolByCode.get("KARISIMBI")!;

  await upsertDemoUser({
    email: "ipp@ipp-nordkivu1.test",
    name: "Ir Mozart Salama",
    passwordHash: password,
    roleId: roleByKey.get(ROLE_KEYS.IPP)!.id,
    roleScopedToPool: false,
  });

  await upsertDemoUser({
    email: "informaticien@ipp-nordkivu1.test",
    name: "Grace Nzuzi",
    passwordHash: password,
    roleId: roleByKey.get(ROLE_KEYS.INFORMATICIEN)!.id,
    roleScopedToPool: false,
  });

  const chefGoma = await upsertDemoUser({
    email: "chef.goma@ipp-nordkivu1.test",
    name: "Moise Bahati",
    passwordHash: password,
    poolId: goma.id,
    roleId: roleByKey.get(ROLE_KEYS.CHEF_POOL)!.id,
    roleScopedToPool: true,
  });

  await upsertDemoUser({
    email: "exploitant.goma@ipp-nordkivu1.test",
    name: "Alice Kavira",
    passwordHash: password,
    poolId: goma.id,
    roleId: roleByKey.get(ROLE_KEYS.EXPLOITANT_POOL)!.id,
    roleScopedToPool: true,
  });

  const inspecteurGoma = await upsertDemoUser({
    email: "inspecteur.goma@ipp-nordkivu1.test",
    name: "Jean Mapenzi",
    passwordHash: password,
    poolId: goma.id,
    roleId: roleByKey.get(ROLE_KEYS.INSPECTEUR)!.id,
    roleScopedToPool: true,
  });

  await upsertDemoUser({
    email: "exploitant.ipp@ipp-nordkivu1.test",
    name: "Furaha Mbusa",
    passwordHash: password,
    roleId: roleByKey.get(ROLE_KEYS.EXPLOITANT_IPP)!.id,
    roleScopedToPool: false,
  });

  const school1 = await prisma.school.upsert({
    where: { code: "EP-GOMA-001" },
    update: { poolId: goma.id },
    create: {
      name: "EP Les Volcans",
      code: "EP-GOMA-001",
      poolId: goma.id,
      province: "Nord-Kivu",
      territoire: "Goma",
      director: "M. Bahati",
      type: "Primaire",
    },
  });

  const school2 = await prisma.school.upsert({
    where: { code: "INST-GOMA-002" },
    update: { poolId: goma.id },
    create: {
      name: "Institut La Paix",
      code: "INST-GOMA-002",
      poolId: goma.id,
      province: "Nord-Kivu",
      territoire: "Goma",
      director: "Mme Furaha",
      type: "Secondaire",
    },
  });

  await prisma.school.upsert({
    where: { code: "EP-KARISIMBI-001" },
    update: { poolId: karisimbi.id },
    create: {
      name: "EP Mont Karisimbi",
      code: "EP-KARISIMBI-001",
      poolId: karisimbi.id,
      province: "Nord-Kivu",
      territoire: "Karisimbi",
      director: "M. Kambale",
      type: "Primaire",
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-1" },
    update: {},
    create: {
      id: "seed-assignment-1",
      schoolId: school1.id,
      inspectorId: inspecteurGoma.id,
      assignedById: chefGoma.id,
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-2" },
    update: {},
    create: {
      id: "seed-assignment-2",
      schoolId: school2.id,
      inspectorId: inspecteurGoma.id,
      assignedById: chefGoma.id,
    },
  });

  console.log("Seed terminé. Comptes de démo (mot de passe : Demo1234!) :");
  console.log("- ipp@ipp-nordkivu1.test (Inspecteur Principal Provincial)");
  console.log("- informaticien@ipp-nordkivu1.test (Informaticien)");
  console.log("- chef.goma@ipp-nordkivu1.test (Chef de pool — Goma)");
  console.log("- exploitant.goma@ipp-nordkivu1.test (Exploitant de pool — Goma)");
  console.log("- inspecteur.goma@ipp-nordkivu1.test (Inspecteur itinérant — Goma)");
  console.log("- exploitant.ipp@ipp-nordkivu1.test (Exploitant IPP — Bureau d'exploitation)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
