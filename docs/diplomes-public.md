# Rubrique publique « Diplômes » (`/diplomes`)

Première étape du module provincial des titres scolaires (IPA chargé des titres) :
la partie **publique** seulement. Aucune donnée réelle n'est encore connectée.

## Ce qui existe

| Élément | Fichier |
| --- | --- |
| Menu public (ordinateur + mobile, état actif) | `src/components/public-nav.tsx`, utilisé par `src/components/site-header.tsx` |
| Accès depuis l'accueil (« Rechercher mon diplôme ») | `src/components/homepage/diplomas-access-section.tsx` |
| Page publique | `src/app/diplomes/page.tsx` |
| Formulaire (client) | `src/app/diplomes/diploma-search-form.tsx` |
| Action serveur | `src/app/diplomes/actions.ts` |
| Liste des établissements avec recherche | `src/components/diplomes/school-combobox.tsx` |
| États de résultat | `src/components/diplomes/diploma-outcome.tsx` |
| Types publics + contrat de source | `src/lib/diplomes/types.ts` |
| Critères provisoires + validation | `src/lib/diplomes/criteria.ts` |
| Recherche (aucune source connectée) | `src/lib/diplomes/search.ts` |
| Exemples fictifs (développement / Preview) | `src/lib/diplomes/apercu.ts` |
| Tests | `src/lib/diplomes/diplomes.test.ts` |

Également : `/diplomes` ajouté à `PUBLIC_PREFIXES` (`src/middleware.ts`), au sitemap et au pied de page.

Aucune table Prisma, aucune migration, aucune donnée en base.

## Fonctionnement actuel

- `getDiplomaSource()` renvoie `null` : la page affiche « Le service de recherche des diplômes sera
  prochainement disponible. », le formulaire est visible mais désactivé, aucune recherche n'est simulée.
- Établissements proposés : ceux déjà publiés sur les pages POOL (`getPublicPools()`, nom seulement,
  écoles de démonstration exclues). La saisie libre reste permise.

## Aperçu des états (jamais en production)

`/diplomes?apercu=1` en développement local (`NODE_ENV` ≠ production) ou sur un déploiement Preview
(`VERCEL_ENV=preview`) : formulaire actif avec un sélecteur « état à simuler », et galerie de tous les états.
Les exemples sont fictifs (POOL « Exemple », adresse `@exemple.invalid`). En production
(`VERCEL_ENV=production`), le paramètre est ignoré, ce que vérifient la page et l'action serveur.

## Règles à respecter lors de l'intégration des données

1. **Rattachement ≠ localisation.** Le statut publié vient uniquement de `currentLocation`, calculée à
   partir des réceptions physiques et des opérations enregistrées. Le POOL de rattachement de l'école
   (`homePoolName`) n'est jamais utilisé pour afficher une disponibilité (`toPublicStatus`, testé).
2. **Correspondance exacte**, sur des critères normalisés (`normalizeName`) ; un nom seul ne suffit jamais.
3. **Homonymes** : plus d'un dossier → `PLUSIEURS_CORRESPONDANCES`, sans aucun détail.
4. **Aucune donnée personnelle** en sortie : seul le statut (et, pour un POOL, nom, adresse officielle,
   e-mail institutionnel, indications de retrait). Aucun téléphone (décision de l'Inspection pour les POOL),
   aucun historique de transfert, aucune liste, aucun export.
5. **Avant d'ouvrir le service** : quota de recherches par adresse IP (protection contre les recherches
   automatisées ; un champ piège est déjà en place) et journalisation sans conserver les critères saisis.

## Brancher la future source

Implémenter `DiplomaSource.find(criteria)` dans le module administratif et la renvoyer depuis
`getDiplomaSource()`. Les critères (`criteria.ts`) seront adaptés au format réel du fichier Excel du
service des titres ; les composants n'ont pas à changer.
