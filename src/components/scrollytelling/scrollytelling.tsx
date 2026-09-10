"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SCENES, type Scene } from "./scenes-data";
import { TextOverlay } from "./text-overlay";
import { VideoWindow } from "./video-window";
import type { Map3DStageHandle } from "./map-3d-stage";

const Map3DStage = dynamic(() => import("./map-3d-stage").then((m) => m.Map3DStage), { ssr: false });

function findActiveScene(progress: number): Scene {
  return SCENES.find((s) => progress >= s.start && progress < s.end) ?? SCENES[SCENES.length - 1];
}

export function Scrollytelling() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Map3DStageHandle>(null);
  const [mode, setMode] = useState<"fallback" | "immersive">("fallback");
  const [activeScene, setActiveScene] = useState<Scene>(SCENES[0]);
  const [sceneLocalProgress, setSceneLocalProgress] = useState(0);

  // Étape 1 : uniquement décider du mode (desktop + mouvement autorisé, ou
  // repli). gsap.matchMedia réévalue automatiquement si l'utilisateur
  // redimensionne la fenêtre ou change sa préférence de mouvement.
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      setMode("immersive");
      return () => setMode("fallback");
    });
    return () => mm.revert();
  }, []);

  // Étape 2 : ne créer le pin GSAP qu'APRÈS que React ait effectivement
  // rendu l'arbre "immersive" (donc que wrapperRef/pinRef pointent vers de
  // vrais éléments) — sinon ScrollTrigger s'accroche à des refs encore
  // nulles (celles de l'arbre "fallback" affiché au premier rendu) et le
  // pin ne s'active jamais, laissant un grand vide vide au scroll.
  useEffect(() => {
    if (mode !== "immersive") return;

    gsap.registerPlugin(ScrollTrigger);
    const pinEl = pinRef.current;
    const wrapperEl = wrapperRef.current;
    if (!pinEl || !wrapperEl) return;

    const trigger = ScrollTrigger.create({
      trigger: wrapperEl,
      start: "top top",
      end: "bottom bottom",
      pin: pinEl,
      scrub: 1,
      onUpdate: (self) => {
        stageRef.current?.setProgress(self.progress);
        const scene = findActiveScene(self.progress);
        setActiveScene((prev) => (prev.id === scene.id ? prev : scene));
        const local = (self.progress - scene.start) / Math.max(scene.end - scene.start, 1e-6);
        setSceneLocalProgress(local);
      },
    });

    return () => trigger.kill();
  }, [mode]);

  if (mode === "fallback") {
    return <FallbackScrollytelling />;
  }

  return (
    <div ref={wrapperRef} className="relative h-[800vh]">
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden bg-[var(--color-navy)]">
        <Map3DStage ref={stageRef} />
        {activeScene.kind === "video" && activeScene.videoId && (
          <VideoWindow videoId={activeScene.videoId} active progress={sceneLocalProgress} />
        )}
        <TextOverlay scene={activeScene} visible={activeScene.kind === "map"} />
      </div>
    </div>
  );
}

// Repli mobile / prefers-reduced-motion : pas de pin, pas de WebGL — chaque
// scène apparaît simplement en fondu au scroll, comme la version précédente.
// Les scènes vidéo affichent une miniature YouTube cliquable plutôt qu'un
// lecteur embarqué, pour rester léger.
function FallbackScrollytelling() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const items = containerRef.current?.querySelectorAll<HTMLElement>("[data-scene]");
      items?.forEach((el) => {
        if (prefersReducedMotion) {
          gsap.set(el, { opacity: 1, y: 0 });
          return;
        }
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none reverse" },
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="bg-[var(--color-navy)] py-16 text-white">
      <div className="mx-auto max-w-2xl space-y-20 px-6">
        {SCENES.map((scene) => (
          <div key={scene.id} data-scene className="opacity-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">{scene.eyebrow}</p>
            <h3 className="text-xl font-bold sm:text-2xl">{scene.title}</h3>
            <p className="mt-2 text-sm text-gray-300">{scene.body}</p>
            {scene.kind === "video" && scene.videoId && (
              <a
                href={`https://www.youtube.com/watch?v=${scene.videoId}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex aspect-video items-center justify-center rounded-xl bg-white/5 text-sm font-medium text-blue-300 ring-1 ring-white/10 hover:bg-white/10"
              >
                Voir la vidéo institutionnelle →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
