-- Fiche publique des POOL, publication du personnel (accord + autorisation),
-- historique des affectations et marquage des données de démonstration.
--
-- Migration additive : aucune ligne n'est supprimée. Les seules lignes
-- existantes modifiées sont des marquages/rattrapages explicites :
--   - comptes de démonstration (e-mail en .test, domaine réservé qui ne peut
--     pas être une adresse réelle) → isDemo = true ;
--   - écoles créées par le seed de démonstration, reconnues à leurs codes
--     EXACTS (src/lib/demo-seed.ts) → isDemo = true ;
--   - affectations existantes : date d'effet = date de création.
-- Aucun POOL ne devient public : slug, adresse et e-mail restent vides, et
-- aucun accord ni aucune autorisation de publication n'est présumé.

-- CreateEnum
CREATE TYPE "PublicationDecisionKind" AS ENUM ('CONSENT', 'AUTHORIZATION');

-- CreateEnum
CREATE TYPE "PublicationScope" AS ENUM ('IDENTITY', 'PHOTO');

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN "slug" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "officialEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pool_slug_key" ON "Pool"("slug");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "photoUpdatedAt" TIMESTAMP(3),
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicationConsentIdentity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicationConsentPhoto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicationAuthIdentity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicationAuthPhoto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "School" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "endReason" TEXT,
ADD COLUMN "endedById" TEXT;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PublicationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "PublicationDecisionKind" NOT NULL,
    "scope" "PublicationScope" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationRecord_userId_createdAt_idx" ON "PublicationRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicationRecord" ADD CONSTRAINT "PublicationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationRecord" ADD CONSTRAINT "PublicationRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rattrapage : date d'effet des affectations existantes.
UPDATE "Assignment" SET "effectiveFrom" = "createdAt";

-- Marquage des comptes de démonstration (.test = domaine réservé, RFC 2606).
UPDATE "User" SET "isDemo" = true WHERE lower("email") LIKE '%.test';

-- Marquage des écoles du seed de démonstration, par leurs codes exacts :
-- SCH-<code du POOL de démo>-01 à -04, et les trois écoles nommées du seed.
UPDATE "School" SET "isDemo" = true
WHERE "code" ~ '^SCH-(GOMA|KARISIMBI|NYIRAGONGO|RUTSHURU-[1-5])-0[1-4]$'
   OR "code" IN ('EP-GOMA-001', 'INST-GOMA-002', 'EP-KARISIMBI-001');

-- Permission de décision de publication. Référentiel RBAC (pas une donnée
-- métier) : même clé que PERMISSIONS.PUBLICATION_MANAGE dans
-- src/lib/rbac-data.ts. Accordée aux seuls rôles IPP et Informaticien
-- (décision de l'Inspection), s'ils existent. Idempotent.
INSERT INTO "Permission" ("id", "key", "label", "category")
VALUES ('perm_publication_manage', 'publication.manage', 'Autoriser la publication publique des agents (nom, fonction, photo)', 'Publication')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_pubmgr_' || r."id", r."id", p."id"
FROM "RoleDefinition" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('ipp', 'informaticien') AND p."key" = 'publication.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
