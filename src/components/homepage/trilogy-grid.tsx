"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { TrilogyPillar } from "./homepage-data";

export function TrilogyGrid({ pillars }: { pillars: TrilogyPillar[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
      {pillars.map((pillar, i) => {
        const isHovered = hovered === i;
        const isSoftened = hovered !== null && !isHovered;

        return (
          <div key={pillar.title} className="relative">
            <span
              aria-hidden
              className={clsx(
                "absolute -inset-2 -z-10 rounded-3xl bg-blue-50 transition-opacity duration-300 ease-out",
                isHovered ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={clsx(
                "flex h-full flex-col items-center rounded-2xl border bg-white/80 p-6 text-center transition-all duration-300 ease-out",
                isHovered && "scale-[1.03] border-gray-200 shadow-md",
                isSoftened && "scale-[0.98] border-gray-100 opacity-70",
                !isHovered && !isSoftened && "border-gray-200 shadow-sm"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                {pillar.number}
              </span>
              <h3 className="mt-5 text-base font-bold text-gray-900">{pillar.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{pillar.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
