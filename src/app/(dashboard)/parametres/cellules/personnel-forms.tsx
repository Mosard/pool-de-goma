"use client";

import { useActionState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { setCellMandateAction, setPersonnelCellIpaAction, type CellFormState } from "./actions";

type IpaOption = { id: string; name: string; busyWith: string | null };

/** Vocation « gestion du personnel » d'une cellule ; contrôles refaits côté serveur. */
export function MandateForm({ cellId, mandate }: { cellId: string; mandate: "GENERAL" | "PERSONNEL" }) {
  const [state, action, pending] = useActionState<CellFormState, FormData>(setCellMandateAction.bind(null, cellId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-gray-700">
        Vocation
        <Select name="mandate" defaultValue={mandate} className="mt-1">
          <option value="GENERAL">Cellule de l&apos;IPP</option>
          <option value="PERSONNEL">Gestion du personnel</option>
        </Select>
      </label>
      <Button type="submit" variant="secondary" disabled={pending} className="!min-h-0 !px-3 !py-2 text-xs">
        {pending ? "Enregistrement…" : "Enregistrer la vocation"}
      </Button>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && <span className="text-sm text-emerald-700">Enregistré.</span>}
    </form>
  );
}

/** Responsable IPA de la cellule du personnel : affecter, remplacer, retirer. */
export function PersonnelIpaForm({ cellId, cellCode, ipaId, ipas }: { cellId: string; cellCode: string; ipaId: string | null; ipas: IpaOption[] }) {
  const [state, action, pending] = useActionState<CellFormState, FormData>(setPersonnelCellIpaAction.bind(null, cellId), {});
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      <label className="text-sm font-medium text-gray-700">
        Responsable (IPA)
        <Select name="ipaId" defaultValue={ipaId ?? ""} className="mt-1">
          <option value="">— Aucun (retirer) —</option>
          {ipas.map((i) => (
            <option key={i.id} value={i.id} disabled={Boolean(i.busyWith) && i.busyWith !== cellCode}>
              {i.name}
              {i.busyWith && i.busyWith !== cellCode ? ` (déjà : ${i.busyWith})` : ""}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium text-gray-700">
        Motif (facultatif)
        <Input name="reason" maxLength={300} className="mt-1" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending} className="!min-h-0 !px-3 !py-2 text-xs">
          {pending ? "Enregistrement…" : "Enregistrer le responsable"}
        </Button>
        {state.error && <Alert variant="error">{state.error}</Alert>}
        {state.ok && <span className="text-sm text-emerald-700">Enregistré.</span>}
      </div>
    </form>
  );
}
