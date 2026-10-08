"use client";

import { useActionState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { saveCellAction, type CellFormState } from "./actions";

type IpaOption = { id: string; name: string; busyWith: string | null };

/** Création ou modification d'une cellule ; tous les contrôles sont refaits côté serveur. */
export function CellForm({
  cell,
  ipas,
}: {
  cell?: { id: string; code: string; name: string; ipaId: string | null };
  ipas: IpaOption[];
}) {
  const [state, action, pending] = useActionState<CellFormState, FormData>(saveCellAction, {});
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      {cell && <input type="hidden" name="cellId" value={cell.id} />}
      <label className="text-sm font-medium text-gray-700">
        Sigle
        <Input name="code" required defaultValue={cell?.code ?? ""} placeholder="ex. IPAF" className="mt-1 uppercase" />
      </label>
      <label className="text-sm font-medium text-gray-700 sm:col-span-2">
        Intitulé
        <Input name="name" required defaultValue={cell?.name ?? ""} placeholder="Cellule de l'IPAF" className="mt-1" />
      </label>
      <label className="text-sm font-medium text-gray-700">
        IPA responsable
        <Select name="ipaId" defaultValue={cell?.ipaId ?? ""} className="mt-1">
          <option value="">— À désigner —</option>
          {ipas.map((i) => (
            <option key={i.id} value={i.id} disabled={Boolean(i.busyWith) && i.busyWith !== cell?.code}>
              {i.name}
              {i.busyWith && i.busyWith !== cell?.code ? ` (déjà : ${i.busyWith})` : ""}
            </option>
          ))}
        </Select>
      </label>
      <div className="flex items-center gap-3 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : cell ? "Enregistrer" : "Créer la cellule"}
        </Button>
        {state.error && <Alert variant="error">{state.error}</Alert>}
        {state.ok && <span className="text-sm text-emerald-700">Enregistré.</span>}
      </div>
    </form>
  );
}
