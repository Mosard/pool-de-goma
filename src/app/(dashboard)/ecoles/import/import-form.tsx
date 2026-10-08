"use client";

import { useActionState } from "react";
import { Alert, Button, Card, FieldError, Input, Label, Select } from "@/components/ui";
import { importSchoolsAction, type SchoolImportState } from "./actions";

const initialState: SchoolImportState = {};

export function ImportForm({ pools }: { pools: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(importSchoolsAction, initialState);
  const report = state.report;

  return (
    <div className="space-y-6">
      <Card>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="poolId">POOL dans lequel importer</Label>
              <Select id="poolId" name="poolId" required defaultValue={pools.length === 1 ? pools[0].id : ""}>
                <option value="" disabled>Choisir un POOL</option>
                {pools.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="file">Fichier Excel rempli (.xlsx)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                required
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Chaque ligne est rattachée au POOL choisi : une ligne dont le code du POOL est différent est rejetée.
            Code déjà enregistré dans ce POOL : la fiche est mise à jour (une cellule vide garde la valeur actuelle).
            Code nouveau : l&apos;école est créée. Aucune école n&apos;est supprimée.
          </p>
          {state.formError && <FieldError message={state.formError} />}
          <Button type="submit" disabled={pending}>
            {pending ? "Import en cours..." : "Importer"}
          </Button>
        </form>
      </Card>

      {report && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Récapitulatif — {report.fileName} → POOL {report.pool.name} ({report.pool.code})
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Écoles créées" value={report.created.length} tone="text-emerald-700" />
            <Stat label="Écoles mises à jour" value={report.updated.length} tone="text-blue-700" />
            <Stat label="Déjà à jour" value={report.unchanged.length} tone="text-gray-700" />
            <Stat label="Lignes rejetées" value={report.rejected.length} tone="text-red-700" />
          </dl>

          {report.rejected.length === 0 ? (
            <Alert variant="success">Toutes les lignes du fichier ont été traitées.</Alert>
          ) : (
            <div>
              <Alert variant="error">
                {report.rejected.length} ligne(s) rejetée(s) : corrigez-les dans le fichier puis importez-le de nouveau
                (les lignes déjà importées seront simplement mises à jour, sans doublon).
              </Alert>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-2 pr-4">Ligne</th>
                      <th className="py-2 pr-4">Code de l&apos;école</th>
                      <th className="py-2">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.rejected.map((r) => (
                      <tr key={r.line}>
                        <td className="py-2 pr-4 font-medium">{r.line}</td>
                        <td className="py-2 pr-4">{r.code ?? "—"}</td>
                        <td className="py-2 text-gray-700">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.created.length + report.updated.length > 0 && (
            <details className="text-sm text-gray-700">
              <summary className="cursor-pointer text-gray-900">Détail des écoles créées et mises à jour</summary>
              <ul className="mt-2 space-y-1">
                {report.created.map((s) => (
                  <li key={`c${s.line}`}>Ligne {s.line} — {s.code} · {s.name} <span className="text-emerald-700">(créée)</span></li>
                ))}
                {report.updated.map((s) => (
                  <li key={`u${s.line}`}>Ligne {s.line} — {s.code} · {s.name} <span className="text-blue-700">(mise à jour)</span></li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-2xl font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
