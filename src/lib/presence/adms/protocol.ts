// Protocole ADMS (ZKTeco « push », vérifié sur l'UA300 réelle avec la sonde
// adms-sonde, octobre 2026) — fonctions PURES, sans réseau ni base.
//
// Échanges observés (micrologiciel Ver 8.0.4.6, pushver 2.4.1) :
//   GET  /iclock/cdata?SN=…&options=all&pushver=…   → configuration (poignée de main)
//   POST /iclock/cdata?SN=…&table=ATTLOG&Stamp=…     → pointages, une ligne chacun
//   GET  /iclock/getrequest?SN=…[&INFO=…]           → interrogation (aucune commande envoyée)
//   POST /iclock/devicecmd?SN=…                      → résultat de commande (jamais utilisé)
// Variante facultative : /p/<secret>/iclock/... (chemin secret propre à l'appareil).
//
// Seules les lignes ATTLOG sont lues. Les autres tables (utilisateurs,
// empreintes, visages, photos, journal d'opérations) ne sont jamais décodées.

import { createHash } from "node:crypto";
import { MAX_EVENTS_PER_BATCH, type CanonicalEvent } from "@/lib/presence/ingest";

const PIN_RE = /^[A-Za-z0-9_.-]{1,64}$/; // même règle que les associations
const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

export type AdmsEndpoint = "cdata" | "getrequest" | "devicecmd" | "querydata" | "other";

/** Point d'entrée ADMS d'après le dernier segment du chemin (« cdata », « cdata.aspx »…). */
export function admsEndpoint(segment: string): AdmsEndpoint {
  const s = segment.toLowerCase().replace(/\.aspx$/, "");
  return s === "cdata" || s === "getrequest" || s === "devicecmd" || s === "querydata" ? s : "other";
}

/** Numéro de série plausible (lettres, chiffres) ; sinon null. */
export function cleanSn(sn: string | null | undefined): string | null {
  return typeof sn === "string" && /^[A-Za-z0-9]{4,40}$/.test(sn) ? sn : null;
}

/** Secret de chemin plausible (base64url, 16 à 64 caractères) ; sinon null. */
export function cleanPathSecret(secret: string | null | undefined): string | null {
  return typeof secret === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(secret) ? secret : null;
}

/**
 * Sens du pointage d'après l'état ADMS. PROVISOIRE (question Q-PUNCH-1) :
 * 0 = entrée, 1 = sortie ; tout le reste (pauses 2/3, heures sup. 4/5,
 * 255 = indéfini) reste UNKNOWN tant que l'Inspection n'a pas décidé.
 * L'état brut est conservé (RawPunch.rawStatus) : la règle pourra changer sans perte.
 */
export function directionFromStatus(status: string): "IN" | "OUT" | "UNKNOWN" {
  if (status === "0") return "IN";
  if (status === "1") return "OUT";
  return "UNKNOWN";
}

/**
 * Identifiant d'événement STABLE, construit sur les valeurs BRUTES (et non
 * sur le sens déduit) : changer plus tard la règle de sens ne pourra jamais
 * faire entrer deux fois le même pointage (dedupKey = dev:<appareil>:ev:<id>).
 */
export function externalEventId(pin: string, localTime: string, status: string, verify: string): string {
  return `adms:${pin}:${localTime}:${status}:${verify}`.slice(0, 120);
}

export type AttlogLine = {
  event: CanonicalEvent;
  rawStatus: string;
  workCode: string | null;
};
export type AttlogRejected = { line: number; code: "PIN_INVALIDE" | "HEURE_INVALIDE" };

/**
 * Lecture d'un corps ATTLOG : une ligne par pointage, champs séparés par des
 * tabulations : PIN, « AAAA-MM-JJ HH:MM:SS » (heure de l'appareil), état,
 * mode de vérification, code de travail, champs réservés. Les lignes
 * illisibles sont signalées par leur numéro et un motif, JAMAIS recopiées.
 * La validité calendaire et l'avance d'horloge sont contrôlées à la réception.
 */
