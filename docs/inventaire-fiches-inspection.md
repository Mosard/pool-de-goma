# Inventaire des fiches d'inspection itinérante — Phase 1 (analyse)

> **Statut : analyse seule, aucun code applicatif modifié.** Ce document attend
> la validation de l'Inspection (et les réponses à la section 9) avant toute
> adaptation (phase 2).
>
> Rédigé le 2026-10-07 à partir du dossier `D:\inuka Tech\PROJET\Pool de Goma\Document itinerant`
> (19 fichiers, pas de sous-dossier) et de l'état du dépôt sur la branche
> `feat/attribution-fonctions` (commit `1e7e9a4`).

Conventions de ce document :

- **[DOC]** : règle écrite dans une fiche ou dans le module de formation (référence donnée).
- **[PROPOSÉ]** : validation ou comportement que je propose, non écrit dans les documents.
- « Module » = `2 MODULE FORMATION SUR UTILISATION DES FORMULES'.docx` (module de formation de l'IGE,
  kit des formules rénovées de juillet 2018).
- Notation 0–4 : 0 = Médiocre, 1 = Assez Bon, 2 = Bon, 3 = Très Bon, 4 = Élite [DOC, module § C2 « Gestion du patrimoine »].

---

## 1. Lecture des fichiers sources

Tous les fichiers ont pu être lus. Aucun passage illisible n'a été rencontré.

| Fichier | Format | Lecture | Remarque |
|---|---|---|---|
| `2 MODULE FORMATION SUR UTILISATION DES FORMULES'.docx` | Word | Texte et tableaux extraits (python-docx) | Module de formation, **pas une fiche** |
| `A2  REVUE_021135.pdf` | PDF 2 p. | Couche texte + rendu image | — |
| `A3 REVUE_021140.pdf` | PDF 2 p. | Couche texte + rendu image | — |
| `A4 REVUE1_021145.pdf` | PDF 2 p. | Couche texte + rendu image | — |
| `A5 REVUE_021150.pdf` | PDF 1 p. | Couche texte + rendu image | — |
| `A6_EDU_NC.pdf` | PDF 1 p. | Couche texte + rendu image | — |
| `A11 REVUE_021210.pdf` | PDF 1 p. | Couche texte | — |
| `A12 REVUE_021213.pdf` | PDF 1 p. | Couche texte | — |
| `C1 REVUE_021218.pdf` | PDF 1 p. | Couche texte | — |
| `C1 REVUE-1.docx` | Word | Texte et tableaux | Doublon de la fiche PDF (§ 3) |
| `C2_EDU_NC_ANCIENNE.pdf` | PDF 2 p. | Couche texte | Intitulé « ANCIENNE » |
| `C2B REVUE_021232.pdf` | PDF 2 p. | Couche texte + rendu image (en-tête) | — |
| `C2C_EDU_NC_021237.pdf` | PDF 2 p. | Couche texte + rendu image (tableau de conversion) | — |
| `C3.docx` | Word | Texte et tableaux | Version « séquence didactique » (APC) |
| `C3B REVUE-1.docx` | Word | Texte et tableaux | — |
| `C5A_EDU_NC.pdf` | PDF 2 p. | Couche texte | — |
| `C6B  REVUE_021334.pdf` | PDF 2 p. | Couche texte | — |
| `F1_EDU_NC.pdf` | PDF 2 p. | Couche texte | — |

Les PDF ont une couche texte exploitable, donc la reconnaissance de texte (OCR) n'a pas été
nécessaire. Les mises en page complexes (en-tête, tableaux de conversion) ont été vérifiées
en image. Seules les mentions imprimées ont été relevées : les fiches sont vierges.

---

## 2. Inventaire des fiches uniques présentes (16)

Chaque fiche comporte le **même en-tête (cartouche)** décrit au § 5.0, sauf exceptions signalées.
« Destinataires » = cases de ventilation de l'en-tête. La ventilation officielle (nombre
d'exemplaires par destinataire) est fixée par le tableau 5 du module, qui reprend la
lettre-circulaire MINEPSP/IGE/8003/0925/2002.

| Code | Intitulé exact (fiche) | Module | Objectif (module) | Rempli par | Niveau | Source retenue |
|---|---|---|---|---|---|---|
| A2 | PLAN TRIMESTRIEL D'ACTIVITES | A — Administration interne | Planifier les activités du trimestre, avant son début | Inspecteur itinérant | Non précisé (cases M/P/S) | `A2  REVUE_021135.pdf` |
| A3 | RELEVE TRIMESTRIEL D'ACTIVITES | A | Statistiques de la production trimestrielle, notation, jours de mission | Inspecteur itinérant | idem | `A3 REVUE_021140.pdf` |
| A4 | RELEVE ANNUEL D'ACTIVITES | A | Synthèse des 4 trimestres | Inspecteur itinérant | idem | `A4 REVUE1_021145.pdf` |
| A5 | CONSTAT D'ABSENCE (d'un chef d'établissement / d'un membre du personnel) | A | Constater une absence non justifiée, un constat par absent | Inspecteur | idem | `A5 REVUE_021150.pdf` |
| A6 | BORDEREAU DE TRANSMISSION (+ 4. RECEPISSE) | A | Accompagner et récapituler les rapports transmis ; accusé de réception | Inspecteur (bordereau + récépissé pré-rempli) ; service destinataire (réception conforme / non conforme) | idem | `A6_EDU_NC.pdf` |
| A11 | PROCES-VERBAL DE SUSPENSION PREVENTIVE / MESURES CONSERVATOIRES | A | Suspendre préventivement un agent présumé fautif | Inspecteur ; agent incriminé (prise de connaissance) | M, P, S (cité dans la fiche) | `A11 REVUE_021210.pdf` |
| A12 | PROCES-VERBAL D'OUVERTURE D'ACTION DISCIPLINAIRE | A | Demander à l'agent ses justifications écrites | Inspecteur ; incriminé | idem | `A12 REVUE_021213.pdf` |
| C1 | PREMIERE VISITE | C — Contrôle | Relever les problèmes et proposer des solutions, sans notation | Inspecteur ; CE (prise de connaissance, sceau) | M/P/S | `C1 REVUE_021218.pdf` (= `C1 REVUE-1.docx`) |
| C2 | INSPECTION ADMINISTRATIVE | C | Contrôler la gestion du patrimoine, pédagogique et administrative par le CE ; noter | Inspecteur ; CE | M/P/S | `C2_EDU_NC_ANCIENNE.pdf` (seule version disponible) |
| C2B | INSPECTION DE LA FORMATION | C | Contrôler la cellule de base, les dossiers et l'état de la formation continue | Inspecteur ; chef de cellule de base (CCB) ; CE | **Pas de case M/P/S** ; partie M/P et partie S dans le tableau des UP | `C2B REVUE_021232.pdf` |
| C2C | INSPECTION DE LA BIBLIOTHEQUE ET DES ARCHIVES SCOLAIRES | C | Contrôler la bibliothèque et les archives (fiche **absente du module**, voir § 4) | Inspecteur ; CE | M/P/S | `C2C_EDU_NC_021237.pdf` |
| C3 | INSPECTION PEDAGOGIQUE (SEQUENCE DIDACTIQUE) | C | Contrôler une séquence didactique d'un enseignant ; noter | Inspecteur ; enseignant ; CE | M/P/S | `C3.docx` |
| C3B | INSPECTION PEDAGOGIQUE (LECON PRATIQUE) | C | Leçon pratique des options techniques et professionnelles ; noter | Inspecteur ; enseignant ; CE | Secondaire technique/professionnel (module) ; cases M/P/S présentes | `C3B REVUE-1.docx` |
| C5A | INSPECTION D'UN ADJOINT (CPP, CPS) | C | Contrôler un conseiller pédagogique du primaire (colonne 1) ou du secondaire (colonne 2) ; noter | Inspecteur ; adjoint ; CE | P (CPP) ou S (CPS) | `C5A_EDU_NC.pdf` |
| C6B | ENQUETE DE VIABILITE | C | Éclairer la décision de viabilité d'une école | Inspecteur | M/P/S | `C6B  REVUE_021334.pdf` |
| F1 | ACTION DE FORMATION | F — Formation en cours d'emploi | Rendre compte d'une action de formation | Inspecteur (facilitateur principal) ; facilitateurs associés ; CE ; participants (signature) | M/P/S | `F1_EDU_NC.pdf` |

### 2.1 Fiches du catalogue officiel absentes du dossier

