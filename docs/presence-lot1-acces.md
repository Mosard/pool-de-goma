# Présence du personnel — lot 1 : accès, cellule du personnel, fiches

Décisions de l'Inspection du 2026-10-10 (analyse complète tenue hors dépôt).
Ce lot ne contient **ni pointages, ni appareils, ni demandes, ni corrections,
ni délégations, ni intérims** : seulement les permissions, le raccordement à la
cellule du personnel et la consultation des fiches en lecture seule.

## Ce qui est en place

| Élément | Où |
|---|---|
| 14 permissions du module (catégorie « Présence du personnel »), attribuées par fonction | `src/lib/rbac-data.ts`, `src/lib/demo-seed.ts`, migration `20261010120000_presence_lot1_acces` |
| Vocation explicite d'une cellule : `Cell.mandate` (`GENERAL` / `PERSONNEL`), jamais déduite du nom ni du code | `prisma/schema.prisma` |
| Pouvoirs du responsable du personnel (`PERSONNEL_HEAD_KEYS`) : seulement à l'IPA responsable (`Cell.ipaId`) de **la** cellule active `PERSONNEL` ; aucun si plusieurs cellules actives portent cette vocation | `bindPersonnelHeadPermissions` (`src/lib/cells/rules.ts`), `loadRealAccess` |
| Règle existante conservée : IPA sans cellule active = aucun droit | `awaitingCellAssignment` |
| Super Admin : catalogue **moins** `SUPER_ADMIN_EXCLUDED_PERMISSIONS` (fiches, seuils et calendrier, vérification, approbation, délégation, heures sup., permissions de cellule), même si une ligne en base les lui donnait | `bindRolePermissions` |
| « Voir comme » : aucun pouvoir réservé en simulation (IPP ou IPA simulés compris) | `withoutReservedForSimulation` |
| « Gérer les accès » : aucun **ajout** individuel des permissions du module (retrait possible) ; un ajout déjà en base reste sans effet | `PRESENCE_NOT_INDIVIDUALLY_GRANTABLE`, `applyAdjustments` |
| Historique d'appartenance aux cellules (`StaffCellTerm`) : tenu à chaque affectation ; reprise sans date inventée (`CONNUE` ou `CONSTATEE_A_LA_REPRISE`) | `src/lib/cells/history.ts`, migration |
| Fiches du personnel : recherche `/personnel` et fiche `/personnel/[id]`, lecture seule, liste blanche de champs, « Non renseigné » / « 0 », recherche et consultation journalisées sans contenu | `src/lib/personnel/*`, onglet « Fiches du personnel » de l'espace Inspecteurs |
| Profil : journal avec les noms des champs modifiés ; nombre d'enfants entier ≥ 0 | `src/app/(dashboard)/profil/actions.ts`, `src/lib/validations.ts` |
| Paramètres › Cellules : vocation **affichée**, sans action de modification | `src/app/(dashboard)/parametres/cellules/page.tsx` |

## Points ouverts qui touchent ce lot

- **Q-A** — qui attribue ou modifie la vocation « gestion du personnel » : aucune action d'écriture n'existe ; la cellule du personnel ne peut donc pas encore être activée depuis l'application.
- **Q-E** — attribution individuelle des permissions sensibles (hors calendrier, décidé) : refusée en attendant.
- **Q-FICHE-1/2/3** — modification et export des fiches, accès de l'IPP et du Super Admin, champs manquants : rien d'ajouté.
- Retrait de la fonction d'IPA depuis « Gérer les accès » sans retirer `Cell.ipaId` : comportement antérieur inchangé (le compte perd ses droits d'IPA ; l'historique suit `Cell.ipaId`).

## Vérifications (base locale uniquement)

- `npm test` : règles pures (`src/lib/personnel/presence-access.test.ts`, onglets).
- `POSTGRES_URL=<locale> npx tsx prisma/scripts/verify-personnel.ts` : raccordement, refus par appel direct, simulation, ajustements, liste blanche, historique.
- `POSTGRES_URL=<locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-personnel-http.ts` (application démarrée) : pages réelles, refus, retrait de responsabilité pendant une session ouverte.
