"use client";

import { useState } from "react";
import { clsx } from "clsx";

export function VideoWindow({
  videoId,
  active,
  progress,
}: {
  videoId: string;
  active: boolean;
  progress: number;
}) {
  const [muted, setMuted] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Montage paresseux, irréversible : une fois la scène active, l'iframe reste
  // montée (pas de démontage au scroll suivant) pour éviter de relancer la
  // vidéo. Ajustement fait pendant le rendu plutôt que dans un effet — la
  // condition devient fausse dès que `mounted` passe à true, donc pas de
  // boucle de rendu.
  if (active && !mounted) setMounted(true);

  const scale = active ? 0.55 + Math.min(Math.max(progress, 0), 1) * 0.45 : 0.55;

  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-700",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className="relative aspect-video w-[90%] max-w-3xl overflow-hidden rounded-2xl shadow-[0_0_60px_rgba(37,99,235,0.35)] ring-1 ring-blue-400/30 transition-transform duration-700"
        style={{ transform: `scale(${scale})` }}
      >
        {mounted && (
          <iframe
            className="pointer-events-auto h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoId}&controls=1&rel=0&modestbranding=1`}
            title="Vidéo institutionnelle IPP Nord-Kivu 1"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
        {mounted && muted && (
          <button
            type="button"
            onClick={() => setMuted(false)}
            className="pointer-events-auto absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80"
          >
            Activer le son
          </button>
        )}
      </div>
    </div>
  );
}
