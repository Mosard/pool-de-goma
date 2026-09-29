import type { ReactNode } from "react";

// Format de l'éditeur simple des contenus (sous-ensemble de Markdown), rendu
// en éléments React : AUCUN HTML libre n'est interprété, donc aucun script ni
// style injecté. Utilisé par l'aperçu du back-office et par les pages
// publiques.
//
//   ## Intertitre            ### Sous-intertitre
//   - élément de liste       1. élément numéroté
//   > citation
//   ![texte alternatif](/medias/<id>)   (image du contenu, seule sur sa ligne)
//   **gras**  *italique*  [texte du lien](https://… ou /chemin)

const MEDIA_SRC = /^\/medias\/[a-z0-9]{10,40}$/;
const IMAGE_LINE = /^!\[([^\]]{0,200})\]\((\/medias\/[a-z0-9]{10,40})\)$/;

/** Lien accepté : https/http absolu ou chemin interne ; jamais javascript:, data:… */
function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(u)) return u;
  if (/^\/(?!\/)[^\s]*$/.test(u)) return u;
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Ordre : liens, gras, italique.
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      if (!href) {
        out.push(m[1]);
      } else if (href.startsWith("/")) {
        out.push(
          <a key={key} href={href} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
            {m[1]}
          </a>
        );
      } else {
        out.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            {m[1]}
          </a>
        );
      }
    } else if (m[3] !== undefined) {
      out.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<em key={key}>{m[4]}</em>);
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(lines: string[], keyPrefix: string): ReactNode[] {
  return lines.flatMap((line, i) => {
    const nodes = renderInline(line, `${keyPrefix}-${i}`);
    return i < lines.length - 1 ? [...nodes, <br key={`${keyPrefix}-br-${i}`} />] : nodes;
  });
}

/** Rendu du texte d'un contenu. */
export function renderContentBody(body: string): ReactNode[] {
  const blocks = body.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const out: ReactNode[] = [];
  blocks.forEach((raw, b) => {
    const lines = raw.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    if (lines.length === 0) return;
    const key = `b${b}`;
    const first = lines[0].trim();

    const image = lines.length === 1 ? IMAGE_LINE.exec(first) : null;
    if (image && MEDIA_SRC.test(image[2])) {
      out.push(
        <figure key={key} className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- image servie par /medias, déjà compressée */}
          <img src={image[2]} alt={image[1]} loading="lazy" className="w-full rounded-xl bg-gray-100" />
          {image[1] && <figcaption className="mt-2 text-center text-xs text-gray-500">{image[1]}</figcaption>}
        </figure>
      );
      return;
    }
    if (first.startsWith("### ")) {
      out.push(<h3 key={key} className="mt-6 text-lg font-semibold text-gray-900">{renderInline(first.slice(4), key)}</h3>);
      return;
    }
    if (first.startsWith("## ")) {
      out.push(<h2 key={key} className="mt-8 text-xl font-bold text-gray-900">{renderInline(first.slice(3), key)}</h2>);
      return;
    }
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      out.push(
        <ul key={key} className="my-4 list-disc space-y-1 pl-6">
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^\s*-\s+/, ""), `${key}-${i}`)}</li>
          ))}
        </ul>
      );
      return;
    }
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      out.push(
        <ol key={key} className="my-4 list-decimal space-y-1 pl-6">
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^\s*\d+\.\s+/, ""), `${key}-${i}`)}</li>
          ))}
        </ol>
      );
      return;
    }
    if (lines.every((l) => l.startsWith(">"))) {
      out.push(
        <blockquote key={key} className="my-4 border-l-4 border-blue-200 pl-4 italic text-gray-700">
          {withBreaks(lines.map((l) => l.replace(/^>\s?/, "")), key)}
        </blockquote>
      );
      return;
    }
    out.push(
      <p key={key} className="my-4 leading-relaxed">
        {withBreaks(lines, key)}
      </p>
    );
  });
  return out;
}

/** Texte brut (extraits, description SEO) : sans syntaxe ni images. */
export function contentPlainText(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{2,3}\s+|^>\s?|^\s*-\s+|^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Identifiants des images /medias référencées dans le texte. */
export function inlineMediaIds(body: string): string[] {
  return [...body.matchAll(/!\[[^\]]*\]\(\/medias\/([a-z0-9]{10,40})\)/g)].map((m) => m[1]);
}
