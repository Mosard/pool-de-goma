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
| Paramètres › Cellules : vocation choisie à la création et modifiable ensuite ; responsable de la cellule du personnel | `src/app/(dashboard)/parametres/cellules/*` |

## Complément Q-A (décision du 2026-10-10)

- Permission `cells.personnel.manage` : IPP principal, Super Admins, secrétaires de l'IPP, informaticien (par leur fonction) et IPA chargé du personnel en fonction (par son affectation, `PERSONNEL_HEAD_KEYS`). Jamais ajoutée individuellement.
- Elle permet d'attribuer ou retirer la vocation (`setCellMandate`, `src/lib/cells/personnel.ts`) et d'affecter, remplacer ou retirer le responsable IPA **de la seule cellule du personnel** (`setCellIpa`, mêmes contrôles d'éligibilité : compte officiel actif, fonction d'IPA, aucune autre cellule dirigée ; jamais sur son propre compte). Les autres cellules gardent `ROLE_GRANTORS` (IPA ← IPP, Super Admin).
- Une seule cellule active `PERSONNEL` par organisation : vérifiée dans la transaction et garantie par l'index unique partiel `Cell_one_active_personnel_key` (migration `20261010130000_cellule_personnel_gestion` ; non représentable dans `schema.prisma`, `prisma migrate diff` ne le retire pas). La réactivation d'une ancienne cellule du personnel est refusée si une autre est active.
- Journal : `cell.mandate_personnel_set` / `cell.mandate_personnel_remove` (avant / après, sigle de la cellule, responsable) et `cell.ipa_assign` / `cell.ipa_remove` (avant / après, sigle, vocation, autorité utilisée). Auteur réel ; mode « Voir comme » consigné comme partout.
- Pouvoirs : relus à chaque requête ; retirés si la cellule est archivée, perd sa vocation, si le responsable est remplacé ou retiré, si son compte n'est plus actif ou s'il n'a plus la fonction d'IPA (une affectation restante ne maintient rien). Accès : « Paramètres » mène directement aux cellules pour qui n'a que cette permission.

## Points ouverts qui touchent ce lot

- **Q-E** — attribution individuelle des permissions sensibles (hors calendrier, décidé) : refusée en attendant.
- **Q-FICHE-1/2/3** — modification et export des fiches, accès de l'IPP et du Super Admin, champs manquants : rien d'ajouté.
- Retrait de la fonction d'IPA depuis « Gérer les accès » sans retirer `Cell.ipaId` : le compte perd tous ses pouvoirs (vérifié) ; l'affectation reste enregistrée et la page des cellules la signale (« Responsable enregistré sans compte actif ou sans fonction d'IPA »).

## Vérifications (base locale uniquement)

- `npm test` : règles pures (`src/lib/personnel/presence-access.test.ts`, onglets).
- `POSTGRES_URL=<locale> npx tsx prisma/scripts/verify-personnel.ts` : raccordement, refus par appel direct, simulation, ajustements, liste blanche, historique.
- `POSTGRES_URL=<locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-personnel-http.ts` (application démarrée) : pages réelles, refus, retrait de responsabilité pendant une session ouverte.
