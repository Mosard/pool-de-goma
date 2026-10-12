"use client";

import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { clearViewModeAction, setViewModeAction } from "./view-mode-actions";

type RoleOption = { key: string; label: string; scope: string };
type PoolOption = { id: string; name: string };

/**
 * Bandeau « Voir comme » (Super Admin, IPP) : une fonction (et un POOL) pour
 * voir l'écran de ce profil. Super Admin : exactement les droits du profil.
 * IPP : fonctions de POOL seulement, sans jamais dépasser ses propres droits.
 * Les actions faites dans ce mode sont tracées à son nom, avec le mode actif.
 */
export function ViewModeBar({
  holderLabel,
  kind = "bounded",
  active,
  roles,
  pools,
  cells,
}: {
  holderLabel: string;
  /** full : Super Admin ; bounded : IPP ; readonly : informaticien, secrétaires de l'IPP (consultation seule). */
  kind?: "full" | "bounded" | "readonly";
  active: { label: string; poolName: string | null } | null;
  roles: RoleOption[];
  pools: PoolOption[];
  /** Cellules actives : simuler un exploitant de l'IPP ou un IPA exige une cellule. */
  cells: { id: string; code: string; name: string }[];
}) {
  const [roleKey, setRoleKey] = useState("");
  const role = roles.find((r) => r.key === roleKey);
  const explanation =
    kind === "readonly"
      ? "Consultation seule : vous voyez l'écran complet de ce profil, mais aucune modification, validation, signature ni export n'est possible. Vos consultations sont tracées à votre nom."
      : kind === "bounded"
        ? "Vous voyez l'écran de ce profil, dans la limite de vos propres droits. Vos actions sont tracées à votre nom."
        : "Vous avez exactement les droits de ce profil. Vos actions sont tracées à votre nom.";

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-100 px-6 py-2 text-sm text-amber-900">
        <span className="font-semibold">
          {kind === "readonly" ? "Consultation : " : "Vue simulée : "}
          {active.label}
          {active.poolName ? ` — ${active.poolName}` : ""}
        </span>
        <span className="text-amber-800">{explanation}</span>
        <form action={clearViewModeAction} className="ml-auto">
          <Button type="submit" variant="secondary" className="!min-h-0 !px-3 !py-1 text-xs">
            {kind === "readonly" ? "Revenir à ma fonction" : `Revenir en ${holderLabel}`}
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
      <span className="font-semibold">{kind === "readonly" ? "Consulter comme (lecture seule) :" : `${holderLabel} — voir comme :`}</span>
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
      {(role?.scope === "CELL" || role?.key === "ipa") && (
        <Select name="cellId" aria-label="Cellule" required defaultValue="" className="!w-auto !py-1 text-xs">
          <option value="" disabled>Cellule…</option>
          {cells.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </Select>
      )}
      <Button type="submit" className="!min-h-0 !px-3 !py-1 text-xs" disabled={!roleKey}>
        Basculer
      </Button>
    </form>
  );
}