Le module (§ « Tableau synoptique des formules : A0 ») dénombre **29 formules, dont 23 avec
canevas et 6 sans canevas**. Ces formules ne sont pas dans le dossier :

| Code | Intitulé (module) | Canevas | Impact |
|---|---|---|---|
| **A1** | Fiche administrative | Oui | **Manquante.** Le module la décrit en détail (établissement, structure et peuplement, mise en place du personnel), mais sans la fiche je ne reconstruis pas sa mise en page. |
| A7 | Lettre | Non | Rapport libre codé |
| A8 | Autre activité administrative | Non | Rapport libre codé |
| **C3M** | Inspection pédagogique (enseignement maternel) | Oui | **Manquante.** Le module (§ 2.6) décrit ses 10 postes et leurs rubriques, mais pas la mise en page ni le tableau de conversion propre à la fiche (voir § 4.1). |
| C4 | Inspection financière | Oui | Manquante (décrite dans le module) |
| C5B | Inspection d'un adjoint (DD, DI) | Oui | Manquante (décrite dans le module) |
| C6A | Enquête ordinaire | Oui | Manquante (décrite dans le module) |
| C7 | Inspection des dossiers des apprenants | Oui | Manquante (décrite dans le module) |
| C8 | Autre activité de contrôle | Non | Rapport libre codé |
| F2 | Action d'encadrement | Oui | Manquante (décrite dans le module) |
| F3 | Outil de formation | Non | Rapport libre codé |
| F4 | Autre activité de formation | Non | Rapport libre codé |
| T1 | Fiche d'analyse d'items | Oui | Manquante (décrite dans le module) |
| T2 | Autre activité d'évaluation | Non | Rapport libre codé |

**Je n'invente le contenu d'aucune fiche manquante.** Les formules « sans canevas »
(A7, A8, C8, F3, F4, T2) sont des rapports libres. Elles peuvent prendre la forme d'un rapport
codé avec l'en-tête commun et un texte libre [PROPOSÉ, voir question Q2].

---

## 3. Doublons exclus

| Fichier écarté | Doublon de | Raison (comparaison du contenu) |
|---|---|---|
| `C1 REVUE-1.docx` | `C1 REVUE_021218.pdf` | Mêmes en-tête (01 à 09, ventilation, M/P/S), mêmes 10 postes (1.1 Parcelle à 1.10 Internat) en deux colonnes « Constats – Problèmes / Solutions proposées », même rubrique II « Rapport circonstancié » Oui/Non, mêmes signatures (CE, inspecteur, sceau). Aucune différence de fond. Le fichier source est conservé. |

Aucun autre doublon n'a été trouvé. Le module de formation n'est pas une fiche : il sert de
référence pour les règles métier.

---

## 4. Variantes, différences et conflits documentaires

### 4.1 Particularité du maternel (indication « A1M » à vérifier)

- **Aucune mention de « A1M »** dans les 19 fichiers (recherche dans tous les textes extraits).
- La fiche **A1 elle-même est absente** du dossier. Le module la présente comme une fiche
  unique, avec la case de niveau M/P/S. La structure et le peuplement y sont décrits
  « au maternel et au primaire : par année » et « au secondaire : par cycle, par option et
  par année ». C'est **une seule fiche dont un tableau change selon le niveau**, sans
  variante nommée A1M.
