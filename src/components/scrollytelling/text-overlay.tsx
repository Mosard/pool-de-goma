import { clsx } from "clsx";
import type { Scene } from "./scenes-data";

export function TextOverlay({ scene, visible }: { scene: Scene; visible: boolean }) {
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center px-6 text-center transition-all duration-700 sm:bottom-16",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 -bottom-10 top-1/2 -z-10 bg-gradient-to-t from-[var(--color-navy)] via-[var(--color-navy)]/70 to-transparent" />
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-blue-300">{scene.eyebrow}</p>
      <h3 className="max-w-2xl text-4xl font-bold text-white sm:text-5xl">{scene.title}</h3>
      <p className="mt-4 max-w-lg text-base text-gray-200 sm:text-lg">{scene.body}</p>
    </div>
  );
}
