# Import des écoles par fichier Excel — bilan de la phase 1 (analyse)

Date : 2026-10-08. Phase 1 uniquement : **aucun code applicatif n'a été modifié.**
Ce document décrit l'existant, ce qu'il faut ajouter et les points à trancher
avant la phase 2.

---

## 1. Existant

### 1.1 Modèle `School` (`prisma/schema.prisma`, l. 438)

| Champ | Type | Obligatoire | Saisi dans le formulaire | Remarque |
|---|---|---|---|---|
| `id` | cuid | auto | non | identifiant technique |
| `poolId` | → `Pool` | oui | oui (« Pool de rattachement ») | rattachement au POOL |
| `name` | texte | oui (≥ 2 car.) | oui | **publié** sur la page du POOL |
| `code` | texte | oui (≥ 2 car.) | oui | **`@unique` sur toute la base** (voir § 1.4) |
| `province` | texte | oui | oui (défaut « Nord-Kivu ») | |
| `territoire` | texte | oui | oui (« Territoire (pool) ») | |
| `address` | texte | non | oui | **publié** sur la page du POOL |
| `director` | texte | non | oui | |
| `phone` | texte | non | oui | |
| `type` | texte libre | non | oui (indication « Primaire / Secondaire ») | aucune liste imposée ; la démo utilise Primaire / Secondaire / Maternelle |
| `active` | booléen (défaut vrai) | — | **non** (aucun écran ne le modifie) | |
| `isDemo` | booléen | — | non | posé automatiquement si l'auteur est un compte de démonstration |
| `createdAt`, `updatedAt` | dates | auto | non | |

Relations : `assignments` (affectations d'inspecteurs), `inspections`.

`Pool` possède lui aussi un `code` `@unique` : c'est ce code qui servira de
« code du POOL » dans le canevas.

### 1.2 Écrans et actions

- `src/app/(dashboard)/ecoles/page.tsx` : liste (toute l'organisation si
  l'utilisateur a une permission « tous les POOL », sinon son POOL) ; bouton
  « Nouvelle école » si `schools.manage` sur au moins un POOL.
- `ecoles/nouveau/page.tsx` + `school-form.tsx` : formulaire de création.
- `ecoles/[id]/page.tsx` : fiche + formulaire de modification (si droit).
- `ecoles/actions.ts` :
  - `createSchoolAction` : validation `schoolSchema` (`src/lib/validations.ts`),
    puis `requirePermission(userId, SCHOOLS_MANAGE, { poolId, organizationId })`
    — **relu en base** via `loadUserAccess` (rôles + ajustements individuels
    + mode « Voir comme »), puis `school.create` avec `isDemo` = compte démo,
    `logAudit("school.create")`, `revalidatePublicPools()`.
  - `updateSchoolAction` : même contrôle sur le POOL actuel **et** sur le POOL
    de destination en cas de déplacement ; un compte de démonstration ne peut
    pas modifier une école réelle (`requireOfficialActorUnlessDemoTarget`) ;
    un changement de POOL clôt les affectations en cours.

### 1.3 Permission `schools.manage` et portée par POOL

Contrôle : `hasPermission(permissions, key, { poolId, organizationId })`
(`src/lib/permission-checks.ts`) — une permission avec `poolId = null` vaut
pour tous les POOL de l'organisation, sinon uniquement pour son POOL.

Attribution par défaut (`ROLE_PERMISSIONS`, `src/lib/rbac-data.ts`) :

| Rôle | `schools.manage` | Portée |
|---|---|---|
| IPP | oui | tous les POOL |
| Super Admin | oui (toutes les permissions) | tous les POOL |
| Chef de POOL | oui | son POOL |
| **Secrétaire de POOL** | **oui** | son POOL |
| **Informaticien** | **non** | — |
| Autres (IPA, inspecteur, exploitants, agents) | non | — |

S'y ajoutent les ajustements individuels (`UserPermission`, écran « Gérer
les accès ») qui peuvent accorder ou retirer `schools.manage` à une personne.

⚠️ Écart avec la demande : la demande cite « le chef de POOL, l'IPP ou
l'informaticien ». Aujourd'hui l'**informaticien n'a pas** `schools.manage`
et le **secrétaire de POOL l'a**. Voir question Q1.

### 1.4 Clé d'identification : écart important

Aujourd'hui `School.code` est **unique dans toute la base** (index
`School_code_key`, migration `0_init`). Le couple « code du POOL + code de
l'école » n'existe donc **pas** comme clé : deux POOL ne peuvent pas avoir une
école de même code. Le nom n'est jamais unique (conforme à la demande).