- La seule variante maternelle **documentée** est **C3M** (« variante de C3 destinée à
  l'enseignement maternel »). Elle figure dans le module, dans A3, A4 et A6, mais sa fiche
  manque dans le dossier.
- Les autres fiches sont communes à M/P/S, avec la case de niveau M/P/S. Quelques fiches
  contiennent une partie selon le niveau :
  - C2B : tableau des UP en deux parties, M/P à gauche et S à droite. Au maternel, une seule UP [DOC].
  - C5A : colonne CPP (primaire) ou CPS (secondaire). **Rien n'est prévu pour un adjoint du maternel.**
  - F1 : la colonne « Classe » du tableau de participation est remplie au M/P et neutralisée au S [DOC].
  - A4 : « 0 + 1 : maternel et primaire : tous » / « 2. secondaire : discipline inspectée ».
- **Contradiction avec l'indication provisoire :** les documents placent la particularité du
  maternel sur **C3M**, pas sur A1M. Voir la question Q2.

### 4.2 Versions et variantes conservées (pas des doublons)

| Fiche | Constat | Traitement proposé |
|---|---|---|
| C2 « ANCIENNE » | Seule version de C2 dans le dossier. Son nom indique qu'une version plus récente existe peut-être. Elle cite la Loi-cadre n° 14/004 (2014) et l'intitulé ministériel « Éducation nationale et nouvelle citoyenneté ». | Implémenter cette version comme **C2 v1**, sans présumer qu'elle est périmée (Q4). |
| C2C | Fiche « Inspection de la bibliothèque et des archives scolaires », marquée Kinshasa-Lukunga. **Absente du module** : il range le contrôle de la bibliothèque et des archives sous **C8** (« autre activité de contrôle, sans canevas »). Elle figure cependant dans le bordereau A6, mais pas dans A3 ni A4. | Fiche distincte de C2 (contenu entièrement différent). Usage officiel au Nord-Kivu 1 à confirmer (Q4). |
| C3 | Le fichier `C3.docx` est une version **« séquence didactique » (approche par compétences)**. Ses postes 2.4 à 2.7 sont « Organisation des activités initiales / principales / de la synthèse / de l'évaluation ». Le module décrit une version antérieure : structure de la leçon, moyens d'enseignement, participation des apprenants, documents des apprenants. | Implémenter `C3.docx` comme **C3 v1** de l'application. Les différences avec le module sont signalées, pas « corrigées ». |
| En-têtes | Les destinataires varient légèrement : C6B porte « Coord. Prov. » et « S/Proved » ; A6 porte « S/Proved » ; F1 n'a pas d'« IGE ». Plusieurs fiches portent des mentions propres à Kinshasa : « Province : KIN / TSGU » (A2), « Kinshasa-Lukunga » (A6, C2C), « Fait à KINSHASA » (A2, A3, A4), préfixe « MINEPST/IGE/800.013/ » ou « MINEPST/IGE/KL/800.013/ » dans le numéro (A6, C2C, C5A, F1). | Reprendre la liste des destinataires propre à chaque fiche. Remplacer les mentions de Kinshasa par celles du Nord-Kivu 1 (code province **61**, siège Goma, d'après le tableau 1 du module) [PROPOSÉ]. |

### 4.3 Conflits à clarifier

1. **Deux tableaux de conversion différents (bloquant pour les notes).** Les lignes « nombre
   de rubriques remplies → intervalle de points » diffèrent :

   | Ligne (Rr) | `C3.docx` (4 / 3 / 2 / 1 / 0) | `C2C` et `C3B` (identiques entre eux) |
   |---|---|---|
   | 2 | 8–7 / 6 / 5–4 / 3 / 2–0 | identique |
   | 3 | 12–10 / **9** / **8–6** / 5 / 4–0 | 12–10 / **9–8** / **7–6** / 5 / 4–0 |
   | 4 | 16–13 / **12** / **11–8** / **7** / **6–0** | 16–13 / **12–11** / **10–8** / **7–6** / **5–0** |
   | 5 | 20–16 / 15–14 / 13–10 / 9–8 / 7–0 | identique |
   | 6 | **24–20 / 19–17** / 16–12 / 11–10 / 9–0 | **24–19 / 18–17** / 16–12 / 11–10 / 9–0 |
   | 7 | **28–23 / 22–20** / 19–14 / **13–12 / 11–0** | **28–22 / 21–20** / 19–14 / **13–11 / 10–0** |
   | 8 | 32–26 / **25–23 / 22–16** / 15–13 / 12–0 | 32–26 / **« 25 – 2 »** (coquille, lire 25–22 par continuité) / **21–16** / 15–13 / 12–0 |
   | 9 | 36–29 / 28–26 / 25–18 / 17–15 / 14–0 | identique |
   | 10 | 40–32 / 31–28 / 27–20 / 19–16 / 15–0 | identique |
   | % | 100–80 / 79–70 / 69–50 / 49–40 / **« 0 »** (coquille, lire 39–0) | 100–80 / 79–70 / 69–50 / 49–40 / 39–0 |

   - Le tableau de `C3.docx` correspond exactement à la règle des pourcentages (seuils 80 / 70 /
     50 / 40 % de 4 × Rr), sauf la case « 3 → 1 » de la ligne 2. Le tableau `C2C`/`C3B` s'en
     écarte. Par exemple, ligne 7 : 22/28 = 78,6 % donne 4 selon `C2C`/`C3B` mais 3 selon les
     pourcentages.
   - L'exemple du module pour C3 (« P = 21 pour 8 Rr → intervalle 21 – 16 → note 2 ») suit
     le tableau `C2C`/`C3B`, pas `C3.docx`.
   - Ce conflit touche aussi **C2 et C5A**. Leur note finale se lit à la **ligne 3 du tableau
     de C3** (total des trois notes intermédiaires) [DOC, module § C2 « Évaluation synthétique
     intermédiaire »]. Un total de 8 donne 2 avec `C3.docx`, mais 3 avec `C2C`/`C3B`.
2. **Deux méthodes de conversion partielle :**
   - **par la ligne Rr du tableau** pour C3, C3B et C3M [DOC, module § C3 et § C3M,
     « Conversion partielle de la notation »] ;
   - **par le pourcentage Z = P × 100 / (Rr × 4)**, puis le tableau général des pourcentages,
     pour C2 [DOC, module § C2 « Conversion partielle »], C5A [DOC] et C6B (formule
     « T x 100 / R x 4 » imprimée sur la fiche).
   - Le tableau ne couvre que **Rr = 2 à 10**. Pourtant, C2C contient des postes de 14 et
     15 rubriques (3.5, 3.6, 4.2, 4.3) et C2 des postes de 13, 37 et 67 rubriques. La
     méthode à appliquer à C2C, au-delà de 10 rubriques ou pour Rr = 0 ou 1, n'est pas écrite.
3. **C3 (`C3.docx`), libellés de la synthèse.** La synthèse 2.11.10 s'intitule « Documents des
   apprenants », alors que le poste 2.10 de la grille s'intitule « Évaluation de l'acquis ».
   Ce poste contient pourtant des documents d'apprenants (brouillon, cahier de cours,
   manuels, travaux, cahier de communication). Autre défaut : la rubrique « 2.8.6 » est
   numérotée deux fois (travail individuel / travail en groupe).
4. **C2C, synthèse 6.1 « Domaine contrôlé ».** Elle demande une note, mais la section 2
   « Domaine du contrôle » (2.1 Bibliothèque, 2.2 Archives) ne comporte aucune rubrique notée.
5. **Codes des relevés A3 et A4.** A4 contient **A10**, qui n'existe dans aucun autre document,
   et ne contient pas **C8**. A3 contient C8 mais pas A10. Ni A3 ni A4 ne contiennent C2C,
   alors que A6 le contient.
6. **Arrondi des pourcentages.** Le tableau utilise des bornes entières (79–70). Les exemples
   du module arrondissent à l'unité la plus proche : 28 × 100 / 52 = 53,8 → « 54 % » ;
   30 / 35 → « 86 % ». Je propose donc l'arrondi à l'entier le plus proche, 0,5 vers le haut,
   **avant** la lecture du tableau. C'est une proposition tirée des exemples, sans règle écrite.
7. **Numérotation des rapports.** Le module prescrit
   `province / code POOL / initiales / code.n° thématique / n° universel / année civile`,
   par exemple `13 / PP01 / KMD / C3.04 / 06 / 2017` [DOC]. Les fiches révisées pré-impriment
   au contraire le préfixe « MINEPST/IGE/800.013/ ».
8. **Numérotation interne des fiches.** F1 contient deux rubriques « 11 » (Suggestions /
   Tableau de participation). C2C contient deux rubriques « 4 » (Fonds documentaire /
   Note finale). Les libellés seront conservés tels quels.

---

## 5. Tables de correspondance « rubrique du document → champ prévu dans l'application »

Types de champ prévus (phase 2) : `texte`, `texte long`, `nombre`, `date`, `heure`,
`choix` (un seul), `cases` (plusieurs), `note 0–4` (valeurs 0, 1, 2, 3, 4,
**« – » neutralisé**, **« S.O. » sans objet**), `appréciation` (E / TB / B / AB / M),
`tableau` (lignes répétables), `calculé` (lecture seule), `attestation` (nom, lieu et date de
prise de connaissance, refus de signer et témoins), `pièce jointe`.

Chaque fiche affiche des « postes notés » de la même façon : pour chaque rubrique, une note
0–4 et un champ « Observations », puis « Total » et « Conversion » (calculés) et un champ
« Conseils » (texte long).

### 5.0 En-tête commun (toutes les fiches)

| Rubrique du document | Champ prévu | Type | Pré-remplissage [PROPOSÉ] |
|---|---|---|---|
| 01. Inspecteur | `entete.inspecteur` | texte | `User.name` (+ postnom, prénom) |
| Sexe M / F | `entete.inspecteurSexe` | choix | `User.sex` |
| 02. Niveau / Discipline(s) | `entete.niveauDiscipline` | texte | — (maternel, primaire ou discipline du secondaire) |
| 03. Poste d'attache | `entete.posteAttache` | texte | nom du POOL de l'inspecteur |
| 04. B.P. … à … | `entete.bp`, `entete.bpLieu` | texte | — |
| 05. Téléphone / E-mail | `entete.telephone`, `entete.email` | texte | `User.phone`, `User.email` |
| Année scolaire 20.. – 20.. | `entete.anneeScolaire` | texte | année scolaire en cours (sept.–août) |
| Rapport n° / Remise-Envoi n° | `entete.numeroRapport` | calculé | numérotation générée (Q5) |
| Province (A2, A5) | `entete.province` | texte | « Nord-Kivu 1 » |
| Cases de ventilation (Intéressé, Établissement, IGE, IPP, Pool, Proved, Gestionnaire, A.T./Bourgm., Secteur, Classement ; variantes S/Proved, Coord. Prov.) | `entete.destinataires` | cases | liste propre à chaque fiche |
| Niveau M / P / S | `entete.niveau` | choix | — (absent de C2B) |
| Fait à …, le … | `signature.lieu`, `signature.date` | texte, date | lieu du POOL, date du jour |

Mentions d'en-tête propres à certaines fiches : « Établissement » (C1, C2, C2B, C2C, C3, C3B,
C5A, C6B, F1) → `entete.etablissement`, pré-rempli avec le nom de l'école de l'inspection ;
« Nom du chef d'établissement » (C1, C2, C2C, C6B) → `entete.nomCE`, pré-rempli avec
`School.director` ; les autres mentions sont dans la table de la fiche concernée.

### 5.1 A2 — Plan trimestriel d'activités

| Rubrique | Champ | Type / règle |
|---|---|---|
| 1.1 Année (20.. / 20..) | `periode.annee` | texte |
| 1.2 Trimestre 1 / 2 / 3 / 4 | `periode.trimestre` | choix (1 = sept.–déc., 2 = janv.–mars, 3 = avr.–juin, 4 = juil.–août) [DOC] |
| 1.3 Série des mois (Septembre … Août) | `periode.mois` | cases |
| 2. Activités à réaliser : nom du mois, dates (du … au …), lieux / établissements, nombre de classes / unités, type d'activités codées, nombre de jours prévus | `activites[]` : `mois`, `du`, `au`, `lieu`, `nbClassesUnites`, `codeActivite`, `joursPrevus` | tableau (jusqu'à 4 mois par trimestre [DOC]) ; `codeActivite` pris dans la liste des codes officiels, les sigles non autorisés (ENAFEP, congé, …) étant exclus [DOC] |
| S/Total (par mois) | `sousTotaux[mois]` (classes / unités, jours) | calculé [DOC] |
| TOTAL GÉNÉRAL | `totalGeneral` (classes / unités, jours) | calculé [DOC] |
| Signature de l'inspecteur | `signature` | attestation |

### 5.2 A3 — Relevé trimestriel d'activités

