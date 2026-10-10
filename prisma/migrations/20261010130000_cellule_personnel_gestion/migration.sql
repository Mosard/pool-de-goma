-- Cellule du personnel — décision Q-A du 2026-10-10 : l'IPP principal, les
-- Super Admins, l'IPA chargé du personnel en fonction, les secrétaires de
-- l'IPP et l'informaticien attribuent ou retirent la vocation « gestion du
-- personnel » et désignent le responsable IPA de cette cellule. Aucune cellule,
-- aucun compte, aucune vocation n'est créé ni modifié ici.

-- 1. Permission.
INSERT INTO "Permission" ("id", "key", "label", "category") VALUES
  ('perm_cells_personnel_manage', 'cells.personnel.manage',
   'Attribuer ou retirer la vocation « gestion du personnel » et désigner le responsable de cette cellule', 'Présence du personnel')
ON CONFLICT ("key") DO NOTHING;

-- 2. Fonctions (l'IPA chargé du personnel la reçoit par son affectation, pas par une ligne ici).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_presence_' || r."id" || '_' || p."key", r."id", p."id"
FROM "RoleDefinition" r CROSS JOIN "Permission" p
WHERE r."key" IN ('ipp', 'super_admin', 'informaticien', 'secretaire_ipp') AND p."key" = 'cells.personnel.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 3. Une seule cellule ACTIVE de vocation PERSONNEL par organisation, garantie
--    par la base (opérations simultanées comprises). Index partiel, hors du
--    schéma Prisma (non représentable) ; `prisma migrate diff` ne le retire pas.
CREATE UNIQUE INDEX "Cell_one_active_personnel_key" ON "Cell"("organizationId") WHERE "mandate" = 'PERSONNEL' AND "active" = true;
