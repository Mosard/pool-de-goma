# Export des inspections et des rapports — Phase 1 (analyse)

> **Statut : analyse seule, aucun code applicatif modifié.** En attente de validation et des réponses aux questions du § 6.
> Rédigé le 2026-10-07 d'après `master` (`ba31f03`).

## 1. Ce qui existe

### 1.1 Outils d'export ou de génération de documents
**Il n'en existe aucun.** `package.json` ne contient aucune bibliothèque PDF, Excel ou CSV, ni navigateur sans interface. Les seuls « PDF » de l'application sont les pièces jointes des actualités (`contenus`) : on les dépose, on ne les génère pas.

### 1.2 Structure des fiches en base (pour un PDF fidèle)
- **Le lien vers la version :** chaque fiche saisie (`Form`) pointe vers la **ligne exacte de sa version** (`FormTemplate` (code, version), jamais modifiée après publication).
- **La définition :** elle est disponible à deux endroits :
  - dans le code, par le registre `getFicheDef(code, version)` ;
  - en base, sous forme d'instantané JSON dans `FormTemplate.fieldsSchema`.
  `resolveFicheDef` choisit l'un ou l'autre. Un ancien rapport se reconstruit donc avec **la fiche de son époque**.
- **Le contenu de la définition :** l'en-tête (postes 01 à 05, cases de ventilation, M/P/S), les sections, les postes notés (rubriques, numéros imprimés, observations, conseils), les tableaux (lignes imprimées, totaux, pourcentages), les champs calculés, la synthèse avec son tableau de conversion, et les emplacements de signature.
- **Les données saisies :** `Form.data` = `{ values, signatures }`. Les signatures sont des images PNG, éventuellement avec un refus de signer et deux témoins.
- **Les calculs figés :** `Form.computed` est enregistré **à la soumission** (totaux, conversions, note finale, mention). Le PDF reprend ces valeurs figées, et non un recalcul.
- **Le numéro officiel :** `Form.number`.
- **Les anciens contenus :**
  - fiches simulées (ancien format plat) : liste « libellé → valeur » ;
  - rapports de l'ancien circuit : résumé et recommandations, plus leurs fiches.

### 1.3 Périmètre des listes existantes
| Écran | Règle actuelle | Constat |
|---|---|---|
| `/rapports` | Une personne qui exploite ou valide voit **l'organisation** si elle a *n'importe quelle* permission sans POOL, sinon le **POOL de rattachement de son compte** (`user.poolId`). Les autres voient leurs propres rapports. | **Imprécis :** une permission provinciale sans rapport avec l'exploitation (par exemple un ajout individuel) ferait basculer en vue « province » ; et les POOL réellement exploités ne sont pas lus dans les permissions. |
| `/exploitation` | Vue « province » si une permission d'exploitation est sans POOL, sinon le POOL du compte | Correct, mais calculé à part. |
| Tableaux de bord (`src/lib/dashboard`) | Un périmètre par fonction, calculé côté serveur (`resolveDashboardScopes`) | Correct. C'est la logique la plus rigoureuse, mais elle est pensée par section de tableau de bord. |
| **Démonstration** | Ni `/rapports` ni `/exploitation` ne séparent les données de démonstration des données officielles | Le mélange existe déjà à l'écran. |

Les pages de détail (`/rapports/[id]`, `/inspections/[id]`, `/fiches/[id]`) sont protégées par `canReadScope` : seuls l'auteur, ou une personne qui exploite, valide ou affecte dans ce POOL, peuvent les lire.

## 2. Ce qui manque
- **La génération de PDF et d'Excel.**
- **Une règle de périmètre unique** pour la liste, l'exploitation et les exports, fondée sur les **permissions effectives** relues en base (ajustements individuels compris) et non sur le POOL de rattachement.
- **La séparation démonstration / officiel**, dans les listes comme dans les exports.
- **Les filtres** école, inspecteur, POOL, dates et statut sur `/rapports`. `/exploitation` n'a aujourd'hui que POOL, fiche et dates.

## 3. Périmètre commun proposé (`src/lib/exports/scope.ts`)

**Calcul côté serveur**, à partir de `loadUserAccess` (compte ACTIVE, fonctions et ajustements individuels compris) :
- **Rapports de l'auteur :** toujours ses propres rapports.
- **Rapports exploités :** ceux des POOL où la personne détient `reports.review_pool`, `reports.review_province` ou `reports.validate`. Une telle permission sans POOL donne toute l'organisation.
- **Démonstration :** un compte officiel ne voit et n'exporte **que les données officielles** ; un compte de démonstration, **que les données de démonstration**. Un rapport est de démonstration si son école l'est, ou, pour une fiche de période, si son auteur l'est.
- **Filtres demandés :** ils ne font que **restreindre** ce périmètre. Un POOL ou un inspecteur demandé hors périmètre est **refusé** (erreur 403), jamais élargi.

La même fonction sert à la liste `/rapports`, à `/exploitation` et aux deux exports : l'export reprend exactement ce que montre l'écran.

## 4. Méthode proposée par format

