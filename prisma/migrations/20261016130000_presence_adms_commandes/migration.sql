-- Présence ADMS : commandes de gestion envoyées aux pointeuses (inscription,
-- retrait, capture d'empreinte sur l'appareil, inventaire) et inventaire des
-- utilisateurs de l'appareil (PIN et privilège seulement). ADDITIVE uniquement.

-- CreateEnum
CREATE TYPE "DeviceCommandStatus" AS ENUM ('PENDING', 'SENT', 'OK', 'ERROR', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "AttendanceDevice" ADD COLUMN     "admsCommandsPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "admsUsers" JSONB,
ADD COLUMN     "admsUsersAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "pin" TEXT,
    "userId" TEXT,
    "command" TEXT NOT NULL,
    "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "returnCode" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCommand_seq_key" ON "DeviceCommand"("seq");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_status_idx" ON "DeviceCommand"("deviceId", "status");

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
