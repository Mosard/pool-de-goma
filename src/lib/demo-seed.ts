import { type RoleScope } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  ROLE_KEYS,
  WORKFLOW_STATUS_KEYS,
  type PermissionKey,
  type RoleKey,
} from "./rbac-data";

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

// ---------------------------------------------------------------------------
// Données de démonstration supplémentaires — jeux de données réalistes pour
// que les testeurs disposent d'un volume représentatif (au moins 25 lignes
// par liste principale : écoles, utilisateurs, affectations, inspections,
// rapports, demandes de compte). Les fonctions ci-dessous utilisent des
// index déterministes (pas de compteur mutable partagé) afin de pouvoir être
// exécutées en parallèle sans risque de collision, et une concurrence
// bornée (mapConcurrent) pour rester sous la limite de durée d'une fonction
// serverless tout en restant raisonnable pour le pool de connexions.
// ---------------------------------------------------------------------------

const FIRST_NAMES_M = [
  "Jean", "Pierre", "Paul", "Emmanuel", "Patrick", "Joseph", "Innocent", "Claude",
  "Fabrice", "Déo", "Chadrack", "Dieudonné", "Bienvenu", "Justin", "Freddy", "Elie",
  "Sadiki", "Bertin", "Alain", "Christian", "Moise", "Espoir", "Augustin", "Richard",
];

const FIRST_NAMES_F = [
  "Alice", "Furaha", "Grace", "Bella", "Chantal", "Esther", "Marie", "Solange",
  "Ange", "Clarisse", "Jacqueline", "Aline", "Nadine", "Vestine", "Bahati", "Kavira",
  "Neema", "Sifa", "Riziki", "Zawadi", "Providence", "Kyakimwa", "Masika", "Wivine",
];

const LAST_NAMES = [
  "Mapenzi", "Bahati", "Kavira", "Mbusa", "Nzuzi", "Kambale", "Mumbere", "Katembo",
  "Paluku", "Masika", "Kyakimwa", "Sivya", "Muhindo", "Kasereka", "Maombi", "Amani",
  "Baraka", "Salama", "Ndoole", "Rukara", "Bwiza", "Musubao", "Kahindo", "Vahwere", "Bakenga",
];

const LOCALITIES = [
  "Katindo", "Himbi", "Majengo", "Mabanga Sud", "Ndosho", "Mugunga", "Kyeshero",
  "Bujovu", "Kasika", "Kahembe", "Buhimba", "Kibumba", "Rugari", "Kiwanja",
  "Rutshuru-Centre", "Bunagana", "Nyamilima", "Ishasha", "Rwindi", "Kanyabayonga",
  "Kirumba", "Lubero-Centre", "Kayna", "Alimbongo", "Sake", "Bweremana", "Jomba",
  "Vitshumbi", "Kibirizi", "Mabenga", "Rubare", "Kalengera",
];

function personName(i: number) {
  const isMale = i % 2 === 0;
  const first = isMale ? FIRST_NAMES_M[i % FIRST_NAMES_M.length] : FIRST_NAMES_F[i % FIRST_NAMES_F.length];
  const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
  return { first, last, sex: (isMale ? "M" : "F") as "M" | "F", name: `${first} ${last}` };
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

const CONCURRENCY = 8;

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

  const rolePermissionPairs = Object.entries(ROLE_PERMISSIONS).flatMap(([roleKey, permissionKeys]) => {
    const role = roleByKey.get(roleKey);
    if (!role) return [];
    return permissionKeys
      .map((permissionKey) => permissionByKey.get(permissionKey))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((permission) => ({ roleId: role.id, permissionId: permission.id }));
  });

  await mapConcurrent(rolePermissionPairs, CONCURRENCY, (pair) =>
    prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: pair.roleId, permissionId: pair.permissionId } },
      update: {},
      create: pair,
    })
  );

  return roleByKey;
}

const DEFAULT_ORGANIZATION = { code: "IPP-NORD-KIVU-1", name: "IPP Nord-Kivu 1" };

async function seedOrganization() {
  return prisma.organization.upsert({
    where: { code: DEFAULT_ORGANIZATION.code },
    update: { name: DEFAULT_ORGANIZATION.name },
    create: { code: DEFAULT_ORGANIZATION.code, name: DEFAULT_ORGANIZATION.name },
  });
}