export function parseAttlog(body: string): { lines: AttlogLine[]; rejected: AttlogRejected[]; lineCount: number } {
  const lines: AttlogLine[] = [];
  const rejected: AttlogRejected[] = [];
  let lineCount = 0;
  body.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    lineCount++;
    const [pin = "", rawTime = "", status = "", verify = "", workCode = ""] = raw.split("\t").map((x) => x.trim());
    if (!PIN_RE.test(pin)) return rejected.push({ line: i + 1, code: "PIN_INVALIDE" });
    if (!TIME_RE.test(rawTime)) return rejected.push({ line: i + 1, code: "HEURE_INVALIDE" });
    const localTime = rawTime.replace(" ", "T");
    const st = status.slice(0, 8);
    const vm = verify.slice(0, 32);
    lines.push({
      event: {
        externalEventId: externalEventId(pin, localTime, st, vm),
        deviceUserId: pin,
        localTime,
        direction: directionFromStatus(st),
        ...(vm ? { verifyMode: vm } : {}),
      },
      rawStatus: st,
      workCode: workCode && workCode !== "0" ? workCode.slice(0, 32) : null,
    });
  });
  return { lines, rejected, lineCount };
}

/**
 * Clé d'idempotence d'un lot : un renvoi à l'identique par la pointeuse
 * (réponse perdue, coupure) produit la même clé, donc aucun effet.
 * Compatible avec la règle des clés de l'API (8 à 100 caractères).
 */
export function admsIdempotencyKey(sn: string, table: string, stamp: string | null, body: string, part = 0): string {
  const h = createHash("sha256").update(`${sn}\n${table}\n${stamp ?? ""}\n${part}\n${body}`).digest("hex");
  return `adms_${h.slice(0, 48)}`;
}

/** Découpe en lots de 500 au plus (plafond de l'API), chacun avec sa clé. */
export function toBatches(sn: string, stamp: string | null, body: string, lines: AttlogLine[]) {
  const batches: { idempotencyKey: string; lines: AttlogLine[] }[] = [];
  for (let i = 0; i < lines.length; i += MAX_EVENTS_PER_BATCH) {
    batches.push({ idempotencyKey: admsIdempotencyKey(sn, "ATTLOG", stamp, body, i / MAX_EVENTS_PER_BATCH), lines: lines.slice(i, i + MAX_EVENTS_PER_BATCH) });
  }
  return batches;
}

/**
 * TransFlag : ce que la pointeuse a le droit d'envoyer. Pointages SEULEMENT.
 *   - texte (push ≥ 2.x, accepté par l'UA300) : « TransData AttLog »
 *   - bits (anciens micrologiciels) : seul le 1er bit (AttLog) à 1.
 */
export function transFlagFor(pushver: string | null | undefined): string {
  const major = Number.parseFloat(pushver ?? "");
  return Number.isFinite(major) && major >= 2 ? "TransData AttLog" : "1000000000";
}

/**
 * Réponse à la poignée de main. Delay élevé = moins d'appels (opérations de
 * base facturées) ; Realtime=1 = un pointage part tout de suite.
 */
export function handshakeOptions(sn: string, pushver: string | null | undefined, delaySec = 60): string {
  const lines = [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=None",
    "Stamp=None",
    // Journal d'opérations et photos : marqueurs « déjà tout reçu ».
    "OPERLOGStamp=9999",
    "OpStamp=9999",
    "ATTPHOTOStamp=9999",
    "PhotoStamp=9999",
    `ErrorDelay=${Math.max(60, delaySec * 2)}`,
    `Delay=${delaySec}`,
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    `TransFlag=${transFlagFor(pushver)}`,
    "TimeZone=2",
    "Realtime=1",
    "Encrypt=0",
  ];
  return lines.join("\n") + "\n";
}

export type AdmsInfo = { firmware: string | null; users: number | null; fingerprints: number | null; attLogs: number | null; localIp: string | null };

/**
 * Paramètre INFO de getrequest : « Ver 8.0.4.6-20220616,2,1,4,192.168.0.89,… »
 * = micrologiciel, utilisateurs, empreintes (nombre seulement), pointages en mémoire, IP locale.
 */
export function parseInfo(info: string | null | undefined): AdmsInfo | null {
  if (!info) return null;
  const f = info.split(",").map((x) => x.trim());
  if (f.length < 5) return null;
  const n = (v: string | undefined) => (v && /^\d{1,9}$/.test(v) ? Number(v) : null);
  const ip = f[4] && /^\d{1,3}(\.\d{1,3}){3}$/.test(f[4]) ? f[4] : null;
  return { firmware: f[0] ? f[0].slice(0, 64) : null, users: n(f[1]), fingerprints: n(f[2]), attLogs: n(f[3]), localIp: ip };
}

/** Empreinte du chemin secret (stockée hachée, comme les jetons). */
export function hashPathSecret(secret: string): string {
  return createHash("sha256").update(`adms-path:${secret}`).digest("hex");
}

