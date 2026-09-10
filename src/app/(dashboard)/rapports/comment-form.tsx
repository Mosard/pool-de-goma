"use client";

import { useActionState } from "react";
import { Button, Textarea, FieldError } from "@/components/ui";
import { addCommentAction, type CommentState } from "./actions";

const initialState: CommentState = {};

export function CommentForm({ reportId }: { reportId: string }) {
  const action = addCommentAction.bind(null, reportId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Textarea name="content" rows={3} placeholder="Ajouter une observation..." required />
      <FieldError message={state.errors?.content} />
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Ajouter le commentaire"}
      </Button>
    </form>
  );
}
