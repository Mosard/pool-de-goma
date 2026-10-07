-- Ajustements individuels des droits (écran « Gérer les accès »,
-- docs/ecran-gestion-acces.md). Migration ADDITIVE : nouvelle table seulement,
-- aucune donnée existante modifiée ; sans ligne ici, les droits restent ceux
-- des fonctions.
CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'REVOKE');

CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "poolId" TEXT,
    "effect" "PermissionEffect" NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_poolId_key" ON "UserPermission"("userId", "permissionId", "poolId");

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
