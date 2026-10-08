"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Select, Textarea } from "@/components/ui";
import { ippTrackAction, type IppTrackState } from "./actions";

type ActionOption = { key: string; label: string; needsCell: boolean; commentRequired: boolean };
type CellOption = { id: string; code: string; name: string };

/**
 * Étapes de la branche IPP proposées à ce compte. La liste est calculée côté
 * serveur (canActOnTrack) ; l'action serveur refait tous les contrôles.
 */
export function IppTrackPanel({ reportId, actions, cells }: { reportId: string; actions: ActionOption[]; cells: CellOption[] }) {
  const [state, formAction, pending] = useActionState<IppTrackState, FormData>(ippTrackAction.bind(null, reportId), {});
  const [actionKey, setActionKey] = useState(actions[0]?.key ?? "");
  const selected = actions.find((a) => a.key === actionKey);
  if (actions.length === 0) return null;

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.done && <Alert variant="success">Étape enregistrée : {state.done}.</Alert>}
      <Select name="action" value={actionKey} onChange={(e) => setActionKey(e.target.value)} aria-label="Étape">
        {actions.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </Select>
      {selected?.needsCell && (
        <Select name="cellId" required defaultValue="" aria-label="Cellule destinataire">
          <option value="" disabled>
            Cellule destinataire…
          </option>
          {cells.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
      )}
      <Textarea
        name="comment"
        rows={2}
        required={selected?.commentRequired}
        placeholder={selected?.commentRequired ? "Motif (obligatoire)" : "Observation (facultative)"}
      />
      <Button type="submit" disabled={pending || (selected?.needsCell && cells.length === 0)}>
        {pending ? "Enregistrement…" : selected?.label}
      </Button>
      {selected?.needsCell && cells.length === 0 && (
        <p className="text-xs text-gray-500">Aucune cellule active : l&apos;équipe métier doit d&apos;abord les créer (Paramètres → Cellules).</p>
      )}
    </form>
  );
}
