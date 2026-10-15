-- Présence ADMS : suppressions différées et directive de gouvernance du
-- 2026-10-15 sur « Appareils et associations ».
--
-- 1. Suppressions différées (annulables) : colonne facultative, additive.
-- 2. Droits « presence.devices.manage » et « presence.enrollment.manage » :
--    réservés au Super Admin, à la fonction Admin (mêmes droits), à l'IPP
--    principal et à l'informaticien. Retirés des autres fonctions (secrétaires
--    de l'IPP en particulier) et des ajouts individuels éventuels. Aucun
--    compte, aucune fonction et aucune autre permission ne sont touchés ; la
--    consultation des présences (presence.read_all…) est inchangée. Le code
--    revérifie en plus la fonction réelle (holdsDeviceAdminRole).

-- AlterTable
ALTER TABLE "DeviceCommand" ADD COLUMN "notBefore" TIMESTAMP(3);

-- Retrait des deux droits pour toute autre fonction.
DELETE FROM "RolePermission" rp
USING "RoleDefinition" r, "Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND p."key" IN ('presence.devices.manage', 'presence.enrollment.manage')
  AND r."key" NOT IN ('super_admin', 'admin', 'ipp', 'informaticien');

-- Retrait des ajouts individuels (« Gérer les accès ») de ces deux droits ;
-- les retraits individuels (REVOKE) sont conservés.
DELETE FROM "UserPermission" up
USING "Permission" p
WHERE up."permissionId" = p."id"
  AND p."key" IN ('presence.devices.manage', 'presence.enrollment.manage')
  AND up."effect" = 'GRANT';

-- Les quatre fonctions autorisées détiennent les deux droits.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_devadm_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" IN ('super_admin', 'admin', 'ipp', 'informaticien')
  AND p."key" IN ('presence.devices.manage', 'presence.enrollment.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
