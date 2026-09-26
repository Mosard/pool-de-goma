// Inventaire EN LECTURE SEULE des POOL et de leur préparation à la
// publication. Aucune écriture : uniquement des SELECT. N'affiche aucune
// donnée personnelle (ni nom, ni e-mail, ni téléphone de compte) — seulement
// des libellés de POOL et des compteurs.
//
// Usage : POSTGRES_URL=<url de la base à inspecter> npx tsx prisma/scripts/inventory-pools.ts
//
// Fonctionne avant comme après la migration 20260925150000_pool_public_profile.

import { PrismaClient } from "@prisma/client";

// Dénominations officielles confirmées par l'Inspection et URL publiques
// existantes. La comparaison avec la base est EXACTE (aucun rapprochement
// supposé, notamment entre « Karisimbi » et « Karisimbi 1/2 »).
const OFFICIAL = [
  { name: "Goma", slug: "goma" },
  { name: "Karisimbi 1", slug: "karisimbi-1" },
  { name: "Karisimbi 2", slug: "karisimbi-2" },
  { name: "Nyiragongo", slug: "nyiragongo" },
  { name: "Rutshuru 1", slug: "rutshuru-1" },
  { name: "Rutshuru 2", slug: "rutshuru-2" },
  { name: "Rutshuru 3", slug: "rutshuru-3" },
  { name: "Rutshuru 4", slug: "rutshuru-4" },
  { name: "Rutshuru 5", slug: "rutshuru-5" },
];

const prisma = new PrismaClient();