### 1.5 Brique Excel déjà en place

- Dépendance `exceljs` ^4.4.0 déjà installée.
- Modèle à réutiliser : `src/app/(dashboard)/rapports/export.xlsx/route.ts`
  (route GET, session relue en base, audit, en-têtes `Content-Disposition`)
  et `src/lib/exports/server.ts` (construction du classeur).
- `next.config.ts` : `serverActions.bodySizeLimit = 4.5mb` (plafond Vercel),
  suffisant pour un fichier de plusieurs milliers de lignes.
- Tests : `npm test` (`tsx --test "src/**/*.test.ts"`), scripts de vérification
  sur base locale `prisma/scripts/verify-*.ts`.

---

## 2. Ajout des nouveaux champs (sans rien retirer)

Migration **additive** `<horodatage>_ecoles_agrement_import` :

| Nouveau champ | Colonne Prisma | Type | Validation |
|---|---|---|---|
| Arrêté d'agrément | `approvalDecree` | `String?` | texte libre : référence de l'arrêté telle qu'écrite (lettres, `/`, zéros en tête possibles) |
| Nombre de classes | `classCount` | `Int?` | entier ≥ 0 |
| Nombre d'enseignants | `teacherCount` | `Int?` | entier ≥ 0 |
| Options organisées | `options` | `String?` | texte libre séparé par des virgules ; **seulement si l'école est secondaire** |

- Toutes les colonnes sont **nullables** : les écoles existantes restent
  valides, aucune donnée n'est réécrite.
- Pas d'effectif des élèves (volontairement).
- « Options organisées » : stockées telles quelles (espaces autour des
  virgules nettoyés) ; le champ n'apparaît dans le formulaire que si le type
  est secondaire, et le serveur le refuse (ou l'ignore, voir Q4) pour une
  école non secondaire. Détection « secondaire » : `type` contient
  « secondaire » (sans tenir compte de la casse ni des accents), puisque
  `type` est aujourd'hui libre (voir Q3).
- Mise à jour de `schoolSchema`, `parseSchoolForm`, `school-form.tsx`,
  `ecoles/[id]/page.tsx` (affichage). Ces champs ne sont **pas publiés** sur
  le site public (seuls nom + adresse le sont, décision de l'Inspection).

### Clé « code du POOL + code de l'école »

Dans la même migration :

```sql
DROP INDEX "School_code_key";
CREATE UNIQUE INDEX "School_poolId_code_key" ON "School"("poolId", "code");
```

- C'est un **assouplissement** : toute donnée existante (codes déjà uniques
  globalement) respecte forcément la nouvelle contrainte → migration sans
  risque pour les écoles enregistrées.
- Le code du POOL est stable (`Pool.code @unique`) ; la clé technique reste
  `poolId` (équivalent strict du code du POOL), la correspondance code ↔ id
  étant faite côté serveur.
- Code de l'école : espaces de bord retirés ; comparaison proposée
  **insensible à la casse** pour éviter « ep-01 » / « EP-01 » en double (Q5).
- Adaptations induites (sans changement de comportement) : `demo-seed.ts`
  (`upsert where: { code }` → `where: { poolId_code: … }`), message « Ce code
  d'école existe déjà » → « … dans ce POOL ». Le déplacement d'une école vers
  un autre POOL (écran existant) reste possible ; il échoue proprement si le
  POOL de destination a déjà ce code.

---

## 3. Conception de l'import Excel

### 3.1 Découpage (réutilise l'architecture existante)

```
src/lib/schools-import/
  columns.ts      colonnes du canevas (ordre, en-têtes, clé, obligatoire, type) — source unique
  template.ts     construction du canevas vierge (exceljs)
  parse.ts        lecture du classeur → lignes brutes (exceljs), sans base
  validate.ts     fonctions PURES : ligne brute → données validées ou motif de rejet
  server.ts       application en base : contrôle d'accès + création/mise à jour + rapport
  schools-import.test.ts
src/app/(dashboard)/ecoles/canevas.xlsx/route.ts   GET → canevas vierge
src/app/(dashboard)/ecoles/import/page.tsx          écran d'import (POOL + fichier + récapitulatif)
src/app/(dashboard)/ecoles/import/actions.ts        server action importSchoolsAction
prisma/scripts/verify-schools-import.ts             vérification bout en bout, base locale, plusieurs rôles
```

### 3.2 Canevas (bouton « Télécharger le canevas » sur `/ecoles`)

Feuille « Écoles », ligne 1 = en-têtes clairs, figée, astérisque sur les
obligatoires :

| Col. | En-tête | Obligatoire |
|---|---|---|
| A | Code du POOL * | oui |
| B | Code de l'école * | oui |
| C | Nom de l'école * | oui |
| D | Province * | oui (voir Q6) |
| E | Territoire * | oui (voir Q6) |
| F | Type (Maternelle / Primaire / Secondaire) | non |
| G | Directeur | non |
| H | Téléphone | non |
| I | Adresse | non |
| J | Arrêté d'agrément | non |
| K | Nombre de classes | non (entier) |
| L | Nombre d'enseignants | non (entier) |
| M | Options organisées (secondaire seulement, séparées par des virgules) | non |

- Colonnes de codes, téléphone et arrêté d'agrément au **format texte** (préserve les
  zéros en tête).
