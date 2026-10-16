import Link from "next/link";
import { Button, Field, Input, Select } from "@/components/ui";

// Filtres (formulaire GET). Les options proviennent du périmètre du lecteur ;
// toute valeur reçue est de toute façon revérifiée côté serveur.

type Options = { cells: { id: string; code: string; name: string }[]; pools: { id: string; name: string }[]; sites: string[] };
type Values = { date?: string; from?: string; to?: string; cellId?: string; poolId?: string; site?: string; userId?: string };

/** Barre de filtres commune (présences du jour, période, ma présence). */
export function FilterBar({ children, resetHref, active }: { children: React.ReactNode; resetHref: string; active: boolean }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm [&>label]:w-full sm:[&>label]:w-44">
      {children}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Button type="submit" variant="secondary" size="sm" className="min-h-[42px] px-5">
          Appliquer
        </Button>
        {active && (
          <Link href={resetHref} className="rounded-full px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            Réinitialiser
          </Link>
        )}
      </div>
    </form>
  );
}

export function PresenceFiltersForm({
  options,
  values,
  mode,
  agents = [],
  resetHref,
}: {
  options: Options;
  values: Values;
  mode: "day" | "period";
  agents?: { id: string; name: string }[];
  /** Adresse sans filtre ; le lien « Réinitialiser » n'apparaît que si un filtre de périmètre est posé. */
  resetHref?: string;
}) {
  const active = Boolean(values.cellId || values.poolId || values.site || values.userId);
  return (
    <FilterBar resetHref={resetHref ?? (mode === "day" ? "/presence/aujourdhui" : "/presence/periode")} active={active}>
      {mode === "day" ? (
        <Field label="Date">
          <Input type="date" name="date" defaultValue={values.date} />
        </Field>
      ) : (
        <>
          <Field label="Du">
            <Input type="date" name="from" defaultValue={values.from} />
          </Field>
          <Field label="Au">
            <Input type="date" name="to" defaultValue={values.to} />
          </Field>
        </>
      )}
      {options.cells.length > 0 && (
        <Field label="Cellule">
          <Select name="cellId" defaultValue={values.cellId ?? ""}>
            <option value="">Toutes</option>
            {options.cells.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {options.pools.length > 0 && (
        <Field label="POOL">
          <Select name="poolId" defaultValue={values.poolId ?? ""}>
            <option value="">Tous</option>
            {options.pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {options.sites.length > 0 && (
        <Field label="Bureau">
          <Select name="site" defaultValue={values.site ?? ""}>
            <option value="">Tous</option>
            {options.sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {mode === "period" && agents.length > 0 && (
        <Field label="Agent">
          <Select name="userId" defaultValue={values.userId ?? ""}>
            <option value="">Tous</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </FilterBar>
  );
}
