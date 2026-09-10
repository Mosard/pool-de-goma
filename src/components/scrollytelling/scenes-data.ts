// 9 scènes du storyboard fourni : RDC -> vision nationale -> Inspection ->
// IPP Nord-Kivu 1 -> inspecteurs -> enseignants -> élèves -> conclusion.
// `start`/`end` sont des positions de progression (0-1) sur la séquence
// pinnée ; les textes sont l'intention éditoriale du storyboard, pas ses
// phrases mot pour mot (sauf "IPP Nord-Kivu 1").

export type SceneKind = "map" | "video";

export type Scene = {
  id: string;
  kind: SceneKind;
  eyebrow: string;
  title: string;
  body: string;
  start: number;
  end: number;
  videoId?: string;
};

export const SCENES: Scene[] = [
  {
    id: "scene-1",
    kind: "map",
    eyebrow: "01",
    title: "Une nouvelle ère numérique",
    body: "La République Démocratique du Congo entre progressivement dans la transformation numérique.",
    start: 0,
    end: 0.12,
  },
  {
    id: "scene-2",
    kind: "map",
    eyebrow: "02",
    title: "Un réseau qui s'éveille",
    body: "Un maillage numérique se dessine progressivement à travers le pays.",
    start: 0.12,
    end: 0.24,
  },
  {
    id: "scene-3",
    kind: "map",
    eyebrow: "03",
    title: "Une vision nationale",
    body: "L'impulsion part d'abord de l'Inspection, au niveau national.",
    start: 0.24,
    end: 0.34,
  },
  {
    id: "scene-4",
    kind: "map",
    eyebrow: "04",
    title: "IPP Nord-Kivu 1",
    body: "La vision nationale est reprise et appliquée au niveau provincial.",
    start: 0.34,
    end: 0.46,
  },
  {
    id: "scene-5",
    kind: "map",
    eyebrow: "05",
    title: "Un relais provincial",
    body: "L'Inspection transmet la transformation numérique à travers tout le système éducatif.",
    start: 0.46,
    end: 0.54,
  },
  {
    id: "scene-6",
    kind: "video",
    eyebrow: "06",
    title: "Former les inspecteurs",
    body: "La formation numérique des inspecteurs itinérants — premier relais humain.",
    start: 0.54,
    end: 0.68,
    videoId: "nXDotxUYpHU",
  },
  {
    id: "scene-7",
    kind: "video",
    eyebrow: "07",
    title: "Accompagner les enseignants",
    body: "Rentrée scolaire 2026-2027 : rigueur numérique et formation des enseignants.",
    start: 0.68,
    end: 0.82,
    videoId: "SufOnpVGKtk",
  },
  {
    id: "scene-8",
    kind: "map",
    eyebrow: "08",
    title: "Préparer les élèves",
    body: "La technologie, encadrée, mise au service de l'apprentissage.",
    start: 0.82,
    end: 0.92,
  },
  {
    id: "scene-9",
    kind: "map",
    eyebrow: "09",
    title: "Une inspection connectée",
    body: "Une éducation tournée vers l'avenir, du niveau national jusqu'à l'élève.",
    start: 0.92,
    end: 1,
  },
];
