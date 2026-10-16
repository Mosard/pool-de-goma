"use server";

import { parseDiplomaCriteria, type DiplomaFieldErrors } from "@/lib/diplomes/criteria";
import { searchDiplomas } from "@/lib/diplomes/search";
import { isStatePreviewAllowed, previewOutcome } from "@/lib/diplomes/apercu";
import type { DiplomaSearchOutcome } from "@/lib/diplomes/types";

export type DiplomaSearchState = {
  errors?: DiplomaFieldErrors;
  outcome?: DiplomaSearchOutcome;
  /** Compteur de recherches : permet au formulaire de replacer le focus sur chaque nouvelle réponse. */
  attempt?: number;
};

export async function searchDiplomaAction(prev: DiplomaSearchState, formData: FormData): Promise<DiplomaSearchState> {
  const attempt = (prev.attempt ?? 0) + 1;

  // Champ piège invisible : rempli seulement par un robot. Réponse neutre,
  // indiscernable d'une recherche sans résultat.
  if (String(formData.get("site_web") ?? "") !== "") return { attempt, outcome: { kind: "AUCUN_RESULTAT" } };

  const parsed = parseDiplomaCriteria({
    nom: formData.get("nom") ?? undefined,
    postNom: formData.get("postNom") ?? undefined,
    prenom: formData.get("prenom") ?? undefined,
    annee: formData.get("annee") || undefined,
    etablissement: formData.get("etablissement") ?? undefined,
  });
  if (!parsed.ok) return { attempt, errors: parsed.errors };

  // Aperçu de l'interface (développement / Preview uniquement, revérifié ici) :
  // l'état fictif choisi est renvoyé sans consulter aucune donnée.
  if (isStatePreviewAllowed()) {
    const simulated = previewOutcome(formData.get("apercuEtat"));
    if (simulated) {
      await new Promise((r) => setTimeout(r, 700));
      return { attempt, outcome: simulated };
    }
  }

  // À brancher AVANT de connecter une source réelle : quota de recherches par
  // adresse IP (protection contre les recherches automatisées massives) et
  // journalisation minimale, sans conserver les critères saisis.
  return { attempt, outcome: await searchDiplomas(parsed.criteria) };
}
