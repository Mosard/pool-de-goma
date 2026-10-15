# Présence — réception ADMS directe (ZKTeco UA300)

La pointeuse envoie elle-même ses pointages à l'application, en HTTPS (port 443),
sans passerelle locale. Le protocole a été observé sur l'appareil réel avec la
sonde isolée `adms-sonde` (octobre 2026 : micrologiciel `Ver 8.0.4.6-20220616`,
pushver 2.4.1, client `iClock Proxy/1.09`).

## Circuit

| Appel de la pointeuse | Réponse de l'application |
|---|---|
| `GET /iclock/cdata?SN&options=all&pushver` | configuration : `TransFlag=TransData AttLog` (pointages seulement), `Delay=60`, `Realtime=1`, `TimeZone=2` |
| `POST /iclock/cdata?SN&table=ATTLOG` | `OK: n` **après** l'enregistrement en base ; en cas d'erreur, 500 : la pointeuse garde ses pointages et les renvoie |
| `POST /iclock/cdata?table=<autre>` | `OK`, corps **jamais lu ni conservé** ; signalement « table non demandée » (nom + taille) |
| `GET /iclock/getrequest?SN[&INFO]` | `OK` (aucune commande n'est jamais envoyée) ; compteurs INFO enregistrés (nombres seulement) |
| `POST /iclock/devicecmd` | `OK` |

Variante : `/p/<secret>/iclock/...` lorsqu'un chemin secret est défini pour l'appareil.

Code : `src/lib/presence/adms/protocol.ts` (fonctions pures, testées),
`src/lib/presence/adms/handler.ts` (contrôles, réception), routes
`src/app/iclock/[endpoint]` et `src/app/p/[secret]/iclock/[endpoint]`, exclues
du `matcher` du middleware (aucune session, pas de redirection vers `/login`).
Les pointages passent par `ingestBatch` (même circuit que l'API : idempotence,
déduplication, pointages bruts immuables, recalcul des journées).

## Contrôles de sécurité (par couches)

Le protocole ADMS n'a pas de secret : le numéro de série circule en clair et
figure sur l'étiquette. D'où :

1. **Appareil déclaré en ADMS** avec son numéro de série exact (unique) ; tout
   autre numéro → 401 et signalement « numéro de série inconnu ».
2. **Appairage** : refus tant qu'un administrateur n'a pas ouvert une fenêtre
   de 15 minutes ; le premier contact fixe l'empreinte (pushver, client HTTP,
   IP publique), journalisée (`presence.adms_paired`).
3. **Empreinte surveillée** : un changement de pushver, de client ou d'IP
   publique est accepté mais signalé.
4. **Chemin secret** (facultatif) : exigé dès qu'il est défini (stocké haché,
   affiché une fois). À activer si la pointeuse accepte un chemin dans
   l'adresse du serveur (test T5).
5. **Validation humaine** « Vérifié » après le pilote.
6. Désactivation : refus immédiat (au plus 60 s de mémoire par instance).

Risque résiduel sans chemin secret ni filtrage d'IP (pare-feu Vercel) : une
personne qui connaît le numéro de série et l'adresse peut envoyer de faux
pointages. Ils restent tracés (pointages bruts, lot, IP signalée si différente).

## Fiabilité

- Idempotence : clé de lot = empreinte (SN, table, Stamp, corps) ; un renvoi
  identique est sans effet. `externalEventId = adms:PIN:heure:état:mode`
  (valeurs brutes) : changer plus tard la règle de sens ne double jamais un pointage.
- Recalcul des journées : marqué fait par lot (`IngestBatch.recomputedAt`) ;
  s'il a échoué, le renvoi du lot le refait (corrige aussi l'API existante).
- Envois simultanés du même lot : le second est traité comme un renvoi.
- Horloge : un pointage daté de plus de **5 minutes** dans le futur est
  **conservé en quarantaine** (`RawPunch.clockSuspect`), exclu du calcul, et
  signalé. Rien n'est rejeté (la pointeuse effacerait le pointage après `OK`).
  Le décalage est mesuré sur les envois en temps réel.
- Reprise après coupure : la pointeuse renvoie ses pointages non transmis
  (observé) ; comparer « en mémoire sur l'appareil » (INFO) et « reçus ».

## Règles encore en attente

- **Q-PUNCH-1 (sens)** : seuls les états 0 (entrée) et 1 (sortie) sont
  interprétés ; 2 à 5 et 255 restent « sens inconnu ». L'état brut est
  conservé (`RawPunch.rawStatus`).
- Les pointages comptent dès l'appairage, que l'appareil soit « Vérifié » ou non
  (comportement inchangé du module).

## Gestion centralisée des enrôlements (Présence › Appareils)

L'application décide **qui** est inscrit sur la pointeuse et sous **quel PIN** ;
la pointeuse reçoit des commandes (`DeviceCommand`) à sa prochaine
interrogation (≈ 1 minute) et renvoie leur résultat (`/iclock/devicecmd`).

