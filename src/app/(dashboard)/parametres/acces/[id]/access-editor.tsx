"use client";

// Panneau de détail de « Gérer les accès ». Les cases désactivées et leurs
// raisons viennent des mêmes règles que le serveur (src/lib/access-rules.ts) ;
// le serveur revérifie tout à l'enregistrement.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";
import { canAdjustPermission, type Adjustment, type AdjustmentEffect } from "@/lib/access-rules";
import type { SessionPermission, SessionRole } from "@/lib/permission-checks";
import { saveAccessChangesAction } from "../actions";

type Props = {
  targetId: string;
  actor: { organizationId: string; roles: SessionRole[]; permissions: SessionPermission[] };
  poolNames: Record<string, string>;
  actorPools: { id: string; name: string }[];
  /** `roleKey` : sert aussi au refus d'accès provincial pour une personne rattachée à une cellule. */
  currentRoles: { userRoleId: string; roleKey: string; label: string; poolId: string | null; removable: boolean; reason: string }[];
  addableRoles: {
    id: string;
    key: string;
    label: string;
    scope: string;
    pools: { id: string; name: string }[];
    cells: { id: string; code: string; name: string }[];
  }[];
  catalog: { key: string; label: string; category: string }[];
  inherited: { permissionKey: string; poolId: string | null; roles: string[]; scopeLabel?: string }[];
  adjustments: Adjustment[];
};

const key = (k: string, poolId: string | null) => `${k}|${poolId ?? ""}`;

