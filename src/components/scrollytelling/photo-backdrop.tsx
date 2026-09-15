"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Image from "next/image";
import { VISUAL_SEGMENTS } from "./visuals-data";

export type PhotoBackdropHandle = {
  setProgress: (p: number) => void;
};

// Largeur de la zone de fondu enchaîné entre deux visuels consécutifs,
// exprimée en fraction de la progression globale (0-1) de la séquence
// pinnée. La référence d'animation enchaîne des sections indépendantes
// (coupure nette au changement de section) ; ici tout se joue sur un seul
// fond continu, donc un court fondu croisé remplace la coupure pour éviter
// un "pop" visible pendant un scroll lent.
const BLEND = 0.02;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Amplitude du zoom/pan par type de visuel, reprise de la référence :
// - "map" : zoom marqué avec un travelling diagonal (carte de territoire).
// - "kb-slow" : zoom discret, sans travelling (paire d'images côte à côte).
// - "kb" : zoom modéré avec une légère dérive verticale.
function transformFor(kind: (typeof VISUAL_SEGMENTS)[number]["kind"], local: number) {
  if (kind === "map") {
    return {
      scale: lerp(1.05, 1.55, local),
      xPercent: lerp(2, -16, local),
      yPercent: lerp(-2, -6, local),
    };
  }
  if (kind === "kb-slow") {
    return { scale: lerp(1.03, 1.16, local), xPercent: 0, yPercent: 0 };
  }
  return { scale: lerp(1.0, 1.14, local), xPercent: 0, yPercent: lerp(-1, 1, local) };
}

export const PhotoBackdrop = forwardRef<PhotoBackdropHandle>(function PhotoBackdrop(_props, ref) {
  const progressRef = useRef(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imageRefs = useRef<(HTMLDivElement | null)[][]>(VISUAL_SEGMENTS.map(() => []));
  const markerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setProgress: (p: number) => {
      progressRef.current = p;
    },
  }));

  useEffect(() => {
    let raf = 0;
    let running = true;

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const p = progressRef.current;

      VISUAL_SEGMENTS.forEach((segment, i) => {
        let opacity = 1;
        if (i > 0) opacity *= smoothstep(segment.start - BLEND, segment.start + BLEND, p);
        if (i < VISUAL_SEGMENTS.length - 1) opacity *= 1 - smoothstep(segment.end - BLEND, segment.end + BLEND, p);
        opacity = clamp01(opacity);

        const wrapper = segmentRefs.current[i];
        if (wrapper) wrapper.style.opacity = String(opacity);

        const local = clamp01((p - segment.start) / Math.max(segment.end - segment.start, 1e-6));
        const { scale, xPercent, yPercent } = transformFor(segment.kind, local);
        imageRefs.current[i]?.forEach((el) => {
          if (el) el.style.transform = `scale(${scale}) translate(${xPercent}%, ${yPercent}%)`;
        });

        if (segment.marker && markerRef.current) {
          markerRef.current.style.opacity = String(smoothstep(0, 0.35, local));
        }
      });
    }
    frame();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050a0f]">
      {VISUAL_SEGMENTS.map((segment, i) => (
        <div
          key={segment.id}
          ref={(el) => {
            segmentRefs.current[i] = el;
          }}
          className="absolute inset-0"
        >
          {segment.images.map((src, j) => (
            <div
              key={src}
              ref={(el) => {
                imageRefs.current[i][j] = el;
              }}
              className="absolute inset-y-0"
              style={{
                left: segment.images.length > 1 ? `${(100 / segment.images.length) * j}%` : 0,
                width: segment.images.length > 1 ? `${100 / segment.images.length}%` : "100%",
                willChange: "transform",
                transformOrigin: "50% 50%",
              }}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                style={{ filter: "saturate(0.94) contrast(1.03)" }}
                priority={i === 0}
              />
            </div>
          ))}
          {segment.images.length > 1 && (
            <div className="absolute inset-y-0 left-1/2 z-[3] w-px bg-white/30" />
          )}
          {segment.marker && (
            <div
              ref={markerRef}
              className="absolute z-[3] flex items-center gap-2"
              style={{ left: "79%", top: "36%", opacity: 0 }}
            >
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-warning)] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full border-[1.5px] border-[var(--color-warning)]" />
              </span>
              <span className="whitespace-nowrap text-xs tracking-[0.12em] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
                Nord-Kivu
              </span>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                "linear-gradient(to top, rgba(5,8,11,0.45) 0%, rgba(5,8,11,0.12) 26%, rgba(5,8,11,0) 55%)," +
                "linear-gradient(to bottom, rgba(5,8,11,0.3) 0%, rgba(5,8,11,0) 22%)," +
                "radial-gradient(120% 100% at 50% 50%, rgba(5,8,11,0) 55%, rgba(5,8,11,0.28) 100%)",
            }}
          />
        </div>
      ))}
    </div>
  );
});