// ─── Commandes de gestion (serveur → pointeuse) ─────────────────────────────
// Remises en réponse à getrequest, une par ligne : « C:<seq>:<commande> ».
// Seules ces commandes existent dans l'application : inscription et retrait
// d'un utilisateur, capture d'empreinte SUR l'appareil, inventaire, INFO.
// Jamais d'effacement des pointages, jamais de lecture ni d'envoi d'empreinte.

export const PIN_PATTERN = PIN_RE;

/** Nom affiché par la pointeuse : sans accents, 24 caractères, sans séparateurs du protocole. */
export function deviceDisplayName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\t\r\n=]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

/** Inscription ou mise à jour d'un utilisateur ORDINAIRE (Pri=0 : jamais administrateur). */
export function userUpsertCommand(pin: string, name: string): string {
  if (!PIN_RE.test(pin)) throw new Error("PIN invalide.");
  return `DATA UPDATE USERINFO PIN=${pin}\tName=${deviceDisplayName(name)}\tPri=0\tGrp=1`;
}

export function userDeleteCommand(pin: string): string {
  if (!PIN_RE.test(pin)) throw new Error("PIN invalide.");
  return `DATA DELETE USERINFO PIN=${pin}`;
}

/** Lance la capture d'une empreinte SUR la pointeuse (l'agent pose son doigt sur l'appareil). */
export function enrollFingerprintCommand(pin: string, fingerIndex: number): string {
  if (!PIN_RE.test(pin)) throw new Error("PIN invalide.");
  const fid = Math.min(9, Math.max(0, Math.trunc(fingerIndex)));
  return `ENROLL_FP PIN=${pin}\tFID=${fid}\tRETRY=3\tOVERWRITE=0`;
}

export const USER_QUERY_COMMAND = "DATA QUERY USERINFO";
export const INFO_COMMAND = "INFO";

/** Corps de réponse à getrequest : une commande par ligne, ou « OK » s'il n'y en a aucune. */
export function formatCommands(cmds: { seq: number; command: string }[]): string {
  return cmds.length ? cmds.map((c) => `C:${c.seq}:${c.command}`).join("\n") + "\n" : "OK";
}

/** Résultats rendus par /iclock/devicecmd : « ID=<seq>&Return=<code>&CMD=<type> », un par ligne. */
export function parseCommandResults(body: string): { seq: number; returnCode: number; cmd: string | null }[] {
  const out: { seq: number; returnCode: number; cmd: string | null }[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const params = new URLSearchParams(line.trim());
    const id = params.get("ID") ?? params.get("id");
    const ret = params.get("Return") ?? params.get("return");
    if (!id || !/^\d{1,9}$/.test(id) || ret === null || !/^-?\d{1,6}$/.test(ret)) continue;
    out.push({ seq: Number(id), returnCode: Number(ret), cmd: (params.get("CMD") ?? params.get("cmd"))?.slice(0, 32) ?? null });
  }
  return out;
}

export type DeviceUserEntry = { pin: string; privilege: number };

/**
 * Inventaire des utilisateurs envoyé par la pointeuse en réponse à
 * DATA QUERY USERINFO. Formats tolérés selon le micrologiciel :
 *   « USER PIN=1⇥Name=…⇥Pri=0⇥Passwd=…⇥Card=… » (journal d'opérations),
 *   « PIN=1⇥Name=…⇥Pri=0… » (table USERINFO),
 *   « user uid=1⇥pin=1⇥privilege=0⇥name=… » (querydata).
 * Seuls le PIN et le privilège sont extraits. Toute autre ligne (empreintes
 * « FP … », visages, photos) est ignorée sans être interprétée ; nom, mot de
 * passe et carte ne sont jamais retournés.
 */
export function parseUserInventory(body: string): DeviceUserEntry[] {
  const out = new Map<string, number>();
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^(USER\s|user\s|PIN=|pin=)/.test(line)) continue;
    const fields = new Map<string, string>();
    for (const part of line.replace(/^user\s+/i, "").split("\t")) {
      const i = part.indexOf("=");
      if (i > 0) fields.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim());
    }
    const pin = fields.get("pin") ?? "";
    if (!PIN_RE.test(pin)) continue;
    const pri = fields.get("pri") ?? fields.get("privilege") ?? "0";
    out.set(pin, /^\d{1,3}$/.test(pri) ? Number(pri) : 0);
  }
  return [...out].map(([pin, privilege]) => ({ pin, privilege }));
}

/** Privilège ZKTeco : 0 = utilisateur ; 2 = enrôleur ; 6 = administrateur ; 14 = super administrateur. */
export function isDeviceAdmin(privilege: number): boolean {
  return privilege > 0;
}

