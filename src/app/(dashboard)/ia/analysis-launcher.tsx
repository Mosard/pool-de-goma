"use client";

import { useActionState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { launchAnalysisAction, type AiActionState } from "./actions";

const initialState: AiActionState = {};

/**
 * Lance l'étage 2 sur le périmètre et la période affichés. L'analyse dure en
 * général une à quatre minutes ; le bouton reste bloqué pendant ce temps pour
 * éviter un double lancement (chaque analyse a un coût).
 */
export function AnalysisLauncher({
  pool,
  du,
  au,
  scopeLabel,
  reportCount,
}: {
  pool: string | null;
  du: string;
  au: string;
  scopeLabel: string;
  reportCount: number;
}) {
  const [state, action, pending] = useActionState(launchAnalysisAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="pool" value={pool ?? ""} />
      <input type="hidden" name="du" value={du} />
      <input type="hidden" name="au" value={au} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || reportCount === 0}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
          {pending ? "Analyse en cours…" : "Lancer l'analyse IA"}
        </Button>
        <p className="text-xs text-gray-500">
          {reportCount === 0
            ? "Aucun rapport soumis sur cette période : rien à analyser."
            : `${reportCount} rapport(s) · ${scopeLabel}`}
        </p>
      </div>
      {pending && (
        <Alert variant="info">
          Les observations sont en cours d&apos;analyse (une à quatre minutes). Gardez cette page ouverte.
        </Alert>
      )}
      {state.error && <Alert variant="error">{state.error}</Alert>}
    </form>
  );
}
