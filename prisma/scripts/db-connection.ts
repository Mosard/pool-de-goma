// Connexion des scripts serveur à une base distante, sans jamais afficher
// l'URL ni ses identifiants.
//
// URL lue : DATABASE_URL_SCRIPT si définie, sinon POSTGRES_URL. Deux formes :
// - postgres://…@db.prisma.io:5432/…  connexion directe (port 5432) ;
// - prisma+postgres://accelerate.prisma-data.net/?api_key=…  passe par HTTPS
//   (port 443) : à utiliser depuis un réseau qui filtre le port 5432.

import net from "node:net";
import { PrismaClient } from "@prisma/client";

export type UrlShape = {
  source: string;
  scheme: string;
  host: string;
  port: string;
  hasSslmode: boolean;
  hasApiKey: boolean;
  hadQuotesOrSpaces: boolean;
};

function readUrl(): { url: string; shape: UrlShape } {
  const source = process.env.DATABASE_URL_SCRIPT ? "DATABASE_URL_SCRIPT" : "POSTGRES_URL";
  const raw = process.env[source] ?? "";
  if (!raw) throw new Error(`Variable ${source} absente de cette session.`);
  // Guillemets ou espaces copiés par erreur autour de la valeur.
  const url = raw.trim().replace(/^['"]|['"]$/g, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${source} n'est pas une URL valide (valeur non affichée).`);
  }
  const scheme = parsed.protocol.replace(/:$/, "");
  return {
    url,
    shape: {
      source,
      scheme,
      host: parsed.hostname,
      port: parsed.port || (scheme.startsWith("prisma") ? "443" : "5432"),
      hasSslmode: parsed.searchParams.has("sslmode"),
      hasApiKey: parsed.searchParams.has("api_key"),
      hadQuotesOrSpaces: url !== raw,
    },
  };
}

/** Client Prisma pour un script ; délai de connexion allongé (liaison lente). */
export function scriptClient(): { prisma: PrismaClient; shape: UrlShape } {
  const { url, shape } = readUrl();
  let datasourceUrl = url;
  if (shape.scheme === "postgres" || shape.scheme === "postgresql") {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
    datasourceUrl = u.toString();
  }
  return { prisma: new PrismaClient({ datasourceUrl }), shape };
}

export function describe(shape: UrlShape): string {
  return `${shape.source} : ${shape.scheme}://${shape.host}:${shape.port} (sslmode ${shape.hasSslmode ? "présent" : "absent"}, api_key ${shape.hasApiKey ? "présente" : "absente"}${shape.hadQuotesOrSpaces ? ", guillemets/espaces retirés" : ""})`;
}

/**
 * Le serveur répond-il au protocole Postgres ? Envoie seulement une demande
 * de chiffrement (SSLRequest), sans identifiant.
 */
export function probePostgres(host: string, port: number): Promise<string> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const s = net.connect({ host, port, timeout: 25000 });
    s.once("timeout", () => {
      resolve(`aucune réponse en ${Date.now() - t0} ms`);
      s.destroy();
    });
    s.once("error", (e: NodeJS.ErrnoException) => resolve(`${e.code ?? e.message} après ${Date.now() - t0} ms`));
    s.once("connect", () => {
      const req = Buffer.alloc(8);
      req.writeInt32BE(8, 0);
      req.writeInt32BE(80877103, 4);
      s.write(req);
      s.once("data", (d) => {
        resolve(`OK — le serveur répond (« ${String.fromCharCode(d[0])} ») en ${Date.now() - t0} ms`);
        s.destroy();
      });
    });
  });
}

/** Message d'erreur Prisma sans URL ni identifiant éventuel. */
export function scrub(message: string): string {
  return message.replace(/[a-z+]+:\/\/[^\s"'`]+/gi, "<url masquée>").replace(/api_key=[^\s&"'`]+/gi, "api_key=<masquée>");
}
