-- Fonction « Admin » (décision du 2026-10-13) : mêmes droits que le Super
-- Admin (catalogue moins les pouvoirs réservés), attribuée depuis l'écran par
-- un Super Admin seulement. Aucun compte ne la reçoit ici.

-- Sécurité : une fonction personnalisée portant déjà la clé « admin » serait
-- promue super-utilisatrice ; on refuse plutôt de migrer.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RoleDefinition" WHERE "key" = 'admin' AND "isSystem" = false) THEN
    RAISE EXCEPTION 'Une fonction personnalisée utilise déjà la clé « admin » : renommez-la avant de migrer.';
  END IF;
END $$;

INSERT INTO "RoleDefinition" ("id", "key", "label", "description", "scope", "isSystem", "createdAt", "updatedAt")
VALUES ('role_admin', 'admin', 'Admin',
        'Mêmes droits que le Super Admin (administration, assistance, dépannage), attribuée par un Super Admin. Toutes ses actions sont tracées.',
        'PROVINCE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Exactement les permissions actuelles du Super Admin (pouvoirs réservés déjà exclus).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_admin_' || p."key", a."id", rp."permissionId"
FROM "RolePermission" rp
JOIN "RoleDefinition" s ON s."id" = rp."roleId" AND s."key" = 'super_admin'
JOIN "Permission" p ON p."id" = rp."permissionId"
CROSS JOIN "RoleDefinition" a
WHERE a."key" = 'admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
