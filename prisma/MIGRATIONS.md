# Procédure Prisma Migrate — IPP Nord-Kivu 1

Ce projet est passé de `prisma db push` (schéma poussé sans historique) à
**Prisma Migrate** (migrations versionnées, `prisma/migrations/`). Ce document
explique comment appliquer ces migrations selon l'état réel de la base
ciblée, sans jamais risquer de rejouer `0_init` sur une base qui a déjà les
tables qu'il décrit.

Version testée : Prisma CLI **6.19.3** (`npx prisma --version`).

## Le seed n'est plus automatique

Le script `build` (`package.json`) ne fait plus que :

```
prisma generate && prisma migrate deploy && next build
```

**Il n'exécute plus jamais `tsx prisma/seed.ts`.** Un redéploiement
n'applique que les migrations en attente ; il ne crée, ne modifie et ne
supprime aucune donnée applicative. Le seed est une opération **manuelle et
explicite** :

```
npm run db:seed
```
(ou `npx prisma db seed`, équivalent, défini par le bloc `"prisma": { "seed": ... }` de `package.json`)

## Les trois états possibles d'une base cible

Avant de toucher à une base (locale, staging ou production), il faut savoir
dans lequel de ces trois états elle se trouve. **`prisma migrate status` seul
ne suffit PAS à distinguer les cas 1 et 2** — dans les deux cas il annonce
"Following migrations have not yet been applied: 0_init, ...". C'est
`prisma migrate deploy` qui les distingue réellement (voir cas 2).

### Cas 1 — Base neuve, complètement vide
Aucune table, aucune donnée (ex. tout nouvel environnement de test).

```
prisma migrate status
# → "Following migrations have not yet been applied: 0_init, 20260915..._add_organization_multi_tenant"
#   (exit code 1 — normal, rien n'a encore été appliqué)

prisma migrate deploy
# → applique 0_init PUIS add_organization_multi_tenant, dans l'ordre.
# → "All migrations have been successfully applied."

prisma migrate status
# → "Database schema is up to date!"
```

Aucune commande `resolve` n'est nécessaire ici.

### Cas 2 — Base existante avec des données, jamais suivie par Prisma Migrate
C'est l'état actuel de la base de production réelle (créée via `prisma db
push`, jamais de table `_prisma_migrations`).

```
prisma migrate status
# → même message que le Cas 1 : "Following migrations have not yet been applied: 0_init, ..."
#   (Prisma ne sait pas encore que les tables existent déjà)

prisma migrate deploy
# → ÉCHOUE VOLONTAIREMENT :
#   Error: P3005
#   The database schema is not empty. Read more about how to baseline an
#   existing production database: https://pris.ly/d/migrate-baseline
# → RIEN N'EST MODIFIÉ. Prisma refuse de recréer des tables existantes.
#   C'est le signal fiable qu'on est dans le Cas 2, pas le Cas 1.

prisma migrate resolve --applied 0_init
# → "Migration 0_init marked as applied."
#   (0_init n'est PAS ré-exécuté : cette commande enregistre seulement
#   qu'il correspond déjà à l'état actuel de la base.)

prisma migrate status
# → "Following migration have not yet been applied: 20260915..._add_organization_multi_tenant"

prisma migrate deploy
# → applique UNIQUEMENT add_organization_multi_tenant (jamais 0_init).
# → "All migrations have been successfully applied."

prisma migrate status
# → "Database schema is up to date!"
```

**Ne jamais lancer `migrate resolve --applied 0_init` sans être passé par
l'échec P3005 (ou sans savoir par ailleurs que la base a déjà ces tables).**
Sur une base réellement vide, `resolve --applied 0_init` marquerait la
migration comme appliquée sans avoir créé les tables → la base resterait
sans les tables `Pool`, `User`, etc. Toujours laisser `migrate deploy` faire
l'essai en premier ; il échoue proprement (P3005) si la base n'est pas vide.

### Cas 3 — Base déjà baselinée (0_init déjà marqué appliqué lors d'un run précédent)
C'est l'état après un premier passage réussi du Cas 2 (ou après un `migrate
deploy` normal du Cas 1).

```
prisma migrate status
# → "Database schema is up to date!" (si tout est déjà appliqué)
#   ou la liste des migrations restantes s'il y en a de nouvelles.
```

Si un redéploiement relance malgré tout `migrate resolve --applied 0_init`
par erreur sur cette base :

```
prisma migrate resolve --applied 0_init
# → ÉCHOUE PROPREMENT, sans rien modifier :
#   Error: P3008
#   The migration `0_init` is already recorded as applied in the database.
```

Aucune corruption, aucun doublon — juste un échec avec un message explicite.
`prisma migrate status` juste après confirme que rien n'a changé.

**Dans ce cas, il ne faut JAMAIS relancer `resolve` de façon systématique.**
La bonne pratique CI/CD est : ne jamais appeler `migrate resolve` depuis le
pipeline de déploiement automatique. C'est une commande d'admin, à lancer
**une fois, manuellement**, uniquement lors du tout premier passage sur une
base existante (Cas 2). Le pipeline de déploiement (build script) n'appelle
que `prisma migrate deploy`, qui est sûr à relancer indéfiniment (Cas 1 et 3
: idempotent, "No pending migrations to apply." si rien à faire).

## Résumé décisionnel

| Situation connue | Commande à lancer |
|---|---|
| Nouvelle base, jamais servie | `prisma migrate deploy` (suffit) |
| Base de prod actuelle (créée par `db push`, jamais de migration) | `prisma migrate resolve --applied 0_init` **une fois**, puis `prisma migrate deploy` |
| Base déjà baselinée / déjà migrée | `prisma migrate deploy` (aucune action manuelle) |
| Redéploiement automatique (CI/CD) | `prisma migrate deploy` uniquement — jamais `resolve` dans le pipeline |

## Organisation "IPP Nord-Kivu 1" — pas de doublon possible

La migration `20260915124853_add_organization_multi_tenant` crée
l'organisation `IPP-NORD-KIVU-1` elle-même (plus besoin du seed pour cela) :
- Prisma Migrate ne rejoue jamais une migration déjà marquée appliquée — day
  after day, redeploy after redeploy, cet `INSERT` ne s'exécute donc qu'une
  seule fois par base.
- En plus de cette garantie, l'`INSERT` porte un `ON CONFLICT ("code") DO
  NOTHING` : même rejoué manuellement hors du suivi Prisma (cas
  exceptionnel), il ne peut pas créer de second enregistrement.