export function AccessEditor(p: Props) {
  const router = useRouter();
  const [removeRoles, setRemoveRoles] = useState<Set<string>>(new Set());
  const [addRoles, setAddRoles] = useState<{ roleId: string; roleKey: string; poolId: string | null; cellId: string | null; label: string }[]>([]);
  const [newRole, setNewRole] = useState({ roleId: "", poolId: "", cellId: "" });
  const [adj, setAdj] = useState<Map<string, Adjustment>>(() => new Map(p.adjustments.map((a) => [key(a.permissionKey, a.poolId), a])));
  const [addScope, setAddScope] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const scopeLabel = (poolId: string | null) => (poolId ? `POOL ${p.poolNames[poolId] ?? "?"}` : "Tous les POOL");
  // Fonctions du compte après les changements en cours (même calcul que le serveur).
  const finalRoles = {
    roles: [
      ...p.currentRoles.filter((r) => !removeRoles.has(r.userRoleId)).map((r) => ({ key: r.roleKey })),
      ...addRoles.map((r) => ({ key: r.roleKey })),
    ],
  };
  const verdict = (k: string, poolId: string | null, effect: AdjustmentEffect) => canAdjustPermission(p.actor, k, poolId, effect, finalRoles);
  const label = (k: string) => p.catalog.find((c) => c.key === k)?.label ?? k;

  const setAdjustment = (k: string, poolId: string | null, effect: AdjustmentEffect | null) =>
    setAdj((m) => {
      const next = new Map(m);
      if (effect) next.set(key(k, poolId), { permissionKey: k, poolId, effect });
      else next.delete(key(k, poolId));
      return next;
    });

  const initial = useMemo(() => new Map(p.adjustments.map((a) => [key(a.permissionKey, a.poolId), a])), [p.adjustments]);

  const recap: string[] = [];
  for (const r of p.currentRoles) if (removeRoles.has(r.userRoleId)) recap.push(`Retirer la fonction « ${r.label} »${r.poolId ? ` (${scopeLabel(r.poolId)})` : ""}`);
  for (const r of addRoles) recap.push(`Ajouter la fonction « ${r.label} »${r.poolId ? ` (${scopeLabel(r.poolId)})` : ""}`);
  for (const [k, a] of adj) {
    if (initial.get(k)?.effect === a.effect) continue;
    recap.push(`${a.effect === "GRANT" ? "Ajouter" : "Retirer"} individuellement « ${label(a.permissionKey)} » — ${scopeLabel(a.poolId)}`);
  }
  for (const [k, a] of initial) if (!adj.has(k)) recap.push(`Annuler l'ajustement « ${label(a.permissionKey)} » (${a.effect === "GRANT" ? "ajout" : "retrait"}) — ${scopeLabel(a.poolId)}`);

  const save = () =>
    start(async () => {
      const res = await saveAccessChangesAction(
        p.targetId,
        JSON.stringify({
          addRoles: addRoles.map(({ roleId, poolId, cellId }) => ({ roleId, poolId, cellId })),
          removeUserRoleIds: [...removeRoles],
          adjustments: [...adj.values()],
        })
      );
      setConfirming(false);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error ?? "Enregistrement refusé." });
        return;
      }
      setMessage({ ok: true, text: `${res.changed} changement(s) enregistré(s) et inscrit(s) au journal d'audit.` });
      setRemoveRoles(new Set());
      setAddRoles([]);
      router.refresh();
    });

  const categories = [...new Set(p.catalog.map((c) => c.category))];
  const selectedRole = p.addableRoles.find((r) => r.id === newRole.roleId);

  return (
    <div className="space-y-6 pb-24">
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Fonctions</h3>
        <ul className="space-y-2">
          {p.currentRoles.map((r) => (
            <li key={r.userRoleId} className="flex items-center justify-between gap-2 text-sm">
              <span className={removeRoles.has(r.userRoleId) ? "text-gray-400 line-through" : "text-gray-900"}>
                {r.label} {r.poolId && <span className="text-xs text-gray-500">({scopeLabel(r.poolId)})</span>}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={!r.removable}
                title={r.removable ? undefined : r.reason}
                onClick={() =>
                  setRemoveRoles((s) => {
                    const n = new Set(s);
                    if (n.has(r.userRoleId)) n.delete(r.userRoleId);
                    else n.add(r.userRoleId);
                    return n;
                  })
                }
              >
                {removeRoles.has(r.userRoleId) ? "Garder" : "Retirer"}
              </Button>
            </li>
          ))}
          {p.currentRoles.length === 0 && <li className="text-sm text-gray-500">Aucune fonction.</li>}
          {addRoles.map((r, i) => (
            <li key={i} className="flex items-center justify-between text-sm text-emerald-700">
              <span>
                + {r.label} {r.poolId && `(${scopeLabel(r.poolId)})`}
              </span>
              <button type="button" className="text-xs text-red-600" onClick={() => setAddRoles((a) => a.filter((_, j) => j !== i))}>
                Annuler
              </button>
            </li>
          ))}
        </ul>
        {p.addableRoles.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row">
            <select className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" value={newRole.roleId} onChange={(e) => setNewRole({ roleId: e.target.value, poolId: "", cellId: "" })}>
              <option value="">Ajouter une fonction…</option>
              {p.addableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {selectedRole?.scope === "POOL" && (
              <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={newRole.poolId} onChange={(e) => setNewRole((n) => ({ ...n, poolId: e.target.value }))}>
                <option value="">POOL…</option>
                {selectedRole.pools.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            )}
            {selectedRole?.scope === "CELL" && (
              <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={newRole.cellId} onChange={(e) => setNewRole((n) => ({ ...n, cellId: e.target.value }))}>
                <option value="">Cellule (obligatoire)…</option>
                {selectedRole.cells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedRole || (selectedRole.scope === "POOL" && !newRole.poolId) || (selectedRole.scope === "CELL" && !newRole.cellId)}
              onClick={() => {
                if (!selectedRole) return;
                const cell = selectedRole.cells.find((c) => c.id === newRole.cellId);
                setAddRoles((a) => [
                  ...a,
                  {
                    roleId: selectedRole.id,
                    roleKey: selectedRole.key,
                    poolId: selectedRole.scope === "POOL" ? newRole.poolId : null,
                    cellId: selectedRole.scope === "CELL" ? newRole.cellId : null,
                    label: cell ? `${selectedRole.label} — cellule ${cell.code}` : selectedRole.label,
                  },
                ]);
                setNewRole({ roleId: "", poolId: "", cellId: "" });
              }}
            >
              Ajouter
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Le chef de POOL se nomme depuis la fiche du POOL. Les permissions d&apos;une fonction ajoutée ou retirée s&apos;appliquent après l&apos;enregistrement.
        </p>
      </Card>

      {categories.map((cat) => (
        <Card key={cat}>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{cat}</h3>
          <ul className="divide-y divide-gray-100">
            {p.catalog
              .filter((c) => c.category === cat)
              .map((c) => {
                const inh = p.inherited.filter((i) => i.permissionKey === c.key);
                const grants = [...adj.values()].filter((a) => a.permissionKey === c.key && a.effect === "GRANT");
                const effective = new Set([
                  ...inh.filter((i) => adj.get(key(c.key, i.poolId))?.effect !== "REVOKE").map((i) => key(c.key, i.poolId)),
                  ...grants.map((g) => key(c.key, g.poolId)),
                ]);
                const scopes = [null, ...p.actorPools.map((pl) => pl.id)].filter((s) => !effective.has(key(c.key, s)) && verdict(c.key, s, "GRANT").ok);
                const addVerdict = verdict(c.key, p.actorPools[0]?.id ?? null, "GRANT");
                return (
                  <li key={c.key} className="py-3">
                    <p className="text-sm font-medium text-gray-900">{c.label}</p>
                    <ul className="mt-1 space-y-1">
                      {inh.map((i) => {
                        const revoked = adj.get(key(c.key, i.poolId))?.effect === "REVOKE";
                        const v = verdict(c.key, i.poolId, "REVOKE");
                        return (
                          <li key={key(c.key, i.poolId)}>
                            <label className="flex items-start gap-2 text-sm" title={v.ok ? undefined : v.reason}>
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4"
                                checked={!revoked}
                                disabled={!v.ok}
                                onChange={(e) => setAdjustment(c.key, i.poolId, e.target.checked ? null : "REVOKE")}
                              />
                              <span>
                                {i.scopeLabel ?? scopeLabel(i.poolId)} — <span className="text-gray-500">héritée de la fonction ({i.roles.join(", ")})</span>
                                {revoked && <span className="ml-1 rounded bg-red-50 px-1.5 text-xs text-red-700">retirée individuellement</span>}
                                {!v.ok && <span className="block text-xs text-gray-400">{v.reason}</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                      {grants.map((g) => {
                        const v = verdict(c.key, g.poolId, "GRANT");
                        return (
                          <li key={key(c.key, g.poolId)}>
                            <label className="flex items-start gap-2 text-sm" title={v.ok ? undefined : v.reason}>
                              <input type="checkbox" className="mt-1 h-4 w-4" checked disabled={!v.ok} onChange={() => setAdjustment(c.key, g.poolId, null)} />
                              <span>
                                {scopeLabel(g.poolId)} — <span className="rounded bg-emerald-50 px-1.5 text-xs text-emerald-700">ajustement individuel</span>
                                {!v.ok && <span className="block text-xs text-gray-400">{v.reason}</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                      {inh.length === 0 && grants.length === 0 && <li className="text-xs text-gray-400">Non détenue.</li>}
                    </ul>
                    {scopes.length > 0 ? (
                      <div className="mt-2 flex gap-2">
                        <select
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                          value={addScope[c.key] ?? ""}
                          onChange={(e) => setAddScope((s) => ({ ...s, [c.key]: e.target.value }))}
                        >
                          <option value="">Ajouter individuellement…</option>
                          {scopes.map((s) => (
                            <option key={s ?? "all"} value={s ?? "ALL"}>
                              {scopeLabel(s)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 disabled:text-gray-300"
                          disabled={!addScope[c.key]}
                          onClick={() => {
                            const s = addScope[c.key] === "ALL" ? null : addScope[c.key];
                            setAdjustment(c.key, s, "GRANT");
                            setAddScope((x) => ({ ...x, [c.key]: "" }));
                          }}
                        >
                          Ajouter
                        </button>
                      </div>
                    ) : (
                      !addVerdict.ok && (
                        <p className="mt-1 text-xs text-gray-400" title={addVerdict.reason}>
                          Ajout individuel impossible : {addVerdict.reason}
                        </p>
                      )
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}

      {recap.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            {confirming ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">Récapitulatif</p>
                <ul className="mb-3 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-gray-700">
                  {recap.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button type="button" disabled={pending} onClick={save}>
                    {pending ? "Enregistrement…" : "Confirmer"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                    Revenir
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-700">{recap.length} changement(s) en attente</span>
                <Button type="button" onClick={() => setConfirming(true)}>
                  Enregistrer les changements
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
