"use client";

// Saisie, lecture et partie réservée d'une fiche officielle (format 2), pensée
// pour le téléphone. Calculs en direct (src/lib/fiches/calculs.ts), copie
// locale automatique du brouillon en cas de coupure de connexion (ce n'est
// pas un mode hors ligne complet : l'enregistrement et la soumission
// demandent une connexion).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { SignatureField, Pad } from "@/components/fiches/signature-pad";
import {
  APPRECIATION_VALUES,
  CONVERSION_TABLES,
  MENTIONS,
  PERCENT_BOUNDS,
  computeFiche,
  isVisible,
  rowsOf,
} from "@/lib/fiches/calculs";
import { commonHeaderFields } from "@/lib/fiches/defs/index";
import type { Block, FicheData, FicheDef, FieldDef, RatedPosteDef, SignatureValue, TableDef, TableRow } from "@/lib/fiches/types";
import { conseilsKey, freeLabelKey, obsKey } from "@/lib/fiches/types";
import type { Issue } from "@/lib/fiches/validation";
import { saveFicheAction, saveReservedPartAction, submitFicheAction } from "@/app/(dashboard)/fiches/actions";

export type EditorMode = "edit" | "view" | "reserved";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-700";

const NOTE_CHOICES = [
  { v: "4", label: "4" },
  { v: "3", label: "3" },
  { v: "2", label: "2" },
  { v: "1", label: "1" },
  { v: "0", label: "0" },
  { v: "-", label: "–" },
  { v: "SO", label: "S.O." },
];
const APPRECIATION_CHOICES = [...APPRECIATION_VALUES.map((v) => ({ v, label: v })), { v: "-", label: "–" }, { v: "SO", label: "S.O." }];

