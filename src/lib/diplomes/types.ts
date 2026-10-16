// Recherche publique des diplômes d'État (rubrique /diplomes).
//
// Ces types décrivent uniquement ce qui peut SORTIR vers le site public. Le
// modèle de données des titres scolaires (module administratif de l'IPA chargé
// des titres) n'existe pas encore : il sera conçu après analyse du fichier
// Excel du service des titres. Rien ici n'impose sa structure.
//
// RÈGLE FONDAMENTALE — rattachement ≠ localisation :
// - POOL de rattachement : POOL auquel appartient l'établissement scolaire ;
// - localisation actuelle : endroit où le diplôme se trouve RÉELLEMENT,
//   établie uniquement par les réceptions physiques et les opérations
//   administratives enregistrées (réception, transfert, retrait).
// Le rattachement d'une école à un POOL ne permet JAMAIS d'afficher une
// disponibilité dans ce POOL. Seule `currentLocation` (DiplomaSourceMatch)
// détermine le statut publié (voir toPublicStatus dans ./search.ts).

/** Coordonnées publiques d'un bureau de POOL (mêmes règles que /pools : adresse et e-mail institutionnel, aucun téléphone). */
export type PublicPoolOffice = {
  name: string;
  address: string | null;
  officialEmail: string | null;
  /** Indications de retrait saisies par l'administration ; jamais inventées. */
  pickupInstructions: string | null;
};

/** Statut publiable d'un diplôme : aucune donnée personnelle, aucun historique de transfert. */
export type PublicDiplomaStatus =
  | { status: "DISPONIBLE_IPP" }
  | { status: "DISPONIBLE_POOL"; pool: PublicPoolOffice }
  | { status: "EN_TRANSFERT" }
  | { status: "RETIRE" }
  | { status: "RETRAIT_A_CONFIRMER" };

/** Réponse d'une recherche publique. */
export type DiplomaSearchOutcome =
  /** Aucune source provinciale fiable n'est connectée (situation actuelle en production). */
  | { kind: "SERVICE_INDISPONIBLE" }
  | { kind: "TROUVE"; result: PublicDiplomaStatus }
  /** Homonymes : plusieurs dossiers correspondent, aucun détail n'est divulgué. */
  | { kind: "PLUSIEURS_CORRESPONDANCES" }
  | { kind: "AUCUN_RESULTAT" }
  | { kind: "TROP_DE_RECHERCHES" }
  | { kind: "ERREUR" };

export type DiplomaOutcomeKind = DiplomaSearchOutcome["kind"];

/** Critères saisis par le visiteur, après validation (provisoires : voir ./criteria.ts). */
export type DiplomaSearchCriteria = {
  nom: string;
  postNom: string | null;
  prenom: string;
  annee: number;
  etablissement: string;
};

/**
 * Localisation effective d'un diplôme, telle que la calculera le module
 * administratif à partir des opérations enregistrées.
 */
export type DiplomaCurrentLocation =
  | { kind: "IPP" }
  | { kind: "POOL"; office: PublicPoolOffice }
  | { kind: "EN_TRANSFERT" }
  | { kind: "RETIRE" }
  | { kind: "RETRAIT_DECLARE" };

/**
 * Dossier renvoyé par une source de données. `homePoolName` (rattachement)
 * est présent pour l'usage interne mais n'intervient JAMAIS dans le statut
 * publié ; il n'est pas transmis au site public.
 */
export type DiplomaSourceMatch = {
  homePoolName: string | null;
  currentLocation: DiplomaCurrentLocation;
};

/**
 * Contrat que devra implémenter le futur module administratif des titres.
 * La recherche doit être exacte (critères normalisés, voir normalizeName) :
 * jamais de liste, jamais de recherche partielle exposée au public.
 */
export interface DiplomaSource {
  find(criteria: DiplomaSearchCriteria): Promise<DiplomaSourceMatch[]>;
}
