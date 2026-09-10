import * as THREE from "three";

// Silhouette simplifiée et stylisée de la RDC (PAS un tracé cartographique
// précis) — juste assez de points pour être reconnaissable dans une scène
// 3D institutionnelle : bande côtière atlantique à l'ouest, masse centrale,
// "pédoncule" du Katanga au sud, bordure orientale ondulée vers les Grands
// Lacs. Coordonnées brutes arbitraires, normalisées par `buildRdcGeometry`.
const RAW_POINTS: [number, number][] = [
  [2, 52], [2, 48], [8, 46], [6, 40], [10, 20], [25, 8], [45, 5], [60, 10],
  [68, 5], [75, 15], [80, 25], [85, 35], [88, 45], [82, 55], [78, 62],
  [70, 68], [50, 72], [30, 68], [15, 60],
];

// Repères approximatifs dans le même espace brut, utilisés pour animer la
// caméra / les points lumineux (pas des coordonnées géographiques réelles).
const RAW_KINSHASA: [number, number] = [6, 45];
const RAW_NORD_KIVU: [number, number] = [87, 46];

function bounds(points: [number, number][]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function normalize(point: [number, number], b: ReturnType<typeof bounds>, targetWidth: number) {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const scale = targetWidth / (b.maxX - b.minX);
  return new THREE.Vector2((point[0] - cx) * scale, (point[1] - cy) * scale);
}

export type RdcModel = {
  geometry: THREE.ExtrudeGeometry;
  kinshasa: THREE.Vector2;
  nordKivu: THREE.Vector2;
};

export function buildRdcModel(targetWidth = 2.6): RdcModel {
  const b = bounds(RAW_POINTS);
  const points = RAW_POINTS.map((p) => normalize(p, b, targetWidth));
  const shape = new THREE.Shape(points);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
    curveSegments: 2,
  });
  geometry.center();

  return {
    geometry,
    kinshasa: normalize(RAW_KINSHASA, b, targetWidth),
    nordKivu: normalize(RAW_NORD_KIVU, b, targetWidth),
  };
}
