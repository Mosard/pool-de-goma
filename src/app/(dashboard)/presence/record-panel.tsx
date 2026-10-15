"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Avatar, Badge, Skeleton } from "@/components/ui";
import type { RecordPanelView } from "@/lib/personnel/record";
import { loadRecordPanel } from "./actions";

// « Voir la fiche » : panneau latéral en lecture seule au-dessus de la liste des
// présences. Aucune navigation : filtres, défilement et position sont conservés.
// Les droits sont revérifiés par l'action serveur à chaque ouverture (journalisée).

export function RecordPanelButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<RecordPanelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function show() {
    setOpen(true);
    setError(null);
    setRecord(null);
    startTransition(async () => {
      const r = await loadRecordPanel(userId);
      if ("record" in r) setRecord(r.record);
      else setError(r.error);
    });
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        className="mt-1 inline-flex items-center rounded text-xs font-medium text-blue-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-haspopup="dialog"
      >
        Voir la fiche
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[1px]" onClick={close} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={`fiche-${userId}-titre`}
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl motion-safe:animate-[fiche-in_180ms_ease-out]"
          >
            <style>{"@keyframes fiche-in{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}"}</style>
            <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Fiche du personnel — lecture seule</p>
                <h2 id={`fiche-${userId}-titre`} className="truncate text-base font-semibold text-gray-900">
                  {record?.name ?? name}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Fermer la fiche"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm" aria-busy={pending}>
              {pending && !record && !error && (
                <div className="space-y-3" aria-label="Chargement de la fiche">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}

              {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}

              {record && (
                <>
                  <div className="flex items-center gap-4">
                    <Avatar name={record.name} src={record.photoUrl} className="h-14 w-14" />
                    <div className="min-w-0 space-y-1">
                      <Badge color={record.active ? "green" : "gray"}>{record.statusLabel}</Badge>
                      {record.functions.length > 0 && (
                        <ul className="text-xs text-gray-600">
                          {record.functions.map((f, i) => (
                            <li key={`${f}-${i}`}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {record.sections.map((s) => (
                    <section key={s.title} className="rounded-xl border border-gray-100 p-4">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.title}</h3>
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {s.fields.map((f) => (
                          <div key={f.label}>
                            <dt className="text-xs text-gray-500">{f.label}</dt>
                            <dd className="break-words font-medium text-gray-900">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}

                  <p className="text-xs text-gray-400">Consultation inscrite au journal d&apos;audit. Aucune modification possible depuis ce panneau.</p>
                </>
              )}
            </div>

            {record && (
              <footer className="border-t border-gray-100 px-5 py-3 text-right">
                <Link href={`/personnel/${record.id}`} className="text-xs font-medium text-blue-700 hover:underline">
                  Ouvrir la fiche complète
                </Link>
              </footer>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
