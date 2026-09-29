"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, EyeOff, Loader2, Send, Undo2 } from "lucide-react";
import { Alert, Button, Card, FieldError, Textarea } from "@/components/ui";
import {
  publishContentAction,
  requestChangesAction,
  unpublishContentAction,
  type ContentFormState,
} from "./actions";

const initialState: ContentFormState = {};

/** Décision d'un valideur sur un contenu soumis : publier ou renvoyer en correction. */
export function ReviewPanel({ contentId }: { contentId: string }) {
  const [published, publish, publishing] = useActionState(publishContentAction.bind(null, contentId), initialState);
  const [returned, requestChanges, returning] = useActionState(requestChangesAction.bind(null, contentId), initialState);
  const [mode, setMode] = useState<"idle" | "confirm" | "return">("idle");

  return (
    <Card className="space-y-3 border-blue-200 bg-blue-50/40">
      <h2 className="text-sm font-semibold text-gray-900">Votre décision</h2>
      <p className="text-xs text-gray-600">
        Relisez l&apos;aperçu ci-dessous. La publication met le contenu en ligne immédiatement ; un renvoi en correction
        le rend à son auteur avec votre note.
      </p>
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="!min-h-0 px-4 py-2" onClick={() => setMode("confirm")}>
            <Send size={16} aria-hidden /> Publier sur le site
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!min-h-0 border border-gray-200 bg-white px-4 py-2"
            onClick={() => setMode("return")}
          >
            <Undo2 size={16} aria-hidden /> Renvoyer en correction
          </Button>
        </div>
      )}
      {mode === "confirm" && (
        <form action={publish} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Publier maintenant ?</span>
          <Button type="submit" disabled={publishing} className="!min-h-0 px-4 py-2">
            {publishing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
            Confirmer la publication
          </Button>
          <Button type="button" variant="ghost" className="!min-h-0 px-3 py-2" onClick={() => setMode("idle")}>
            Annuler
          </Button>
        </form>
      )}
      {mode === "return" && (
        <form action={requestChanges} className="space-y-2">
          <label htmlFor="note" className="text-xs font-medium text-gray-700">
            Correction attendue (transmise à l&apos;auteur)
          </label>
          <Textarea id="note" name="note" rows={3} required maxLength={1000} />
          <FieldError message={returned.errors?.note} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={returning} className="!min-h-0 px-4 py-2">
              {returning ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Undo2 size={16} aria-hidden />}
              Renvoyer à l&apos;auteur
            </Button>
            <Button type="button" variant="ghost" className="!min-h-0 px-3 py-2" onClick={() => setMode("idle")}>
              Annuler
            </Button>
          </div>
        </form>
      )}
      {(published.formError || returned.formError) && (
        <Alert variant="error">{published.formError ?? returned.formError}</Alert>
      )}
    </Card>
  );
}

/** Retrait d'un contenu publié (motif facultatif, transmis à l'auteur). */
export function UnpublishPanel({ contentId }: { contentId: string }) {
  const [state, action, pending] = useActionState(unpublishContentAction.bind(null, contentId), initialState);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="danger" className="!min-h-0 px-4 py-2" onClick={() => setOpen(true)}>
        <EyeOff size={16} aria-hidden /> Retirer du site
      </Button>
    );
  }
  return (
    <form action={action} className="w-full space-y-2">
      <label htmlFor="unpublish-note" className="text-xs font-medium text-gray-700">
        Motif du retrait (facultatif, transmis à l&apos;auteur)
      </label>
      <Textarea id="unpublish-note" name="note" rows={2} maxLength={1000} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending} className="!min-h-0 px-4 py-2">
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <EyeOff size={16} aria-hidden />}
          Confirmer le retrait
        </Button>
        <Button type="button" variant="ghost" className="!min-h-0 px-3 py-2" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
      {state.formError && <Alert variant="error">{state.formError}</Alert>}
    </form>
  );
}
