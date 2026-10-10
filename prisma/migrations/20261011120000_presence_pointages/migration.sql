-- Présence du personnel — lots 2 à 4 (2026-10-11) : paramètres horaires
-- versionnés, calendrier des exceptions, appareils, identifiants techniques,
-- associations d'identifiants de pointage, lots de réception, pointages BRUTS
-- immuables, synthèses journalières recalculables. Migration additive.
-- Seul l'horaire VALIDÉ est posé ; aucune règle ouverte, aucun calendrier
-- officiel, aucun appareil, aucun pointage n'est créé.

-- CreateEnum
CREATE TYPE "CalendarDayKind" AS ENUM ('NON_TRAVAILLE');

-- CreateEnum
CREATE TYPE "PunchDirection" AS ENUM ('IN', 'OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PunchSource" AS ENUM ('DEVICE', 'SIMULATOR');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('NON_VERIFIE', 'VERIFIE', 'DESACTIVE');

-- CreateTable
CREATE TABLE "AttendanceSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CalendarDayKind" NOT NULL DEFAULT 'NON_TRAVAILLE',
    "label" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "siteLabel" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "firmware" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'NON_VERIFIE',
    "isSimulator" BOOLEAN NOT NULL DEFAULT false,
    "lastContactAt" TIMESTAMP(3),
    "lastEventReceivedAt" TIMESTAMP(3),
    "lastClockOffsetSec" INTEGER,
    "lastClockCheckAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCredential" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceUserMapping" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedById" TEXT,
    "endReason" TEXT,

    CONSTRAINT "DeviceUserMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestBatch" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "source" "PunchSource" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "rejected" INTEGER NOT NULL,

    CONSTRAINT "IngestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawPunch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "deviceLocalTime" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "externalEventId" TEXT,
    "direction" "PunchDirection" NOT NULL,
    "verifyMode" TEXT,
    "source" "PunchSource" NOT NULL,
    "dedupKey" TEXT NOT NULL,

    CONSTRAINT "RawPunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "punchCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSetting_organizationId_key_createdAt_idx" ON "AttendanceSetting"("organizationId", "key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_organizationId_date_key" ON "CalendarDay"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_prefix_key" ON "DeviceCredential"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_tokenHash_key" ON "DeviceCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceUserMapping_deviceId_deviceUserId_idx" ON "DeviceUserMapping"("deviceId", "deviceUserId");

-- CreateIndex
CREATE INDEX "DeviceUserMapping_userId_idx" ON "DeviceUserMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestBatch_deviceId_idempotencyKey_key" ON "IngestBatch"("deviceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RawPunch_dedupKey_key" ON "RawPunch"("dedupKey");

-- CreateIndex
CREATE INDEX "RawPunch_deviceId_deviceUserId_punchedAt_idx" ON "RawPunch"("deviceId", "deviceUserId", "punchedAt");

-- CreateIndex
CREATE INDEX "RawPunch_organizationId_punchedAt_idx" ON "RawPunch"("organizationId", "punchedAt");

-- CreateIndex
CREATE INDEX "DailyAttendance_organizationId_date_idx" ON "DailyAttendance"("organizationId", "date");

-- CreateIndex
CREATE INDEX "DailyAttendance_computedAt_idx" ON "DailyAttendance"("computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendance_userId_date_key" ON "DailyAttendance"("userId", "date");

-- AddForeignKey
ALTER TABLE "AttendanceSetting" ADD CONSTRAINT "AttendanceSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceUserMapping" ADD CONSTRAINT "DeviceUserMapping_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceUserMapping" ADD CONSTRAINT "DeviceUserMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestBatch" ADD CONSTRAINT "IngestBatch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawPunch" ADD CONSTRAINT "RawPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawPunch" ADD CONSTRAINT "RawPunch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Horaire validé (lundi–vendredi, 8 h – 15 h ; retard après 8 h 15 ; départ
-- normal jusqu'à 15 h 15 ; temps supplémentaire proposé depuis 15 h 15).
INSERT INTO "AttendanceSetting" ("id", "organizationId", "key", "value", "setById", "createdAt")
SELECT 'as_init_schedule_' || o."id", o."id", 'schedule',
       '{"workdays":[1,2,3,4,5],"start":"08:00","lateAfter":"08:15","end":"15:00","normalDepartureUntil":"15:15","overtimeFrom":"15:15"}'::jsonb,
       NULL, CURRENT_TIMESTAMP
FROM "Organization" o
ON CONFLICT ("id") DO NOTHING;
