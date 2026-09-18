"use client";

import { useActionState, useId, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar, Alert } from "@/components/ui";
import { updatePhotoAction, type PhotoFormState } from "./actions";

const initialState: PhotoFormState = {};

export function PhotoForm({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [state, formAction, pending] = useActionState(updatePhotoAction, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const inputId = useId();

  return (
    <form action={formAction} className="flex items-center gap-4">
      <label htmlFor={inputId} className="group relative block h-16 w-16 shrink-0 cursor-pointer">
        <Avatar name={name} src={preview ?? photoUrl} className="h-16 w-16 text-lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <Camera size={20} strokeWidth={1.75} className="text-white" />
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm">
          <Camera size={12} strokeWidth={2} />
        </span>
      </label>
      <input
        id={inputId}
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
      <div>
        <p className="text-base font-semibold text-gray-900">{name}</p>
        <label
          htmlFor={inputId}
          className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          <Camera size={14} strokeWidth={1.75} />
          {pending ? "Envoi..." : "Changer la photo"}
        </label>
        {state.formError && (
          <div className="mt-2">
            <Alert variant="error">{state.formError}</Alert>
          </div>
        )}
      </div>
    </form>
  );
}
