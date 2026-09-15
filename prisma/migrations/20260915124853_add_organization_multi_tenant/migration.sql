-- Migration manuelle (retouchée après `prisma migrate diff`) : introduit
-- l'entité Organization (IPP) au-dessus de Pool, et rattache Pool / User /
-- AccountRequest / AuditLog à une organisation.
--
-- La version brute générée par Prisma ajoute organizationId en
-- `TEXT NOT NULL` sans valeur par défaut, ce qui échoue dès qu'une table
-- contient déjà des lignes (cas de la base actuelle : pools, utilisateurs,
-- demandes de compte). Cette version fait donc, pour chaque table concernée :
--   1) ajoute la colonne nullable,
--   2) la remplit (backfill) avec une organisation par défaut,
--   3) applique NOT NULL une fois que plus aucune ligne n'est nulle,
-- avant de créer les index et les clés étrangères.
--
-- IMPORTANT : le build de ce projet relance `tsx prisma/seed.ts` à chaque
-- déploiement (voir package.json#scripts.build). Ce seed fait un upsert
-- Organization par `code` = "IPP-NORD-KIVU-1". L'organisation créée ici doit
-- donc porter EXACTEMENT ce même code, sans quoi le seed créerait une
-- seconde organisation et y déplacerait les pools (par upsert sur leur
-- code), désynchronisant pools et utilisateurs déjà en place. C'est
-- délibéré : cette migration cible spécifiquement le déploiement IPP
-- Nord-Kivu 1, pas un bootstrap générique réutilisable tel quel ailleurs.

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- Bootstrap: une organisation par défaut qui reçoit toutes les lignes
-- existantes. Sur une base vide, cette ligne reste un placeholder inerte
-- (aucun Pool/User/AccountRequest ne la référence).
--
-- ON CONFLICT DO NOTHING : Prisma Migrate ne rejoue jamais une migration
-- déjà marquée "applied" (voir prisma/MIGRATIONS.md), donc ce n'est
-- normalement jamais exécuté deux fois. Ce garde-fou reste une défense en
-- profondeur si ce fichier était un jour rejoué manuellement hors du suivi
-- Prisma (psql, copier-coller, etc.) — dans ce cas la ligne existe déjà par
-- son "code" unique et l'INSERT devient un no-op au lieu d'échouer ou de
-- dupliquer.
INSERT INTO "Organization" ("id", "name", "code", "active", "createdAt", "updatedAt")
VALUES (
    'org_ipp_nordkivu1_bootstrap',
    'IPP Nord-Kivu 1',
    'IPP-NORD-KIVU-1',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

-- AlterTable: colonnes nullable dans un premier temps
ALTER TABLE "Pool" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AccountRequest" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;

-- Backfill: toutes les lignes existantes rattachées à l'organisation par défaut
UPDATE "Pool" SET "organizationId" = 'org_ipp_nordkivu1_bootstrap' WHERE "organizationId" IS NULL;
UPDATE "User" SET "organizationId" = 'org_ipp_nordkivu1_bootstrap' WHERE "organizationId" IS NULL;
UPDATE "AccountRequest" SET "organizationId" = 'org_ipp_nordkivu1_bootstrap' WHERE "organizationId" IS NULL;
UPDATE "AuditLog" SET "organizationId" = 'org_ipp_nordkivu1_bootstrap' WHERE "organizationId" IS NULL;

-- AlterTable: NOT NULL maintenant que chaque ligne a une valeur
ALTER TABLE "Pool" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountRequest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;

-- Filet de sécurité pour un rollback applicatif seul (voir procédure de
-- déploiement / plan de rollback) : si le code d'AVANT ce refactor est
-- redéployé alors que ce schéma reste en place, ses INSERT sur Pool / User /
-- AccountRequest / AuditLog n'écrivent jamais organizationId (colonne
-- inconnue de l'ancien code). Sans valeur par défaut en base, ces INSERT
-- échoueraient immédiatement (NOT NULL violation). Ce DEFAULT rend donc un
-- retour arrière du code seul non-bloquant à court terme : les nouvelles
-- lignes retombent sur l'organisation IPP Nord-Kivu 1 le temps de statuer.
-- Prisma ne connaît pas ce DEFAULT (absent du schema.prisma, qui n'en a pas
-- besoin puisque le code actuel fournit toujours organizationId) : un futur
-- `prisma migrate dev` le verra comme un léger drift et proposera de le
-- supprimer — c'est acceptable, à garder ou retirer consciemment plus tard.
ALTER TABLE "Pool" ALTER COLUMN "organizationId" SET DEFAULT 'org_ipp_nordkivu1_bootstrap';
ALTER TABLE "User" ALTER COLUMN "organizationId" SET DEFAULT 'org_ipp_nordkivu1_bootstrap';
ALTER TABLE "AccountRequest" ALTER COLUMN "organizationId" SET DEFAULT 'org_ipp_nordkivu1_bootstrap';
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET DEFAULT 'org_ipp_nordkivu1_bootstrap';

-- CreateIndex
CREATE INDEX "Pool_organizationId_idx" ON "Pool"("organizationId");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "AccountRequest_organizationId_idx" ON "AccountRequest"("organizationId");
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- AddForeignKey (AuditLog n'a pas de relation Prisma déclarée vers
-- Organization dans le schéma, donc pas de FK ici — cohérent avec le diff
-- Prisma, qui n'en génère pas non plus).
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