function Chips({ value, choices, onChange, disabled, ariaLabel }: { value: string; choices: { v: string; label: string }[]; onChange: (v: string) => void; disabled: boolean; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const active = value === c.v;
        return (
          <button
            key={c.v}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? "" : c.v)}
            className={`min-h-[40px] min-w-[44px] rounded-lg border px-2 text-sm font-semibold transition-colors ${
              active ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function storageKey(formId: string, userId: string) {
  return `ippnk1:fiche:${formId}:${userId}`;
}
type LocalCopy = { data: FicheData; at: number; synced: boolean };

function readLocal(key: string): LocalCopy | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, copy: LocalCopy) {
  try {
    window.localStorage.setItem(key, JSON.stringify(copy));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la saisie continue sans copie locale.
  }
}

export function FicheEditor({
  formId,
  userId,
  def,
  initial,
  serverUpdatedAt,
  mode,
}: {
  formId: string;
  userId: string;
  def: FicheDef;
  initial: FicheData;
  serverUpdatedAt: string;
  mode: EditorMode;
}) {
  const router = useRouter();
  const [data, setData] = useState<FicheData>(initial);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [restore, setRestore] = useState<LocalCopy | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const key = storageKey(formId, userId);
  const firstRender = useRef(true);

  const values = data.values;
  const computed = useMemo(() => computeFiche(def, values), [def, values]);
  const issueById = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);

  // Copie locale plus récente que la version enregistrée (coupure avant envoi).
  useEffect(() => {
    if (mode !== "edit") return;
    // Lu après le montage (le stockage du navigateur n'existe pas au rendu serveur).
    const t = setTimeout(() => {
      const local = readLocal(key);
      if (local && !local.synced && local.at > Date.parse(serverUpdatedAt)) setRestore(local);
    }, 0);
    return () => clearTimeout(t);
  }, [key, mode, serverUpdatedAt]);

  // Copie locale à chaque modification.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (mode !== "edit" || !dirty) return;
    const t = setTimeout(() => writeLocal(key, { data, at: Date.now(), synced: false }), 500);
    return () => clearTimeout(t);
  }, [data, dirty, key, mode]);

  const update = useCallback((patch: (d: FicheData) => FicheData) => {
    setData((d) => patch(d));
    setDirty(true);
  }, []);
  const setValue = (id: string, v: FicheData["values"][string]) => update((d) => ({ ...d, values: { ...d.values, [id]: v } }));
  const setSignature = (id: string, v: SignatureValue | undefined) =>
    update((d) => {
      const signatures = { ...d.signatures };
      if (v) signatures[id] = v;
      else delete signatures[id];
      return { ...d, signatures };
    });

  const save = useCallback(() => {
    startTransition(async () => {
      try {
        const res = mode === "reserved" ? await saveReservedPartAction(formId, JSON.stringify(data)) : await saveFicheAction(formId, JSON.stringify(data));
        if (!res.ok) {
          setMessage({ kind: "error", text: res.error ?? "Enregistrement impossible." });
          return;
        }
        setIssues(res.issues ?? []);
        setDirty(false);
        writeLocal(key, { data, at: Date.now(), synced: true });
        const errors = (res.issues ?? []).filter((i) => i.level === "error").length;
        setMessage({
          kind: "success",
          text: mode === "reserved" ? "Partie réservée enregistrée." : errors ? `Brouillon enregistré. ${errors} point(s) à compléter avant de soumettre.` : "Brouillon enregistré : la fiche est complète.",
        });
        router.refresh();
      } catch {
        setMessage({ kind: "error", text: "Pas de connexion : la fiche est conservée sur ce téléphone. Réessayez dès que la connexion revient." });
      }
    });
  }, [data, formId, key, mode, router]);

  // Retour de la connexion : enregistrement automatique des modifications en attente.
  useEffect(() => {
    if (mode !== "edit") return;
    const onOnline = () => {
      if (dirty) save();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [dirty, mode, save]);

  const submit = () => {
    if (!window.confirm("Soumettre cette fiche ? Elle ne sera plus modifiable, sauf si elle vous est renvoyée pour correction.")) return;
    startTransition(async () => {
      try {
        const res = await submitFicheAction(formId, JSON.stringify(data));
        setIssues(res.issues ?? []);
        if (!res.ok) {
          setMessage({ kind: "error", text: res.error ?? "Soumission impossible." });
          const first = res.issues?.find((i) => i.level === "error");
          if (first) document.getElementById(`f-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        setDirty(false);
        writeLocal(key, { data, at: Date.now(), synced: true });
        setMessage({ kind: "success", text: "Fiche soumise." });
        router.refresh();
      } catch {
        setMessage({ kind: "error", text: "Pas de connexion : la fiche n'a pas été soumise. Elle reste conservée sur ce téléphone." });
      }
    });
  };

  const canEdit = (notForAuthor?: boolean) => (mode === "edit" ? !notForAuthor : mode === "reserved" ? Boolean(notForAuthor) : false);

  // -------------------------------------------------------------------------
  // Rendu des blocs
  // -------------------------------------------------------------------------

  function issueFor(id: string) {
    const i = issueById.get(id);
    return i ? <p className={`mt-1 text-xs ${i.level === "error" ? "text-red-600" : "text-amber-700"}`}>{i.message}</p> : null;
  }

  function renderField(f: FieldDef) {
    if (!isVisible(f.showIf, values)) return null;
    const disabled = !canEdit(f.notForAuthor);
    const raw = values[f.id];
    const v = typeof raw === "string" ? raw : "";
    let input: React.ReactNode;
    switch (f.type) {
      case "textarea":
        input = <textarea id={f.id} className={inputClass} rows={3} value={v} disabled={disabled} onChange={(e) => setValue(f.id, e.target.value)} />;
        break;
      case "choice":
        input =
          (f.options?.length ?? 0) <= 4 && (f.options ?? []).every((o) => o.length <= 24) ? (
            <Chips ariaLabel={f.label} value={v} choices={(f.options ?? []).map((o) => ({ v: o, label: o }))} disabled={disabled} onChange={(x) => setValue(f.id, x)} />
          ) : (
            <select id={f.id} className={inputClass} value={v} disabled={disabled} onChange={(e) => setValue(f.id, e.target.value)}>
              <option value="">Choisir</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          );
        break;
      case "checks": {
        const list = Array.isArray(raw) ? (raw as string[]) : [];
        input = (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {f.options?.map((o) => (
              <label key={o} className="flex min-h-[32px] items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={list.includes(o)}
                  disabled={disabled}
                  onChange={(e) => setValue(f.id, e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
                />
                {o}
              </label>
            ))}
          </div>
        );
        break;
      }
      case "note":
        input = <Chips ariaLabel={f.label} value={v} choices={NOTE_CHOICES} disabled={disabled} onChange={(x) => setValue(f.id, x)} />;
        break;
      case "appreciation":
        input = <Chips ariaLabel={f.label} value={v} choices={APPRECIATION_VALUES.map((x) => ({ v: x, label: x }))} disabled={disabled} onChange={(x) => setValue(f.id, x)} />;
        break;
      default:
        input = (
          <input
            id={f.id}
            className={inputClass}
            type={f.type === "number" ? "text" : f.type}
            inputMode={f.type === "number" ? "decimal" : undefined}
            value={v}
            disabled={disabled}
            onChange={(e) => setValue(f.id, e.target.value)}
          />
        );
    }
    return (
      <div key={f.id} id={`f-${f.id}`} className={f.type === "textarea" || f.type === "checks" ? "sm:col-span-2" : ""}>
        <label htmlFor={f.id} className="mb-1 block text-sm font-medium text-gray-700">
          {f.label}
          {f.required && !disabled && <span className="text-red-500"> *</span>}
        </label>
        {f.hint && <p className="mb-1 text-xs text-gray-500">{f.hint}</p>}
        {input}
        {issueFor(f.id)}
      </div>
    );
  }

  function renderRated(p: RatedPosteDef) {
    const res = computed.postes[p.id];
    const disabled = !canEdit();
    return (
      <div key={p.id} id={`f-${p.id}`} className="sm:col-span-2 rounded-2xl border border-gray-200">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-gray-900">{p.label}</h4>
          <p className="text-xs text-gray-500">
            {p.scale === "M-E" ? "Appréciation M (médiocre) à E (élite) ; « – » neutralisé, « S.O. » sans objet." : "Note de 0 à 4 ; « – » neutralisé, « S.O. » sans objet."}
          </p>
        </div>
        <ul className="divide-y divide-gray-100">
          {p.items.map((item) => {
            const v = typeof values[item.id] === "string" ? (values[item.id] as string) : "";
            const obs = typeof values[obsKey(item.id)] === "string" ? (values[obsKey(item.id)] as string) : "";
            const isFree = p.freeItems?.includes(item.id);
            const low = p.scale === "0-4" ? ["0", "1"].includes(v) : ["M", "AB"].includes(v);
            return (
              <li key={item.id} id={`f-${item.id}`} className="px-4 py-3">
                <div className="mb-2 text-sm text-gray-800">
                  <span className="mr-1 font-mono text-xs text-gray-400">{item.num ?? item.id}</span>
                  {isFree ? (
                    <input
                      className={`${inputClass} mt-1`}
                      placeholder="Rubrique libre (intitulé)"
                      value={typeof values[freeLabelKey(item.id)] === "string" ? (values[freeLabelKey(item.id)] as string) : ""}
                      disabled={disabled}
                      onChange={(e) => setValue(freeLabelKey(item.id), e.target.value)}
                    />
                  ) : (
                    item.label
                  )}
                </div>
                <Chips ariaLabel={item.label} value={v} choices={p.scale === "M-E" ? APPRECIATION_CHOICES : NOTE_CHOICES} disabled={disabled} onChange={(x) => setValue(item.id, x)} />
                {(obs !== "" || low || !disabled) && (
                  <details className="mt-2" open={obs !== "" || low}>
                    <summary className="cursor-pointer text-xs font-medium text-blue-600">Observation</summary>
                    <textarea className={`${inputClass} mt-1`} rows={2} value={obs} disabled={disabled} onChange={(e) => setValue(obsKey(item.id), e.target.value)} />
                  </details>
                )}
                {issueFor(item.id)}
                {issueFor(obsKey(item.id))}
              </li>
            );
          })}
        </ul>
        {p.conversion && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span>
              Total → <strong>{res?.points ?? 0}</strong> pts sur {res?.filled ?? 0} rubrique(s)
            </span>
            {res?.percent !== null && res?.percent !== undefined && <span>Z = {res.percent} %</span>}
            <span>
              ← Conversion : <strong>{res?.note ?? "—"}</strong>
            </span>
          </div>
        )}
        {p.conseils !== false && (
          <div className="border-t border-gray-100 px-4 py-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">{p.conseilsLabel ?? "Conseils"}</label>
            <textarea className={inputClass} rows={2} value={typeof values[conseilsKey(p.id)] === "string" ? (values[conseilsKey(p.id)] as string) : ""} disabled={disabled} onChange={(e) => setValue(conseilsKey(p.id), e.target.value)} />
          </div>
        )}
      </div>
    );
  }

  function renderTable(t: TableDef) {
    const rows = rowsOf(t, values);
    const res = computed.tables[t.id];
    const disabled = !canEdit();
    const setRows = (next: TableRow[]) => setValue(t.id, next);
    const setCell = (rowId: string, col: string, v: string) => setRows(rows.map((r) => (r._id === rowId ? { ...r, [col]: v } : r)));
    return (
      <div key={t.id} id={`f-${t.id}`} className="sm:col-span-2">
        <p className="mb-2 text-sm font-medium text-gray-700">{t.label}</p>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                {t.fixedRows && <th className="px-2 py-2" />}
                {t.columns.map((c) => (
                  <th key={c.id} className="px-2 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
                {!t.fixedRows && !disabled && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row._id}>
                  {t.fixedRows && <th className="whitespace-nowrap px-2 py-1 text-left text-xs font-semibold text-gray-700">{t.fixedRows.find((f) => f.id === row._id)?.label}</th>}
                  {t.columns.map((c) => {
                    const calc = c.percentOf || c.sumOf;
                    if (calc) {
                      const n = res?.percents[row._id]?.[c.id];
                      return (
                        <td key={c.id} className="px-2 py-1 text-right text-gray-600">
                          {n ?? "—"}
                        </td>
                      );
                    }
                    if (c.type === "signature") {
                      return (
                        <td key={c.id} className="min-w-[180px] px-2 py-1">
                          <Pad value={row[c.id]} disabled={disabled} height={70} onChange={(image) => setCell(row._id, c.id, image ?? "")} />
                        </td>
                      );
                    }
                    return (
                      <td key={c.id} className="px-1 py-1">
                        {c.type === "choice" ? (
                          <select className={`${inputClass} min-w-[96px] py-1.5`} value={row[c.id] ?? ""} disabled={disabled} onChange={(e) => setCell(row._id, c.id, e.target.value)}>
                            <option value="" />
                            {c.options?.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={`${inputClass} py-1.5 ${c.type === "number" ? "min-w-[64px] text-right" : "min-w-[120px]"}`}
                            type={c.type === "date" ? "date" : "text"}
                            inputMode={c.type === "number" ? "decimal" : undefined}
                            value={row[c.id] ?? ""}
                            disabled={disabled}
                            onChange={(e) => setCell(row._id, c.id, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}
                  {!t.fixedRows && !disabled && (
                    <td className="px-1">
                      <button type="button" aria-label="Supprimer la ligne" className="px-2 text-red-500" onClick={() => setRows(rows.filter((r) => r._id !== row._id))}>
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {(t.sumColumns?.length ?? 0) > 0 && (
                <tr className="bg-gray-50 font-semibold">
                  {t.fixedRows && <th className="px-2 py-1 text-left text-xs">TOTAL</th>}
                  {t.columns.map((c, i) => (
                    <td key={c.id} className="px-2 py-1 text-right text-xs">
                      {t.sumColumns?.includes(c.id) ? res?.totals[c.id] : !t.fixedRows && i === 0 ? "TOTAL" : ""}
                    </td>
                  ))}
                  {!t.fixedRows && !disabled && <td />}
                </tr>
              )}
              {t.percentRow && (
                <tr className="bg-gray-50 text-xs">
                  {t.fixedRows && <th className="px-2 py-1 text-left">%</th>}
                  {t.columns.map((c) => (
                    <td key={c.id} className="px-2 py-1 text-right">
                      {res?.columnPercents[c.id] ?? ""}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {t.groupBy && res && Object.keys(res.subtotals).length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {Object.entries(res.subtotals).map(([g, sums]) => (
              <li key={g}>
                S/Total {g} : {Object.entries(sums).map(([c, n]) => `${t.columns.find((x) => x.id === c)?.label ?? c} ${n}`).join(" · ")}
              </li>
            ))}
          </ul>
        )}
        {!t.fixedRows && !disabled && (
          <Button type="button" variant="ghost" className="mt-2" onClick={() => setRows([...rows, { _id: `r${Date.now().toString(36)}` } as TableRow])}>
            + Ajouter une ligne
          </Button>
        )}
        {issueFor(t.id)}
      </div>
    );
  }

  function renderBlock(b: Block, i: number) {
    if ("showIf" in b && !isVisible(b.showIf, values)) return null;
    switch (b.kind) {
      case "field":
        return renderField(b);
      case "rated":
        return renderRated(b);
      case "table":
        return renderTable(b);
      case "signature":
        return (
          <div key={b.id} id={`f-${b.id}`} className="sm:col-span-2">
            <SignatureField
              label={b.label}
              mention={b.mention}
              allowRefusal={b.allowRefusal}
              value={data.signatures[b.id]}
              disabled={!canEdit(b.notForAuthor)}
              onChange={(v) => setSignature(b.id, v)}
            />
            {issueFor(b.id)}
          </div>
        );
      case "computed":
        return (
          <div key={b.id} className="sm:col-span-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {b.label} : <strong>{computed.derived[b.id] ? new Date(computed.derived[b.id]! + "T00:00:00").toLocaleDateString("fr-FR") : "—"}</strong>
          </div>
        );
      case "text":
        return (
          <p key={`t${i}`} className={`sm:col-span-2 text-sm ${b.style === "legal" ? "italic text-gray-800" : b.style === "note" ? "rounded-xl bg-amber-50 px-3 py-2 text-amber-900" : "text-gray-800"}`}>
            {b.text}
          </p>
        );
    }
  }

  const header = [...commonHeaderFields(def), ...def.header];
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-6 pb-28">
      {restore && (
        <Alert variant="info">
          <p>Une copie de cette fiche, plus récente que la version enregistrée, est conservée sur ce téléphone ({new Date(restore.at).toLocaleString("fr-FR")}).</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" onClick={() => { setData(restore.data); setDirty(true); setRestore(null); }}>
              Reprendre cette copie
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRestore(null)}>
              Ignorer
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">En-tête</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{header.map(renderField)}</div>
      </Card>

      {def.sections.map((s) =>
        isVisible(s.showIf, values) ? (
          <Card key={s.id}>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">{s.title}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{s.blocks.map(renderBlock)}</div>
          </Card>
        ) : null
      )}

      {def.synthese && computed.synthese && (
        <Card id="f-synthese">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{def.synthese.label}</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {computed.synthese.parts.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 text-gray-700">{p.label}</td>
                  <td className="py-1.5 text-right font-semibold">{p.note ?? "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">← Conversion / Total →</td>
                <td className="py-1.5 text-right">
                  {computed.synthese.note ?? "—"} / {computed.synthese.total ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white">
            {def.synthese.finalLabel} : <strong>{computed.synthese.mention ?? "non calculable"}</strong>
          </p>
          <ConversionReference def={def} />
          {issueFor("synthese")}
        </Card>
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">À vérifier</h3>
          <ul className="space-y-1 text-sm">
            {[...errors, ...warnings].map((i, n) => (
              <li key={n}>
                <button type="button" className={`text-left hover:underline ${i.level === "error" ? "text-red-700" : "text-amber-700"}`} onClick={() => document.getElementById(`f-${i.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                  {i.level === "error" ? "• " : "◦ "}
                  {i.message}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {mode !== "view" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              {message ? <span className={message.kind === "error" ? "text-red-600" : message.kind === "success" ? "text-emerald-700" : ""}>{message.text}</span> : dirty ? "Modifications non enregistrées (copie conservée sur ce téléphone)." : "À jour."}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={save}>
                {pending ? "…" : mode === "reserved" ? "Enregistrer" : "Enregistrer le brouillon"}
              </Button>
              {mode === "edit" && (
                <Button type="button" disabled={pending} onClick={submit}>
                  Soumettre
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tableau de conversion imprimé sur la fiche, pour référence. */
function ConversionReference({ def }: { def: FicheDef }) {
  const table = def.synthese?.table;
  if (!table) return null;
  const rows = CONVERSION_TABLES[table];
  return (
    <details className="mt-3 text-xs text-gray-600">
      <summary className="cursor-pointer font-medium text-blue-600">Tableau de conversion</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-center">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1">NOTE</th>
              {[4, 3, 2, 1, 0].map((n) => (
                <th key={n} className="px-2 py-1">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="px-2 py-1">%</th>
              {[...PERCENT_BOUNDS, 0].map((b, i) => (
                <td key={i} className="px-2 py-1">
                  {i === 0 ? "100" : PERCENT_BOUNDS[i - 1] - 1}–{b}
                </td>
              ))}
            </tr>
            {Object.entries(rows).map(([rr, bounds]) => (
              <tr key={rr}>
                <th className="px-2 py-1">{rr}</th>
                {[...bounds, 0].map((b, i) => (
                  <td key={i} className="px-2 py-1">
                    {i === 0 ? Number(rr) * 4 : bounds[i - 1] - 1}–{b}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="italic">
              <th className="px-2 py-1">MENTION</th>
              {[...MENTIONS].reverse().map((m) => (
                <td key={m} className="px-2 py-1">
                  {m}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function StatusBadge({ label, keyName }: { label: string; keyName: string }) {
  const color = keyName === "A_CORRIGER" || keyName === "REJETE" ? "red" : keyName === "VALIDE" || keyName === "CLOTURE" ? "green" : "blue";
  return <Badge color={color}>{label}</Badge>;
}
