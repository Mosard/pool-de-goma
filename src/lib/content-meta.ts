// Référentiel PUR des contenus éditoriaux (sans base) : importable par les
// composants client comme par le serveur.

export const CONTENT_KINDS = ["ACTUALITE", "ARTICLE", "COMMUNIQUE", "GALERIE"] as const;
export type ContentKindKey = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKindKey, string> = {
  ACTUALITE: "Actualité",
  ARTICLE: "Article",
  COMMUNIQUE: "Communiqué",
  GALERIE: "Album photo",
};

export const CONTENT_KIND_PLURALS: Record<ContentKindKey, string> = {
  ACTUALITE: "Actualités",
  ARTICLE: "Articles",
  COMMUNIQUE: "Communiqués",
  GALERIE: "Albums photo",
};

export type ContentStatusKey = "BROUILLON" | "SOUMIS" | "A_CORRIGER" | "PUBLIE" | "RETIRE";

export const CONTENT_STATUS_LABELS: Record<ContentStatusKey, string> = {
  BROUILLON: "Brouillon",
  SOUMIS: "En attente de validation",
  A_CORRIGER: "À corriger",
  PUBLIE: "Publié",
  RETIRE: "Retiré du site",
};

export const CONTENT_STATUS_COLORS: Record<ContentStatusKey, "gray" | "blue" | "orange" | "green" | "red"> = {
  BROUILLON: "gray",
  SOUMIS: "blue",
  A_CORRIGER: "orange",
  PUBLIE: "green",
  RETIRE: "red",
};

/** Statuts dans lesquels l'auteur peut modifier son contenu. */
export const EDITABLE_STATUSES: readonly ContentStatusKey[] = ["BROUILLON", "A_CORRIGER", "RETIRE"];

export const CONTENT_LIMITS = {
  title: 120,
  summary: 300,
  body: 40_000,
  alt: 200,
  // Image envoyée (déjà réduite dans le navigateur) et PDF : sous la limite
  // de corps de requête de Vercel (4,5 Mo).
  uploadBytes: 4 * 1024 * 1024,
  imagesPerContent: 20,
  galleryPerContent: 30,
  videosPerContent: 5,
  /** Contenus « À la une » en même temps. */
  pinned: 3,
} as const;

// ---------------------------------------------------------------------------
// Catégories éditoriales. La clé est enregistrée en base : pour renommer une
// catégorie, changer le libellé, jamais la clé.

export const CONTENT_CATEGORIES = [
  { key: "vie-inspection", label: "Vie de l'Inspection" },
  { key: "inspections", label: "Inspections et pédagogie" },
  { key: "examens", label: "Examens et évaluations" },
  { key: "formations", label: "Formations" },
  { key: "evenements", label: "Événements" },
  { key: "administration", label: "Avis administratifs" },
] as const;

export type ContentCategoryKey = (typeof CONTENT_CATEGORIES)[number]["key"];

export const CONTENT_CATEGORY_KEYS = CONTENT_CATEGORIES.map((c) => c.key) as [ContentCategoryKey, ...ContentCategoryKey[]];

export function categoryLabel(key: string | null | undefined): string | null {
  return CONTENT_CATEGORIES.find((c) => c.key === key)?.label ?? null;
}

// ---------------------------------------------------------------------------
// Vidéos intégrées : YouTube et Facebook uniquement, converties en adresse
// d'intégration connue (jamais une adresse libre dans une iframe).

export type VideoEmbed = { provider: "youtube" | "facebook"; url: string; embedUrl: string };

export function parseVideoLink(raw: string): VideoEmbed | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const id = /^[\w-]{11}$/;

  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") yt = u.searchParams.get("v");
    else yt = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1] ?? null;
  }
  if (yt && id.test(yt)) {
    return { provider: "youtube", url: `https://www.youtube.com/watch?v=${yt}`, embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` };
  }

  if (host === "fb.watch" || host === "facebook.com") {
    const isVideo = host === "fb.watch" || /\/(videos|reel|watch)(?:\/|$)/.test(u.pathname) || u.pathname === "/watch/";
    if (!isVideo) return null;
    const clean = `https://${host === "fb.watch" ? "fb.watch" : "www.facebook.com"}${u.pathname}${u.searchParams.get("v") ? `?v=${encodeURIComponent(u.searchParams.get("v")!)}` : ""}`;
    return {
      provider: "facebook",
      url: clean,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(clean)}&show_text=false`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dates saisies dans les formulaires : heure de Goma (UTC+2, sans heure d'été).

const GOMA_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Valeur d'un champ datetime-local (heure de Goma) vers une date, ou null. */
export function parseGomaDateTime(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+02:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date vers la valeur d'un champ datetime-local en heure de Goma. */
export function toGomaInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(new Date(date).getTime() + GOMA_OFFSET_MS).toISOString().slice(0, 16);
}

/** Un contenu PUBLIE dont la date de mise en ligne est future est « programmé ». */
export function isScheduled(status: string, publishedAt: Date | string | null | undefined, now = new Date()): boolean {
  return status === "PUBLIE" && !!publishedAt && new Date(publishedAt).getTime() > now.getTime();
}

/** Adresse publique lisible à partir du titre (sans accents ni ponctuation). */
export function slugify(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "contenu"
  );
}
