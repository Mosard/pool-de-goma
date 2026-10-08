-- Données des cellules de l'IPP (décisions du 2026-10-08,
-- docs/exploitants-ipp-cellules.md § 6). Séparée de la migration de
-- structure : les nouvelles valeurs d'enum (RoleScope.CELL) y sont utilisées.
-- Aucune cellule, aucun compte, aucun IPA n'est créé ici.

-- 1. Permissions nouvelles.
INSERT INTO "Permission" ("id", "key", "label", "category") VALUES
  ('perm_reports_route_ipp', 'reports.route_ipp', 'Secrétariat de l''IPP : recevoir les rapports et les envoyer à une cellule', 'Circuit de validation'),
  ('perm_reports_review_cell', 'reports.review_cell', 'Exploiter les rapports affectés à sa cellule et préparer ses synthèses', 'Circuit de validation'),
  ('perm_reports_sign_cell', 'reports.sign_cell', 'Valider et transmettre à l''IPP les rapports et synthèses de sa cellule (IPA)', 'Circuit de validation')
ON CONFLICT ("key") DO NOTHING;

-- 2. Fonction « Exploitant de l'IPP » : rattachement obligatoire à une cellule.
UPDATE "RoleDefinition"
SET "scope" = 'CELL',
    "label" = 'Exploitant de l''IPP',
    "description" = 'Exploite les rapports que le secrétariat a envoyés à sa cellule et prépare ses synthèses.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'exploitant_ipp';

-- 3. Nouvelle fonction « Secrétaire de l'IPP » (réception et orientation, sans exploitation ni signature).
INSERT INTO "RoleDefinition" ("id", "key", "label", "description", "scope", "isSystem", "createdAt", "updatedAt")
VALUES ('role_secretaire_ipp', 'secretaire_ipp', 'Secrétaire de l''IPP',
        'Reçoit les rapports soumis et les envoie à la cellule correspondante, au nom de l''IPP.', 'PROVINCE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- 4. Retraits autorisés (remplacent la décision Q8 du 2026-10-07) :
--    exploitant de l'IPP : review_pool (tous les POOL), ai.analyze (Q8), review_province (D8) ;
--    IPA : review_province (D4, il ne voit que sa cellule) ;
--    Agent IPP : review_province (décision du 2026-10-09 : il ne lit plus toute la province).
DELETE FROM "RolePermission" rp
USING "RoleDefinition" r, "Permission" p
WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  AND (
    (r."key" = 'exploitant_ipp' AND p."key" IN ('reports.review_pool', 'reports.review_province', 'ai.analyze'))
    OR (r."key" IN ('ipa', 'agent_ipp') AND p."key" = 'reports.review_province')
  );

-- 4 bis. Ancien circuit retiré (décision du 2026-10-09) : plus de transmission
--    du POOL au bureau IPP, ni de validation, rejet ou clôture par l'IPP dans
--    le circuit du POOL. La remontée à l'IPP passe par le secrétariat, la
--    cellule (validation de l'IPA) puis la signature de l'IPP. Les rapports
--    déjà à ces statuts les gardent (historique), sans transition possible.
DELETE FROM "WorkflowTransition" t
USING "WorkflowStatus" f, "WorkflowStatus" s
WHERE t."fromStatusId" = f."id" AND t."toStatusId" = s."id"
  AND (f."key", s."key") IN (
    ('EN_EXPLOITATION', 'TRANSMIS'),
    ('TRANSMIS', 'EN_ATTENTE_VALIDATION'),
    ('EN_ATTENTE_VALIDATION', 'VALIDE'),
    ('EN_ATTENTE_VALIDATION', 'REJETE'),
    ('REJETE', 'A_CORRIGER'),
    ('VALIDE', 'CLOTURE')
  );

-- Le POOL termine lui-même son exploitation (En exploitation → Clôturé).
INSERT INTO "WorkflowTransition" ("id", "fromStatusId", "toStatusId", "label", "allowedPermissionKey")
SELECT 'wt_pool_exploitation_terminee', f."id", s."id", 'Exploitation terminée (POOL)', 'reports.review_pool'
FROM "WorkflowStatus" f, "WorkflowStatus" s
WHERE f."key" = 'EN_EXPLOITATION' AND s."key" = 'CLOTURE'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- reports.validate sert désormais à la signature de l'IPP principal (branche IPP).
UPDATE "Permission"
SET "label" = 'Signer les rapports et synthèses validés et transmis par les cellules (IPP)'
WHERE "key" = 'reports.validate';

-- 5. Nouvelles permissions des fonctions. Les permissions de cellule ne valent
--    que pour la cellule de la personne (src/lib/permissions.ts).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_cellules_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE (r."key" = 'exploitant_ipp' AND p."key" = 'reports.review_cell')
   OR (r."key" = 'ipa' AND p."key" = 'reports.sign_cell')
   OR (r."key" = 'secretaire_ipp' AND p."key" = 'reports.route_ipp')
   OR (r."key" = 'super_admin' AND p."key" IN ('reports.route_ipp', 'reports.review_cell', 'reports.sign_cell'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 6. Branche IPP des rapports déjà soumis : arrivés au secrétariat, cellule
--    indéterminable (legacy), à orienter. Aucun rapport ni historique n'est modifié.
INSERT INTO "ReportIppTrack" ("id", "reportId", "organizationId", "stage", "legacy", "arrivedAt", "updatedAt")
SELECT 'ipt_' || r."id", r."id", COALESCE(p."organizationId", sp."organizationId"), 'AU_SECRETARIAT', true,
       COALESCE(r."submittedAt", r."createdAt"), CURRENT_TIMESTAMP
FROM "Report" r
JOIN "WorkflowStatus" ws ON ws."id" = r."statusId"
LEFT JOIN "Pool" p ON p."id" = r."poolId"
LEFT JOIN "Inspection" i ON i."id" = r."inspectionId"
LEFT JOIN "School" s ON s."id" = i."schoolId"
LEFT JOIN "Pool" sp ON sp."id" = s."poolId"
WHERE ws."key" <> 'BROUILLON' AND COALESCE(p."organizationId", sp."organizationId") IS NOT NULL
ON CONFLICT ("reportId") DO NOTHING;