async function columnExists(table: string, column: string) {
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}`;
  return rows[0].n > 0;
}

async function main() {
  const migrated = (await columnExists("Pool", "slug")) && (await columnExists("User", "isDemo"));
  console.log(`Migration pool_public_profile appliquée : ${migrated ? "oui" : "non"}`);

  const pools = await prisma.$queryRawUnsafe<
    { id: string; name: string; code: string; active: boolean; org: string; slug: string | null; has_address: boolean; has_email: boolean }[]
  >(
    `SELECT p."id", p."name", p."code", p."active", o."code" AS org,
            ${migrated ? `p."slug", p."address" IS NOT NULL AS has_address, p."officialEmail" IS NOT NULL AS has_email` : `NULL AS slug, false AS has_address, false AS has_email`}
     FROM "Pool" p JOIN "Organization" o ON o."id" = p."organizationId"
     ORDER BY o."code", p."name"`
  );

  const demoUser = migrated ? `u."isDemo"` : `lower(u."email") LIKE '%.test'`;
  const demoSchool = migrated
    ? `s."isDemo"`
    : `(s."code" ~ '^SCH-(GOMA|KARISIMBI|NYIRAGONGO|RUTSHURU-[1-5])-0[1-4]$' OR s."code" IN ('EP-GOMA-001','INST-GOMA-002','EP-KARISIMBI-001'))`;

  const counts = await prisma.$queryRawUnsafe<
    { pool_id: string; schools: number; demo_schools: number; inspectors: number; demo_inspectors: number; agents: number; chief_holders: number }[]
  >(`
    SELECT p."id" AS pool_id,
      (SELECT COUNT(*)::int FROM "School" s WHERE s."poolId" = p."id" AND s."active" AND NOT ${demoSchool}) AS schools,
      (SELECT COUNT(*)::int FROM "School" s WHERE s."poolId" = p."id" AND ${demoSchool}) AS demo_schools,
      (SELECT COUNT(DISTINCT ur."userId")::int FROM "UserRole" ur JOIN "RoleDefinition" r ON r."id" = ur."roleId"
         JOIN "User" u ON u."id" = ur."userId"
         WHERE ur."poolId" = p."id" AND r."key" = 'inspecteur' AND u."status" = 'ACTIVE' AND NOT ${demoUser}) AS inspectors,
      (SELECT COUNT(DISTINCT ur."userId")::int FROM "UserRole" ur JOIN "RoleDefinition" r ON r."id" = ur."roleId"
         JOIN "User" u ON u."id" = ur."userId"
         WHERE ur."poolId" = p."id" AND r."key" = 'inspecteur' AND ${demoUser}) AS demo_inspectors,
      (SELECT COUNT(DISTINCT ur."userId")::int FROM "UserRole" ur JOIN "RoleDefinition" r ON r."id" = ur."roleId"
         JOIN "User" u ON u."id" = ur."userId"
         WHERE ur."poolId" = p."id" AND r."scope" = 'POOL' AND r."key" NOT IN ('inspecteur', 'chef_pool')
           AND u."status" = 'ACTIVE' AND NOT ${demoUser}) AS agents,
      (SELECT COUNT(*)::int FROM "UserRole" ur JOIN "RoleDefinition" r ON r."id" = ur."roleId"
         WHERE ur."poolId" = p."id" AND r."key" = 'chef_pool') AS chief_holders
    FROM "Pool" p`);
  const countByPool = new Map(counts.map((c) => [c.pool_id, c]));

  console.log(`\nPOOL en base : ${pools.length}`);
  console.table(
    pools.map((p) => {
      const c = countByPool.get(p.id);
      return {
        organisation: p.org,
        nom: p.name,
        code: p.code,
        actif: p.active,
        slug: p.slug ?? "—",
        adresse: p.has_address ? "oui" : "non",
        email: p.has_email ? "oui" : "non",
        ecoles_reelles: c?.schools ?? 0,
        ecoles_demo: c?.demo_schools ?? 0,
        inspecteurs_reels: c?.inspectors ?? 0,
        inspecteurs_demo: c?.demo_inspectors ?? 0,
        autres_agents_reels: c?.agents ?? 0,
        titulaires_chef: c?.chief_holders ?? 0,
      };
    })
  );

  console.log("\nDénominations officielles → POOL de la base (correspondance EXACTE du nom) :");
  for (const o of OFFICIAL) {
    const exact = pools.filter((p) => p.name === o.name);
    const bySlug = pools.filter((p) => p.slug === o.slug);
    const status =
      exact.length === 1
        ? `trouvé (code ${exact[0].code})`
        : exact.length > 1
          ? `AMBIGU : ${exact.length} POOL portent ce nom`
          : "ABSENT sous ce nom exact";
    console.log(`  ${o.name.padEnd(12)} ${status} ; URL /pools/${o.slug} ${bySlug.length ? "reliée" : "non reliée"}`);
  }

  const others = pools.filter((p) => !OFFICIAL.some((o) => o.name === p.name));
  if (others.length > 0) {
    console.log("\nPOOL en base dont le nom ne figure pas dans la liste officielle (décision nécessaire) :");
    for (const p of others) console.log(`  - « ${p.name} » (code ${p.code}, ${p.active ? "actif" : "inactif"})`);
  }

  const [users] = await prisma.$queryRawUnsafe<{ total: number; demo: number }[]>(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ${demoUser})::int AS demo FROM "User" u`
  );
  const [demoAdmins] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(DISTINCT u."id")::int AS n FROM "User" u JOIN "UserRole" ur ON ur."userId" = u."id"
     JOIN "RoleDefinition" r ON r."id" = ur."roleId"
     WHERE ${demoUser} AND u."status" = 'ACTIVE' AND r."key" IN ('ipp', 'informaticien')`
  );
  console.log(`\nComptes : ${users.total} au total, dont ${users.demo} de démonstration.`);
  console.log(`Comptes de démonstration ACTIFS avec rôle IPP ou Informaticien : ${demoAdmins.n}`);

  const publication = await prisma.$queryRaw<{ role: string }[]>`
    SELECT r."key" AS role FROM "RolePermission" rp
    JOIN "Permission" p ON p."id" = rp."permissionId" JOIN "RoleDefinition" r ON r."id" = rp."roleId"
    WHERE p."key" = 'publication.manage'`;
  console.log(
    `Permission publication.manage : ${publication.length > 0 ? `accordée aux rôles ${publication.map((r) => r.role).join(", ")}` : "absente"}`
  );

  const [photos] = await prisma.$queryRaw<{ n: number; heavy: number; max_kb: number }[]>`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE length("photoUrl") > 200000)::int AS heavy,
           COALESCE(MAX(length("photoUrl")) / 1024, 0)::int AS max_kb
    FROM "User" WHERE "photoUrl" IS NOT NULL`;
  console.log(`Photos de profil : ${photos.n} (dont ${photos.heavy} de plus de ~200 Ko ; la plus lourde ≈ ${photos.max_kb} Ko en base64)`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
