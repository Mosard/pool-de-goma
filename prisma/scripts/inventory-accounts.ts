// Inventaire EN LECTURE SEULE des comptes et de leur capacité à valider les
// demandes. Aucune écriture : uniquement des SELECT. N'affiche aucune donnée
// personnelle (ni nom, ni e-mail, ni téléphone) — seulement des compteurs.
//
// Usage : POSTGRES_URL=<url de la base à inspecter> npx tsx prisma/scripts/inventory-accounts.ts
// Réseau qui filtre le port 5432 : DATABASE_URL_SCRIPT=<url prisma+postgres://…> (voir db-connection.ts).
// L'URL et ses identifiants ne sont jamais affichés.

import { describe, probePostgres, scriptClient, scrub } from "./db-connection";

const { prisma, shape } = scriptClient();

async function checkConnection(): Promise<boolean> {
  console.log(`Connexion via ${describe(shape)}`);
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Connexion établie en ${Date.now() - t0} ms.\n`);
    return true;
  } catch (e) {
    const err = e as { errorCode?: string; code?: string; message?: string };
    console.error(`\nÉchec de connexion (${err.errorCode ?? err.code ?? "sans code"}) : ${scrub(err.message ?? String(e)).split("\n").filter(Boolean).pop()}`);
    if (shape.scheme.startsWith("postgres")) {
      const probe = await probePostgres(shape.host, Number(shape.port));
      console.error(`Test du protocole Postgres sur ${shape.host}:${shape.port} (sans identifiant) : ${probe}`);
      if (!probe.startsWith("OK")) {
        console.error(
          "=> Le port s'ouvre mais le protocole Postgres n'aboutit pas : le réseau de ce poste filtre ce trafic.\n" +
            "   Utilisez l'URL Prisma Postgres passant par HTTPS (prisma+postgres://accelerate.prisma-data.net/?api_key=…)\n" +
            "   dans DATABASE_URL_SCRIPT, ou lancez le script depuis un autre réseau."
        );
      }
    }
    return false;
  }
}

async function main() {
  if (!(await checkConnection())) process.exitCode = 1;
  if (process.exitCode) return;

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