| Rubrique | Champ | Type / règle |
|---|---|---|
| 1. Période (année, trimestre, série de mois) | `periode.*` | comme A2, « strictement identique à A2 » [DOC] |
| 2. Tableau statistique de la production (2.1 Administration, 2.2 Contrôle, 2.3 Formation, 2.4 Évaluation) : codes A1 … T2 × lignes Écoles / Services, Personnes, Documents, Nombre de jours ; colonnes P / R / % pour les codes qui les prévoient (A1, C1, C2, C2B, C3, C3B, C3M, C5A, C5B, C7, F1, F2, F3, T1), R seul pour les autres | `production[code]` : `ecoles`, `personnes`, `documents`, `jours`, avec `prevu`, `realise` | tableau ; `pourcentage = R × 100 / P` arrondi (exemple 30/35 → 86) [DOC] |
| 3. Tableau analytique : mois, dates, lieux, nombre de classes / unités, numéros thématiques des rapports, nombre de jours ; « Total général des jours en % » | `analytique[]`, `analytique.totalJours` | tableau ; **total des jours analytiques = somme des jours des modules** [DOC] ; jours ≤ jours du calendrier scolaire [DOC, contrôle impossible sans calendrier, voir § 8] |
| 4. Tableau synoptique de la notation : CE (C2, C2B), adjoints (C5A, C5B), enseignants qualifiés (C3), sous-qualifiés (C3) × notes 4 / 3 / 2 / 1 / 0, totaux, % | `notation[fonction][code][note]` | tableau ; totaux en ligne et en colonne, % par colonne = 100 [DOC] |
| 5. Jours de mission : jours accomplis, montants reçus, références des ordres de mission | `missions[]` | tableau ; totaux [DOC] |
| 6. Difficultés rencontrées | `difficultes` | texte long |
| 7. Suggestions | `suggestions` | texte long |
| Signature de l'inspecteur itinérant | `signature` | attestation |

### 5.3 A4 — Relevé annuel d'activités

| Rubrique | Champ | Type / règle |
|---|---|---|
| 1. Période couverte du … au … | `periode.du`, `periode.au` | date (en principe du 1er sept. au 31 août [DOC]) |
| 2. Production annuelle : codes A1 … T2 (dont A10, sans C8, voir § 4.3-5) × Écoles / Services, Personnes, Documents, Jours | `production[code]` | tableau ; **total des 4 A3, sans pourcentage** [DOC] |
| 3. Relevé modulaire et trimestriel : modules 1 à 4 × trimestres 1 à 4 et bilan × jours P / R / % ; totaux | `modulaire[module][trimestre]` | tableau, calculé depuis les A3 [DOC] |
| 4. Effectifs de la juridiction : établissements, CE, adjoints, enseignants × unités réelles / unités inspectées / % inspectés | `effectifs[fonction]` | tableau ; % = inspectés × 100 / réels [DOC] |
| 5. Qualification : M + P (tous) / S (discipline inspectée) × qualifiés, sous-qualifiés, % qualifiés | `qualification[niveau]` | tableau ; calcul sur les effectifs **réels** au M/P et sur les **inspectés** au S [DOC] |
| 6. Tableau synoptique de la notation | `notation…` | comme A3, total des 4 trimestres [DOC] |
| 7. Jours de mission par trimestre 1 à 4 | `missions[trimestre]` | tableau, total [DOC] |
| 8.1 à 8.6 Difficultés (pédagogique, matériel, technique, structurel, financier, autres) | `difficultes.*` | texte long × 6 |
| 9.1 à 9.3 Recommandations (contrôle, formation, évaluation) | `recommandations.*` | texte long × 3 |
| Signature | `signature` | attestation |

### 5.4 A5 — Constat d'absence

