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
  const action = transitionReportAction.bind(null, reportId);

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <Select name="toStatusKey" value={toStatusKey} onChange={(e) => setToStatusKey(e.target.value)}>
        {transitions.map((t) => (
          <option key={t.toStatus.key} value={t.toStatus.key}>{t.toStatus.label}</option>
        ))}
      </Select>
      <Textarea name="comment" rows={2} placeholder="Commentaire (optionnel)" />
      <Button type="submit">Appliquer la transition</Button>
    </form>
  );
}
