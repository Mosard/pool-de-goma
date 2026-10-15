-- Présence : réception ADMS directe des pointeuses ZKTeco (UA300).
-- Migration ADDITIVE uniquement (colonnes facultatives ou avec valeur par
-- défaut, nouvelle table). Pré-requis en production : aucun numéro de série
-- en double dans "AttendanceDevice" (sinon l'index unique échoue).

-- CreateEnum
CREATE TYPE "DeviceProtocol" AS ENUM ('API', 'ADMS');

-- AlterTable
ALTER TABLE "AttendanceDevice" ADD COLUMN     "admsInfo" JSONB,
ADD COLUMN     "admsInfoAt" TIMESTAMP(3),
ADD COLUMN     "admsLocalIp" TEXT,
ADD COLUMN     "admsPairedAt" TIMESTAMP(3),
ADD COLUMN     "admsPairingUntil" TIMESTAMP(3),
ADD COLUMN     "admsPathSecretHash" TEXT,
ADD COLUMN     "admsPublicIp" TEXT,
ADD COLUMN     "admsPushVersion" TEXT,
ADD COLUMN     "admsUserAgent" TEXT,
ADD COLUMN     "protocol" "DeviceProtocol" NOT NULL DEFAULT 'API';

-- AlterTable
ALTER TABLE "IngestBatch" ADD COLUMN     "recomputedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RawPunch" ADD COLUMN     "clockSuspect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rawStatus" TEXT,
ADD COLUMN     "workCode" TEXT;

-- CreateTable
CREATE TABLE "AttendanceDeviceAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "deviceId" TEXT,
    "dedupKey" TEXT NOT NULL,
    "serialNumber" TEXT,
    "kind" TEXT NOT NULL,
    "detail" JSONB,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "AttendanceDeviceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeviceAlert_dedupKey_key" ON "AttendanceDeviceAlert"("dedupKey");

-- CreateIndex
CREATE INDEX "AttendanceDeviceAlert_organizationId_resolvedAt_idx" ON "AttendanceDeviceAlert"("organizationId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_serialNumber_key" ON "AttendanceDevice"("serialNumber");

-- AddForeignKey
ALTER TABLE "AttendanceDeviceAlert" ADD CONSTRAINT "AttendanceDeviceAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
