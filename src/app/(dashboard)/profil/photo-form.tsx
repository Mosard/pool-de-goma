"use client";

import { useActionState, useState } from "react";
import { Avatar, Alert } from "@/components/ui";
import { updatePhotoAction, type PhotoFormState } from "./actions";

const initialState: PhotoFormState = {};

export function PhotoForm({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [state, formAction, pending] = useActionState(updatePhotoAction, initialState);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={preview ?? photoUrl} className="h-14 w-14 text-base" />
      <div>
        <p className="text-base font-semibold text-gray-900">{name}</p>
        <form action={formAction} className="mt-1 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
            Changer la photo
            <input
              type="file"
              name="photo"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPreview(URL.createObjectURL(file));
                e.target.form?.requestSubmit();
              }}
            />
          </label>
          {pending && <span className="text-xs text-gray-400">Envoi...</span>}
        </form>
        {state.formError && (
          <div className="mt-2">
            <Alert variant="error">{state.formError}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
