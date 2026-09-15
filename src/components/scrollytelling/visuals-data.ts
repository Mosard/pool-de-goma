import { SCENES } from "./scenes-data";

// Les six visuels photographiques du storyboard IPP Nord-Kivu 1 (carte,
// conférence, IPP, formation, enseignants, élèves), avec l'ordre, les
// transitions et le style de zoom (Ken Burns) repris d'une référence
// d'animation fournie séparément — appliqués ici au fond de la séquence
// existante, sans toucher aux textes ni aux scènes vidéo déjà en place.
// `start`/`end` sont dérivés des bornes de `SCENES` pour rester synchronisés
// avec la timeline narrative (0-1 sur la séquence pinnée).

export type VisualKind = "map" | "kb" | "kb-slow";

export type VisualSegment = {
  id: string;
  kind: VisualKind;
  images: string[];
  start: number;
  end: number;
  marker?: boolean;
};

export const VISUAL_SEGMENTS: VisualSegment[] = [
  {
    id: "carte",
    kind: "map",
    images: ["/scrollytelling/carte.png"],
    start: SCENES[0].start,
    end: SCENES[1].end,
    marker: true,
  },
  {
    id: "conference",
    kind: "kb",
    images: ["/scrollytelling/conference.jpg"],
    start: SCENES[2].start,
    end: SCENES[2].end,
  },
  {
    id: "ipp",
    kind: "kb",
    images: ["/scrollytelling/ipp.png"],
    start: SCENES[3].start,
    end: SCENES[4].end,
  },
  {
    id: "formation",
    kind: "kb-slow",
    images: ["/scrollytelling/formation-1.jpg", "/scrollytelling/formation-2.jpg"],
    start: SCENES[5].start,
    end: SCENES[5].end,
  },
  {
    id: "enseignants",
    kind: "kb",
    images: ["/scrollytelling/enseignants.jpg"],
    start: SCENES[6].start,
    end: SCENES[6].end,
  },
  {
    id: "eleves",
    kind: "kb",
    images: ["/scrollytelling/eleves.jpg"],
    start: SCENES[7].start,
    end: SCENES[8].end,
  },
];
