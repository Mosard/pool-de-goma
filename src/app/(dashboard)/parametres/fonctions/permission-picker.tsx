// Choix des permissions d'une fonction, regroupées par catégorie. Commun à la
// création et à la modification ; le serveur revérifie chaque permission donnée.

export function PermissionPicker({
  catalog,
  checked = [],
}: {
  catalog: { key: string; label: string; category: string }[];
  checked?: string[];
}) {
  const categories = Array.from(new Set(catalog.map((p) => p.category)));
  return (
    <div className="space-y-5">
      {categories.map((category) => {
        const items = catalog.filter((p) => p.category === category);
        return (
          <fieldset key={category}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {category} <span className="font-normal normal-case tracking-normal text-gray-400">· {items.length}</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((p) => (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-gray-300 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50/60 has-[:checked]:text-gray-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500"
                >
                  <input type="checkbox" name="permissionKeys" value={p.key} defaultChecked={checked.includes(p.key)} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-pretty">{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
