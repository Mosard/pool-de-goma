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
