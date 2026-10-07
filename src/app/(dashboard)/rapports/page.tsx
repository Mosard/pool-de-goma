import Link from "next/link";
import { auth } from "@/lib/auth";
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { OFFICIAL_FICHES } from "@/lib/fiches/defs/index";
import { filtersQuery } from "@/lib/exports/scope";
import { filterOptions, loadExportSubject, loadReportRows, resolveFilters } from "@/lib/exports/server";

const STATUS_COLOR: Record<string, "gray" | "blue" | "green" | "orange" | "red"> = {
  [WORKFLOW_STATUS_KEYS.BROUILLON]: "gray",
  [WORKFLOW_STATUS_KEYS.SOUMIS]: "orange",
  [WORKFLOW_STATUS_KEYS.RECU]: "orange",
  [WORKFLOW_STATUS_KEYS.EN_EXPLOITATION]: "blue",
  [WORKFLOW_STATUS_KEYS.A_CORRIGER]: "red",
  [WORKFLOW_STATUS_KEYS.TRANSMIS]: "blue",
  [WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION]: "orange",
  [WORKFLOW_STATUS_KEYS.VALIDE]: "green",
  [WORKFLOW_STATUS_KEYS.REJETE]: "red",
  [WORKFLOW_STATUS_KEYS.CLOTURE]: "green",
};

const PAGE_SIZE = 200;

// Périmètre commun (src/lib/exports/scope.ts) : ses propres rapports et ceux
// des POOL que l'on exploite ou valide ; démonstration et officiel séparés.
export default async function RapportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  const subject = await loadExportSubject(session!.user.id);
  const { filters, error } = await resolveFilters(subject, await searchParams);
  const [rows, options] = await Promise.all([error ? Promise.resolve([]) : loadReportRows(subject, filters, PAGE_SIZE + 1), filterOptions(subject)]);
  const shown = rows.slice(0, PAGE_SIZE);
  const field = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        description={`${shown.length}${rows.length > PAGE_SIZE ? "+" : ""} rapport(s)`}
        actions={
          !error && shown.length > 0 ? (
            <a href={`/rapports/export.xlsx${filtersQuery(filters)}`}>
              <Button type="button" variant="secondary">
                Exporter en Excel
              </Button>
            </a>
          ) : undefined
        }
      />

      <Card>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
          <label className="text-sm font-medium text-gray-700">
            École
            <input name="ecole" defaultValue={filters.ecole ?? ""} placeholder="Nom de l'école" className={field} />
          </label>
          {options.canFilterInspector && (
            <label className="text-sm font-medium text-gray-700">
              Inspecteur
              <select name="inspecteur" defaultValue={filters.inspecteurId ?? ""} className={field}>
                <option value="">Tous</option>
                {options.inspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {options.canFilterPool && (
            <label className="text-sm font-medium text-gray-700">
              POOL
              <select name="pool" defaultValue={filters.poolId ?? ""} className={field}>
                <option value="">Tous</option>
                {options.pools.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm font-medium text-gray-700">
            Fiche
            <select name="fiche" defaultValue={filters.code ?? ""} className={field}>
              <option value="">Toutes</option>
              {OFFICIAL_FICHES.map((d) => (
                <option key={`${d.code}${d.version}`} value={d.code}>
                  {d.code} — {d.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Statut
            <select name="statut" defaultValue={filters.statut ?? ""} className={field}>
              <option value="">Tous</option>
              {options.statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Du
            <input type="date" name="du" defaultValue={filters.du ?? ""} className={field} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Au
            <input type="date" name="au" defaultValue={filters.au ?? ""} className={field} />
          </label>
          <Button type="submit">Filtrer</Button>
        </form>
      </Card>

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : shown.length === 0 ? (
        <EmptyState message="Aucun rapport pour ces critères." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Fiche / École</th>
                <th className="px-4 py-3">POOL</th>
                <th className="px-4 py-3">Inspecteur</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.ecole}</p>
                    <p className="text-xs text-gray-500">
                      {r.fiche}
                      {r.numero && ` · ${r.numero}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.pool}</td>
                  <td className="px-4 py-3 text-gray-600">{r.inspecteur}</td>
                  <td className="px-4 py-3 text-gray-600">{r.date.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[r.statutKey] ?? "gray"}>{r.statut}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/rapports/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > PAGE_SIZE && <p className="px-4 py-2 text-xs text-gray-400">Seuls les {PAGE_SIZE} plus récents sont affichés ; l&apos;export Excel les contient tous.</p>}
        </Card>
      )}
    </div>
  );
}
