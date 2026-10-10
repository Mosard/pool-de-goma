-- Présence du personnel — lot 1 : permissions, vocation de la cellule du
-- personnel, historique d'appartenance aux cellules (décisions du 2026-10-10,
-- PRESENCES-BIOMETRIQUES-ANALYSE.md, Révision 2). Migration additive :
-- aucune cellule, aucun compte, aucune vocation n'est créé ni modifié ici.

-- 1. Structure.
CREATE TYPE "CellMandate" AS ENUM ('GENERAL', 'PERSONNEL');
CREATE TYPE "StaffTermStartSource" AS ENUM ('CONNUE', 'CONSTATEE_A_LA_REPRISE');

ALTER TABLE "Cell" ADD COLUMN "mandate" "CellMandate" NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "StaffCellTerm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "startSource" "StaffTermStartSource" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "via" TEXT NOT NULL,

    CONSTRAINT "StaffCellTerm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffCellTerm_userId_cellId_idx" ON "StaffCellTerm"("userId", "cellId");
CREATE INDEX "StaffCellTerm_cellId_endedAt_idx" ON "StaffCellTerm"("cellId", "endedAt");

ALTER TABLE "StaffCellTerm" ADD CONSTRAINT "StaffCellTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffCellTerm" ADD CONSTRAINT "StaffCellTerm_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Permissions nouvelles (aucune ne découle d'une autre).
INSERT INTO "Permission" ("id", "key", "label", "category") VALUES
  ('perm_presence_read_all', 'presence.read_all', 'Consulter les présences de tout le personnel (tous les POOL, bureaux et cellules)', 'Présence du personnel'),
  ('perm_presence_read_cell', 'presence.read_cell', 'Consulter les présences des personnes de sa cellule', 'Présence du personnel'),
  ('perm_personnel_records_read_all', 'personnel.records.read_all', 'Consulter les fiches détaillées de tout le personnel (lecture seule)', 'Présence du personnel'),
  ('perm_presence_devices_manage', 'presence.devices.manage', 'Administrer les pointeuses et leur synchronisation', 'Présence du personnel'),
  ('perm_presence_enrollment_manage', 'presence.enrollment.manage', 'Associer les identifiants de pointage aux comptes', 'Présence du personnel'),
  ('perm_presence_schedule_manage', 'presence.schedule.manage', 'Modifier les seuils horaires et le calendrier', 'Présence du personnel'),
  ('perm_presence_req_initiate_cell', 'presence.requests.initiate_cell', 'Initier les demandes (mission, congé, absence) des personnes de sa cellule', 'Présence du personnel'),
  ('perm_presence_req_initiate_uncelled', 'presence.requests.initiate_uncelled', 'Initier les demandes des agents sans cellule', 'Présence du personnel'),
  ('perm_presence_req_verify', 'presence.requests.verify', 'Vérifier les demandes et décider des absences justifiées', 'Présence du personnel'),
  ('perm_presence_req_approve_final', 'presence.requests.approve_final', 'Approuver ou signer les missions et congés', 'Présence du personnel'),
  ('perm_presence_delegations_manage', 'presence.delegations.manage', 'Déléguer ses pouvoirs d''approbation', 'Présence du personnel'),
  ('perm_presence_punch_correct', 'presence.punch.correct', 'Corriger les pointages (événements bruts conservés)', 'Présence du personnel'),
  ('perm_presence_overtime_decide', 'presence.overtime.decide', 'Décider des heures supplémentaires proposées', 'Présence du personnel'),
  ('perm_cells_interim_manage', 'cells.interim.manage', 'Désigner un intérimaire pour une cellule', 'Présence du personnel')
ON CONFLICT ("key") DO NOTHING;

