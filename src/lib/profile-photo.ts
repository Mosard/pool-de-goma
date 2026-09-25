// Photos de profil : `User.photoUrl` stocke une data URL base64 (voir
// migration 20260918140000_add_user_photo). Ce module limite leur poids —
// à l'enregistrement (redimensionnement) et à la diffusion publique
// (vignette servie par une route dédiée, jamais inlinée dans le HTML).

type Sharp = import("sharp").SharpConstructor;

let sharpModule: Promise<Sharp | null> | null = null;

// sharp est fourni avec Next.js (dépendance optionnelle). S'il manque sur la
// plateforme, on retombe sur une validation par signature sans
// redimensionnement plutôt que de casser l'envoi de photo.
function loadSharp(): Promise<Sharp | null> {
  sharpModule ??= import("sharp").then((m) => m.default).catch(() => null);
  return sharpModule;
}

const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", test: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

/** Type réel d'après le contenu (jamais d'après le type déclaré par le navigateur). SVG et autres formats refusés. */
export function sniffImageMime(buffer: Buffer): string | null {
  return SIGNATURES.find((s) => s.test(buffer))?.mime ?? null;
}

export const STORED_PHOTO_MAX_PX = 512;

/**
 * Valide et normalise une photo envoyée par l'utilisateur. Retourne une data
 * URL WebP d'au plus 512 px de côté (quelques dizaines de Ko), ou null si le
 * fichier n'est pas une image JPEG/PNG/WebP lisible.
 */
export async function normalizeProfilePhoto(input: Buffer): Promise<string | null> {
  const mime = sniffImageMime(input);
  if (!mime) return null;

  const sharp = await loadSharp();
  if (!sharp) return `data:${mime};base64,${input.toString("base64")}`;

  try {
    const output = await sharp(input)
      .rotate()
      .resize(STORED_PHOTO_MAX_PX, STORED_PHOTO_MAX_PX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return `data:image/webp;base64,${output.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Décode une data URL stockée. Refuse tout ce qui n'est pas une image JPEG/PNG/WebP réelle. */
export function decodePhotoDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  const mime = sniffImageMime(buffer);
  return mime ? { mime, buffer } : null;
}

/** Vignette carrée pour le site public, recalculée depuis la photo stockée. */
export async function publicThumbnail(dataUrl: string, size: number): Promise<{ mime: string; body: Buffer } | null> {
  const decoded = decodePhotoDataUrl(dataUrl);
  if (!decoded) return null;

  const sharp = await loadSharp();
  if (!sharp) return { mime: decoded.mime, body: decoded.buffer };

  try {
    const body = await sharp(decoded.buffer)
      .rotate()
      .resize(size, size, { fit: "cover", position: "attention" })
      .webp({ quality: 78 })
      .toBuffer();
    return { mime: "image/webp", body };
  } catch {
    return null;
  }
}
