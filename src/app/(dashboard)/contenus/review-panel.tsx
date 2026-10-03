"use client";

import { useActionState, useState } from "react";
import { CalendarClock, CheckCircle2, EyeOff, Loader2, Send, Star, StarOff, Undo2 } from "lucide-react";
import { Alert, Button, Card, FieldError, Input, Textarea } from "@/components/ui";
import { CONTENT_LIMITS, toGomaInputValue } from "@/lib/content-meta";
import {
  publishContentAction,
  requestChangesAction,
  togglePinAction,
  unpublishContentAction,
  type ContentFormState,
} from "./actions";

const initialState: ContentFormState = {};

/**
 * Décision d'un valideur sur un contenu soumis : publier (tout de suite ou à
 * une date choisie) ou renvoyer en correction.
 */
export function ReviewPanel({ contentId, suggestedDate }: { contentId: string; suggestedDate: string | null }) {
  const [published, publish, publishing] = useActionState(publishContentAction.bind(null, contentId), initialState);
  const [returned, requestChanges, returning] = useActionState(requestChangesAction.bind(null, contentId), initialState);
  const [mode, setMode] = useState<"idle" | "confirm" | "return">("idle");
  // Date proposée par l'auteur (la page ne la transmet que si elle est à venir).
  const suggested = suggestedDate;
  const [publishAt, setPublishAt] = useState(toGomaInputValue(suggested));

  return (
    <Card className="space-y-3 border-blue-200 bg-blue-50/40">
      <h2 className="text-sm font-semibold text-gray-900">Votre décision</h2>
      <p className="text-xs text-gray-600">
        Relisez l&apos;aperçu ci-dessous. Vous pouvez publier tout de suite ou programmer la mise en ligne ; un renvoi
        en correction rend le contenu à son auteur avec votre note.
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
        <form action={publish} className="space-y-3">
          <div className="max-w-xs">
            <label htmlFor="publishAt" className="text-xs font-medium text-gray-700">
              Date de mise en ligne (heure de Goma)
            </label>
            <Input
              id="publishAt"
              name="publishAt"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              {suggested ? "Date proposée par l'auteur. " : ""}Videz le champ pour publier maintenant.
            </p>
            <FieldError message={published.errors?.publishAt} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={publishing} className="!min-h-0 px-4 py-2">
              {publishing ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : publishAt ? (
                <CalendarClock size={16} aria-hidden />
              ) : (
                <CheckCircle2 size={16} aria-hidden />
              )}
              {publishAt ? "Programmer la publication" : "Publier maintenant"}
            </Button>
            <Button type="button" variant="ghost" className="!min-h-0 px-3 py-2" onClick={() => setMode("idle")}>
              Annuler
            </Button>
          </div>
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

/** Mise « À la une » d'un contenu publié (accueil et haut de la page Actualités). */
export function PinPanel({ contentId, pinned }: { contentId: string; pinned: boolean }) {
  const [state, action, pending] = useActionState(() => togglePinAction(contentId), initialState);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant={pinned ? "secondary" : "primary"} disabled={pending} className="!min-h-0 px-4 py-2">
        {pending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : pinned ? (
          <StarOff size={16} aria-hidden />
        ) : (
          <Star size={16} aria-hidden />
        )}
        {pinned ? "Retirer de la une" : "Mettre à la une"}
      </Button>
      <p className="text-xs text-gray-500">
        {pinned
          ? "Affiché en premier sur l'accueil et sur la page Actualités."
          : `Affiche ce contenu en premier sur l'accueil (${CONTENT_LIMITS.pinned} au plus à la fois).`}
      </p>
      {state.formError && <Alert variant="error">{state.formError}</Alert>}
    </form>
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
