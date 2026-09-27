-- Identifiant de connexion choisi par le demandeur (additif, sans perte).
-- Aucune donnée existante n'est modifiée : colonnes nullables, index
-- unique sur une colonne entièrement vide au moment de la migration.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- AlterTable
ALTER TABLE "AccountRequest" ADD COLUMN "username" TEXT,
ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AccountRequest_username_idx" ON "AccountRequest"("username");
