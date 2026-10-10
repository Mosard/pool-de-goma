// Journal d'audit sans contenu sensible : on consigne QUELS champs ont changé,
// jamais leurs valeurs (décisions du 2026-10-10). Fonction pure, testée.

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : false;
  }
  return a === b;
}

/** Noms des champs de `after` dont la valeur diffère de `before` (ordre de `after`). */
export function changedFieldNames(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((k) => !same(before[k] ?? null, after[k] ?? null));
}
