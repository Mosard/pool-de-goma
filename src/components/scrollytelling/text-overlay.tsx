"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import type { Scene } from "./scenes-data";

export function TextOverlay({ scene, dimmed }: { scene: Scene; dimmed: boolean }) {
  const [displayed, setDisplayed] = useState(scene);
  const [punched, setPunched] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // À chaque changement de scène (même d'une scène "carte" à une autre), on
  // repousse explicitement le texte hors champ puis on le fait revenir avec
  // le nouveau contenu — un simple fondu était trop discret pour que le
  // changement de scène soit perçu (retour utilisateur).
  useEffect(() => {
    if (scene.id === displayed.id) return;
    setPunched(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDisplayed(scene);
      setPunched(true);
    }, 260);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [scene, displayed.id]);

  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center px-6 text-center transition-opacity duration-500 sm:bottom-16",
        dimmed ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 -bottom-10 top-1/2 -z-10 bg-gradient-to-t from-[var(--color-navy)] via-[var(--color-navy)]/70 to-transparent" />
      <div
        className={clsx(
          "flex flex-col items-center transition-all duration-300 ease-out",
          punched ? "translate-y-0 scale-100 opacity-100" : "-translate-y-4 scale-95 opacity-0"
        )}
      >
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-blue-300">{displayed.eyebrow}</p>
        <h3 className="max-w-2xl text-5xl font-bold text-white sm:text-6xl">{displayed.title}</h3>
        <p className="mt-4 max-w-lg text-lg text-gray-200 sm:text-xl">{displayed.body}</p>
      </div>
    </div>
  );
}