-- 3. Attribution par fonction (matrice R2.2). Le Super Admin ne reçoit PAS :
--    fiches détaillées, seuils et calendrier, vérification, approbation,
--    délégation, heures supplémentaires, permissions de cellule
--    (SUPER_ADMIN_EXCLUDED_PERMISSIONS, également écartées par le code).
--    Pouvoirs du responsable du personnel : jamais par une ligne ici, seulement
--    par l'affectation à la cellule de vocation PERSONNEL (PERSONNEL_HEAD_KEYS).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_presence_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE (r."key" = 'ipp' AND p."key" IN (
        'presence.read_all', 'presence.devices.manage', 'presence.enrollment.manage', 'presence.schedule.manage',
        'presence.requests.approve_final', 'presence.delegations.manage', 'presence.overtime.decide'))
   OR (r."key" = 'ipa' AND p."key" IN ('presence.read_cell', 'presence.requests.initiate_cell'))
   OR (r."key" IN ('informaticien', 'secretaire_ipp') AND p."key" IN (
        'presence.read_all', 'presence.devices.manage', 'presence.enrollment.manage',
        'presence.requests.initiate_uncelled', 'presence.punch.correct'))
   OR (r."key" = 'super_admin' AND p."key" IN (
        'presence.read_all', 'presence.devices.manage', 'presence.enrollment.manage',
        'presence.requests.initiate_uncelled', 'presence.punch.correct', 'cells.interim.manage'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 4. Reprise de l'historique d'appartenance (cellules actives seulement).
--    Aucune date ancienne n'est inventée : une date n'est reprise que si elle
--    est CONNUE (affectation faite depuis l'application, ou trace d'audit) ;
--    sinon startedAt reste vide et l'appartenance est « constatée à la reprise ».
--    Les lignes CellIpaAssignment « reprise » portent Cell.updatedAt, qui n'est
--    pas une date d'affectation : elles sont traitées comme constatées.

-- 4a. IPA responsables.
INSERT INTO "StaffCellTerm" ("id", "userId", "cellId", "roleKey", "startedAt", "startSource", "observedAt", "via")
SELECT DISTINCT ON (c."id")
  'sct_init_ipa_' || c."id",
  c."ipaId",
  c."id",
  'ipa',
  CASE WHEN a."via" IN ('direction', 'cellules') THEN a."startedAt" ELSE NULL END,
  CASE WHEN a."via" IN ('direction', 'cellules') THEN 'CONNUE'::"StaffTermStartSource" ELSE 'CONSTATEE_A_LA_REPRISE'::"StaffTermStartSource" END,
  CURRENT_TIMESTAMP,
  CASE WHEN a."via" IN ('direction', 'cellules') THEN a."via" ELSE 'reprise' END
FROM "Cell" c
LEFT JOIN "CellIpaAssignment" a ON a."cellId" = c."id" AND a."ipaId" = c."ipaId" AND a."endedAt" IS NULL
WHERE c."ipaId" IS NOT NULL AND c."active" = true
ORDER BY c."id", a."startedAt" DESC NULLS LAST;

-- 4b. Exploitants de l'IPP rattachés à une cellule active : date connue
--     seulement par la dernière trace d'audit qui les y a rattachés.
INSERT INTO "StaffCellTerm" ("id", "userId", "cellId", "roleKey", "startedAt", "startSource", "observedAt", "via")
SELECT
  'sct_init_exp_' || ur."id",
  ur."userId",
  ur."cellId",
  'exploitant_ipp',
  ev."createdAt",
  CASE WHEN ev."createdAt" IS NOT NULL THEN 'CONNUE'::"StaffTermStartSource" ELSE 'CONSTATEE_A_LA_REPRISE'::"StaffTermStartSource" END,
  CURRENT_TIMESTAMP,
  COALESCE(ev."via", 'reprise')
FROM "UserRole" ur
JOIN "RoleDefinition" r ON r."id" = ur."roleId" AND r."key" = 'exploitant_ipp'
JOIN "Cell" c ON c."id" = ur."cellId" AND c."active" = true
LEFT JOIN LATERAL (
  SELECT l."createdAt", COALESCE(l."metadata"->>'via', 'gestion-acces') AS "via"
  FROM "AuditLog" l
  WHERE l."entityType" = 'User' AND l."entityId" = ur."userId"
    AND (
      (l."action" = 'user.cell_assign' AND (l."newValue"->'cellIds') ? ur."cellId")
      OR (l."action" = 'user.role_add' AND l."newValue"->>'cellId' = ur."cellId")
    )
  ORDER BY l."createdAt" DESC
  LIMIT 1
) ev ON true
WHERE ur."cellId" IS NOT NULL;
