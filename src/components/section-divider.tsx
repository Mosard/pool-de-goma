// Petit repère visuel entre deux sections pour adoucir un grand espace
// vide — une ligne fine avec un reflet qui balaie doucement, sans JS
// (animation CSS pure, déjà coupée par la règle prefers-reduced-motion
// globale dans globals.css).
export function SectionDivider() {
  return (
    <div aria-hidden className="flex justify-center bg-gray-50 py-8">
      <div className="relative h-px w-24 overflow-hidden rounded-full bg-gray-200">
        <div className="absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-400 to-transparent [animation:divider-sweep_4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
