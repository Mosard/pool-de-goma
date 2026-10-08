-- Décision de l'Inspection (2026-10-08) : le Super Admin devient une fonction
-- officielle de l'Inspection. Texte seulement : ni droits, ni attribution, ni
-- statut réservé ne changent (src/lib/rbac-data.ts).
UPDATE "RoleDefinition"
SET "label" = 'Super Admin',
    "description" = 'Fonction officielle de l''Inspection : accès complet à la plateforme pour l''administration, l''assistance et le dépannage. Toutes ses actions sont tracées.',
    "updatedAt" = now()
WHERE "key" = 'super_admin';
