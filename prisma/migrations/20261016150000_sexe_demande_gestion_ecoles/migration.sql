-- Additif uniquement : colonnes facultatives, aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "SchoolManagement" AS ENUM ('PUBLIC', 'PRIVATE', 'CONVENTIONED');

-- AlterTable
ALTER TABLE "AccountRequest" ADD COLUMN "sex" "Sex";

-- AlterTable
ALTER TABLE "School" ADD COLUMN "management" "SchoolManagement",
ADD COLUMN "confession" TEXT,
ADD COLUMN "qualifiedTeacherCount" INTEGER;
