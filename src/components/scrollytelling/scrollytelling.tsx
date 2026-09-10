"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SCENES } from "./scenes-data";

export function Scrollytelling() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const scenes = containerRef.current?.querySelectorAll<HTMLElement>("[data-scene]");
      scenes?.forEach((scene) => {
        if (prefersReducedMotion) {
          gsap.set(scene, { opacity: 1, y: 0 });
          return;
        }
        gsap.fromTo(
          scene,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: scene,
              start: "top 75%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative bg-[var(--color-navy)] py-20 text-white">
      <div className="mx-auto max-w-3xl space-y-32 px-6">
        {SCENES.map((scene) => (
          <div key={scene.id} data-scene className="flex min-h-[40vh] flex-col justify-center opacity-0">
            {/* Point d'ancrage pour le futur visuel (carte 3D RDC / vidéo) — placeholder sobre en attendant les assets réels. */}
            <div className="mb-6 h-1 w-16 rounded-full bg-blue-500" />
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-300">{scene.eyebrow}</p>
            <h3 className="text-2xl font-bold sm:text-3xl">{scene.title}</h3>
            <p className="mt-3 max-w-xl text-sm text-gray-300 sm:text-base">{scene.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
