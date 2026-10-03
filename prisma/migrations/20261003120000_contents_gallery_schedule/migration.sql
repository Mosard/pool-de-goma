-- Contenus (additif) : albums photo et vidéos, programmation de la mise en
-- ligne, catégories, mise « À la une ». Aucune donnée existante n'est modifiée.

-- AlterEnum
ALTER TYPE "ContentKind" ADD VALUE 'GALERIE';

-- AlterEnum
ALTER TYPE "MediaRole" ADD VALUE 'GALLERY';

-- AlterTable
ALTER TABLE "Content" ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "category" TEXT,
ADD COLUMN "videoLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "pinnedAt" TIMESTAMP(3);
