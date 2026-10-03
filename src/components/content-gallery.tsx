"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryView = { id: string; alt: string | null }[];

/**
 * Photos d'album : grille de vignettes, agrandissement au clic avec
 * navigation (flèches, clavier, glissement sur téléphone).
 */
export function ContentGallery({ photos }: { photos: GalleryView }) {
  const [open, setOpen] = useState<number | null>(null);
  const [touchX, setTouchX] = useState<number | null>(null);
  const count = photos.length;

  const go = useCallback((delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count)), [count]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, go]);

  if (count === 0) return null;
  const current = open === null ? null : photos[open];

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group block w-full overflow-hidden rounded-xl bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Agrandir la photo ${i + 1}${p.alt ? ` : ${p.alt}` : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- image servie par /medias, déjà compressée */}
              <img
                src={`/medias/${p.id}`}
                alt={p.alt ?? ""}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo agrandie"
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
            <span>
              {open + 1} / {count}
            </span>
            <button type="button" aria-label="Fermer" className="rounded-full p-2 hover:bg-white/10" onClick={() => setOpen(null)}>
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            {/* eslint-disable-next-line @next/next/no-img-element -- image servie par /medias */}
            <img
              src={`/medias/${current.id}`}
              alt={current.alt ?? ""}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Photo précédente"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(-1);
                  }}
                  className="absolute left-2 hidden rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:block"
                >
                  <ChevronLeft size={24} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Photo suivante"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(1);
                  }}
                  className="absolute right-2 hidden rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:block"
                >
                  <ChevronRight size={24} aria-hidden />
                </button>
              </>
            )}
          </div>
          <p className="min-h-[3.5rem] px-6 py-4 text-center text-sm text-white/85">{current.alt}</p>
        </div>
      )}
    </>
  );
}
