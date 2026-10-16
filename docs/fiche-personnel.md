# Fiche individuelle du personnel (formulaire IGAP)

Version numérique de la « Fiche de renseignement de l'agent de l'administration »
de l'Inspection Générale de l'Administration Publique (IGAP), pages 1 à 9.
Décisions validées le 2026-10-16.

## Ce que voit chacun

| Profil | Sa propre fiche | Fiches des autres agents |
|---|---|---|
| Tout compte actif | lecture, modification, PDF | aucun accès (« fiche introuvable ») |
| IPA responsable de la cellule du personnel | idem | lecture, modification, PDF, observations |
| IPP principal | idem | lecture, modification, PDF, observations |
| Super Admin, Admin (toute l'organisation) | idem | lecture, modification, PDF, observations |
| Informaticien (saisie lors de la mise en place) | idem | lecture, modification, PDF, observations |

- Lecture des autres fiches : `personnel.records.read_all` ; modification et
  observations : `personnel.records.edit_all`. Les deux sont accordées par la
  **fonction réelle** (`bindRecordReaderPermissions`) ou par la responsabilité de
  la cellule du personnel (`PERSONNEL_HEAD_KEYS`) ; jamais en « Voir comme »,
  jamais par un ajout individuel, jamais dans une fonction personnalisée. La
  modification suppose la lecture : retirer individuellement la lecture coupe tout.
- Toutes les vérifications sont refaites côté serveur à chaque page, action et
  PDF (`src/lib/personnel-file/server.ts`, `resolveFileContext`). Hors périmètre
  (autre agent, autre organisation, données réelles / de démonstration mêlées,
  identifiant forgé), la réponse est la même que pour une fiche inexistante.
- Consulter les présences ne donne pas la fiche. « Voir la fiche » (Présence)
  n'apparaît qu'avec `personnel.records.read_all` et ouvre `/personnel/<id du compte>`.

## Écrans

- **Mon profil** : carte « Ma fiche personnelle » (complétude indicative).
- **`/profil/fiche`** : la fiche du compte connecté (identifiant de session).
- **`/personnel/[id]`** : la fiche d'un agent pour les profils habilités ; en tête,
  les fonctions et l'affectation de l'application (jamais celles déclarées).
- Chaque rubrique s'enregistre seule ; tous les champs sont facultatifs ; les
  promotions, diplômes et enfants s'ajoutent, se modifient et se retirent sans limite.
- La colonne « OBS. » du formulaire devient une observation par rubrique,
  lisible par l'agent, écrite par les gestionnaires (jamais sur leur propre fiche).
- La déclaration « Je jure en mon honneur… » et les signatures se portent sur la
  version imprimée : l'application n'enregistre aucune signature.

## Données

| Table | Contenu |
|---|---|
| `PersonnelFile` | une fiche par compte (`userId` unique), date et auteur de la dernière modification |
| `PersonnelFileSection` | une ligne par rubrique : valeurs (JSON validé), observation, `version` |
| `PersonnelPromotion` | II.C — une ligne par promotion |
| `PersonnelDiploma` | IV — un ou plusieurs titres par niveau (PhD → primaire) |
| `PersonnelChild` | III.E — une ligne par enfant (EBio / EAd / EST) |

- Rubriques et champs : **une seule définition**, `src/lib/personnel-file/defs.ts`
  (formulaire, consultation, complétude, PDF).
- Postnom, prénom, sexe, date de naissance, téléphone (1), matricule et nombre
  d'enfants restent dans `User` (une seule valeur, aucune copie). L'adresse
  électronique (1) reprend celle du compte tant qu'elle n'est pas saisie ;
  l'identifiant de connexion ne change jamais.
- **Intégrité administrative** : grade, affectation, commission, transfert,
  mutation déclarés ne sont lus par aucune règle de droits, de fonction, de
  POOL ou de cellule.
- **Anti-écrasement** : chaque enregistrement porte la version affichée ; une
  rubrique modifiée entre-temps par quelqu'un d'autre est refusée (« rechargez »).
- **Journal** (`AuditLog`) : `personnel.file.view`, `.update` (rubrique + noms
  des champs), `.observation`, `.entry.add|update|remove` (identifiant de
  l'entrée), `.pdf`. Aucune valeur n'y est recopiée.

## PDF

`/profil/fiche/pdf` et `/personnel/[id]/fiche/pdf` (même contrôle, 404 hors
périmètre, aucun export en bascule de consultation) : A4, ordre et terminologie
IGAP (N°, libellé, informations, OBS.), en-tête du tableau répété, lignes jamais
coupées, tableau des enfants en paysage, champs vides laissés vides, date de
génération et « Page x sur y ». Rendu par `@react-pdf/renderer` dans Next.js
(le moteur ne se charge pas sous `tsx --test` : vérification par HTTP).

## Listes avec recherche

`src/components/search-select.tsx` (combobox accessible, recherche sans accents,
clavier) remplace les longues listes de comptes, agents, écoles et inspecteurs.
Les options restent celles que le serveur a déjà filtrées selon les droits. Les
listes courtes ou à choix désactivés gardent le sélecteur natif. Au-delà de
quelques centaines d'éléments, prévoir une recherche côté serveur paginée.

## Migration et retour arrière

`20261017120000_fiche_personnel` est **additive** (cinq tables, deux types, une
permission au catalogue). Aucune table existante n'est modifiée.

Retour arrière (supprime uniquement les fiches saisies), après avoir retiré le code :

```sql
DROP TABLE "PersonnelChild", "PersonnelDiploma", "PersonnelPromotion", "PersonnelFileSection", "PersonnelFile";
DROP TYPE "PersonnelChildRelation", "PersonnelStudyLevel";
DELETE FROM "UserPermission" WHERE "permissionId" = 'perm_personnel_records_edit_all';
DELETE FROM "Permission" WHERE "key" = 'personnel.records.edit_all';
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261017120000_fiche_personnel';
```

## Vérifications

- `npm test` : `src/lib/personnel-file/rules.test.ts`, `src/components/search-select-filter.test.ts`.
- Base et application **locales** (scénarios A à I, PDF réels) :
  `POSTGRES_URL=<locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-fiche-personnel.ts`
- `prisma/scripts/verify-personnel-http.ts` (fiches et cellule du personnel), adapté.
