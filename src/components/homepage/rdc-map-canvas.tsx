"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Map3DStage, type Map3DStageHandle } from "@/components/scrollytelling/map-3d-stage";

// Réutilise la carte 3D de la RDC construite pour l'ancien scrollytelling
// (contour réel du pays, particules/lignes lumineuses, marqueur Nord-Kivu),
// mais pilotée ici par une simple oscillation continue (aller-retour doux)
// plutôt que par le scroll — il n'y a plus de scène vidéo à céder derrière
// elle, donc on s'arrête avant la portion de la courbe de progression qui
// servait à l'effacer pour cette vidéo.
const PEAK_PROGRESS = 0.46;

export function RdcMapCanvas() {
  const stageRef = useRef<Map3DStageHandle>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stageRef.current?.setProgress(PEAK_PROGRESS);
      return;
    }

    const proxy = { value: 0 };
    const tween = gsap.to(proxy, {
      value: PEAK_PROGRESS,
      duration: 12,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      onUpdate: () => stageRef.current?.setProgress(proxy.value),
    });

    return () => {
      tween.kill();
    };
  }, []);

  return <Map3DStage ref={stageRef} />;
}
