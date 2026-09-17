"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

// Maquette du logiciel (photo réelle générée, laptop + tablette) présentée
// comme un objet vivant plutôt qu'une image plate : léger flottement,
// halo lumineux discret derrière, et un petit indicateur qui pulse pour
// suggérer une interface active — pas d'animation du contenu de l'image
// elle-même (c'est une photo, pas une vraie interface).
export function SoftwareMockup() {
  const floatRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const float = floatRef.current;
    const glow = glowRef.current;
    if (!float || !glow) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.to(float, {
        y: -10,
        duration: 5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(glow, {
        opacity: 0.7,
        scale: 1.06,
        duration: 6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative mx-auto max-w-2xl">
      <div
        ref={glowRef}
        aria-hidden
        className="absolute inset-x-6 inset-y-8 -z-10 rounded-[3rem] bg-blue-400/25 opacity-40 blur-3xl"
      />
      <div ref={floatRef}>
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5">
          <Image
            src="/homepage/logiciel-mockup.jpg"
            alt="Aperçu du logiciel de gestion scolaire : tableau de bord, gestion des élèves et des classes"
            fill
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
            style={{ objectPosition: "center 88%" }}
          />
          <span className="absolute right-[9%] top-[10%] flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        </div>
      </div>
    </div>
  );
}
