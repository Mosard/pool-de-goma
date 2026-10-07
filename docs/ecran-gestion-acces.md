# Écran « Gérer les accès » — Phase 1 (analyse)

> **Statut : analyse seule, aucun code applicatif modifié.** En attente de validation et des réponses aux questions du § 6.
> Rédigé le 2026-10-07 d'après `master` (`bd12115`).

## 1. Ce qui existe

### 1.1 Modèle de données (`prisma/schema.prisma`)

| Table | Rôle |
|---|---|
| `RoleDefinition` | Fonction : `key`, `label`, `scope` (PROVINCE ou POOL), `isSystem` (fonction prévue d'office ou créée dans Paramètres) |
| `Permission` | Permission du catalogue : `key`, `label`, `category` |
| `RolePermission` | Permissions d'une fonction : unicité (fonction, permission) |
| `UserRole` | Fonction d'une personne : `userId`, `roleId`, `poolId` (vide pour une fonction provinciale) ; unicité (personne, fonction, POOL) |

**Réponse au point clé : les permissions ne sont attachées qu'aux fonctions.** Aucune table ne relie une permission à une personne. Il n'existe donc aucun moyen aujourd'hui d'ajouter ou de retirer une permission à une personne par-dessus sa fonction.

### 1.2 Calcul des droits effectifs

- **`loadRealAccess(userId)`** (`src/lib/permissions.ts`) :
  1. Le compte doit être **ACTIVE** ; sinon, aucun rôle et aucune permission.
  2. Pour chaque `UserRole`, chaque permission de la fonction devient une entrée `{ permissionKey, poolId, organizationId }`. `poolId` est celui de la fonction : vide pour une fonction provinciale, ce qui signifie « tous les POOL de l'organisation ».
- **`loadUserAccess(userId)`** ajoute :
  - le drapeau Super Admin ;
  - le mode « Voir comme » : les droits deviennent ceux de la fonction simulée, et pour l'IPP ils sont bornés à ses droits réels.
- **`hasPermission(permissions, key, { poolId, organizationId })`** (`permission-checks.ts`) :
  - une entrée sans POOL vaut pour tout POOL de la même organisation ;
  - une entrée de POOL ne vaut que pour ce POOL.
- **Session (`src/lib/auth.ts`)** : les droits sont relus en base **à chaque requête** (`accessForRequest`). Un changement s'applique donc immédiatement, menus compris. *Le document `GESTION-ACCES-ET-PERMISSIONS.md` disait à tort, en section 13, que l'affichage pouvait avoir du retard : il sera corrigé.*

**Calculs de droits qui ne passent pas par `loadUserAccess`** (à adapter, sinon un ajustement individuel serait ignoré) :
- `notifyUsersWithPermission` (`src/lib/notifications/dispatcher.ts`) : il choisit les destinataires d'après les seules permissions des fonctions ;
- la recherche des valideurs à prévenir (`src/app/(dashboard)/contenus/actions.ts`, ligne 130).

### 1.3 Règles d'attribution déjà en place

- **`ROLE_GRANTORS`** (`rbac-data.ts`) et **`canGrantRole`** (`permission-checks.ts`) : qui peut attribuer quelle fonction, avec ces règles particulières :
  - le chef de POOL n'agit que dans son POOL et ne donne que les fonctions d'appui (inspecteur, exploitant, secrétaire, agent de POOL) ;
  - le Super Admin ne s'attribue jamais depuis l'application ;
  - l'IPP n'est attribué que par le Super Admin.
- **`requireRoleGrant`** (`permissions.ts`) :
  - jamais sur soi-même ;
  - jamais une fonction réservée ;
  - une fonction créée dans Paramètres ne s'attribue que si l'on détient soi-même chacune de ses permissions.
- **`requireAuthorityOverAccount`** : agir sur un compte (suspendre, envoyer un lien) n'est possible que si l'on pourrait attribuer **chacune** de ses fonctions ; jamais sur son propre compte, sauf exception explicite.
- **Comptes de démonstration** : un compte de démonstration n'agit jamais sur des données réelles (`requireOfficialActorUnlessDemoTarget`).
- **Écrans qui attribuent déjà des fonctions**, à réutiliser plutôt que dupliquer :
  - `parametres/pools/[id]/actions.ts` : ajouter et retirer une fonction de POOL, nommer un chef. Retirer la fonction d'inspecteur met fin à ses affectations et, le cas échéant, à sa fonction de chef.
  - `lib/accounts.ts` : création de compte, approbation de demande.
  - Chacun de ces écrans écrit une entrée d'audit (`user.role_add`, etc.).
- **Accès à Paramètres** : la page exige `pools.manage`, soit l'IPP, l'informaticien et le Super Admin. **Le chef de POOL n'y a pas accès** ; il gère son POOL depuis « Mon POOL » (`/parametres/pools/[id]`).

## 2. Ajout proposé au modèle de données (additif)

Nouvelle table **`UserPermission`**, pour les ajustements individuels :

| Champ | Sens |
|---|---|
| `userId` | personne concernée |
| `permissionId` | permission du catalogue |
| `poolId` | vide = ajustement valable sur tous les POOL ; sinon, pour ce POOL |
| `effect` | `GRANT` (ajout par-dessus la fonction) ou `REVOKE` (retrait d'une permission héritée) |
| `grantedById`, `createdAt` | auteur et date (l'historique complet reste dans le journal d'audit) |

- Unicité sur (`userId`, `permissionId`, `poolId`) : une seule décision par permission et par portée.
- Rien n'est retiré ni modifié dans les tables existantes. Sans ligne dans `UserPermission`, les droits restent exactement ceux d'aujourd'hui.

## 3. Intégration dans le calcul des droits

Dans `loadRealAccess`, après le calcul par les fonctions :
1. **Retraits** : on supprime chaque entrée héritée dont (permission, POOL) correspond exactement à un `REVOKE`.
2. **Ajouts** : on ajoute chaque `GRANT` comme une entrée `{ permissionKey, poolId, organizationId }`.
3. On dédoublonne.

Propriétés conservées :
- **Compte non ACTIVE** : toujours aucun droit, car le calcul s'arrête avant.
- **`hasPermission`** : inchangé, car il reçoit la même liste d'entrées.
- **« Voir comme »** : les droits simulés restent ceux de la fonction seule, sans ajustement. Le plafond de l'IPP se calcule sur ses droits réels, ajustements compris.
- **Contrôles qui dépendent d'une fonction et non d'une permission** : ils restent inchangés. Par exemple, l'autorisation de publication exige la fonction IPP, informaticien ou Super Admin ; donner `publication.manage` à quelqu'un ne lui donne donc pas ce pouvoir.
- **Calculs hors `loadUserAccess`** (notifications, valideurs de contenus) : ils devront appliquer les mêmes ajouts et retraits.

**Règles serveur proposées pour un ajustement individuel**, toutes contrôlées côté serveur à partir de la session relue en base :
1. Jamais sur soi-même.
2. L'acteur doit avoir autorité sur le compte (`requireAuthorityOverAccount`).
3. L'acteur doit détenir lui-même la permission, sur une portée qui couvre celle de l'ajustement : on ne donne jamais plus que ce qu'on a.
4. Le chef de POOL n'ajuste que dans son POOL (`poolId` = son POOL).
5. Compte de démonstration : mêmes règles qu'aujourd'hui.
6. Chaque ajout ou retrait est écrit dans le journal d'audit, par exemple sous les actions `user.permission_grant` et `user.permission_revoke` :
   - qui a fait l'action ;
   - sur quel compte ;
   - quelle permission ;
   - quelle portée ;
   - dans quel sens ;
   - avant et après ;
   - la date.

## 4. Matrice : qui ouvre l'écran, qui il voit, ce qu'il ajuste

| Personne connectée | Comptes visibles et gérables | Fonctions qu'elle peut attribuer ou retirer | Permissions qu'elle peut cocher |
|---|---|---|---|
| **Super Admin** | Tous les comptes de l'organisation, sauf le sien et ceux des autres Super Admin | Toutes, sauf Super Admin | Toutes, sur tous les POOL |
| **IPP** | Tous, sauf le sien, celui des autres IPP et les Super Admin | IPA, informaticien, et toutes les fonctions provinciales et de POOL | Celles qu'il détient : accounts, users, pools, schools, assignments, reports.review_province, reports.validate, audit, form_templates, publication, direction, content.publish, ai.analyze |
| **Informaticien** | Comptes dont il peut attribuer chaque fonction : **pas** l'IPP, ni un IPA, ni un autre informaticien, ni un Super Admin | Exploitant IPP, agent IPP, chargé des médias, chef de POOL, et toutes les fonctions de POOL | Celles qu'il détient : accounts, users, pools, form_templates, audit, publication, content.publish, ai.analyze. Il **ne peut pas** cocher inspections.conduct ni reports.* |
| **Chef de POOL** | Comptes de **son** POOL qui n'ont que des fonctions d'appui (inspecteur, exploitant, secrétaire, agent de POOL) ; pas un autre chef ni un compte provincial | Inspecteur, exploitant, secrétaire, agent de POOL, dans son POOL | Celles qu'il détient dans son POOL : schools, assignments, reports.review_pool, ai.analyze, limitées à son POOL |
| **IPA, exploitant IPP, agent IPP, chargé des médias, inspecteur, exploitant ou secrétaire ou agent de POOL** | Aucun : le bouton n'est pas affiché | — | — |

Les permissions que la personne connectée ne peut pas cocher restent visibles mais désactivées, avec leur raison : « vous ne détenez pas cette permission », « hors de votre POOL », « fonction que vous ne pouvez pas attribuer ».

## 5. Plan de la phase 2 (après validation)

1. **Branche dédiée :** `feat/gestion-acces`.
2. **Migration additive** : la table `UserPermission`.
3. **Calcul des droits** : intégration dans `loadRealAccess`, dans les notifications et dans la recherche des valideurs de contenus, avec des tests.
4. **Règles serveur** :
   - « qui peut voir et gérer ce compte » ;
   - « peut ajuster cette permission sur cette portée » ;
   - réutilisation de `canGrantRole`, `requireRoleGrant` et `requireAuthorityOverAccount`.
5. **Actions serveur** :
   - enregistrement groupé des changements, après un récapitulatif ;
   - audit de chaque changement ;
   - pour retirer la fonction d'inspecteur, réutilisation de la logique existante (fin des affectations, de la fonction de chef).
6. **Écran** `/parametres/acces`, adapté au téléphone :
   - liste avec recherche et filtres (POOL, fonction, état du compte) ;
   - panneau de détail avec les fonctions et les permissions par domaine ;
   - origine de chaque permission : « héritée de la fonction » ou « ajustement individuel » ;
   - cases désactivées avec leur raison ;
   - récapitulatif avant confirmation.
7. **Bouton « Gérer les accès »** dans Paramètres, et à l'endroit décidé pour le chef de POOL (§ 6, Q1).
8. **Tests** :
   - ajustement autorisé ;
   - compte hors portée refusé ;
   - ajustement interdit refusé côté serveur, même si l'interface est contournée ;
   - entrée d'audit écrite ;
   - vérification avec les comptes de démonstration de chaque fonction.
9. **Fin** : lint, build, et résumé.

## 6. Questions bloquantes

- **Q1 — Accès du chef de POOL.** Paramètres exige `pools.manage`, que le chef n'a pas. Faut-il :
  - (a) ouvrir l'écran au chef via un bouton « Gérer les accès » sur sa page « Mon POOL », l'écran restant sous `/parametres/acces` avec son propre contrôle (ma proposition) ;
  - (b) ouvrir la page Paramètres au chef de POOL ;
  - (c) ne pas donner l'écran au chef de POOL ?
- **Q2 — Portée d'un ajout individuel.** Pour un acteur provincial, l'ajout vaut-il pour tous les POOL ou pour un POOL choisi ? Je propose de laisser le choix : « tous les POOL » ou « un POOL ». Pour le chef, ce sera toujours son POOL.
- **Q3 — Retrait d'une permission héritée d'une fonction provinciale.** Le modèle actuel ne permet de la retirer que **sur tous les POOL**, pas pour un seul POOL. Est-ce acceptable ?
- **Q4 — Permissions sensibles.** Faut-il interdire l'ajout individuel de certaines permissions, même à qui les détient ? Par exemple `accounts.manage`, `users.manage`, `audit.view`, ou `publication.manage` et `direction.manage`, qui de toute façon n'ont pas d'effet sans la fonction requise.
- **Q5 — Comptes sans aucune fonction.** Ils n'ont aucune fonction à « pouvoir attribuer » ; la règle d'autorité les laisse donc à tous les gestionnaires. Je propose :
  - les acteurs provinciaux (IPP, informaticien, Super Admin) peuvent les gérer ;
  - le chef de POOL seulement si le compte est rattaché à son POOL.

---

*Remarque : une autre session travaille actuellement sur la branche `feat/tableaux-de-bord-perimetre`, avec des modifications non commitées (`dashboard/page.tsx`, `demo-seed.ts`). La phase 2 devra partir d'un dépôt propre, ou d'une copie séparée.*
