-- Fiche individuelle du personnel (formulaire IGAP, 9 pages) — 2026-10-16.
--
-- Migration ADDITIVE : cinq tables et deux types nouveaux, une permission
-- nouvelle au catalogue. Aucune table existante n'est modifiée ni vidée
-- (comptes, fonctions, affectations, présences intacts).
--
-- La permission « personnel.records.edit_all » n'est attribuée à AUCUNE
-- fonction en base : comme « personnel.records.read_all », elle est ajoutée
-- par le code d'après la fonction réelle (Super Admin, Admin, IPP principal,
-- informaticien) et à l'IPA responsable de la cellule du personnel.
--
-- Retour arrière (supprime uniquement les fiches saisies) : voir
-- docs/fiche-personnel.md, § « Retour arrière ».

-- CreateEnum
CREATE TYPE "PersonnelStudyLevel" AS ENUM ('PHD', 'MASTER', 'LICENCE', 'GRADUAT', 'D6', 'POST_PRIMAIRE', 'PRIMAIRE');

-- CreateEnum
CREATE TYPE "PersonnelChildRelation" AS ENUM ('BIOLOGIQUE', 'ADOPTIF', 'SOUS_TUTELLE');

-- CreateTable
CREATE TABLE "PersonnelFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PersonnelFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelFileSection" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "observation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PersonnelFileSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelPromotion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "grade" TEXT,
    "actNature" TEXT,
    "actReference" TEXT,
    "actSignedAt" DATE,
    "actSignatory" TEXT,
    "notifReference" TEXT,
    "notifDate" DATE,
    "notifSignatory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelDiploma" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "level" "PersonnelStudyLevel" NOT NULL,
    "field" TEXT,
    "year" INTEGER,
    "documentNature" TEXT,
    "documentReference" TEXT,
    "issuedAt" DATE,
    "institutionName" TEXT,
    "institutionCommune" TEXT,
    "institutionCity" TEXT,
    "institutionProvince" TEXT,
    "institutionCountry" TEXT,
    "institutionContinent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelDiploma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelChild" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "nom" TEXT,
    "postnom" TEXT,
    "prenom" TEXT,
    "sex" "Sex",
    "birthDate" DATE,
    "birthPlace" TEXT,
    "nationality" TEXT,
    "profession" TEXT,
    "relation" "PersonnelChildRelation",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelChild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelFile_userId_key" ON "PersonnelFile"("userId");

-- CreateIndex
CREATE INDEX "PersonnelFile_organizationId_idx" ON "PersonnelFile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelFileSection_fileId_key_key" ON "PersonnelFileSection"("fileId", "key");

-- CreateIndex
CREATE INDEX "PersonnelPromotion_fileId_position_idx" ON "PersonnelPromotion"("fileId", "position");

-- CreateIndex
CREATE INDEX "PersonnelDiploma_fileId_level_idx" ON "PersonnelDiploma"("fileId", "level");

-- CreateIndex
CREATE INDEX "PersonnelChild_fileId_position_idx" ON "PersonnelChild"("fileId", "position");

-- AddForeignKey
ALTER TABLE "PersonnelFile" ADD CONSTRAINT "PersonnelFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelFileSection" ADD CONSTRAINT "PersonnelFileSection_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PersonnelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelPromotion" ADD CONSTRAINT "PersonnelPromotion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PersonnelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelDiploma" ADD CONSTRAINT "PersonnelDiploma_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PersonnelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelChild" ADD CONSTRAINT "PersonnelChild_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PersonnelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catalogue des permissions (« Gérer les accès » l'affiche ; non attribuable individuellement).
INSERT INTO "Permission" ("id", "key", "label", "category")
VALUES ('perm_personnel_records_edit_all', 'personnel.records.edit_all', 'Modifier les fiches individuelles de tout le personnel et y porter les observations', 'Présence du personnel')
ON CONFLICT ("key") DO NOTHING;
