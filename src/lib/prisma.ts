import { PrismaClient } from "@prisma/client";
import { ReadOnlyModeError } from "@/lib/errors";
import { READ_ONLY_WRITABLE_MODELS, isWriteOperation, shouldBlockWrite } from "@/lib/read-only-guard";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

// Falls back to a placeholder so the client can be constructed (and pages that
// never touch the DB, like /login for an anonymous visitor, keep working) even
// before POSTGRES_URL is configured on the hosting platform.
const datasourceUrl =
  process.env.POSTGRES_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    datasources: { db: { url: datasourceUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

/**
 * Mode consultation (décision du 2026-10-12) : pendant une bascule « Voir
 * comme » d'un informaticien ou d'un secrétaire de l'IPP, toute écriture est
 * refusée ICI, quel que soit l'écran ou l'action serveur qui la demande.
 * Contrôle fait seulement pour une écriture, et seulement si le cookie de
 * bascule est présent ; fonctions RÉELLES relues en base (client sans garde).
 * Hors requête (scripts, tests), aucun cookie : aucun effet.
 */
async function writeBlocked(model: string | undefined, operation: string): Promise<boolean> {
  if (!isWriteOperation(operation)) return false;
  if (model && READ_ONLY_WRITABLE_MODELS.includes(model)) return false;
  const { readViewMode } = await import("@/lib/view-mode");
  if (!(await readViewMode())) return false;
  const { auth } = await import("@/lib/auth");
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return false;
  const roles = await base.userRole.findMany({ where: { userId }, select: { role: { select: { key: true } } } });
  return shouldBlockWrite({ model, operation, viewModeActive: true, realRoleKeys: roles.map((r) => r.role.key) });
}

// Extension de requêtes seulement : l'API (modèles, transactions) est
// identique à celle de PrismaClient, d'où le type conservé pour tout le code.
export const prisma = base.$extends({
  name: "consultation-sans-ecriture",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (await writeBlocked(model, operation)) throw new ReadOnlyModeError();
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;

/** Refus explicite (exports, analyses IA) avant tout traitement coûteux, pendant une consultation. */
export async function assertNotReadOnly(): Promise<void> {
  if (await writeBlocked(undefined, "create")) throw new ReadOnlyModeError();
}
