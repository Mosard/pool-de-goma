// Contenu provisoire du scrollytelling (§9 du design.md). Aucun asset 3D/vidéo
// acheté n'est disponible : chaque scène est un placeholder textuel sobre,
// prêt à être remplacé par la carte 3D RDC / les vidéos réelles plus tard
// sans changer la structure (voir Scene, ci-dessous, pour le point d'ancrage
// du futur visuel).

export type Scene = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
};

export const SCENES: Scene[] = [
  {
    id: "scene-1",
    eyebrow: "01 — République Démocratique du Congo",
    title: "Une transformation numérique à l'échelle nationale",
    body: "Le ministère porte une vision claire : faire entrer l'enseignement congolais dans l'ère numérique.",
  },
  {
    id: "scene-2",
    eyebrow: "02 — Réseau numérique national",
    title: "Un réseau se déploie à travers le pays",
    body: "Des circuits d'information et de formation se mettent progressivement en place.",
  },
  {
    id: "scene-3",
    eyebrow: "03 — Connexions",
    title: "Une infrastructure et une vision prennent forme",
    body: "Institutions, provinces et acteurs de terrain se relient autour d'un même objectif.",
  },
  {
    id: "scene-4",
    eyebrow: "04 — Niveau national",
    title: "L'impulsion part de l'institution",
    body: "L'Inspection principale au niveau national porte l'origine de cette transformation.",
  },
  {
    id: "scene-5",
    eyebrow: "05 — Province Éducationnelle Nord-Kivu 1",
    title: "IPP Nord-Kivu 1",
    body: "La province s'inscrit pleinement dans cette dynamique de numérisation de l'enseignement.",
  },
  {
    id: "scene-6",
    eyebrow: "06 — Formation en cascade",
    title: "De l'institution jusqu'à l'élève",
    body: "Formation des inspecteurs, puis des enseignants, puis accompagnement numérique des élèves.",
  },
  {
    id: "scene-7",
    eyebrow: "07 — Résultat",
    title: "Un environnement éducatif modernisé",
    body: "Une administration plus connectée, des enseignants formés, des élèves mieux préparés.",
  },
];