- Seconde feuille « Mode d'emploi » (règles, exemple de ligne).
- `active`, `isDemo`, `id`, dates : **pas** dans le canevas (non saisis dans
  le formulaire actuel).
- Accès au canevas : toute personne ayant `schools.manage` sur au moins un POOL.

### 3.3 Import (bouton « Importer un fichier » sur `/ecoles`)

Écran `/ecoles/import` : liste des POOL **où l'utilisateur a
`schools.manage`** (calculée côté serveur), sélecteur de fichier `.xlsx`.

Server action `importSchoolsAction(formData)` :

1. Session obligatoire ; **`requirePermission(userId, SCHOOLS_MANAGE, { poolId, organizationId })`**
   sur le POOL choisi, relu en base (même fonction que la création manuelle).
   L'identifiant de POOL envoyé par le navigateur n'est qu'une **demande** :
   hors portée → refus global, rien n'est écrit.
2. Contrôles fichier : `.xlsx`, taille ≤ 4 Mo, ≤ 2 000 lignes (Q7), en-têtes
   reconnus (sinon refus global clair : « Ce fichier n'est pas le canevas des
   écoles »).
3. Pour chaque ligne (numéro de ligne Excel réel) : lignes entièrement vides
   ignorées ; sinon validation pure :
   - champ obligatoire manquant → « Ligne 7 : nom de l'école manquant » ;
   - code du POOL absent → rejet ; **différent du POOL choisi** → rejet
     (« Ligne 9 : code POOL X ≠ POOL choisi Y ») — le POOL n'est jamais
     déduit du fichier ;
   - nombres non entiers ou négatifs → rejet ;
   - options sur une école non secondaire → rejet (ou ignorées, Q4) ;
   - code d'école en double **dans le fichier** → première occurrence
     traitée, les suivantes rejetées.
4. Application ligne par ligne (chaque ligne indépendante, pas de transaction
   globale → une ligne fautive ne bloque pas les autres) :
   - recherche par `(poolId choisi, code)` ;
   - absente → `create` (`isDemo` = compte de démonstration, comme la saisie
     manuelle) ;
   - présente → `update` des seuls champs du canevas (jamais `poolId`,
     `active`, `isDemo`, affectations, inspections) ; **cellule facultative
     vide = valeur existante conservée** (Q2) ;
   - compte de démonstration sur une école réelle → ligne rejetée (même règle
     que `updateSchoolAction`) ;
   - erreur base imprévue → ligne rejetée avec motif, l'import continue.
