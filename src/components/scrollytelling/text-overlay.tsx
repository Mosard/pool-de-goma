"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import type { Scene } from "./scenes-data";

export function TextOverlay({ scene, dimmed }: { scene: Scene; dimmed: boolean }) {
  const [displayed, setDisplayed] = useState(scene);
  const [punched, setPunched] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // À chaque changement de scène (même d'une scène "carte" à une autre), on
  // repousse explicitement le texte hors champ — immédiatement, pendant le
  // rendu — puis on le fait revenir avec le nouveau contenu après un court
  // délai : un simple fondu était trop discret pour que le changement de
  // scène soit perçu (retour utilisateur).
  if (scene.id !== displayed.id && punched) {
    setPunched(false);
  }

  useEffect(() => {
    if (scene.id === displayed.id) return;
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
          punched ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        )}
      >
        <p className="mb-4 text-base font-bold uppercase tracking-[0.3em] text-blue-300 [text-shadow:0_1px_12px_rgba(0,0,0,0.8)] sm:text-lg">{displayed.eyebrow}</p>
        <h3 className="max-w-3xl text-6xl font-bold text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.85),0_1px_4px_rgba(0,0,0,0.9)] sm:text-7xl">{displayed.title}</h3>
        <p className="mt-5 max-w-xl text-xl text-gray-200 [text-shadow:0_1px_12px_rgba(0,0,0,0.8)] sm:text-2xl">{displayed.body}</p>
      </div>
    </div>
  );
}
