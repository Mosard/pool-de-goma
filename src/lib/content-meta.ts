// Référentiel PUR des contenus éditoriaux (sans base) : importable par les
// composants client comme par le serveur.

export const CONTENT_KINDS = ["ACTUALITE", "ARTICLE", "COMMUNIQUE"] as const;
export type ContentKindKey = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKindKey, string> = {
  ACTUALITE: "Actualité",
  ARTICLE: "Article",
  COMMUNIQUE: "Communiqué",
};

export const CONTENT_KIND_PLURALS: Record<ContentKindKey, string> = {
  ACTUALITE: "Actualités",
  ARTICLE: "Articles",
  COMMUNIQUE: "Communiqués",
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
} as const;

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