5. Audit : une entrée `school.import` (POOL, nom du fichier, compteurs) +
   `school.create` / `school.update` par école (anciennes et nouvelles
   valeurs, comme aujourd'hui). `revalidatePath("/ecoles")`,
   `revalidatePublicPools()`.
6. Récapitulatif : **N créées, N mises à jour, N rejetées**, tableau des
   rejets (ligne, code, motif).

Aucune suppression : une école absente du fichier n'est ni supprimée ni
désactivée.

### 3.4 Tests prévus

- `schools-import.test.ts` (purs, `npm test`) : en-têtes reconnus, lignes
  valides, obligatoires manquants, POOL différent, nombres invalides, options
  hors secondaire, doublons dans le fichier, lignes vides ignorées.
- `prisma/scripts/verify-schools-import.ts` (base locale uniquement, refuse
  une base distante comme les autres scripts) :
  1. fichier valide → écoles créées ;
  2. même code réimporté → mise à jour, pas de doublon ; écoles
     préexistantes non touchées ;
  3. lignes bonnes et fautives mêlées → bonnes importées, fautives rapportées
     avec numéro et motif ;
  4. chef du POOL A appelant directement l'action avec le POOL B → refusé,
     rien d'écrit ; idem secrétaire de POOL ; IPP, Super Admin (et
     informaticien selon Q1) acceptés partout ; inspecteur refusé ;
  5. même code dans deux POOL → deux écoles distinctes.
- `npm run lint`, `npx tsc --noEmit`, `npx next build` (pas `npm run build`
  sous Windows : il lancerait `prisma migrate deploy`).

### 3.5 Précautions de déploiement

La migration (index unique composite + 4 colonnes nullables) est additive et
sans perte, mais **pousser la branche déclenche `prisma migrate deploy` sur la
base de production** via Vercel. La phase 2 restera sur une branche locale
dédiée (`feat/import-ecoles-excel`), non poussée sans votre accord.

---

## 4. Décisions (points tranchés avant la phase 2)

- **Q1 — Qui peut importer ? ✅ TRANCHÉ (2026-10-08)** : l'import respecte
  strictement `schools.manage` :
  - **Informaticien** : reçoit `schools.manage` sur tous les POOL
    (`ROLE_PERMISSIONS` + migration de données idempotente sur
    `RolePermission`, sans toucher aux autres permissions).
  - **Super Admin** : `schools.manage` sur tous les POOL (il l'a déjà via
    `SUPER_ADMIN_PERMISSIONS` = tout le catalogue ; à vérifier en base lors des
    tests). Décision de l'Inspection : le Super Admin devient **à partir
    d'aujourd'hui une fonction officielle de l'Inspection**.
  - **Secrétaire de POOL** : garde `schools.manage`, limité à son POOL.
  - IPP (tous les POOL) et chef de POOL (son POOL) : inchangés.
  - Conséquence hors périmètre de l'import, à confirmer : le libellé et la
    description actuels du Super Admin (`rbac-data.ts` : « administration
    technique… N'occupe aucune fonction de l'Inspection ») contredisent cette
    décision ; idem son statut de fonction réservée (`RESTRICTED_ROLE_KEYS`)
    et les gardes qui en découlent. Rien n'est changé là sans accord explicite.
- **Q2 à Q7 — ✅ TRANCHÉS (2026-10-08) : propositions retenues.**
  - Q2 : cellule vide en mise à jour = valeur existante **conservée**.
  - Q3 : type d'école en **texte libre** ; « secondaire » détecté sans
    casse ni accents.
  - Q4 : options sur une école non secondaire → **ligne rejetée**.
  - Q5 : codes comparés **sans tenir compte de la casse** (import et
    formulaire) ; le code garde son écriture d'origine.
  - Q6 : province et territoire **obligatoires**.
  - Q7 : **2 000 écoles** au plus par fichier (4 Mo).
- Super Admin « fonction officielle » : libellé, description et statut
  réservé à revoir **plus tard, dans une demande séparée** (décision du
  2026-10-08). Non modifiés ici.

---

## 5. Réalisation (phase 2)

Branche `feat/import-ecoles-excel` (worktree `../app-ecoles`), **non poussée**.

