"use client";

import { useState } from "react";
import { Button } from "./ui";

export function ConfirmButton({
  label,
  confirmLabel = "Confirmer",
  variant = "primary",
  className,
  formAction,
  icon,
}: {
  label: string;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  formAction: (formData: FormData) => void | Promise<void>;
  /** Icône facultative affichée devant le libellé (bouton et confirmation). */
  icon?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant={variant} className={className} onClick={() => setConfirming(true)}>
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <span className="text-xs text-gray-500">Confirmer ?</span>
      <Button type="submit" variant={variant} className="!min-h-0 !px-3 !py-1.5 text-xs">
        {icon}
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="!min-h-0 !px-3 !py-1.5 text-xs"
        onClick={() => setConfirming(false)}
      >
        Annuler
      </Button>
    </form>
  );
}
