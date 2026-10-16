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

  // Pastille d'état : verte quand la dernière vérification a réussi, ambre si la connexion manque.
  return (
    <p
      aria-live="polite"
      title="Vérification toutes les 30 secondes ; la page ne se recharge que si des données ont changé."
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
        failed ? "border-amber-200 bg-amber-50 text-amber-900" : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${failed ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden />
      <span className="min-w-0">
        {failed ? (
          "Actualisation impossible (connexion) : données peut-être anciennes"
        ) : checkedAt ? (
          <>
            Vérifié à <span className="tabular-nums">{checkedAt}</span> (heure de Goma) · toutes les 30 s
          </>
        ) : (
          "Actualisation automatique toutes les 30 s"
        )}
      </span>
    </p>
  );
}
