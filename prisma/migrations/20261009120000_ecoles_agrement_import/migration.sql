-- Fiche école enrichie et import Excel (docs/import-ecoles-excel.md).
-- Migration additive : aucune colonne ni donnée retirée.

-- 1. Nouveaux champs, tous facultatifs : les écoles existantes restent valides.
ALTER TABLE "School" ADD COLUMN "approvalDecree" TEXT;
ALTER TABLE "School" ADD COLUMN "classCount" INTEGER;
ALTER TABLE "School" ADD COLUMN "teacherCount" INTEGER;
ALTER TABLE "School" ADD COLUMN "options" TEXT;

-- 2. Clé d'identification « POOL + code de l'école » au lieu d'un code
--    unique dans toute la base. Assouplissement : les codes existants, déjà
--    uniques globalement, respectent forcément la nouvelle contrainte.
DROP INDEX "School_code_key";
CREATE UNIQUE INDEX "School_poolId_code_key" ON "School"("poolId", "code");

-- 3. Décision de l'Inspection (2026-10-08) : l'informaticien gère les fiches
--    écoles de tous les POOL ; le Super Admin aussi (déjà le cas s'il détient
--    tout le catalogue). Ajout seulement ; rien n'est retiré.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_ecoles_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" IN ('informaticien', 'super_admin') AND p."key" = 'schools.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
