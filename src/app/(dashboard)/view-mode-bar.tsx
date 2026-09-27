"use client";

import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { clearViewModeAction, setViewModeAction } from "./view-mode-actions";

type RoleOption = { key: string; label: string; scope: string };
type PoolOption = { id: string; name: string };

/**
 * Bandeau du Super Admin : « Voir comme » une fonction (et un POOL) pour
 * reproduire exactement l'écran et les droits de ce profil. Les actions faites
 * dans ce mode sont tracées à son nom, avec le mode actif.
 */
export function ViewModeBar({
  active,
  roles,
  pools,
}: {
  active: { label: string; poolName: string | null } | null;
  roles: RoleOption[];
  pools: PoolOption[];
}) {
  const [roleKey, setRoleKey] = useState("");
  const role = roles.find((r) => r.key === roleKey);

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-100 px-6 py-2 text-sm text-amber-900">
        <span className="font-semibold">
          Vue simulée : {active.label}
          {active.poolName ? ` — ${active.poolName}` : ""}
        </span>
        <span className="text-amber-800">
          Vous avez exactement les droits de ce profil. Vos actions sont tracées à votre nom.
        </span>
        <form action={clearViewModeAction} className="ml-auto">
          <Button type="submit" variant="secondary" className="!min-h-0 !px-3 !py-1 text-xs">
            Revenir en Super Admin
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={setViewModeAction}
      className="flex flex-wrap items-center gap-2 border-b border-indigo-200 bg-indigo-50 px-6 py-2 text-sm text-indigo-900"
    >
      <span className="font-semibold">Super Admin — voir comme :</span>
      <Select
        name="role"
        aria-label="Profil à simuler"
        value={roleKey}
        onChange={(e) => setRoleKey(e.target.value)}
        className="!w-auto !py-1 text-xs"
      >
        <option value="">Choisir un profil…</option>
        {roles.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </Select>
      {role?.scope === "POOL" && (
        <Select name="poolId" aria-label="POOL" required defaultValue="" className="!w-auto !py-1 text-xs">
          <option value="" disabled>POOL…</option>
          {pools.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      )}
      <Button type="submit" className="!min-h-0 !px-3 !py-1 text-xs" disabled={!roleKey}>
        Basculer
      </Button>
    </form>
  );
}
