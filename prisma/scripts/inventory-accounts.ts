// Inventaire EN LECTURE SEULE des comptes et de leur capacité à valider les
// demandes. Aucune écriture : uniquement des SELECT. N'affiche aucune donnée
// personnelle (ni nom, ni e-mail, ni téléphone) — seulement des compteurs.
//
// Usage : POSTGRES_URL=<url de la base à inspecter> npx tsx prisma/scripts/inventory-accounts.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.count();
  console.log(`Organisations : ${orgs}`);

  const adminRoles = await prisma.roleDefinition.findMany({
    where: { rolePermissions: { some: { permission: { key: "accounts.manage" } } } },
    select: { key: true },
    orderBy: { key: "asc" },
  });
  console.log(
    `Fonctions habilitées à valider les demandes (accounts.manage) : ${adminRoles.map((r) => r.key).join(", ") || "AUCUNE"}`
  );

  const byStatus = await prisma.user.groupBy({ by: ["isDemo", "status"], _count: { _all: true } });
  console.log("\nComptes par type et statut :");
  for (const row of byStatus.sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || a.status.localeCompare(b.status))) {
    console.log(`  ${row.isDemo ? "démo    " : "officiel"}  ${row.status.padEnd(9)} ${row._count._all}`);
  }

  const adminHolders = await prisma.userRole.findMany({
    where: { role: { rolePermissions: { some: { permission: { key: "accounts.manage" } } } } },
    select: { userId: true, role: { select: { key: true } }, user: { select: { isDemo: true, status: true } } },
  });
  const tally = new Map<string, Set<string>>();
  for (const h of adminHolders) {
    const k = `${h.user.isDemo ? "démo" : "officiel"} | ${h.role.key} | ${h.user.status}`;
    if (!tally.has(k)) tally.set(k, new Set());
    tally.get(k)!.add(h.userId);
  }
  console.log("\nTitulaires d'une fonction qui valide les demandes (type | fonction | statut : nombre) :");
  if (tally.size === 0) console.log("  aucun");
  for (const [k, ids] of [...tally.entries()].sort()) console.log(`  ${k} : ${ids.size}`);

  const officialActiveAdmins = new Set(
    adminHolders.filter((h) => !h.user.isDemo && h.user.status === "ACTIVE").map((h) => h.userId)
  ).size;
  console.log(`\n=> Administrateurs OFFICIELS ACTIFS capables de valider une demande réelle : ${officialActiveAdmins}`);

  const requests = await prisma.accountRequest.findMany({ where: { status: "PENDING" }, select: { email: true } });
  const demoReq = requests.filter((r) => r.email.toLowerCase().endsWith(".test")).length;
  console.log(`Demandes en attente : ${requests.length} (réelles : ${requests.length - demoReq}, démo .test : ${demoReq})`);

  const liveTokens = await prisma.passwordResetToken.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } });
  console.log(`Liens d'activation / réinitialisation encore valides : ${liveTokens}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