async function seedPools(organizationId: string) {
  const rows = await Promise.all(
    POOLS.map((p) =>
      prisma.pool.upsert({
        where: { code: p.code },
        update: { name: p.name, organizationId },
        create: { code: p.code, name: p.name, organizationId },
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

  await mapConcurrent(WORKFLOW_TRANSITIONS, CONCURRENCY, async (t) => {
    const fromStatus = statusByKey.get(t.from);
    const toStatus = statusByKey.get(t.to);
    if (!fromStatus || !toStatus) return;
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
  });

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

  await mapConcurrent(FORM_TEMPLATES, CONCURRENCY, async (t) => {
    const category = categoryByCode.get(t.categoryCode);
    if (!category) return;
    await prisma.formTemplate.upsert({
      where: { code: t.code },
      update: { title: t.title, fieldsSchema: t.fieldsSchema, categoryId: category.id },
      create: { code: t.code, title: t.title, fieldsSchema: t.fieldsSchema, categoryId: category.id },
    });
  });
}

async function upsertDemoUser(params: {
  email: string;
  name: string;
  passwordHash: string;
  organizationId: string;
  poolId?: string | null;
  roleId: string;
  roleScopedToPool: boolean;
  sex?: "M" | "F";
  phone?: string;
  matricule?: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      status: "ACTIVE",
      organizationId: params.organizationId,
      poolId: params.poolId ?? null,
      sex: params.sex,
      phone: params.phone,
      matricule: params.matricule,
    },
    create: {
      email: params.email,
      name: params.name,
      passwordHash: params.passwordHash,
      status: "ACTIVE",
      organizationId: params.organizationId,
      poolId: params.poolId ?? null,
      sex: params.sex,
      phone: params.phone,
      matricule: params.matricule,
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

type PoolRow = { id: string; code: string; name: string };
type RoleRow = { id: string; key: string };
type StatusRow = { id: string; key: string };

async function seedDemoSchools(poolByCode: Map<string, PoolRow>) {
  const SCHOOLS_PER_POOL = 4;
  const TYPE_CYCLE = [
    { type: "Primaire", prefix: "EP" },
    { type: "Secondaire", prefix: "INST" },
    { type: "Primaire", prefix: "EP" },
    { type: "Maternelle", prefix: "EM" },
  ] as const;

  const pools = Array.from(poolByCode.values());
  const jobs = pools.flatMap((pool, poolIdx) =>
    Array.from({ length: SCHOOLS_PER_POOL }, (_, i) => ({ pool, poolIdx, i, globalIdx: poolIdx * SCHOOLS_PER_POOL + i }))
  );

  const rows = await mapConcurrent(jobs, CONCURRENCY, async ({ pool, i, globalIdx }) => {
    const locality = LOCALITIES[globalIdx % LOCALITIES.length];
    const { type, prefix } = TYPE_CYCLE[i % TYPE_CYCLE.length];
    const code = `SCH-${pool.code}-${String(i + 1).padStart(2, "0")}`;
    const name = `${prefix} ${locality}`;
    const director = personName(globalIdx + 1).name;

    const school = await prisma.school.upsert({
      where: { code },
      update: { poolId: pool.id, name, type, director },
      create: {
        code,
        poolId: pool.id,
        name,
        province: "Nord-Kivu",
        territoire: pool.name,
        director,
        phone: `+243${900000000 + globalIdx}`,
        type,
      },
    });
    return { id: school.id, poolCode: pool.code };
  });

  return rows;
}

const POOL_ROLE_CYCLE: { roleKey: RoleKey; count: number }[] = [
  { roleKey: ROLE_KEYS.CHEF_POOL, count: 1 },
  { roleKey: ROLE_KEYS.EXPLOITANT_POOL, count: 1 },
  { roleKey: ROLE_KEYS.SECRETAIRE_POOL, count: 1 },
  { roleKey: ROLE_KEYS.AGENT_POOL, count: 1 },
  { roleKey: ROLE_KEYS.INSPECTEUR, count: 2 },
];
const SLOTS_PER_POOL = POOL_ROLE_CYCLE.reduce((sum, r) => sum + r.count, 0);

async function seedDemoUsers(
  organizationId: string,
  poolByCode: Map<string, PoolRow>,
  roleByKey: Map<string, RoleRow>,
  passwordHash: string
) {
  const pools = Array.from(poolByCode.values());
  const jobs: { pool: PoolRow; roleKey: RoleKey; n: number }[] = [];

  pools.forEach((pool, poolIdx) => {
    let slot = 0;
    for (const { roleKey, count } of POOL_ROLE_CYCLE) {
      for (let i = 0; i < count; i++) {
        jobs.push({ pool, roleKey, n: poolIdx * SLOTS_PER_POOL + slot + 1 });
        slot++;
      }
    }
  });

  const created = await mapConcurrent(jobs, CONCURRENCY, async ({ pool, roleKey, n }) => {
    const role = roleByKey.get(roleKey);
    if (!role) return null;

    const p = personName(n);
    const email = `${slugify(`${p.first}.${p.last}`)}.${pool.code.toLowerCase()}@ipp-nordkivu1.test`;

    const user = await upsertDemoUser({
      email,
      name: p.name,
      passwordHash,
      organizationId,
      poolId: pool.id,
      roleId: role.id,
      roleScopedToPool: true,
      sex: p.sex,
      phone: `+243${900000000 + n}`,
      matricule: `MAT-${pool.code}-${String(n).padStart(4, "0")}`,
    });

    return { poolCode: pool.code, roleKey, userId: user.id };
  });

  const poolStaff = new Map<string, { chefId: string; inspecteurs: { id: string }[] }>();
  for (const pool of pools) poolStaff.set(pool.code, { chefId: "", inspecteurs: [] });

  for (const row of created) {
    if (!row) continue;
    const staff = poolStaff.get(row.poolCode)!;
    if (row.roleKey === ROLE_KEYS.CHEF_POOL) staff.chefId = row.userId;
    if (row.roleKey === ROLE_KEYS.INSPECTEUR) staff.inspecteurs.push({ id: row.userId });
  }

  return poolStaff;
}

const ASSIGNMENTS_PER_INSPECTEUR = 3;
const INSPECTION_STATUS_CYCLE = [
  "PLANIFIEE", "EN_COURS", "TERMINEE", "RAPPORT_SOUMIS", "RAPPORT_SOUMIS", "VALIDEE", "VALIDEE",
] as const;
const REPORT_STATUS_IN_PROGRESS = [
  WORKFLOW_STATUS_KEYS.SOUMIS, WORKFLOW_STATUS_KEYS.RECU, WORKFLOW_STATUS_KEYS.EN_EXPLOITATION,
  WORKFLOW_STATUS_KEYS.TRANSMIS, WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION,
];
const REPORT_STATUS_DONE = [WORKFLOW_STATUS_KEYS.VALIDE, WORKFLOW_STATUS_KEYS.CLOTURE];

async function seedDemoAssignmentsAndInspections(
  schools: { id: string; poolCode: string }[],
  poolStaff: Map<string, { chefId: string; inspecteurs: { id: string }[] }>,
  statusByKey: Map<string, StatusRow>
) {
  const jobs: {
    poolCode: string;
    chefId: string;
    inspecteurId: string;
    globalIdx: number;
  }[] = [];

  let globalIdx = 0;
  for (const [poolCode, staff] of poolStaff.entries()) {
    if (!staff.chefId) continue;
    for (const inspecteur of staff.inspecteurs) {
      for (let a = 0; a < ASSIGNMENTS_PER_INSPECTEUR; a++) {
        globalIdx++;
        jobs.push({ poolCode, chefId: staff.chefId, inspecteurId: inspecteur.id, globalIdx });
      }
    }
  }

  const schoolsByPool = new Map<string, { id: string; poolCode: string }[]>();
  for (const s of schools) {
    const list = schoolsByPool.get(s.poolCode) ?? [];
    list.push(s);
    schoolsByPool.set(s.poolCode, list);
  }

  const results = await mapConcurrent(jobs, CONCURRENCY, async (job) => {
    const poolSchools = schoolsByPool.get(job.poolCode) ?? [];
    if (poolSchools.length === 0) return { hasReport: false };
    const school = poolSchools[job.globalIdx % poolSchools.length];

    await prisma.assignment.upsert({
      where: { id: `seed-assign-${job.globalIdx}` },
      update: { schoolId: school.id, inspectorId: job.inspecteurId, assignedById: job.chefId },
      create: {
        id: `seed-assign-${job.globalIdx}`,
        schoolId: school.id,
        inspectorId: job.inspecteurId,
        assignedById: job.chefId,
      },
    });

    const status = INSPECTION_STATUS_CYCLE[job.globalIdx % INSPECTION_STATUS_CYCLE.length];
    const scheduledDate = new Date(Date.now() - job.globalIdx * 3 * 24 * 60 * 60 * 1000);
    const isPastPlanning = status !== "PLANIFIEE";

    const inspection = await prisma.inspection.upsert({
      where: { id: `seed-insp-${job.globalIdx}` },
      update: { status, schoolId: school.id, inspectorId: job.inspecteurId },
      create: {
        id: `seed-insp-${job.globalIdx}`,
        schoolId: school.id,
        inspectorId: job.inspecteurId,
        status,
        scheduledDate,
        completedAt: isPastPlanning && status !== "EN_COURS" ? scheduledDate : null,
      },
    });

    if (status !== "RAPPORT_SOUMIS" && status !== "VALIDEE") {
      return { hasReport: false };
    }

    const isDone = status === "VALIDEE";
    const statusPool = isDone ? REPORT_STATUS_DONE : REPORT_STATUS_IN_PROGRESS;
    const statusKey = statusPool[job.globalIdx % statusPool.length];
    const workflowStatus = statusByKey.get(statusKey);
    if (!workflowStatus) return { hasReport: false };

    const report = await prisma.report.upsert({
      where: { inspectionId: inspection.id },
      update: { statusId: workflowStatus.id },
      create: {
        inspectionId: inspection.id,
        summary: "Inspection réalisée conformément à la fiche prévue. Constat global satisfaisant, quelques points d'attention relevés.",
        recommendations: "Poursuivre le suivi pédagogique et renforcer l'accès aux infrastructures de base.",
        statusId: workflowStatus.id,
        submittedAt: scheduledDate,
        validatedAt: isDone ? scheduledDate : null,
      },
    });

    const historyCount = await prisma.reportStatusHistory.count({ where: { reportId: report.id } });
    if (historyCount === 0) {
      await prisma.reportStatusHistory.create({
        data: {
          reportId: report.id,
          toStatusId: workflowStatus.id,
          changedById: job.chefId,
          comment: "Généré via le jeu de données de démonstration.",
        },
      });
    }

    return { hasReport: true };
  });

  return {
    assignmentsCreated: jobs.length,
    inspectionsCreated: jobs.length,
    reportsCreated: results.filter((r) => r.hasReport).length,
  };
}

const REQUEST_ROLE_CYCLE: RoleKey[] = [
  ROLE_KEYS.INSPECTEUR, ROLE_KEYS.SECRETAIRE_POOL, ROLE_KEYS.AGENT_POOL, ROLE_KEYS.EXPLOITANT_POOL,
];
const REQUEST_STATUS_CYCLE = ["PENDING", "PENDING", "APPROVED", "REJECTED"] as const;
const ACCOUNT_REQUEST_COUNT = 25;

async function seedDemoAccountRequests(
  organizationId: string,
  poolByCode: Map<string, PoolRow>,
  roleByKey: Map<string, RoleRow>
) {
  const pools = Array.from(poolByCode.values());
  const items = Array.from({ length: ACCOUNT_REQUEST_COUNT }, (_, idx) => idx + 1);

  await mapConcurrent(items, CONCURRENCY, async (i) => {
    const p = personName(200 + i);
    const pool = pools[i % pools.length];
    const roleKey = REQUEST_ROLE_CYCLE[i % REQUEST_ROLE_CYCLE.length];
    const role = roleByKey.get(roleKey);
    const status = REQUEST_STATUS_CYCLE[i % REQUEST_STATUS_CYCLE.length];

    await prisma.accountRequest.upsert({
      where: { id: `seed-accreq-${i}` },
      update: { status },
      create: {
        id: `seed-accreq-${i}`,
        name: p.name,
        email: `${slugify(`${p.first}.${p.last}`)}.demande${i}@example.test`,
        phone: `+243${910000000 + i}`,
        message: "Demande de création de compte pour accéder à la plateforme d'inspection.",
        requestedRoleId: role?.id,
        organizationId,
        poolId: pool.id,
        status,
        reviewedAt: status === "PENDING" ? null : new Date(),
      },
    });
  });

  return ACCOUNT_REQUEST_COUNT;
}

export async function runDemoSeed() {
  const log: string[] = [];
  const push = (line: string) => {
    log.push(line);
    console.log(line);
  };

  const password = await bcrypt.hash("Demo1234!", 10);

  const organization = await seedOrganization();
  const roleByKey = await seedRbac();
  const poolByCode = await seedPools(organization.id);
  const statusByKey = await seedWorkflow();
  await seedFormTemplates();

  const goma = poolByCode.get("GOMA")!;
  const karisimbi = poolByCode.get("KARISIMBI")!;

  await upsertDemoUser({
    email: "ipp@ipp-nordkivu1.test",
    name: "Ir Mozart Salama",
    passwordHash: password,
    organizationId: organization.id,
    roleId: roleByKey.get(ROLE_KEYS.IPP)!.id,
    roleScopedToPool: false,
  });

  await upsertDemoUser({
    email: "informaticien@ipp-nordkivu1.test",
    name: "Grace Nzuzi",
    passwordHash: password,
    organizationId: organization.id,
    roleId: roleByKey.get(ROLE_KEYS.INFORMATICIEN)!.id,
    roleScopedToPool: false,
  });

  const chefGoma = await upsertDemoUser({
    email: "chef.goma@ipp-nordkivu1.test",
    name: "Moise Bahati",
    passwordHash: password,
    organizationId: organization.id,
    poolId: goma.id,
    roleId: roleByKey.get(ROLE_KEYS.CHEF_POOL)!.id,
    roleScopedToPool: true,
  });

  await upsertDemoUser({
    email: "exploitant.goma@ipp-nordkivu1.test",
    name: "Alice Kavira",
    passwordHash: password,
    organizationId: organization.id,
    poolId: goma.id,
    roleId: roleByKey.get(ROLE_KEYS.EXPLOITANT_POOL)!.id,
    roleScopedToPool: true,
  });

  const inspecteurGoma = await upsertDemoUser({
    email: "inspecteur.goma@ipp-nordkivu1.test",
    name: "Jean Mapenzi",
    passwordHash: password,
    organizationId: organization.id,
    poolId: goma.id,
    roleId: roleByKey.get(ROLE_KEYS.INSPECTEUR)!.id,
    roleScopedToPool: true,
  });

  await upsertDemoUser({
    email: "exploitant.ipp@ipp-nordkivu1.test",
    name: "Furaha Mbusa",
    passwordHash: password,
    organizationId: organization.id,
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

  // Jeux de données de démonstration en volume (≥ 25 lignes par liste) pour
  // que les testeurs voient une application déjà peuplée et représentative.
  const generatedSchools = await seedDemoSchools(poolByCode);
  const poolStaff = await seedDemoUsers(organization.id, poolByCode, roleByKey, password);
  const { assignmentsCreated, inspectionsCreated, reportsCreated } = await seedDemoAssignmentsAndInspections(
    generatedSchools,
    poolStaff,
    statusByKey
  );
  const accountRequestsCreated = await seedDemoAccountRequests(organization.id, poolByCode, roleByKey);

  push("Seed terminé. Comptes de démo (mot de passe : Demo1234!) :");
  push("- ipp@ipp-nordkivu1.test (Inspecteur Principal Provincial)");
  push("- informaticien@ipp-nordkivu1.test (Informaticien)");
  push("- chef.goma@ipp-nordkivu1.test (Chef de pool — Goma)");
  push("- exploitant.goma@ipp-nordkivu1.test (Exploitant de pool — Goma)");
  push("- inspecteur.goma@ipp-nordkivu1.test (Inspecteur itinérant — Goma)");
  push("- exploitant.ipp@ipp-nordkivu1.test (Exploitant IPP — Bureau d'exploitation)");
  push("Tous les comptes générés utilisent aussi le mot de passe Demo1234!");
  push(
    `Données de démonstration : ${generatedSchools.length} écoles, ${assignmentsCreated} affectations, ` +
      `${inspectionsCreated} inspections, ${reportsCreated} rapports, ${accountRequestsCreated} demandes de compte.`
  );

  return {
    log,
    counts: {
      schools: generatedSchools.length,
      users: SLOTS_PER_POOL * poolByCode.size,
      assignments: assignmentsCreated,
      inspections: inspectionsCreated,
      reports: reportsCreated,
      accountRequests: accountRequestsCreated,
    },
  };
}
