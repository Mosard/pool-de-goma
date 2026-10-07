"use client";

// Télécharger ou partager le PDF d'un rapport (partage natif du téléphone si disponible).

import { useState } from "react";
import { Button } from "@/components/ui";

export function PdfButtons({ reportId, filename }: { reportId: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const url = `/rapports/${reportId}/pdf`;
  const share = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: filename });
      else window.open(url, "_blank");
    } catch {
      // Partage annulé ou impossible : rien à faire.
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <a href={url} target="_blank" rel="noopener">
        <Button type="button" variant="secondary">Imprimer / PDF</Button>
      </a>
      <Button type="button" variant="ghost" disabled={busy} onClick={share}>
        {busy ? "…" : "Partager"}
      </Button>
    </div>
  );
}
