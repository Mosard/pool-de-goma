"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

// Séquence cinématographique du Hero : extérieur du bâtiment de l'IPP ->
// approche lente de l'entrée -> transition (flou + fondu) -> intérieur du
// bureau de l'IPP, en boucle très douce. Deux photos réelles superposées,
// zoomées via transform-origin (jamais de recadrage qui déforme ou coupe un
// visage) — pas de vidéo générée, pas de dépendance ajoutée : uniquement
// GSAP, déjà utilisé ailleurs dans le projet.
export function HeroSequence() {
  const exteriorRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const exterior = exteriorRef.current;
    const interior = interiorRef.current;
    if (!exterior || !interior) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(exterior, { opacity: 1 });
      gsap.set(interior, { opacity: 0 });
      return;
    }

    const isSmall = window.matchMedia("(max-width: 640px)").matches;
    const exteriorScale = isSmall ? 1.07 : 1.13;
    const interiorScale = isSmall ? 1.06 : 1.1;

    const ctx = gsap.context(() => {
      gsap.set(exterior, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" });
      gsap.set(interior, { opacity: 0, scale: 1.02, y: 0, filter: "blur(0px)" });

      const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power1.inOut" } });

      // Plan 1 — extérieur : zoom très lent et fluide dirigé vers l'entrée
      // (transform-origin placé sur la porte, cf. className), avec une
      // légère translation vers l'avant.
      tl.to(exterior, { scale: exteriorScale, y: -8, duration: 6 });

      // Plan 2 — passage vers l'intérieur : flou bref puis net, fondu croisé.
      tl.to(exterior, { filter: "blur(10px)", duration: 0.6 }, ">-0.2");
      tl.to(interior, { filter: "blur(10px)", opacity: 1, duration: 0.6 }, "<");
      tl.to([exterior, interior], { filter: "blur(0px)", duration: 0.7 }, ">-0.1");
      tl.to(exterior, { opacity: 0, duration: 0.01 }, "<");

      // Plan 3 — intérieur : très léger push-in, l'IPP reste le sujet.
      tl.to(interior, { scale: interiorScale, y: -6, duration: 4.5 });

      // Tenue sur le plan final avant la boucle.
      tl.to({}, { duration: 1 });

      // Retour en douceur vers l'état de départ (aucun saut à la boucle).
      tl.to(interior, { filter: "blur(10px)", duration: 0.6 }, ">");
      tl.to(exterior, { filter: "blur(10px)", opacity: 1, scale: 1, y: 0, duration: 0.6 }, "<");
      tl.to([exterior, interior], { filter: "blur(0px)", duration: 0.7 }, ">-0.1");
      tl.set(interior, { opacity: 0, scale: 1.02, y: 0 });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--color-navy)]">
      <div
        ref={exteriorRef}
        className="absolute inset-0"
        style={{ transformOrigin: "55% 58%", willChange: "transform, opacity, filter" }}
      >
        <Image
          src="/homepage/bureau-ippnk1.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "55% 58%" }}
        />
      </div>
      <div
        ref={interiorRef}
        className="absolute inset-0"
        style={{ transformOrigin: "32% 48%", willChange: "transform, opacity, filter" }}
      >
        <Image
          src="/homepage/interieur-bureau-ipp.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "32% 48%" }}
        />
      </div>
      {/* Légère assombrissement, concentré derrière le texte, pas un voile
          uniforme — le fond doit rester lisible. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/35" />
    </div>
  );
}
