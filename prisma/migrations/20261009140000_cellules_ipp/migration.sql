-- Cellules de l IPP, branche IPP des rapports (secretariat, affectation,
-- validation et signature portées par la synthèse) et rattachement des fonctions à une cellule.
-- docs/exploitants-ipp-cellules.md. Additif ; aucune cellule n est creee.

-- CreateEnum
CREATE TYPE "IppStage" AS ENUM ('AU_SECRETARIAT', 'AFFECTE', 'EXPLOITE');

-- AlterEnum
ALTER TYPE "RoleScope" ADD VALUE 'CELL';

-- AlterEnum
ALTER TYPE "SynthesisStatus" ADD VALUE 'SIGNE';

-- DropIndex
DROP INDEX "UserRole_userId_roleId_poolId_key";

-- AlterTable
ALTER TABLE "AiAnalysis" ADD COLUMN     "cellId" TEXT;

-- AlterTable
ALTER TABLE "Synthesis" ADD COLUMN     "cellId" TEXT;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "cellId" TEXT;

-- CreateTable
CREATE TABLE "Cell" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipaId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportIppTrack" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stage" "IppStage" NOT NULL DEFAULT 'AU_SECRETARIAT',
    "cellId" TEXT,
    "legacy" BOOLEAN NOT NULL DEFAULT false,
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "exploitedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportIppTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportIppEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fromStage" "IppStage",
    "toStage" "IppStage" NOT NULL,
    "fromCellId" TEXT,
    "cellId" TEXT,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportIppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cell_ipaId_key" ON "Cell"("ipaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cell_organizationId_code_key" ON "Cell"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ReportIppTrack_reportId_key" ON "ReportIppTrack"("reportId");

-- CreateIndex
CREATE INDEX "ReportIppTrack_organizationId_stage_idx" ON "ReportIppTrack"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "ReportIppTrack_cellId_stage_idx" ON "ReportIppTrack"("cellId", "stage");

-- CreateIndex
CREATE INDEX "ReportIppEvent_reportId_idx" ON "ReportIppEvent"("reportId");

-- CreateIndex
CREATE INDEX "UserRole_cellId_idx" ON "UserRole"("cellId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_poolId_cellId_key" ON "UserRole"("userId", "roleId", "poolId", "cellId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_ipaId_fkey" FOREIGN KEY ("ipaId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportIppTrack" ADD CONSTRAINT "ReportIppTrack_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportIppTrack" ADD CONSTRAINT "ReportIppTrack_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportIppTrack" ADD CONSTRAINT "ReportIppTrack_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "ReportIppEvent" ADD CONSTRAINT "ReportIppEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportIppEvent" ADD CONSTRAINT "ReportIppEvent_fromCellId_fkey" FOREIGN KEY ("fromCellId") REFERENCES "Cell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportIppEvent" ADD CONSTRAINT "ReportIppEvent_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportIppEvent" ADD CONSTRAINT "ReportIppEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Synthesis" ADD CONSTRAINT "Synthesis_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

