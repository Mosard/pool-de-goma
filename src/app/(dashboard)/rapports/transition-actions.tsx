"use client";

import { useState } from "react";
import { Button, Select, Textarea } from "@/components/ui";
import { transitionReportAction } from "./actions";

type TransitionOption = { toStatus: { key: string; label: string } };

export function TransitionActions({
  reportId,
  transitions,
}: {
  reportId: string;
  transitions: TransitionOption[];
}) {
  const [toStatusKey, setToStatusKey] = useState(transitions[0]?.toStatus.key ?? "");
  const [confirming, setConfirming] = useState(false);
  const action = transitionReportAction.bind(null, reportId);
  const selectedLabel = transitions.find((t) => t.toStatus.key === toStatusKey)?.toStatus.label ?? "";

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <Select
        name="toStatusKey"
        value={toStatusKey}
        onChange={(e) => {
          setToStatusKey(e.target.value);
          setConfirming(false);
        }}
      >
        {transitions.map((t) => (
          <option key={t.toStatus.key} value={t.toStatus.key}>{t.toStatus.label}</option>
        ))}
      </Select>
      <Textarea name="comment" rows={2} placeholder="Commentaire (optionnel)" />
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Confirmer « {selectedLabel} » ?</span>
          <Button type="submit">Confirmer</Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
            Annuler
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setConfirming(true)}>
          Appliquer la transition
        </Button>
      )}
    </form>
  );
}
