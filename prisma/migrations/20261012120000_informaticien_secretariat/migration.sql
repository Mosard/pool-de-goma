-- Décision du 2026-10-12 : l'informaticien de l'IPP reçoit le droit du
-- Secrétariat de l'IPP (reports.route_ipp : recevoir les rapports soumis et
-- les envoyer ou réaffecter à une cellule, au nom de l'IPP), comme les
-- secrétaires de l'IPP. Aucun compte ni aucune autre permission modifiés.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_secretariat_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" = 'informaticien' AND p."key" = 'reports.route_ipp'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
