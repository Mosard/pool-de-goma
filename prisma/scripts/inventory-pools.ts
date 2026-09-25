// Inventaire EN LECTURE SEULE des POOL et de leur préparation à la
// publication. Aucune écriture : uniquement des SELECT. N'affiche aucune
// donnée personnelle (ni nom, ni email, ni téléphone de compte) — seulement
// des libellés de POOL et des compteurs.
//
// Usage : POSTGRES_URL=<url de la base à inspecter> npx tsx prisma/scripts/inventory-pools.ts
//
// Fonctionne avant comme après la migration 20260925150000_pool_public_profile
// (les colonnes slug/address/phones sont lues seulement si elles existent).

import { PrismaClient } from "@prisma/client";

const LEGACY_SLUGS = [
  "goma",
  "karisimbi-1",
  "karisimbi-2",
  "nyiragongo",
  "rutshuru-1",
  "rutshuru-2",
  "rutshuru-3",
  "rutshuru-4",
  "rutshuru-5",
];

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Pool' AND column_name IN ('slug', 'address', 'phones')`;
  const hasPublicColumns = columns.length === 3;

  const pools = await prisma.$queryRawUnsafe<
    { id: string; name: string; code: string; active: boolean; org: string; slug: string | null; has_address: boolean; phone_count: number }[]
  >(
    `SELECT p."id", p."name", p."code", p."active", o."code" AS org,
            ${hasPublicColumns ? `p."slug", p."address" IS NOT NULL AS has_address, COALESCE(cardinality(p."phones"), 0)::int AS phone_count` : `NULL AS slug, false AS has_address, 0 AS phone_count`}
     FROM "Pool" p JOIN "Organization" o ON o."id" = p."organizationId"
     ORDER BY o."code", p."name"`
  );

  const counts = await prisma.$queryRaw<
    { pool_id: string; schools: number; active_inspectors: number; chief_holders: number; eligible_chiefs: number }[]
  >`
    SELECT p."id" AS pool_id,
      (SELECT COUNT(*)::int FROM "School" s WHERE s."poolId" = p."id" AND s."active") AS schools,
      (SELECT COUNT(DISTINCT ur."userId")::int FROM "UserRole" ur
         JOIN "RoleDefinition" r ON r."id" = ur."roleId" JOIN "User" u ON u."id" = ur."userId"
         WHERE ur."poolId" = p."id" AND r."key" = 'inspecteur' AND u."status" = 'ACTIVE') AS active_inspectors,
      (SELECT COUNT(*)::int FROM "UserRole" ur JOIN "RoleDefinition" r ON r."id" = ur."roleId"
         WHERE ur."poolId" = p."id" AND r."key" = 'chef_pool') AS chief_holders,
      (SELECT COUNT(*)::int FROM "UserRole" ur JOIN "RoleDefinition" r ON r."id" = ur."roleId"
         JOIN "User" u ON u."id" = ur."userId"
         WHERE ur."poolId" = p."id" AND r."key" = 'chef_pool' AND u."status" = 'ACTIVE'
           AND EXISTS (SELECT 1 FROM "UserRole" ur2 JOIN "RoleDefinition" r2 ON r2."id" = ur2."roleId"
                       WHERE ur2."userId" = u."id" AND ur2."poolId" = p."id" AND r2."key" = 'inspecteur')) AS eligible_chiefs
    FROM "Pool" p`;
  const countByPool = new Map(counts.map((c) => [c.pool_id, c]));

  console.log(`Colonnes de fiche publique présentes : ${hasPublicColumns ? "oui" : "non (migration non appliquée)"}`);
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
        telephones: p.phone_count,
        ecoles_actives: c?.schools ?? 0,
        inspecteurs_actifs: c?.active_inspectors ?? 0,
        titulaires_chef: c?.chief_holders ?? 0,
        chefs_eligibles: c?.eligible_chiefs ?? 0,
      };
    })
  );

  const claimed = new Set(pools.map((p) => p.slug).filter(Boolean));
  console.log("\nURL publiques existantes (site actuel) :");
  for (const slug of LEGACY_SLUGS) {
    console.log(`  /pools/${slug} → ${claimed.has(slug) ? "reliée à un POOL de la base" : "non reliée"}`);
  }

  const karisimbi = pools.filter((p) => /karisimbi/i.test(`${p.name} ${p.code}`));
  console.log(`\nPOOL dont le nom ou le code contient « Karisimbi » : ${karisimbi.length}`);
  for (const p of karisimbi) console.log(`  - « ${p.name} » (code ${p.code}, ${p.active ? "actif" : "inactif"})`);

  const [demo] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "User" WHERE "email" LIKE '%@ipp-nordkivu1.test'`;
  const [total] = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "User"`;
  console.log(`\nComptes : ${total.n} au total, dont ${demo.n} comptes de démonstration (@ipp-nordkivu1.test)`);

  const publication = await prisma.$queryRaw<{ role: string }[]>`
    SELECT r."key" AS role FROM "RolePermission" rp
    JOIN "Permission" p ON p."id" = rp."permissionId" JOIN "RoleDefinition" r ON r."id" = rp."roleId"
    WHERE p."key" = 'publication.manage'`;
  console.log(
    `Permission publication.manage : ${publication.length > 0 ? `accordée aux rôles ${publication.map((r) => r.role).join(", ")}` : "absente"}`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
