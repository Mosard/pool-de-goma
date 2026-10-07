-- Rapport de synthèse de l'exploitant (docs/rapport-synthese-exploitant.md).
-- Migration additive : nouvelles tables seulement, aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "SynthesisStatus" AS ENUM ('BROUILLON', 'SOUMIS', 'A_CORRIGER', 'VALIDE');

-- CreateTable
CREATE TABLE "Synthesis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "poolId" TEXT,
    "authorId" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "formatVersion" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL DEFAULT '{}',
    "status" "SynthesisStatus" NOT NULL DEFAULT 'BROUILLON',
    "number" TEXT,
    "numberYear" INTEGER,
    "numberSeq" INTEGER,
    "numberScope" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Synthesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynthesisSource" (
    "id" TEXT NOT NULL,
    "synthesisId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SynthesisSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynthesisStatusHistory" (
    "id" TEXT NOT NULL,
    "synthesisId" TEXT NOT NULL,
    "fromStatus" "SynthesisStatus",
    "toStatus" "SynthesisStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SynthesisStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynthesisVersion" (
    "id" TEXT NOT NULL,
    "synthesisId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SynthesisVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Synthesis_number_key" ON "Synthesis"("number");

-- CreateIndex
CREATE INDEX "Synthesis_organizationId_status_idx" ON "Synthesis"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Synthesis_poolId_idx" ON "Synthesis"("poolId");

-- CreateIndex
CREATE INDEX "Synthesis_authorId_idx" ON "Synthesis"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Synthesis_organizationId_numberScope_numberYear_numberSeq_key" ON "Synthesis"("organizationId", "numberScope", "numberYear", "numberSeq");

-- CreateIndex
CREATE INDEX "SynthesisSource_reportId_idx" ON "SynthesisSource"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "SynthesisSource_synthesisId_reportId_key" ON "SynthesisSource"("synthesisId", "reportId");

-- CreateIndex
CREATE INDEX "SynthesisStatusHistory_synthesisId_idx" ON "SynthesisStatusHistory"("synthesisId");

-- CreateIndex
CREATE UNIQUE INDEX "SynthesisVersion_synthesisId_number_key" ON "SynthesisVersion"("synthesisId", "number");

-- AddForeignKey
ALTER TABLE "Synthesis" ADD CONSTRAINT "Synthesis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Synthesis" ADD CONSTRAINT "Synthesis_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Synthesis" ADD CONSTRAINT "Synthesis_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisSource" ADD CONSTRAINT "SynthesisSource_synthesisId_fkey" FOREIGN KEY ("synthesisId") REFERENCES "Synthesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisSource" ADD CONSTRAINT "SynthesisSource_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisStatusHistory" ADD CONSTRAINT "SynthesisStatusHistory_synthesisId_fkey" FOREIGN KEY ("synthesisId") REFERENCES "Synthesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisStatusHistory" ADD CONSTRAINT "SynthesisStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisVersion" ADD CONSTRAINT "SynthesisVersion_synthesisId_fkey" FOREIGN KEY ("synthesisId") REFERENCES "Synthesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisVersion" ADD CONSTRAINT "SynthesisVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

