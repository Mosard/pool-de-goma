-- IA (additif) : analyses des rapports des inspecteurs itinérants, problèmes
-- proposés et journal des réactions des responsables. Aucune donnée
-- existante n'est modifiée.

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('REUSSIE', 'ECHOUEE');

-- CreateEnum
CREATE TYPE "AiGravity" AS ENUM ('CRITIQUE', 'ELEVEE', 'MODEREE', 'FAIBLE');

-- CreateEnum
CREATE TYPE "AiDecisionStatus" AS ENUM ('PROPOSEE', 'VALIDEE', 'REJETEE', 'AJUSTEE');

-- CreateEnum
CREATE TYPE "AiReactionKind" AS ENUM ('VALIDATION', 'REJET', 'AJUSTEMENT', 'COMMENTAIRE', 'SERVICE_DESIGNE');

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "poolId" TEXT,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "AiAnalysisStatus" NOT NULL,
    "model" TEXT NOT NULL,
    "reportIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "synthese" TEXT,
    "limites" JSONB,
    "error" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProblem" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "constat" TEXT NOT NULL,
    "gravite" "AiGravity" NOT NULL,
    "nbRapports" INTEGER NOT NULL,
    "sites" JSONB NOT NULL,
    "periode" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "hypothese" TEXT NOT NULL,
    "aVerifier" TEXT NOT NULL,
    "decisionProposee" TEXT NOT NULL,
    "serviceResponsable" TEXT NOT NULL,
    "attributionId" TEXT,
    "delaiIndicatif" TEXT NOT NULL,
    "resultatAttendu" TEXT NOT NULL,
    "status" "AiDecisionStatus" NOT NULL DEFAULT 'PROPOSEE',
    "decisionAjustee" TEXT,
    "motifRejet" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReaction" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "AiReactionKind" NOT NULL,
    "comment" TEXT,
    "motif" TEXT,
    "decisionAjustee" TEXT,
    "attributionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysis_organizationId_createdAt_idx" ON "AiAnalysis"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_poolId_createdAt_idx" ON "AiAnalysis"("poolId", "createdAt");

-- CreateIndex
CREATE INDEX "AiProblem_analysisId_rank_idx" ON "AiProblem"("analysisId", "rank");

-- CreateIndex
CREATE INDEX "AiProblem_status_idx" ON "AiProblem"("status");

-- CreateIndex
CREATE INDEX "AiProblem_attributionId_idx" ON "AiProblem"("attributionId");

-- CreateIndex
CREATE INDEX "AiReaction_problemId_createdAt_idx" ON "AiReaction"("problemId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProblem" ADD CONSTRAINT "AiProblem_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProblem" ADD CONSTRAINT "AiProblem_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "DirectionAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReaction" ADD CONSTRAINT "AiReaction_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "AiProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReaction" ADD CONSTRAINT "AiReaction_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Permission « ai.analyze ». Référentiel RBAC (pas une donnée métier) : même
-- clé que PERMISSIONS.AI_ANALYZE dans src/lib/rbac-data.ts (décision du
-- 2026-10-06). Accordée à l'IPP, aux IPP adjoints, à l'Inspool (chef de pool,
-- limité à son POOL par le rattachement de son rôle), à l'informaticien et au
-- Super Admin. Idempotent.
INSERT INTO "Permission" ("id", "key", "label", "category")
VALUES ('perm_ai_analyze', 'ai.analyze', 'Consulter et lancer les analyses IA des rapports', 'IA')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_ai_' || r."id", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" IN ('ipp', 'ipa', 'chef_pool', 'informaticien', 'super_admin') AND p."key" = 'ai.analyze'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
