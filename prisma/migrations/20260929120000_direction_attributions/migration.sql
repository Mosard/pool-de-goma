-- Direction de l'Inspection (additif) : attributions des IPP adjoints et
-- permission de les gérer. Aucune donnée existante n'est modifiée ; aucune
-- attribution n'est créée ici (l'IPP principal les saisit lui-même).

CREATE TABLE "DirectionAttribution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "holderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectionAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectionAttribution_organizationId_label_key" ON "DirectionAttribution"("organizationId", "label");
CREATE INDEX "DirectionAttribution_holderId_idx" ON "DirectionAttribution"("holderId");

ALTER TABLE "DirectionAttribution" ADD CONSTRAINT "DirectionAttribution_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectionAttribution" ADD CONSTRAINT "DirectionAttribution_holderId_fkey"
    FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permission de gestion de la Direction. Référentiel RBAC (pas une donnée
-- métier) : même clé que PERMISSIONS.DIRECTION_MANAGE dans
-- src/lib/rbac-data.ts. Accordée à l'IPP et au Super Admin, s'ils existent
-- (pas à l'informaticien : décision du 2026-09-29). Idempotent.
INSERT INTO "Permission" ("id", "key", "label", "category")
VALUES ('perm_direction_manage', 'direction.manage', 'Gérer la Direction de l''Inspection (attributions des IPP adjoints)', 'Publication')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_dirmgr_' || r."id", r."id", p."id"
FROM "RoleDefinition" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('ipp', 'super_admin') AND p."key" = 'direction.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
