// Module III — Formation en cours d'emploi (F). Définition v1 de F1, libellés
// repris mot pour mot de la fiche (docs/inventaire-fiches-inspection.md, § 5.15).
//
// F1 version 2 : la version 1 du code « F1 » est la fiche simulée
// « Contrôle financier (provisoire) », conservée telle quelle en base pour
// que ses rapports restent lisibles (décision Q7, § 10).

import type { FicheDef } from "@/lib/fiches/types";
import { ETABLISSEMENT, choice, date, number, signature, textarea, text } from "@/lib/fiches/defs/commun";

const AUTRE = "Autre";

export const F1: FicheDef = {
  format: 2,
  code: "F1",
  version: 2,
  title: "ACTION DE FORMATION",
  module: "F",
  scope: "visite",
  source: "F1_EDU_NC.pdf",
  levels: true,
  destinataires: ["Intéressé", "Etablissement", "IPP", "Pool", "Proved", "Gestionnaire", "A.T./Bourgm.", "Secteur", "Classement"],
  header: [{ ...ETABLISSEMENT, required: false }],
  instanceLabel: "5",
  sections: [
    {
      id: "1",
      title: "1. Nature",
      blocks: [
        choice(
          "1.nature",
          "1. Nature",
          ["Exposé", "Conférence pédagogique", "Séance d'animation pédagogique", "Journées pédagogiques", "Séminaire de sensibilisation", "Séminaire de formation", AUTRE],
          { required: true }
        ),
        text("1.autre", "Autre (préciser)", { showIf: { field: "1.nature", equals: AUTRE }, required: true }),
        choice("1.rythme", "Intensif / Extensif", ["Intensif", "Extensif"]),
      ],
    },
    {
      id: "2",
      title: "2. Modalités",
      blocks: [
        date("2.1.du", "2.1. Date(s) : du", { required: true }),
        date("2.1.au", "2.1. Date(s) : au"),
        number("2.2.heures", "2.2. Durée : Heure (s)"),
        number("2.2.jours", "2.2. Durée : Jour (s)"),
        number("2.3.operateurs", "2.3. Participation : Opérateurs pédagogiques"),
        number("2.3.etablissements", "2.3. Participation : Etablissement (s)"),
        number("2.3.services", "2.3. Participation : Service (s)"),
      ],
    },
    {
      id: "3",
      title: "3. à 11.",
      blocks: [
        textarea("3", "3. Initiative"),
        textarea("4", "4. Collaboration"),
        textarea("5", "5. Sujet / Thème", { required: true }),
        textarea("6", "6. Objectif(s)", { required: true }),
        textarea("7", "7. Méthodes et techniques (stratégies)"),
        textarea("8", "8. Moyens de formation mis en œuvre"),
        textarea("9", "9. Bilan"),
        textarea("10", "10. Contrôle du suivi"),
        textarea("11", "11. Suggestions"),
      ],
    },
    {
      id: "12",
      title: "11. TABLEAU DE PARTICIPATION",
      blocks: [
        {
          kind: "table",
          id: "participation.etablissements",
          label: "Etablissement (s) ou Service (s)",
          columns: [
            { id: "nom", label: "Nom", type: "text" },
            { id: "adresse", label: "Adresse locale, postale ou N° téléphonique", type: "text" },
          ],
        },
        {
          kind: "table",
          id: "participation.personnes",
          label: "Personne (s)",
          columns: [
            { id: "nom", label: "Nom et postnom", type: "text" },
            { id: "sexe", label: "Sexe", type: "choice", options: ["M", "F"] },
            { id: "fonction", label: "Fonction", type: "text" },
            { id: "titre", label: "Titre", type: "text" },
            { id: "classe", label: "Classe (maternel et primaire ; neutraliser au secondaire)", type: "text" },
            { id: "telephone", label: "Téléphone", type: "text" },
            { id: "signature", label: "Signature", type: "signature" },
          ],
        },
      ],
    },
    {
      id: "sig",
      title: "Signatures",
      blocks: [
        signature("sig.ce", "Nom et signature du C.E."),
        signature("sig.associes", "Nom et signature du (des) Facilitateur (s) Associé(s)"),
        signature("sig.inspecteur", "Nom et signature du facilitateur Principal", { required: true }),
      ],
    },
  ],
};