| Rubrique | Champ | Type / règle |
|---|---|---|
| D'un chef d'établissement / D'un membre du personnel | `typeAbsent` | choix |
| 08. Province | `entete.province` | texte |
| 1. Identité de l'établissement : nom, matricule, B.P., adresse complète, sous-division, pool d'inspection, gestion, coordination sous-provinciale | `etablissement.*` | texte (nom et POOL pré-remplis) |
| 2. Identité de l'absent : nom, matricule, fonction | `absent.*` | texte |
| Date du constat, heure du constat | `constat.date`, `constat.heure` | date, heure |
| Nom du CE (uniquement s'il diffère du 2) | `nomCEsiDifferent` | texte |
| 3. Observation(s) | `observations` | texte long (circonstances atténuantes ou aggravantes [DOC]) |
| Réservé à l'administration | `reserveAdministration` | texte long, **non rempli par l'inspecteur** [PROPOSÉ : lecture seule pour lui] |
| 4. Lettre, destinataire : chef de sous-division / coordinateur sous-provincial / chef d'établissement | `lettre.destinataires` | cases ; si l'absent est le CE, le destinataire est le chef de sous-division [DOC] |
| Absence constatée : du CE / de l'enseignant / de (préciser) | `lettre.absenceDe`, `lettre.preciser` | choix + texte |
| Texte de la lettre | — | texte fixe, **non modifiable** [DOC] |
| Fait à, le / signature | `signature` | attestation |

Règle [DOC] : un constat par absent (un A5 par personne).

### 5.5 A6 — Bordereau de transmission (+ récépissé)

| Rubrique | Champ | Type / règle |
|---|---|---|
| 07. Remise / Envoi n° | `entete.numeroRapport` | calculé |
| 1. Code (C1 … T2, A1 … A12, Autres) | `lignes[code]` | liste fixe de codes (A6 exclu) [DOC] |
| 2. Nombre | `lignes[code].nombre` | nombre, calculable |
| 3. Numéro de chaque document (entrée universelle, séparée par « ; ») | `lignes[code].numeros` | calculé depuis les rapports joints [PROPOSÉ] |
| 4. Récépissé : en-tête recopié | `recepisse.entete` | calculé (identique au bordereau [DOC]) |
| Nom du service qui réceptionne, sceau, fait à, le, nom et signature du réceptionnaire | `recepisse.*` | rempli par le **service destinataire** |
| Réception conforme / non conforme ; numéros manquants (codes dans l'ordre) | `recepisse.conformite`, `recepisse.manquants` | choix, texte |

### 5.6 A11 — PV de suspension préventive / mesures conservatoires et A12 — PV d'ouverture d'action disciplinaire

Les deux fiches ont la même structure ; seuls leurs textes fixes diffèrent.

| Rubrique | Champ | Type / règle |
|---|---|---|
| Texte légal d'introduction (A11 : art. 2 de l'ordonnance 91-231 et circulaire 001/02126/91 ; A12 : Titre III, chap. IX du statut) | — | texte fixe |
| Nous : nom, postnom, prénom, grade, fonction | `autorite.*` | texte (pré-rempli avec l'inspecteur) |
| À charge de : M., Mme, Mlle ; grade, n° matricule, fonction | `incrimine.*` | texte |
| Établissement, sous-division, pool d'inspection, gestion, coordination sous-provinciale | `etablissement.*` | texte |
| Faute(s) disciplinaire(s) (libellé, circonstances de temps et de lieu) | `fautes` | texte long, obligatoire [PROPOSÉ] |
| A11 : mesure(s) conservatoire(s) prise(s) | `mesures` | texte long |
| A11 : « En annexe, le PV d'ouverture d'action disciplinaire » | `annexeA12` | lien vers un A12 [PROPOSÉ] |
| A12 : délai réglementaire de justification | `delaiJustification` | calculé : 20 jours, ou 30 si l'agent ne réside pas au même lieu [DOC, module § A12] |
| Signature de l'inspecteur ; signature de l'incriminé (réception, prise de connaissance) | `signature`, `priseConnaissance` | attestation ; refus de signer acté et contresigné par deux témoins [DOC, A11] |
| Pièces à conviction (PV d'audition, …) | `pieces` | pièce jointe [DOC : « y annexe »] |

### 5.7 C1 — Première visite

| Rubrique | Champ | Type / règle |
|---|---|---|
| 06. Établissement, 07. Nom du CE | `entete.etablissement`, `entete.nomCE` | pré-remplis |
| I. Postes 1.1 Parcelle, 1.2 Bâtiments, 1.3 Équipements, 1.4 Moyens d'enseignement, 1.5 Personnel, 1.6 Apprenants, 1.7 Administration, 1.8 Organisation pédagogique, 1.9 Finances, 1.10 Internat | `postes[i].constats`, `postes[i].solutions` | texte long × 2 × 10 ; **toutes les rubriques doivent être traitées** ; « – » si la rubrique n'engage pas le CE ; « S.O. » si le poste existe sans être opérationnel ; **RAS, rien, absent, néant sont interdits** [DOC] |
| II. Rapport circonstancié pour complément d'informations Oui / Non | `rapportCirconstancie` | choix ; si « Oui », le rapport circonstancié est joint [DOC] → pièce jointe |
| Signatures : CE (prise de connaissance et réception), inspecteur ; sceau | `signatureInspecteur`, `priseConnaissanceCE` | attestation |

### 5.8 C2 — Inspection administrative (version « ancienne », seule disponible)

| Rubrique | Champ | Type / règle |
|---|---|---|
| 1.1 Implantation (environnement physique, social, pédagogique) | `description.implantation`, `.implantationAppreciation` | texte long + appréciation E/TB/B/AB/M |
| 1.2 Structure : conformité à l'arrêté ; viabilité de l'école | `description.conformite` (+ appréciation), `description.viabilite` | texte long + appréciation ; texte long |
| 2.1 Description du patrimoine (cf. annexe) | `patrimoine.description` | texte long |
| 2.2 Gestion du patrimoine : 2.2.1 Enseigne … 2.2.13 Gestion de l'internat (13 rubriques) | `patrimoine.notes[2.2.x]` | note 0–4 + observations |
| ← Conversion / Total → | `patrimoine.total`, `patrimoine.conversion` | calculé : Z = P × 100 / (Rr × 4), puis tableau des % [DOC] |
| 2.3 Conseils | `patrimoine.conseils` | texte long |
| 3.1 Description du personnel pédagogique | `pedagogie.description` | texte long |
| 3.2 Gestion pédagogique : 3.2.1 Programmes / curricula … 3.2.37 Développement communautaire (37 rubriques) | `pedagogie.notes[3.2.x]` | note 0–4 + observations ; conversion identique à 2.2 [DOC] |
| 3.3 Conseils | `pedagogie.conseils` | texte long |
| 4.1 Gestion administrative : 4.1.1 Loi-cadre n° 14/004 … 4.1.67 Sens du commandement (67 rubriques) | `administration.notes[4.1.x]` | note 0–4 + observations ; conversion identique [DOC] |
| 4.2 Conseils | `administration.conseils` | texte long |
| 5. Évaluation synthétique intermédiaire : 5.1 Patrimoine, 5.2 Pédagogie, 5.3 Administration ; Conversion / Total | `synthese.*` | calculé : total (0–12) converti à la **ligne 3 du tableau de C3** [DOC] (conflit § 4.3-1) |
| 6. Appréciation finale | `appreciationFinale` | calculé : 4 ÉLITE, 3 TRÈS BON, 2 BON, 1 ASSEZ BON, 0 MÉDIOCRE [DOC] |
| 7. Tableau général de conversion (% → note → mention ; 2e ligne GRANDE DISTINCTION / DISTINCTION / SATISFACTION / BALANCE / ÉCHEC) | — | référence, non saisie |
| Signatures CE, inspecteur ; sceau | attestations | — |
| Annexes 1 à 4 (plan de la parcelle, relevé du patrimoine, tableau de la population scolaire, liste nominale du personnel) | `annexes.*` | pièce jointe ; « le C2 n'est réputé complet que s'il comprend ces quatre annexes » [DOC] |

La liste complète des 117 libellés (13 + 37 + 67) sera reprise mot pour mot de la fiche dans
la définition de la fiche (phase 2).

### 5.9 C2B — Inspection de la formation

| Rubrique | Champ | Type / règle |
|---|---|---|
| 07. Identité du CE ; 08. Identité du CCB + sexe ; 09. Dernier C2B | `entete.identiteCE`, `entete.ccb`, `entete.ccbSexe`, `entete.dernierC2B` | texte (dernier C2B : inspecteur, numéro, date, appréciation [DOC]) |
| 1.1 Description de la CB | `cb.description` | texte long |
| 1.2 Identité du CCB : nom, qualification, ancienneté comme CCB | `cb.ccb.*` | texte, nombre |
| 1.3 Définition des UP : M/P (degré / classe, code UP1–UP6, nom du chef d'UP, titre en sigle, nombre Q / SQ) ; S (code, discipline, nom du chef d'UP, titre + option, Q / SQ) | `cb.up[]` | tableau, variante M/P ou S |
| 2. Tenue des dossiers 2.1 … 2.15 (15 rubriques) | `dossiers[2.x]` | appréciation **M à E** + observations (seulement si < B [DOC]) |
| Conseils | `dossiers.conseils` | texte long |
| 3.1 Planification hebdomadaire : UP × lundi … samedi (heure 1 à 6, AM / PM) | `planification[up][jour]` | tableau, format « 2-PM » [DOC] |
| 3.2 Moyens de formation : quantité, conservation, circulation, exploitation, rendement | `moyens.*` | texte (observations) |
| 3.3 Réunions de formation : rythme, contenu, participation, suivi | `reunions.*` | texte |
| 4.1 à 4.4 Conseils (FC des qualifiés, FC des sous-qualifiés, fonctionnement de la CB, besoins en moyens de formation) | `conseils.*` | texte long × 4 |
| 5. Appréciation synthétique | `appreciationSynthetique` | choix ÉLITE / TRÈS BON / BON / ASSEZ BON / MÉDIOCRE, saisie par l'inspecteur, **sans calcul** [DOC] |
| 6.1 CCB (seulement s'il est différent du CE [DOC]) ; 6.2 CE ; 6.3 inspecteur ; sceau | attestations | — |

### 5.10 C2C — Inspection de la bibliothèque et des archives scolaires

| Rubrique | Champ | Type / règle |
|---|---|---|
| 1.1 Implantation ; 1.2 Structure (conformité, viabilité) | comme C2 1.1 et 1.2 | texte long + appréciation |
| 2.1 Bibliothèque ; 2.2 Archives | `domaine.bibliotheque`, `domaine.archives` | texte long (conflit § 4.3-4) |
| 3.1 Local (5) ; 3.2 Matériel informatique (4) ; 3.3 Matériel professionnel (7 + 1 ligne libre) ; 3.4 Précautions à prendre (4) ; 3.5 Matériel bureautique (15) ; 3.6 Éléments d'archivage (14) | `ressources[poste].notes[...]` | note 0–4 + observations ; conversion ; conseils par poste |
| 4.1 Situation de la bibliothèque (5) ; 4.2 Classification des ouvrages (10) ; 4.3 Stratégies d'acquisition (14 + 1 ligne libre) | `fonds[poste].notes[...]` | idem |
| 5. Suggestions | `suggestions` | texte long |
| 6. Évaluation synthétique 6.1 à 6.10 ; Conversion / Total | `synthese.*` | calculé : total de 10 notes → ligne 10 [DOC : tableau de la fiche] |
| 7. Tableau de conversion | — | référence (version `C2C`/`C3B`) |
| 4. Note finale (en toutes lettres) | `noteFinale` | calculé |
| 8. Signatures : CE (noms), inspecteur ; sceau | attestations | — |

### 5.11 C3 — Inspection pédagogique (séquence didactique, `C3.docx`)

| Rubrique | Champ | Type / règle |
|---|---|---|
| 07. Enseignant ; 08. Dernier C3 (inspecteur, date, cote) ; 09. Charge hebdomadaire | `entete.enseignant`, `entete.dernierC3.*`, `entete.chargeHebdo` | texte, date |
| 1. Activité(s) inspectée(s) : sous-domaine, discipline, code matr., classe, P/I, heure, savoirs essentiels | `activite.*` | texte ; P/I = présents / inscrits |
| 2.1 Personnalité (8) | `grille.2.1` | note 0–4 + observations ; conversion **par la ligne Rr** [DOC] ; conseils |
| 2.2 Maîtrise de la matière (5) | `grille.2.2` | idem |
| 2.3 Maîtrise du programme / curriculum (5) | `grille.2.3` | idem |
| 2.4 Organisation des activités initiales (8) | `grille.2.4` | idem |
| 2.5 Organisation des activités principales (7) | `grille.2.5` | idem |
| 2.6 Organisation de la synthèse (5) | `grille.2.6` | idem |
| 2.7 Organisation de l'évaluation (5) | `grille.2.7` | idem |
| 2.8 Stratégies (7, dont « 2.8.6 » en double) | `grille.2.8` | idem ; identifiants internes distincts, libellés conservés |
| 2.9 Documents de l'enseignant (8) | `grille.2.9` | idem |
| 2.10 Évaluation de l'acquis (6) | `grille.2.10` | idem (libellé de la synthèse : § 4.3-3) |
| 2.11 Évaluation synthétique 2.11.1 à 2.11.10 ; Conversion / Total | `synthese.*` | calculé : total des 10 notes → **ligne 10** [DOC] |
| 4. Note finale (en toutes lettres) | `noteFinale` | calculé |
| 2.12 Signatures : enseignant(e) inspecté(e), CE, inspecteur ; sceau | attestations ; refus de signer → deux témoins parmi les enseignants [DOC] | — |

### 5.12 C3B — Inspection pédagogique (leçon pratique)

| Rubrique | Champ | Type / règle |
|---|---|---|
| En-tête 07 à 09 | comme C3 | — |
| 1. Activité inspectée : branche, classe, heure, effectif P/I, sujet | `activite.*` | texte |
| 2.1 Personnalité (6) ; 2.2 Maîtrise de la matière (5) ; 2.3 Maîtrise du programme / curriculum (5) ; 2.4 Structure de la leçon (8) ; 2.5 Stratégies (4) ; 2.6 Moyens d'enseignement (4) ; 2.7 Participation des apprenants (6) ; 2.8 Documents des apprenants (5) ; 2.9 Documents de l'enseignant (7) ; 2.10 Évaluation de l'acquis (4) | `grille.2.x` | note 0–4 + observations ; conversion par la ligne Rr ; conseils |
| 3. Évaluation synthétique 3.1 à 3.10 | `synthese.*` | calculé, ligne 10 |
| 4. Note finale | `noteFinale` | calculé |
| 5. Signatures : enseignant, CE (+ noms), inspecteur ; sceau | attestations | — |

### 5.13 C5A — Inspection d'un adjoint (CPP, CPS)

| Rubrique | Champ | Type / règle |
|---|---|---|
| 07. Nom de l'adjoint, tél. ; 08. Dernier C5A (inspecteur, date, cote) | `entete.adjoint.*`, `entete.dernierC5A.*` | texte, date |
| Choix de la colonne : 1. Conseiller pédagogique du primaire / 2. du secondaire | `typeAdjoint` | choix CPP / CPS [PROPOSÉ : seule la colonne choisie s'affiche] |
| 1.1 / 2.1 Tâches administratives (12, identiques) | `taches.admin` | note 0–4 + observations ; Z en % [DOC] ; conseils |
| 1.2 Tâches pédagogiques CPP (11) / 2.2 CPS (20) | `taches.peda` | idem |
| 1.3 Personnalité CPP (8) / 2.3 CPS (10) | `personnalite` | idem |
| Évaluation synthétique intermédiaire (0 à 4) : tâches administratives, pédagogiques, personnalité ; Conversion / Total | `synthese.*` | calculé : total (0–12) → ligne 3 du tableau de C3 [DOC, « procédure identique » à C2] |
| Appréciation finale | `appreciationFinale` | calculé |
| Signatures : adjoint, CE (nom), inspecteur ; sceau | attestations | — |

### 5.14 C6B — Enquête de viabilité

| Rubrique | Champ | Type / règle |
|---|---|---|
| 07. Nom du CE ; 08. Téléphone du CE | `entete.nomCE`, `entete.telCE` | texte |
| 1. Demandeur ou donneur d'ordre : nom, fonction, date, référence | `demandeur.*` | texte, date |
| 2. Promoteur : nom, tél., adresse | `promoteur.*` | texte |
| 3. But | `but` | texte long |
| 4. Établissement : pool d'inspection, sous-division, coordination sous-provinciale ; 4.1 adresse, vacation, téléphone ; 4.2 propriété des lieux ; 4.3 arrêté d'agrément ; 4.4 nature de la parcelle ; 4.5 autorisation d'ouverture ; 4.6 nature des bâtiments ; 4.7 date d'ouverture réelle ; 4.8 CE (nom, titre, ancienneté à l'EPSP, sexe, âge) ; 4.9 responsable pédagogique ; 4.10 dépôt bancaire | `etablissement.*` | texte, date, nombre ; vacation = sigles DV, VUAM, VUPM, VUALT, DOA, DOAM, DOPM [DOC] |
| 5. Évaluation analytique de 0 à 4 : 5.1 Implantation (7), 5.2 Patrimoine (9), 5.3 Structure (8), 5.4 Personnel (7), 5.5 Administration (7), 5.6 Finances (7), 5.7 Pédagogie (7), 5.8 Internat (7) | `evaluation[chapitre]` | note 0–4 + observations ; conversion par chapitre selon « T × 100 / R × 4 » [DOC] ; **pas de moyenne des chapitres** [DOC] |
| 6. Commentaire critique | `commentaire` | texte long |
| 7. Conclusion : viable / à parfaire / non viable | `conclusion` | choix, **saisi par l'inspecteur** (critères au module [DOC]) |
| Signature de l'inspecteur | attestation | — |
| Annexes (les quatre annexes définies en A1 et en C2) | `annexes.*` | pièce jointe [DOC : « joindre impérieusement »] |

### 5.15 F1 — Action de formation

| Rubrique | Champ | Type / règle |
|---|---|---|
| 1. Nature : exposé, conférence pédagogique, séance d'animation pédagogique, journées pédagogiques, séminaire de sensibilisation, séminaire de formation, autre ; intensif / extensif | `nature`, `natureAutre`, `rythme` | choix, texte, choix |
| 2.1 Date(s) du … au … ; 2.2 Durée en heures / jours ; 2.3 Participation : opérateurs pédagogiques, établissements, services | `modalites.*` | date, nombre (participation calculable depuis le tableau [PROPOSÉ]) |
| 3. Initiative ; 4. Collaboration ; 5. Sujet / thème ; 6. Objectif(s) ; 7. Méthodes et techniques ; 8. Moyens de formation mis en œuvre ; 9. Bilan ; 10. Contrôle du suivi ; 11. Suggestions | `initiative` … `suggestions` | texte long × 9 |
| 11. Tableau de participation : établissements / services (n°, nom, adresse ou téléphone) ; personnes (n°, nom et postnom, sexe, fonction, titre, classe, téléphone, signature), 25 lignes sur papier | `participation.etablissements[]`, `participation.personnes[]` | tableau sans limite [PROPOSÉ] ; « classe » neutralisée au secondaire [DOC] |
| Signatures : CE, facilitateur(s) associé(s), facilitateur principal ; sceau | attestations | — |

---

## 6. Écarts avec l'application actuelle

État observé du dépôt : `prisma/schema.prisma`, `src/lib/demo-seed.ts`, `src/lib/form-schema.ts`,
`src/app/(dashboard)/inspections/*`, `src/app/(dashboard)/rapports/*`, `src/lib/workflow.ts`,
`src/lib/ai/reports.ts`, `src/lib/rbac-data.ts`.

### 6.1 Ce qui existe

- Un modèle générique et réutilisable : `InspectionCategory` → `FormTemplate`
  (`code`, `title`, `version`, `fieldsSchema` en JSON) → `Form` (`data` en JSON, `completed`),
  rattaché à une `Inspection` (une école, un inspecteur) qui produit un seul `Report`
  (résumé, recommandations, statut du circuit).
- Un circuit d'exploitation configurable (`WorkflowStatus` / `WorkflowTransition`) :
  BROUILLON → SOUMIS → REÇU → EN EXPLOITATION → (À CORRIGER) → TRANSMIS → EN ATTENTE DE
  VALIDATION → VALIDÉ / REJETÉ → CLÔTURÉ. Il s'accompagne d'un historique, d'un journal
  d'audit et de notifications, dont la demande de correction à l'inspecteur.
- Les restrictions d'affectation : un inspecteur n'ouvre une inspection que dans une école
  où il est affecté (le Super Admin étant l'exception). Les comptes de démonstration ne
  touchent que des données de démonstration.
- La liste des rapports suit la portée de l'utilisateur. Les profils provinciaux voient tous
  les POOL de l'organisation ; les profils de POOL voient leur POOL ; l'inspecteur voit ses
  propres rapports.
- Les observations (commentaires) des exploitants s'affichent sur `/rapports/[id]`, visibles par l'inspecteur.

### 6.2 Ce qui manque ou doit être corrigé, par thème

| # | Constat (fichier) | Conséquence | Ajustement prévu (phase 2) |
|---|---|---|---|
| E1 | Les 4 fiches actuelles sont **simulées et réutilisent des codes officiels avec un autre sens** : « F1 — Contrôle financier », « T1 — Évaluation des résultats », « A1 — Identification », « C101 » (`src/lib/demo-seed.ts`) | Confusion avec F1 (action de formation), T1 (analyse d'items) et A1 (fiche administrative) | Désactiver les fiches simulées sans les supprimer. Les rapports déjà saisis restent lisibles avec leur ancienne fiche (Q7). |
| E2 | `FormTemplate.code` est **unique**, et le seed fait un `upsert` qui **remplace `fieldsSchema` en place** | Impossible de garder deux versions d'une fiche ; une mise à jour modifierait l'affichage des anciens rapports | Unicité sur `(code, version)`. Une version publiée devient **immuable**, et chaque `Form` pointe vers la ligne exacte de sa version, ce qui enregistre la version utilisée. Migration additive (§ 7). |
| E3 | `fieldsSchema` ne connaît que `text`, `number`, `textarea` et `select` (`src/lib/form-schema.ts`) | Impossible de représenter les postes notés, tableaux, cases, champs calculés, attestations et sections | Nouveau format de définition versionné, validé par `zod` (déjà présent), et rendu dédié. L'ancien format reste lu pour les fiches simulées. |
| E4 | `Form` est unique par `(inspection, fiche)` (`@@unique([inspectionId, formTemplateId])`) | Impossible de saisir **plusieurs C3** lors d'une même visite (un par enseignant, école globale) ou plusieurs A5 (un par absent [DOC]) | Autoriser plusieurs exemplaires d'une même fiche par inspection (migration additive, § 7). |
| E5 | **Pas de choix de fiche** : la page affiche **toutes** les fiches actives à chaque inspection, et la barre de progression compte toutes les fiches | L'itinérant ne peut pas choisir les activités menées | Bouton « Ajouter une fiche » avec la liste officielle filtrée par niveau (M/P/S). Progression calculée sur les fiches ajoutées. |
| E6 | **Pas de brouillon** : « Enregistrer la fiche » marque toujours `completed: true`, sans aucune validation (`saveFicheAction`) | Une fiche à moitié remplie compte comme complète | Deux actions distinctes : « Enregistrer le brouillon » (sans contrôle) et « Marquer comme complète » (contrôles du § 8). |
| E7 | **Perte possible en cas de coupure** : l'action serveur ne sauvegarde rien localement (aucun `localStorage` dans `src`) | Une fiche longue (C2 : 117 rubriques) est perdue si l'envoi échoue | Copie locale automatique du brouillon dans le navigateur (par fiche et par utilisateur), proposée à la restauration. Ce n'est **pas** un mode hors ligne complet, que l'architecture ne prévoit pas. |
| E8 | `saveFicheAction` **ne vérifie pas le statut** côté serveur : le verrouillage « rapport soumis » n'existe que dans l'interface | Une fiche reste modifiable après soumission par un envoi direct | Refus côté serveur hors des statuts modifiables (brouillon, à corriger). |
| E9 | **Correction impossible** : quand le rapport passe « À corriger », l'inspection reste `RAPPORT_SOUMIS`, ce qui garde les fiches verrouillées et masque le formulaire (`inspections/[id]/page.tsx`, `workflow.ts`) | La boucle « renvoyer pour correction → resoumettre » ne fonctionne pas pour l'itinérant | Rendre les fiches modifiables à l'état « À corriger », et faire passer la resoumission par le circuit (transition « Resoumettre » et historique) au lieu d'un `upsert` direct. |
| E10 | `submitReportAction` remet le rapport à SOUMIS par `upsert` **quel que soit son statut**, sans écrire dans l'historique | Contournement possible du circuit | Soumission uniquement depuis BROUILLON ou À CORRIGER, avec historique. **Une seule soumission** pour l'ensemble de la visite (Q3). |
| E11 | `/inspections/[id]` et `/rapports/[id]` **ne contrôlent que la connexion** | Tout compte connecté peut lire n'importe quelle inspection ou n'importe quel rapport par son adresse | Ajouter le contrôle de portée existant (auteur, POOL, province) : c'est une **restriction**, aucun droit n'est élargi. |
| E12 | La transition « Resoumettre » est accordée à toute personne ayant `inspections.conduct` dans le POOL | Un autre inspecteur du POOL pourrait resoumettre le rapport d'un collègue | Réserver la resoumission à l'auteur. |
| E13 | Pas de numéro de rapport ni d'en-tête pré-rempli | Ressaisie manuelle et risque d'erreur | Numérotation automatique (Q5) et pré-remplissage (§ 5.0). |
| E14 | Pas de calcul (totaux, conversions, notes finales) | — | Fonctions pures de calcul, testées (§ 8). |
| E15 | L'inspecteur ne voit les observations et l'historique que sur `/rapports/[id]`, pas sur sa page d'inspection | Retours peu visibles | Afficher le statut, les observations et la demande de correction sur la page de l'inspection. |
| E16 | Exploitants IPP (`exploitant_ipp` = `reports.review_province`) : ils **voient** les rapports de tous les POOL mais n'**agissent** qu'à partir de TRANSMIS (transmis par le POOL) ; pas d'accès à l'analyse IA ; aucune vue consolidée des fiches (notation, statistiques) | L'exploitation provinciale dépend de la transmission de chaque POOL | Ajouter des vues d'exploitation provinciales tirées des fiches, en lecture : tableaux de notation et statistiques par code, par POOL et par période. **Aucun droit nouveau sans décision** (Q8). |
| E17 | L'analyse IA (`src/lib/ai/reports.ts`) aplatit un `fieldsSchema` « plat » | Elle ne saura pas lire les nouvelles fiches | Fonction d'aplatissement pour le nouveau format (notes et observations par rubrique, notes finales). |
| E18 | `Report.summary` (obligatoire) et `recommendations` n'existent dans aucune fiche officielle | Double saisie probable (conseils déjà dans les fiches) | À décider (Q3) : conserver un court mot d'accompagnement facultatif, ou le supprimer de la soumission. |
| E19 | Aucun dépôt de pièces jointes de rapport n'existe, bien que le modèle `Attachment` soit présent | Annexes C2 et C6B, pièces à conviction A11 et A12, rapport circonstancié C1 | Dépôt d'annexes sur le rapport (Q6). |
| E20 | Aucun outil de test dans le projet (pas de script `test`) | — | Tests avec `node:test`, lancés par `tsx --test` (`tsx` est déjà installé, aucune nouvelle dépendance). |

### 6.3 Points par fiche

| Fiche | Existe dans l'application | Manque |
|---|---|---|
| A1 | Fiche simulée « A1 — Identification & administration (provisoire) », sans rapport avec la fiche officielle | Fiche officielle absente du dossier (Q2) |
| A2, A3, A4, A6 | Rien | Fiches propres à l'inspecteur et à une période, **pas à une école**. Le modèle actuel rattache tout à une inspection d'école (Q2, Q3). A3 et A4 se déduisent en grande partie des rapports soumis [PROPOSÉ]. |
| A5, A11, A12 | Rien | Fiches complètes à créer, plusieurs par visite (E4) |
| C1, C2, C2B, C2C, C3, C3B, C5A, C6B | Fiche simulée « C101 » seulement | Fiches complètes, calculs et versions |
| F1 | Fiche simulée « F1 — Contrôle financier », **sens différent** | Fiche officielle à créer, distincte de la simulée (E1) |
| T1 | Fiche simulée « T1 — Évaluation des résultats », **sens différent** | Fiche officielle absente du dossier |

---

## 7. Modèle de données : évolutions prévues (phase 2, toutes additives)

**Aucune migration ne supprimera ni n'altèrera de rapport existant.** Les migrations prévues :

1. `FormTemplate` : remplacer l'unicité de `code` par l'unicité de `(code, version)`, et
   ajouter les colonnes facultatives `module` (A, C, F, T), `levels` (M/P/S) et `source`
   (nom du document d'origine). Les lignes existantes gardent `version = 1`.
2. `Form` : remplacer `@@unique([inspectionId, formTemplateId])` par un index simple, et
   ajouter `status` (BROUILLON, COMPLÈTE ; `completed` reste en place), `number` (numéro du
   rapport) et `computed` (résultats de calcul figés à l'enregistrement, pour la lecture et
   l'exploitation).
3. **Migration de données à valider avant application (Q7)** : renommer le **code** des 4
   fiches simulées (`A1` → `PROV-A1`, `C101` → `PROV-C101`, `T1` → `PROV-T1`, `F1` →
   `PROV-F1`) et les passer à `active = false`. Les `Form` et `Report` liés ne changent pas :
   ils pointent vers la fiche par identifiant, et leurs données restent intactes.
4. Les définitions des fiches officielles sont écrites dans le code
   (`src/lib/fiches/<code>/v1.ts`), puis inscrites en base comme nouvelle ligne
   `(code, version)`. **Une version déjà en base n'est jamais modifiée** : toute évolution
   crée la version suivante.

Rappel du risque de déploiement : un push, même d'une branche, lance `prisma migrate deploy`
pendant la construction Vercel. **Aucun push de la branche de phase 2 sans votre accord.**

---

## 8. Règles : documentées et proposées

### 8.1 Règles explicitement documentées [DOC]

| Règle | Source |
|---|---|
| Notation 0–4 (0 = Médiocre … 4 = Élite) ; « – » si la rubrique n'engage pas la personne inspectée ; « S.O. » si le poste existe sans être opérationnel ; **RAS, rien, absent, néant interdits** | Module, § C1, C2, C3, C3M |
| Rubriques neutralisées ou S.O. **exclues** du total P et du nombre Rr | Module, § C2 et C3 « Conversion partielle » |
| C2, C5A : Z = P × 100 / (Rr × 4), puis tableau général des % (100–80 → 4 ; 79–70 → 3 ; 69–50 → 2 ; 49–40 → 1 ; 39–0 → 0) | Module, § C2 et C5A ; fiches C2 et C5A, poste 7 |
| C3, C3B, C3M : conversion partielle par la ligne Rr du tableau de conversion | Module, § C3 et C3M |
| C3, C3B, C3M, C2C : note finale = total des 10 notes converti à la ligne 10 | Module, § C3, C3B, C3M ; fiches |
| C2, C5A : note finale = total des 3 notes intermédiaires converti à la ligne 3 du tableau de C3 ; mention correspondante | Module, § C2 « Évaluation synthétique intermédiaire » et C5A |
| Mentions : 4 ÉLITE, 3 TRÈS BON, 2 BON, 1 ASSEZ BON, 0 MÉDIOCRE ; note finale en toutes lettres et en capitales | Fiches C2, C2C, C3, C3B, C5A ; module |
| C6B : conversion par chapitre selon T × 100 / R × 4, sans moyenne des chapitres ; conclusion viable / à parfaire / non viable | Fiche C6B ; module § C6B |
| Observations à formuler en général là où la note est inférieure à 2 (BON) ; C2B : observations seulement si l'appréciation est inférieure à B | Module, § C2, C2B, C3 |
| A2 : sous-total par mois et total trimestriel des classes / unités et des jours ; codes officiels seulement | Module, § A2 |
| A3 : % = R × 100 / P ; total des jours analytiques = somme des jours des modules ; synoptique de la notation en balance carrée, % par colonne = 100 ; jours ≤ jours du calendrier scolaire | Module, § A3 |
| A4 : total des quatre A3 (sans % pour la production) ; relevé modulaire P / R / % ; % d'inspectés ; % de qualifiés (réels au M/P, inspectés au S) | Module, § A4 |
| A5 : un constat par absent ; texte de la lettre non modifiable ; absence du CE → lettre au chef de sous-division | Module, § A5 |
| A6 : numéros universels séparés par « ; » ; A6 ne se liste pas lui-même ; récépissé identique au bordereau | Module, § A6 |
| A12 : délai de justification de 20 jours, porté à 30 hors de la localité de l'autorité | Module, § A12 |
| C1 : toutes les rubriques doivent être traitées | Module, § C1 |
| C2 : quatre annexes obligatoires | Module, § C2 « Avertissement » |
| Refus de signer : mention « Refus de signer » ; enseignant → contresigné par le CE ; CE → deux témoins | Module, « Signature du rapport » |
| Numérotation à double entrée (thématique par code + universelle continue), année civile | Module, « Numérotation du rapport » |

### 8.2 Validations proposées [PROPOSÉ]

| Proposition | Pourquoi |
|---|---|
| Arrondi de Z à l'entier le plus proche (0,5 vers le haut) avant lecture du tableau | Cohérent avec les exemples du module (53,8 → 54 ; 85,7 → 86) |
| Poste sans aucune rubrique notée (Rr = 0) : conversion « non calculable », et la note finale reste vide tant qu'un poste requis n'est pas calculable | Aucune règle écrite |
| Blocage de « Marquer comme complète » si une rubrique notée est vide (ni note, ni « – », ni « S.O. ») | « Toutes les rubriques doivent être traitées » (C1, C2) |
| Refus des saisies « RAS », « rien », « absent », « néant » dans les champs de constats et d'observations | Interdiction écrite, mise en œuvre automatique proposée |
| Avertissement (non bloquant) si une note inférieure à 2 n'a pas d'observation | « En général » : pas une obligation stricte |
| A2 : la somme des jours prévus d'un trimestre ne dépasse pas le nombre de jours du trimestre | Le calendrier scolaire officiel n'est pas fourni |
| P/I : présents ≤ inscrits | Cohérence |
| C5A : l'affichage d'une seule colonne (CPP ou CPS) suit le type d'adjoint choisi | Évite de remplir la mauvaise colonne |
| Note finale **toujours calculée** (non modifiable à la main), avec affichage du détail du calcul | Fidélité au barème ; à confirmer (Q1) |

Chaque calcul documenté sera couvert par des tests (phase 2) : Z et arrondi, lecture du
tableau par ligne Rr, exclusion de « – » et « S.O. », synthèses C2, C5A, C3, C3B et C2C,
totaux et pourcentages de A2, A3 et A4, délai A12.

---

## 9. Questions métier bloquantes

Seules les questions qui empêchent une implémentation fiable figurent ici.

- **Q1 — Tableau de conversion de référence.** Le tableau de `C3.docx` et celui de `C2C`/`C3B`
  diffèrent sur les lignes 3, 4, 6, 7 et 8 (§ 4.3-1). Lequel fait foi, pour C3, C3B, C3M, C2C
  et pour la ligne 3 utilisée par C2 et C5A ? Quand la ligne Rr et le pourcentage donnent des
  notes différentes, lequel prévaut ? Et que faire au-delà de 10 rubriques (C2C) ou pour
  Rr = 1 ?
- **Q2 — Périmètre de la phase 2.** Implémenter seulement les 16 fiches présentes ? Pouvez-vous
  fournir **A1 et C3M** (et C4, C5B, C6A, C7, F2, T1 s'ils sont utilisés) ? Je n'ai trouvé
  aucune « A1M » : la particularité du maternel documentée est C3M. Les formules sans
  canevas (A7, A8, C8, F3, F4, T2) deviennent-elles un « rapport libre codé » ? Les fiches de
  période (A2, A3, A4, A6), non liées à une école, entrent-elles dans cette phase ?
- **Q3 — Circuit de transmission.** L'itinérant soumet-il **l'ensemble de la visite** (toutes
  les fiches de l'école globale) en **une seule soumission**, ce que je propose pour éviter la
  double soumission ? Ou chaque fiche suit-elle son propre circuit ? Le bordereau A6 doit-il
  être **produit automatiquement** à la soumission, plutôt que saisi, et son récépissé
  correspond-il à l'accusé de réception actuel du POOL (« Accuser réception ») ? Faut-il
  garder le « Résumé » et les « Recommandations » actuels, absents des fiches ?
- **Q4 — Versions de C2 et statut de C2C.** Existe-t-il une version de C2 plus récente que
  « C2_EDU_NC_ANCIENNE » ? C2C, propre à Kinshasa-Lukunga et absente du module qui classe ce
  contrôle en C8, est-elle utilisée officiellement au Nord-Kivu 1 ?
- **Q5 — Numéro de rapport.** Faut-il le format du module (`61 / <code POOL> / <initiales> /
  C3.04 / <n° universel> / 2026`) ou le préfixe « MINEPST/IGE/… » des fiches révisées ?
  Quels sont les codes officiels des POOL (PP01, PS03, …) : ceux déjà saisis dans
  `Pool.code`, ou d'autres ?
- **Q6 — Signatures et annexes.** La prise de connaissance par le CE et l'enseignant se fait-elle
  sur papier, l'application enregistrant seulement « signé / refus de signer / témoins » ?
  Les annexes (plan de la parcelle, liste du personnel, pièces à conviction) sont-elles
  **déposées** (photo ou scan) dans l'application ?
- **Q7 — Fiches simulées en production.** Puis-je renommer le code des fiches simulées (`A1`,
  `C101`, `T1`, `F1` → `PROV-…`) et les désactiver, sans toucher aux rapports liés
  (migration de données décrite au § 7.3) ?
- **Q8 — « Exploiter » au niveau provincial.** Concrètement, que doivent pouvoir faire les
  exploitants de l'IPP sur les rapports de tous les POOL ? Aujourd'hui, ils voient tout,
  commentent, et n'agissent qu'après la transmission du POOL. Faut-il seulement leur donner
  des vues d'exploitation consolidées (notation, statistiques, par POOL) ? Ou doivent-ils
  pouvoir agir sur un rapport **avant** sa transmission par le POOL, ce qui modifierait le
  circuit et leurs droits ?