### 4.1 PDF d'une fiche (rapport)
| Option | Avantages | Limites |
|---|---|---|
| **A. `@react-pdf/renderer`, génération côté serveur** (recommandée) | Vrai fichier PDF, téléchargeable et partageable sur téléphone (partage natif du téléphone) ; pur JavaScript, fonctionne sur Vercel ; mise en page déclarative construite à partir de la définition de la fiche (cartouche, grilles, tableaux de conversion, signatures en images) | Nouvelle dépendance (environ 1 à 2 Mo côté serveur) ; mise en page à écrire une fois pour tous les types de blocs |
| B. Navigateur sans interface (Chromium) | Rendu identique à une page HTML | Lourd pour Vercel (taille de fonction, démarrage lent), fragile |
| C. Page « version imprimable » + impression du navigateur | Aucune dépendance | Pas de vrai fichier généré par le serveur ; résultat variable selon le téléphone |

- **Portée de la fidélité :** le PDF reproduit **la structure** de la fiche officielle : en-tête et cartouche, numérotation et libellés exacts, ordre des rubriques, grilles de notes avec observations, tableaux, synthèse et barème, emplacements de signature avec les signatures tracées. Il ne s'agit **pas** d'un fac-similé au pixel près des fiches scannées.
- **Route** `GET /rapports/[id]/pdf` : contrôle `canReadScope` et règle démonstration / officiel côté serveur ; définition de la **version** liée au rapport ; calculs figés.
- **Boutons :**
  - sur la page d'un rapport et sur la page d'une fiche soumise : « Télécharger / partager en PDF » ;
  - sur la page d'une inspection : le PDF de chaque fiche, et un PDF « toutes les fiches de la visite » qui assemble celles que la personne a le droit de lire.

### 4.2 Excel en masse
- **Bibliothèque `exceljs`** (pur JavaScript, génère un vrai `.xlsx`). Je l'écarte au profit de SheetJS, dont la version disponible sur npm n'est plus maintenue.
- **Route** `GET /rapports/export.xlsx?…` : mêmes paramètres que les filtres de la liste, même périmètre (§ 3). Une ligne par rapport, avec les colonnes **École, POOL, Inspecteur, Fiche (code et intitulé), N° du rapport, Date, Statut**. La date est celle de la soumission, sinon celle de la création. Les fiches de période n'ont pas d'école et affichent « — ».
- **Plafond :** 10 000 lignes par fichier, avec un message invitant à affiner les filtres au-delà.
- **Évolution prévue, non réalisée maintenant :** un onglet par type de fiche avec le détail de tous les champs, à partir de l'aplatissement déjà écrit pour l'IA (`src/lib/fiches/flatten.ts`).
- **Boutons :** « Exporter en Excel » sur `/rapports` et sur `/exploitation`. Le lien reprend les filtres affichés.

### 4.3 Filtres à ajouter
- **`/rapports` :**
  - recherche par école ;
  - inspecteur : une liste limitée au périmètre ;
  - POOL : seulement si le périmètre en couvre plusieurs ;
  - période (du, au) ;
  - statut ;
  - type de fiche.
- **`/exploitation` :** ajout de l'école, de l'inspecteur et du statut.
- **Les filtres passent dans l'adresse de la page** (paramètres d'URL), et le serveur les revalide toujours.

## 5. Tests prévus (phase 2)
- **Tests unitaires :** construction du périmètre et des filtres pour chaque fonction, refus d'un POOL ou d'un inspecteur hors périmètre, séparation démonstration / officiel.
- **Script de bout en bout sur base locale**, avec les comptes inspecteur, chef de POOL, exploitant de POOL, exploitant IPP et IPP :
  - chacun n'exporte que son périmètre ;
  - une requête forgée à la main est refusée ;
  - le PDF d'un rapport lié à une version antérieure utilise la définition de cette version ;
  - l'export reprend exactement la liste filtrée.
- **Fin :** lint, tests et build.

## 6. Questions bloquantes
- **Q1 — Bibliothèques.** D'accord pour ajouter `@react-pdf/renderer` (PDF) et `exceljs` (Excel) ? Ce sont les deux seules nouvelles dépendances.
- **Q2 — Démonstration dans les listes.** Pour que l'export « reprenne exactement l'écran » sans mélanger démonstration et officiel, il faut appliquer la même séparation **à l'écran** de `/rapports` et `/exploitation` : un compte officiel n'y verra plus les rapports de démonstration. Est-ce acceptable ?
- **Q3 — Correction du périmètre de `/rapports`.** Je propose de remplacer la règle actuelle (permission sans POOL quelconque, POOL de rattachement) par le périmètre commun du § 3, fondé sur les permissions d'exploitation. Certains comptes verront alors **moins** de rapports si leur vue « province » venait d'une permission sans rapport avec l'exploitation. Aucun ne verra plus. D'accord ?
- **Q4 — Rapports de l'ancien circuit et fiches simulées.** Le PDF de ces rapports serait une présentation simple (résumé, recommandations, champs « libellé → valeur »), faute de fiche officielle. Est-ce suffisant ?