### 5.1 Fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | `School` : `approvalDecree`, `classCount`, `teacherCount`, `options` ; `@@unique([poolId, code])` au lieu de `code @unique` |
| `prisma/migrations/20261009120000_ecoles_agrement_import/` | 4 colonnes nullables, index composite, `schools.manage` ajouté à l'informaticien (et au Super Admin s'il lui manquait) — ajout seulement |
| `src/lib/school-fields.ts` | règles pures partagées : secondaire, options, nombres, comparaison des codes |
| `src/lib/validations.ts` | `schoolSchema` : nouveaux champs, options refusées hors secondaire |
| `src/app/(dashboard)/ecoles/actions.ts` | nouveaux champs ; code unique **par POOL** sans tenir compte de la casse |
| `src/app/(dashboard)/ecoles/school-form.tsx`, `[id]/page.tsx` | saisie et affichage ; zone « Options » visible seulement pour une école secondaire |
| `src/app/(dashboard)/ecoles/page.tsx` | boutons « Télécharger le canevas » et « Importer un fichier » (si `schools.manage`) |
| `src/app/(dashboard)/ecoles/canevas.xlsx/route.ts` | canevas vierge (403 sans `schools.manage`) |
| `src/app/(dashboard)/ecoles/import/` | écran d'import (POOL + fichier), action serveur, récapitulatif |
| `src/lib/schools-import/` | `columns.ts` (13 colonnes), `validate.ts` (pur), `workbook.ts` (exceljs), `server.ts` (droits + écriture + audit) |
| `src/lib/demo-seed.ts` | informaticien + `schools.manage` ; upserts par `poolId_code` |
| `src/lib/schools-import/schools-import.test.ts` | 11 tests (`npm test`) |
| `prisma/scripts/verify-schools-import.ts` | vérification de bout en bout, base locale, 7 comptes de rôles différents |

### 5.2 Comportement

- Contrôle d'accès : `loadUserAccess` (base, ajustements individuels et
  « Voir comme » compris) + `hasPermission(schools.manage, { poolId, organizationId })`
  sur le POOL choisi ; refus global (`ForbiddenError`) sinon, rien n'est lu
  ni écrit. La liste des POOL proposés est calculée de la même façon.
- Une ligne dont le code du POOL diffère du POOL choisi est rejetée.
- Récapitulatif : créées, mises à jour, **déjà à jour** (code existant sans
  changement), rejetées (ligne, code, motif).
- Compte de démonstration : écoles créées marquées démo ; une école réelle
  n'est jamais modifiée (ligne rejetée), comme dans la fiche.
- Audit : `school.create` / `school.update` par école (anciennes et nouvelles
  valeurs, `metadata.source = "import Excel"`) + `school.import` (compteurs).

### 5.3 Vérifications (2026-10-08)

- `npm test` : **105/105** (dont 11 nouveaux).
- `npx eslint` : aucune erreur ; `npx tsc --noEmit` : aucune erreur.
- `npx next build --webpack` : réussi (`/ecoles/canevas.xlsx`, `/ecoles/import`).
- Migration testée sur base locale contenant des écoles « anciennes » (dont
  deux de même nom) : données intactes, nouveaux champs vides, index
  composite créé, informaticien ajouté, droits existants conservés.
- `verify-schools-import.ts` : **10/10** — création, mise à jour sans doublon,
  rejets avec numéro et motif, chef et secrétaire refusés hors de leur POOL
  par appel direct (rien d'écrit), inspecteur/exploitant refusés, IPP,
  informaticien et Super Admin sur tous les POOL, même code dans deux POOL,
  démo ↛ école réelle, écoles existantes préservées, audit.
- Application lancée en local, sessions réelles : canevas 200 pour chef de
  POOL, IPP, informaticien ; 403 pour inspecteur et exploitant ; anonyme
  redirigé vers la connexion ; `/ecoles/import` redirige les comptes sans droit.

### 5.4 Restant

- Pas de contrôle visuel dans un navigateur (outil indisponible ici) : à
  regarder à l'écran avant fusion.
- Déploiement : la migration s'appliquera en production au premier push
  (Vercel) — à faire seulement sur votre accord.
- Fusion : une autre session travaille sur `feat/cellules-ipp` ; récupérer
  `master` à jour avant de fusionner (pas de conflit attendu hors
  `demo-seed.ts`).
