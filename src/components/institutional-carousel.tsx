"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui";

// Contenu de démonstration — remplacé par du vrai contenu éditorial une fois
// le back-office (actualités/communiqués) construit.
const SLIDES = [
  { title: "Rentrée scolaire 2026-2027", body: "Lancement de la rentrée sous le signe de la rigueur numérique." },
  { title: "Formation des inspecteurs", body: "Accompagnement numérique des inspecteurs itinérants." },
  { title: "Transformation numérique", body: "Une administration qui se modernise, du national au provincial." },
  { title: "Communiqués", body: "Informations officielles de l'Inspection Principale Provinciale." },
];

export function InstitutionalCarousel() {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const go = (delta: number) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  return (
    <div className="relative">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Contenu de démonstration — en attente des actualités réelles
      </p>
      <div
        className="overflow-hidden"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 40) go(delta > 0 ? -1 : 1);
          touchStartX.current = null;
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide, i) => (
            <div key={i} className="w-full shrink-0 px-1">
              <Card>
                <h3 className="text-base font-semibold text-gray-900">{slide.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{slide.body}</p>
              </Card>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Diapositive précédente"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Aller à la diapositive ${i + 1}`}
              className={clsx("h-2 w-2 rounded-full", i === index ? "bg-blue-600" : "bg-gray-200")}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Diapositive suivante"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
