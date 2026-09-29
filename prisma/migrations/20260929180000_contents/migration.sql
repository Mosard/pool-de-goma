-- Contenus éditoriaux (additif) : actualités, articles, communiqués et leurs
-- fichiers (images compressées, PDF). Aucune donnée existante n'est modifiée.

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('ACTUALITE', 'ARTICLE', 'COMMUNIQUE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('BROUILLON', 'SOUMIS', 'A_CORRIGER', 'PUBLIE', 'RETIRE');

-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('COVER', 'INLINE', 'ATTACHMENT');

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'BROUILLON',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "role" "MediaRole" NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "fileName" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Content_slug_key" ON "Content"("slug");

-- CreateIndex
CREATE INDEX "Content_organizationId_status_publishedAt_idx" ON "Content"("organizationId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Content_authorId_idx" ON "Content"("authorId");

-- CreateIndex
CREATE INDEX "MediaFile_contentId_role_idx" ON "MediaFile"("contentId", "role");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Permissions éditoriales. Référentiel RBAC (pas une donnée métier) : mêmes
-- clés que PERMISSIONS.CONTENT_WRITE / CONTENT_PUBLISH dans src/lib/rbac-data.ts
-- (décision du 2026-09-29). Idempotent, rôles accordés s'ils existent.
INSERT INTO "Permission" ("id", "key", "label", "category")
VALUES
  ('perm_content_write', 'content.write', 'Rédiger des actualités, articles et communiqués (brouillons, soumission)', 'Site public'),
  ('perm_content_publish', 'content.publish', 'Valider et publier les contenus du site, les renvoyer en correction ou les retirer', 'Site public')
ON CONFLICT ("key") DO NOTHING;

-- Rédaction : chargé des médias et Super Admin.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_cwrite_' || r."id", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" IN ('charge_medias', 'super_admin') AND p."key" = 'content.write'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Validation : IPP, IPP adjoint, informaticien et Super Admin.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_cpub_' || r."id", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" IN ('ipp', 'ipa', 'informaticien', 'super_admin') AND p."key" = 'content.publish'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
