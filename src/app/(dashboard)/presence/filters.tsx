import { Button, Input, Select } from "@/components/ui";

// Filtres (formulaire GET). Les options proviennent du périmètre du lecteur ;
// toute valeur reçue est de toute façon revérifiée côté serveur.

type Options = { cells: { id: string; code: string; name: string }[]; pools: { id: string; name: string }[]; sites: string[] };
type Values = { date?: string; from?: string; to?: string; cellId?: string; poolId?: string; site?: string; userId?: string };

export function PresenceFiltersForm({
  options,
  values,
  mode,
  agents = [],
}: {
  options: Options;
  values: Values;
  mode: "day" | "period";
  agents?: { id: string; name: string }[];
}) {
  return (
    <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
      {mode === "day" ? (
        <label className="text-sm text-gray-700">
          Date
          <Input type="date" name="date" defaultValue={values.date} className="mt-1" />
        </label>
      ) : (
        <>
          <label className="text-sm text-gray-700">
            Du
            <Input type="date" name="from" defaultValue={values.from} className="mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Au
            <Input type="date" name="to" defaultValue={values.to} className="mt-1" />
          </label>
        </>
      )}
      {options.cells.length > 0 && (
        <label className="text-sm text-gray-700">
          Cellule
          <Select name="cellId" defaultValue={values.cellId ?? ""} className="mt-1">
            <option value="">Toutes</option>
            {options.cells.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {options.pools.length > 0 && (
        <label className="text-sm text-gray-700">
          POOL
          <Select name="poolId" defaultValue={values.poolId ?? ""} className="mt-1">
            <option value="">Tous</option>
            {options.pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {options.sites.length > 0 && (
        <label className="text-sm text-gray-700">
          Bureau
          <Select name="site" defaultValue={values.site ?? ""} className="mt-1">
            <option value="">Tous</option>
            {options.sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
      )}
      {mode === "period" && agents.length > 0 && (
        <label className="text-sm text-gray-700">
          Agent
          <Select name="userId" defaultValue={values.userId ?? ""} className="mt-1">
            <option value="">Tous</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <Button type="submit" variant="ghost">
        Filtrer
      </Button>
    </form>
  );
}
