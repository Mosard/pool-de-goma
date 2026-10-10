# Présence du personnel — lots 2 à 5 (moteur, pointages, synthèses, interfaces)

Suite de `docs/presence-lot1-acces.md`. Aucune pointeuse réelle n'est connectée : le
matériel n'est pas acheté. Les écrans fonctionnent sans appareil, avec des états vides
explicites ; un simulateur existe pour le développement local seulement.

## Règles appliquées (validées)

| Situation | Règle | Où |
|---|---|---|
| Arrivée jusqu'à 8 h 15 incluse | aucun retard | `lateVerdict` |
| Arrivée à partir de 8 h 16 | retard **signalé**, durée **non calculée** (Q-CALC-1) | `computeDay` |
| Départ avant 15 h | départ anticipé, sous réserve d'une autorisation | `departureVerdict` |
| Départ de 15 h à 15 h 15 inclus | départ normal | `departureVerdict` |
| Départ après 15 h 15 | temps supplémentaire **proposé** depuis 15 h 15 (16 h → 45 min), jamais approuvé ici | `departureVerdict` |

Fuseau : `Africa/Lubumbashi` (UTC+2), instants stockés en UTC (`src/lib/presence/time.ts`).

## Règles non décidées (calcul bloqué, données brutes conservées)

Q-CALC-1 durée du retard · Q-PREC-1 secondes dans la minute d'un seuil · Q-PUNCH-1 entrées /
sorties multiples et sens non transmis (aucune déduction par alternance ni par premier / dernier
pointage) · Q-ABS-1 qualification d'une absence (« aucun pointage reçu » ne vaut jamais absence) ·
Q-SYNC-1 confirmation de la synchronisation et seuil de dérive d'horloge · Q-CAL-1 pointage un jour
non travaillé. Messages : `PENDING_RULES` (`src/lib/presence/settings.ts`).

## Données

`AttendanceSetting` (horaire versionné ; seule la valeur validée est posée par la migration) ·
`CalendarDay` (rien de préchargé) · `AttendanceDevice` (`NON_VERIFIE` par défaut) ·
`DeviceCredential` (jeton haché SHA-256, affiché une fois, révocable) · `DeviceUserMapping`
(association datée [début, fin), journalisée, jamais par le nom) · `IngestBatch` (idempotence) ·
`RawPunch` (brut immuable, heure du pointage ≠ heure de réception, `dedupKey` unique) ·
`DailyAttendance` (synthèse recalculable). Migration `20261011120000_presence_pointages`.

## Réception (format canonique, indépendant du fabricant)

`POST /api/presence/v1/ingest` — `Authorization: Bearer <jeton>`, `Idempotency-Key` ; corps
`{ events: [{ externalEventId?, deviceUserId, localTime: "AAAA-MM-JJTHH:MM:SS", direction?: IN|OUT|UNKNOWN, verifyMode? }] }`
(500 au plus). Réponses : 200, 401, 409 (même clé, autre contenu), 413, 422.
`POST /api/presence/v1/heartbeat` : décalage d'horloge brut. `GET /api/presence/v1/changes` :
curseur pour le rafraîchissement (session requise). Un adaptateur fabricant ou une passerelle
locale se branchera sur ce format après vérification du matériel.

## Droits (relus en base à chaque requête)

Vue globale : `presence.read_all` ; vue de sa cellule (jours d'appartenance seulement) :
`presence.read_cell` ; sa propre présence : tout compte. Appareils : `presence.devices.manage` ;
associations : `presence.enrollment.manage` ; horaire et calendrier : `presence.schedule.manage`
(IPP principal, IPA chargé du personnel). Filtres et accès directs contrôlés côté serveur
(`src/lib/presence/views.ts`). Aucune coordonnée ni donnée familiale dans les vues.

## Simulateur

Disponible seulement si `PRESENCE_SIMULATOR=1`, hors de tout environnement Vercel et sur une base
locale (`presenceSimulatorEnabled`). Ses pointages passent par le même circuit et restent marqués
« Simulation ».

## Vérifications

`npm test` (`rules.test.ts`, `presence.test.ts`) ; `prisma/scripts/verify-presence.ts` (appels
directs, base locale) ; `prisma/scripts/verify-presence-http.ts` (application locale démarrée).
