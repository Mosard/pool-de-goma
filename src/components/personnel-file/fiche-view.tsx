// Fiche individuelle (écran) : sommaire des sections I à VII, rubriques en
// consultation ou modification selon les droits, déclaration finale sans
// signature électronique (la signature se porte sur la version imprimée).

import { FileDown, Lock } from "lucide-react";
import { buttonClasses } from "@/components/ui";
import { PERSONNEL_FILE_SECTIONS, REPEAT_FIELDS } from "@/lib/personnel-file/defs";
import type { FileAccess } from "@/lib/personnel-file/rules";
import type { FileView } from "@/lib/personnel-file/server";
import { plainRow, type Cell } from "./format";
import { GroupCard } from "./group-card";
import { RepeatCard, type RepeatRow } from "./repeat-card";

const fmtDateTime = (d: Date) =>
  d.toLocaleString("fr-FR", { timeZone: "Africa/Lubumbashi", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function rows(list: object[], kind: keyof typeof REPEAT_FIELDS): RepeatRow[] {
  const keys = REPEAT_FIELDS[kind].map((f) => f.key);
  return list.map((r) => {
    const row = r as Record<string, unknown>;
    return { id: String(row.id), values: plainRow(row, keys) };
  });
}

export function FicheView({ view, access, targetId, pdfHref }: { view: FileView; access: FileAccess; targetId: string; pdfHref: string }) {
  const { completeness: c } = view;
  const repeatRows = {
    promotions: rows(view.promotions, "promotions"),
    diplomas: rows(view.diplomas, "diplomas"),
    children: rows(view.children, "children"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-56 flex-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-gray-900">Fiche renseignée à {c.percent} %</span>
            <span className="text-xs tabular-nums text-gray-500">
              {c.filled} / {c.total} champs
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuenow={c.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Complétude de la fiche"
          >
            <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${c.percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {view.updatedAt ? `Dernière mise à jour le ${fmtDateTime(view.updatedAt)}.` : "Aucune rubrique enregistrée pour l'instant."} Indicatif : aucune rubrique
            n&apos;est obligatoire.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!access.edit && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
              <Lock size={14} aria-hidden /> Consultation seule
            </span>
          )}
          {access.pdf && (
            <a href={pdfHref} target="_blank" rel="noopener" className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-10" })}>
              <FileDown size={16} aria-hidden /> Télécharger le PDF
            </a>
          )}
        </div>
      </div>

      <nav aria-label="Sections de la fiche" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
        {PERSONNEL_FILE_SECTIONS.map((s) => (
          <a key={s.key} href={`#section-${s.key}`} className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300">
            {s.roman}. {s.title}
          </a>
        ))}
      </nav>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Sommaire de la fiche" className="hidden lg:block">
          <ol className="sticky top-6 space-y-3 text-sm">
            {PERSONNEL_FILE_SECTIONS.map((s) => (
              <li key={s.key}>
                <a href={`#section-${s.key}`} className="flex gap-2 font-medium text-gray-900 hover:text-blue-700">
                  <span className="w-6 shrink-0 text-gray-400">{s.roman}.</span>
                  <span>{s.title}</span>
                </a>
                <ol className="mt-1 space-y-0.5 pl-8">
                  {s.groups.map((g) => (
                    <li key={g.key}>
                      <a href={`#${g.key}`} className="block truncate text-xs text-gray-500 hover:text-gray-900">
                        {g.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-10">
          {PERSONNEL_FILE_SECTIONS.map((s) => (
            <section key={s.key} id={`section-${s.key}`} aria-labelledby={`titre-${s.key}`} className="scroll-mt-6 space-y-4">
              <h2 id={`titre-${s.key}`} className="flex items-baseline gap-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
                <span className="font-mono text-base text-gray-400">{s.roman}</span>
                {s.title}
              </h2>
              {s.groups.map((g) =>
                g.kind === "fields" ? (
                  <GroupCard
                    key={g.key}
                    targetId={targetId}
                    groupKey={g.key}
                    values={(view.values[g.key] ?? {}) as Record<string, Cell>}
                    version={view.versions[g.key] ?? 0}
                    canEdit={access.edit}
                    canObserve={access.observe}
                    observation={view.observations[g.key] ?? null}
                    accountEmail={view.user.email}
                  />
                ) : (
                  <RepeatCard
                    key={g.key}
                    targetId={targetId}
                    kind={g.kind}
                    rows={repeatRows[g.kind]}
                    canEdit={access.edit}
                    canObserve={access.observe}
                    observation={view.observations[g.key] ?? null}
                  />
                )
              )}
            </section>
          ))}

          <section aria-labelledby="titre-declaration" className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-700">
            <h2 id="titre-declaration" className="font-semibold text-gray-900">
              Déclaration
            </h2>
            <p className="mt-1 max-w-3xl text-pretty">
              « Je jure en mon honneur que les renseignements fournis ci-dessus sont sincères et exacts. » La date, le lieu et les signatures de l&apos;agent et de
              l&apos;inspecteur-auditeur se portent sur la version imprimée : l&apos;application n&apos;enregistre aucune signature.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
