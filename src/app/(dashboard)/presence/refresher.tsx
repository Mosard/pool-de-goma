"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchissement léger (~30 s) : interroge seulement le curseur de
 * changements ; la page n'est rechargée que si des données ont changé.
 * Suspendu quand l'onglet est caché.
 */
export function PresenceRefresher({ initialCursor }: { initialCursor: string }) {
  const router = useRouter();
  const cursor = useRef(initialCursor);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cursor.current = initialCursor;
  }, [initialCursor]);

  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/presence/v1/changes", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const { cursor: next } = (await res.json()) as { cursor: string };
        setFailed(false);
        setCheckedAt(new Date().toLocaleTimeString("fr-FR", { timeZone: "Africa/Lubumbashi" }));
        if (next !== cursor.current) {
          cursor.current = next;
          router.refresh();
        }
      } catch {
        setFailed(true);
      }
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <p className="text-xs text-gray-500" aria-live="polite">
      {failed
        ? "Actualisation impossible pour l'instant (connexion) : les données affichées peuvent être anciennes."
        : checkedAt
          ? `Vérifié à ${checkedAt} (heure de Goma) — actualisation automatique toutes les 30 s.`
          : "Actualisation automatique toutes les 30 s."}
    </p>
  );
}
