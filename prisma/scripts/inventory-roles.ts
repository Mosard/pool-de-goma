// Inventaire EN LECTURE SEULE des fonctions et de leurs permissions réelles
// en base (les droits sont lus en base, pas dans le code). Aucune donnée
// personnelle : clés de fonction, permissions et nombre de titulaires.
//
// Usage : DATABASE_URL_SCRIPT (ou POSTGRES_URL)=<url> npx tsx prisma/scripts/inventory-roles.ts

import { describe, scriptClient } from "./db-connection";
import { PERMISSION_CATALOG } from "../../src/lib/rbac-data";

const { prisma, shape } = scriptClient();

async function main() {
  console.log(`Connexion via ${describe(shape)}\n`);
  const roles = await prisma.roleDefinition.findMany({
    orderBy: { key: "asc" },
    select: {
      key: true,
      scope: true,
      rolePermissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { userRoles: true } },
    },
  });
  const all = PERMISSION_CATALOG.map((p) => p.key);
  for (const r of roles) {
    const perms = r.rolePermissions.map((rp) => rp.permission.key).sort();
    console.log(`${r.key} (${r.scope}, ${r._count.userRoles} titulaire(s))`);
    console.log(`  a       : ${perms.join(", ") || "aucune"}`);
    const missing = all.filter((k) => !perms.includes(k));
    if (r.key === "ipp" || r.key === "informaticien") console.log(`  n'a pas : ${missing.join(", ") || "rien"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