| Action | Effet |
|---|---|
| Inscrire un agent | PIN attribué (au-dessus de tous les PIN connus : associés, inventoriés, ayant pointé) ou saisi ; association datée ; `DATA UPDATE USERINFO … Pri=0` (jamais administrateur) ; capture d'empreinte facultative |
| Capturer une empreinte | `ENROLL_FP` : l'agent pose son doigt **sur la pointeuse** ; l'empreinte reste sur l'appareil |
| Renvoyer l'inscription | après une réinitialisation de l'appareil |
| Retirer | fin d'association datée + `DATA DELETE USERINFO` (par défaut) |
| Demander l'inventaire | `DATA QUERY USERINFO` : liste des PIN de l'appareil avec leur privilège |
| Retirer de la pointeuse (PIN non associé) | `DATA DELETE USERINFO` ; refusé pour un administrateur de l'appareil |

Protections : un PIN ne peut pas contenir de séparateur (aucune injection de
champ, p. ex. `Pri=14`) ; un PIN administrateur ou déjà utilisé par une
personne non associée n'est jamais réattribué ; une commande remise sans
résultat est renvoyée après 5 min si elle est sans effet en double (jamais
une capture d'empreinte), puis expirée après 30 min ; toute action est journalisée.

## Blocage des pointages non autorisés

- **Dans l'application (garanti)** : un pointage n'entre dans une journée que si
  son PIN est associé à un agent à l'heure du pointage. Sinon, il est conservé
  (preuve), exclu du calcul, et signalé « Pointage d'un PIN sans association ».
- **Sur l'appareil (à distance)** : l'inventaire signale les PIN présents sans
  association, les administrateurs de l'appareil, et l'absence d'administrateur
  (« menu accessible à tous ») ; un PIN non associé peut être retiré à distance.

## Tests matériels restants (environnement Preview)

| Test | Procédure | Attendu |
|---|---|---|
| T9 biométrie | enrôler un utilisateur 3 au menu de l'appareil | aucune table d'empreintes reçue ; aucun pointage parasite |
| T5 chemin secret | « Créer un chemin secret », saisir `…vercel.app/p/<secret>` comme adresse | accepté → contacts sur `/p/…` ; refusé → rester sans chemin secret |
| C1 inscription | « Inscrire un agent » sans capture | l'agent apparaît sur la pointeuse avec son nom ; commande « réussie » |
| C2 capture | « Capturer une empreinte », l'agent devant l'appareil | l'appareil demande le doigt ; commande « réussie » ou code d'échec |
| C3 inventaire | « Demander l'inventaire » | liste des PIN et privilèges ; administrateurs signalés |
| C4 retrait | « Retirer » un agent de test | l'agent disparaît de la pointeuse ; il ne peut plus pointer |
| C5 PIN inconnu | créer un utilisateur au menu de l'appareil sans l'inscrire | son pointage est conservé, non compté, signalé |
| C6 sans réseau | inscrire un agent pendant une coupure, puis rétablir | la commande est remise au retour du réseau |

## Limites connues

- Le protocole n'est pas authentifié : sans chemin secret, quiconque connaît
  le numéro de série et l'adresse peut imiter la pointeuse. L'IP publique du
  bureau change (observé : 206.42.85.153 puis 169.239.159.39) : un filtrage
  par IP au pare-feu n'est pas possible en l'état.
- Les commandes `ENROLL_FP` et `DATA QUERY USERINFO` dépendent du
  micrologiciel ; leur prise en charge par l'UA300 (Ver 8.0.4.6) n'est pas
  encore vérifiée (tests C2, C3). Format de l'inventaire toléré : trois variantes.
- La réponse à un inventaire demandé est lue en mémoire (PIN et privilège
  retenus, le reste ignoré) : c'est la seule exception à « tables non lues ».
- Un administrateur de l'appareil peut toujours créer un utilisateur au menu :
  l'application le détecte (inventaire, pointages non autorisés) mais ne peut
  pas l'empêcher. D'où l'importance d'un administrateur sur la pointeuse,
  dont le mot de passe est connu de l'informaticien seul.
- Le délai d'une commande dépend de l'interrogation (≈ 1 min, jusqu'à ≈ 2 min
  avec la mémoire de 60 s par instance).
- Le compteur « pointages en mémoire » de l'appareil inclut les pointages
  antérieurs à l'appairage (déjà transmis ailleurs) : il n'est pas égal au
  nombre reçu.

## Coûts (opérations Prisma Postgres facturées)

~1 440 interrogations par jour et par appareil : appareil gardé en mémoire
60 s, dernier contact écrit au plus toutes les 5 minutes, signalements
regroupés (une ligne par appareil et par nature).

## Tests

- `npm test` : `src/lib/presence/adms/protocol.test.ts`.
- Bout en bout (base et application LOCALES, `ADMS_DEVICE_CACHE_MS=0`) :
  `POSTGRES_URL=<locale> BASE_URL=http://localhost:3100 npx tsx prisma/scripts/verify-adms-http.ts`.

## Mise en service (production : avec l'accord explicite de l'Inspection)

1. Sauvegarde complète ; vérifier qu'aucun numéro de série n'est en double
   (index unique de la migration `20261016120000_presence_adms`).
2. Fusion vers `master` (le build applique la migration additive).
3. Présence › Appareils : enregistrer la pointeuse (mode ADMS, numéro de série
   exact), associer les identifiants, **ouvrir l'appairage**.
4. Sur la pointeuse : serveur = `ippnk1.online`, port 443, HTTPS.
5. Pilote 1 à 2 semaines, puis « Marquer vérifié ».
