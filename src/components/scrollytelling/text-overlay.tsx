import { clsx } from "clsx";
import type { Scene } from "./scenes-data";

export function TextOverlay({ scene, visible }: { scene: Scene; visible: boolean }) {
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 bottom-14 flex flex-col items-center px-6 text-center transition-opacity duration-700 sm:bottom-20",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">{scene.eyebrow}</p>
      <h3 className="max-w-xl text-2xl font-bold text-white sm:text-3xl">{scene.title}</h3>
      <p className="mt-2 max-w-md text-sm text-gray-300">{scene.body}</p>
    </div>
  );
}
