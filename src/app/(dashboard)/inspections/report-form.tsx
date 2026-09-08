"use client";

import { useActionState } from "react";
import { Button, Card, Label, Textarea, FieldError } from "@/components/ui";
import { submitReportAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function ReportForm({
  inspectionId,
  defaultSummary,
  defaultRecommendations,
}: {
  inspectionId: string;
  defaultSummary?: string;
  defaultRecommendations?: string;
}) {
  const action = submitReportAction.bind(null, inspectionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Rapport d&apos;inspection</h3>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="summary">Résumé</Label>
          <Textarea id="summary" name="summary" rows={4} defaultValue={defaultSummary} required />
          <FieldError message={state.errors?.summary} />
        </div>
        <div>
          <Label htmlFor="recommendations">Recommandations</Label>
          <Textarea id="recommendations" name="recommendations" rows={3} defaultValue={defaultRecommendations} />
        </div>
        {state.formError && <FieldError message={state.formError} />}
        <Button type="submit" disabled={pending}>
          {pending ? "Soumission..." : "Soumettre le rapport"}
        </Button>
      </form>
    </Card>
  );
}
