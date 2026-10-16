import type {
  DiplomaSearchCriteria,
  DiplomaSearchOutcome,
  DiplomaSource,
  DiplomaSourceMatch,
  PublicDiplomaStatus,
} from "./types";

/**
 * Source provinciale des diplômes. AUCUNE n'est connectée tant que le fichier
 * Excel du service des titres n'a pas été analysé et que le module
 * administratif de l'IPA n'existe pas : la recherche publique répond alors
 * « service prochainement disponible », sans jamais simuler de résultat.
 * Le futur module renverra ici son implémentation de DiplomaSource.
 */
export function getDiplomaSource(): DiplomaSource | null {
  return null;
}

export function isDiplomaSearchAvailable(): boolean {
  return getDiplomaSource() !== null;
}

/**
 * Statut publié = localisation EFFECTIVE uniquement. Le POOL de rattachement
 * (match.homePoolName) n'est volontairement jamais lu ici.
 */
export function toPublicStatus(match: DiplomaSourceMatch): PublicDiplomaStatus {
  const location = match.currentLocation;
  switch (location.kind) {
    case "IPP":
      return { status: "DISPONIBLE_IPP" };
    case "POOL":
      return { status: "DISPONIBLE_POOL", pool: location.office };
    case "EN_TRANSFERT":
      return { status: "EN_TRANSFERT" };
    case "RETIRE":
      return { status: "RETIRE" };
    case "RETRAIT_DECLARE":
      return { status: "RETRAIT_A_CONFIRMER" };
  }
}

/** Homonymes : plus d'un dossier → aucun détail divulgué. */
export function outcomeFromMatches(matches: DiplomaSourceMatch[]): DiplomaSearchOutcome {
  if (matches.length === 0) return { kind: "AUCUN_RESULTAT" };
  if (matches.length > 1) return { kind: "PLUSIEURS_CORRESPONDANCES" };
  return { kind: "TROUVE", result: toPublicStatus(matches[0]) };
}

export async function searchDiplomas(
  criteria: DiplomaSearchCriteria,
  source: DiplomaSource | null = getDiplomaSource()
): Promise<DiplomaSearchOutcome> {
  if (!source) return { kind: "SERVICE_INDISPONIBLE" };
  try {
    return outcomeFromMatches(await source.find(criteria));
  } catch (error) {
    console.error("[diplomes] recherche impossible", error);
    return { kind: "ERREUR" };
  }
}
