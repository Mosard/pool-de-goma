-- Fiche publique des POOL, autorisations de publication et fin d'affectation.
--
-- Migration strictement additive : aucune ligne existante n'est modifiée ni
-- supprimée. Les nouvelles colonnes sont nullables ou ont une valeur par
-- défaut neutre (aucun slug, aucune adresse, aucun téléphone, aucune
-- publication autorisée). Aucun POOL ne devient donc public tant que
-- l'administration ne lui a pas attribué un slug.

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN "slug" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "phones" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Pool_slug_key" ON "Pool"("slug");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "photoUpdatedAt" TIMESTAMP(3),
ADD COLUMN "publishIdentity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publishPhoto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "endReason" TEXT;

-- Permission de décision de publication. Référentiel RBAC (pas une donnée
-- métier) : même clé que PERMISSIONS.PUBLICATION_MANAGE dans
-- src/lib/rbac-data.ts. Idempotent.
INSERT INTO "Permission" ("id", "key", "label", "category")
VALUES ('perm_publication_manage', 'publication.manage', 'Autoriser la publication publique des profils (nom, fonction, photo)', 'Publication')
ON CONFLICT ("key") DO NOTHING;

-- Accordée aux rôles système qui administrent déjà les comptes (IPP et
-- Informaticien), uniquement s'ils existent dans la base. À confirmer par
-- l'Inspection ; modifiable ensuite sans migration.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_pubmgr_' || r."id", r."id", p."id"
FROM "RoleDefinition" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('ipp', 'informaticien') AND p."key" = 'publication.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
