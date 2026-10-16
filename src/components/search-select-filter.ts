// Filtrage des listes avec recherche (search-select.tsx) : règle pure, testée.

export type SearchOption = { value: string; label: string; hint?: string };

/** Texte comparable : sans accents, sans majuscules, espaces réduits. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chaque mot cherché doit figurer dans le libellé ou l'indication, dans n'importe quel ordre. */
export function filterOptions(options: readonly SearchOption[], query: string): SearchOption[] {
  const parts = normalizeSearch(query).split(" ").filter(Boolean);
  if (parts.length === 0) return [...options];
  return options.filter((o) => {
    const text = normalizeSearch(`${o.label} ${o.hint ?? ""}`);
    return parts.every((p) => text.includes(p));
  });
}
