-- Affectations des IPA aux cellules (décisions du 2026-10-09) : historique des
-- responsabilités de cellule (auteur, dates, point d'entrée) et lien entre les
-- postes de la Direction publique et les cellules. Additive : aucune donnée
-- existante n'est modifiée ; aucun poste n'est relié automatiquement.

-- CreateTable
CREATE TABLE "CellIpaAssignment" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "ipaId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "via" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "endReason" TEXT,

    CONSTRAINT "CellIpaAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CellIpaAssignment_cellId_startedAt_idx" ON "CellIpaAssignment"("cellId", "startedAt");
CREATE INDEX "CellIpaAssignment_ipaId_idx" ON "CellIpaAssignment"("ipaId");

ALTER TABLE "CellIpaAssignment" ADD CONSTRAINT "CellIpaAssignment_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CellIpaAssignment" ADD CONSTRAINT "CellIpaAssignment_ipaId_fkey" FOREIGN KEY ("ipaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CellIpaAssignment" ADD CONSTRAINT "CellIpaAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CellIpaAssignment" ADD CONSTRAINT "CellIpaAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Responsables déjà saisis (page Cellules) : une période ouverte, sans auteur connu.
INSERT INTO "CellIpaAssignment" ("id", "cellId", "ipaId", "startedAt", "via")
SELECT 'cia_init_' || c."id", c."id", c."ipaId", c."updatedAt", 'reprise'
FROM "Cell" c
WHERE c."ipaId" IS NOT NULL;

-- AlterTable : poste de la Direction relié à une cellule (au plus un poste par cellule).
ALTER TABLE "DirectionAttribution" ADD COLUMN "cellId" TEXT;
CREATE UNIQUE INDEX "DirectionAttribution_cellId_key" ON "DirectionAttribution"("cellId");
ALTER TABLE "DirectionAttribution" ADD CONSTRAINT "DirectionAttribution_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE SET NULL ON UPDATE CASCADE;
