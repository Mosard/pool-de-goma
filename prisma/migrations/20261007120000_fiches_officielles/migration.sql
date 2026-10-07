-- Fiches officielles de l'inspection itinérante (docs/inventaire-fiches-inspection.md, § 7 et § 10).
-- Migration ADDITIVE : aucune ligne n'est supprimée ni modifiée, aucune
-- colonne n'est retirée. Les fiches simulées (A1, C101, T1, F1) et leurs
-- rapports restent intacts.

-- 1. Plusieurs versions d'une même fiche : unicité (code, version) au lieu de (code).
DROP INDEX "FormTemplate_code_key";
CREATE UNIQUE INDEX "FormTemplate_code_version_key" ON "FormTemplate"("code", "version");
ALTER TABLE "FormTemplate" ADD COLUMN "module" TEXT,
ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'visite',
ADD COLUMN "source" TEXT;

-- 2. Plusieurs exemplaires d'une fiche par visite (un C3 par enseignant, un A5
--    par absent) ; fiches de période sans inspection ; auteur, POOL, numéro,
--    calculs figés et date de soumission.
DROP INDEX "Form_inspectionId_formTemplateId_key";
ALTER TABLE "Form" ALTER COLUMN "inspectionId" DROP NOT NULL;
ALTER TABLE "Form" ADD COLUMN "authorId" TEXT,
ADD COLUMN "poolId" TEXT,
ADD COLUMN "number" TEXT,
ADD COLUMN "numberYear" INTEGER,
ADD COLUMN "thematicSeq" INTEGER,
ADD COLUMN "universalSeq" INTEGER,
ADD COLUMN "computed" JSONB,
ADD COLUMN "submittedAt" TIMESTAMP(3);
CREATE INDEX "Form_inspectionId_formTemplateId_idx" ON "Form"("inspectionId", "formTemplateId");
CREATE INDEX "Form_authorId_idx" ON "Form"("authorId");
CREATE INDEX "Form_poolId_idx" ON "Form"("poolId");
CREATE UNIQUE INDEX "Form_authorId_numberYear_universalSeq_key" ON "Form"("authorId", "numberYear", "universalSeq");
ALTER TABLE "Form" ADD CONSTRAINT "Form_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Form" ADD CONSTRAINT "Form_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Un rapport par fiche (circuit par fiche, décision Q3). Les rapports
--    existants gardent leur inspection ; les nouveaux portent leur fiche.
ALTER TABLE "Report" ALTER COLUMN "inspectionId" DROP NOT NULL;
ALTER TABLE "Report" ADD COLUMN "formId" TEXT,
ADD COLUMN "poolId" TEXT,
ADD COLUMN "authorId" TEXT;
CREATE UNIQUE INDEX "Report_formId_key" ON "Report"("formId");
CREATE INDEX "Report_poolId_idx" ON "Report"("poolId");
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Exploitant IPP (décision Q8, élargissement de droits décidé explicitement) :
--    exploitation au niveau POOL sur tous les POOL (fonction de portée
--    provinciale) et analyses IA. Ajout seulement ; rien n'est retiré.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_fiches_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" = 'exploitant_ipp' AND p."key" IN ('reports.review_pool', 'ai.analyze')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
