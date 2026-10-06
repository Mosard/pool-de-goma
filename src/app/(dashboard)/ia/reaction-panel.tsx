"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, MessageSquare, PencilLine, X } from "lucide-react";
import { Alert, Button, FieldError, Label, Select, Textarea } from "@/components/ui";
import { AI_LIMITS } from "@/lib/ai/meta";
import { designateServiceAction, reactToProblemAction, type AiActionState } from "./actions";

const initialState: AiActionState = {};
type Mode = "idle" | "VALIDATION" | "REJET" | "AJUSTEMENT" | "COMMENTAIRE";

const SUBMIT_LABELS: Record<Exclude<Mode, "idle">, string> = {
  VALIDATION: "Confirmer la validation",
  REJET: "Confirmer le rejet",
  AJUSTEMENT: "Valider la décision ajustée",
  COMMENTAIRE: "Enregistrer le commentaire",
};

const COMMENT_HINTS: Record<Exclude<Mode, "idle">, string> = {
  VALIDATION: "Votre avis (facultatif) : ce que vous comptez faire, une précision sur le constat…",
  REJET: "Votre avis (facultatif) : votre point de vue sur le constat ou l'hypothèse…",
  AJUSTEMENT: "Votre avis (facultatif) : pourquoi cet ajustement…",
  COMMENTAIRE: "Votre point de vue sur le constat, ce que vous comptez faire, ou votre désaccord avec l'hypothèse…",
};

/**
 * Gestes du responsable concerné sur une carte : valider, rejeter (motif
 * obligatoire), ajuster puis valider, ou commenter. Rien n'est appliqué
 * ailleurs : seul le statut de la proposition change, et tout est archivé.
 */
export function ReactionPanel({
  problemId,
  proposedDecision,
  decided,
}: {
  problemId: string;
  proposedDecision: string;
  decided: boolean;
}) {
  const [state, action, pending] = useActionState(reactToProblemAction.bind(null, problemId), initialState);
  const [mode, setMode] = useState<Mode>("idle");
  const [lastSuccess, setLastSuccess] = useState<string | undefined>();
  if (state.success && state.success !== lastSuccess) {
    setLastSuccess(state.success);
    setMode("idle");
  }

  return (
    <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">
        {decided ? "Revoir votre décision" : "Votre décision"}
      </p>

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="!min-h-0 px-4 py-2" onClick={() => setMode("VALIDATION")}>
            <Check size={16} aria-hidden /> Valider
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!min-h-0 border border-gray-200 bg-white px-4 py-2"
            onClick={() => setMode("AJUSTEMENT")}
          >
            <PencilLine size={16} aria-hidden /> Ajuster puis valider
          </Button>
          <Button type="button" variant="danger" className="!min-h-0 px-4 py-2" onClick={() => setMode("REJET")}>
            <X size={16} aria-hidden /> Rejeter
          </Button>
          <Button type="button" variant="ghost" className="!min-h-0 px-4 py-2" onClick={() => setMode("COMMENTAIRE")}>
            <MessageSquare size={16} aria-hidden /> Commenter
          </Button>
        </div>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="kind" value={mode} />
          {mode === "AJUSTEMENT" && (
            <div>
              <Label htmlFor={`decision-${problemId}`}>Décision ajustée</Label>
              <Textarea
                id={`decision-${problemId}`}
                name="decision"
                rows={4}
                maxLength={AI_LIMITS.decision}
                defaultValue={proposedDecision}
                required
              />
              <FieldError message={state.errors?.decision} />
            </div>
          )}
          {mode === "REJET" && (
            <div>
              <Label htmlFor={`motif-${problemId}`}>Motif du rejet (obligatoire)</Label>
              <Textarea id={`motif-${problemId}`} name="motif" rows={3} maxLength={AI_LIMITS.motif} required />
              <FieldError message={state.errors?.motif} />
            </div>
          )}
          <div>
            <Label htmlFor={`comment-${problemId}`}>{mode === "COMMENTAIRE" ? "Commentaire" : "Commentaire (facultatif)"}</Label>
            <Textarea
              id={`comment-${problemId}`}
              name="comment"
              rows={3}
              maxLength={AI_LIMITS.comment}
              placeholder={COMMENT_HINTS[mode]}
              required={mode === "COMMENTAIRE"}
            />
            <FieldError message={state.errors?.comment} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant={mode === "REJET" ? "danger" : "primary"} disabled={pending} className="!min-h-0 px-4 py-2">
              {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {SUBMIT_LABELS[mode]}
            </Button>
            <Button type="button" variant="ghost" className="!min-h-0 px-3 py-2" onClick={() => setMode("idle")}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {state.error && <Alert variant="error">{state.error}</Alert>}
      {mode === "idle" && state.success && <Alert variant="success">{state.success}</Alert>}
    </div>
  );
}

/** IPP : désigner l'attribution de la Direction chargée de la décision. */
export function ServicePicker({
  problemId,
  current,
  attributions,
}: {
  problemId: string;
  current: string | null;
  attributions: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(designateServiceAction.bind(null, problemId), initialState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] flex-1">
        <Label htmlFor={`service-${problemId}`} className="text-xs">
          Service responsable (désigné par l&apos;IPP)
        </Label>
        <Select id={`service-${problemId}`} name="attributionId" defaultValue={current ?? ""}>
          <option value="">À confirmer</option>
          {attributions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="ghost" disabled={pending} className="!min-h-0 border border-gray-200 bg-white px-4 py-2">
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
        Enregistrer
      </Button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-emerald-700">{state.success}</p>}
    </form>
  );
}
