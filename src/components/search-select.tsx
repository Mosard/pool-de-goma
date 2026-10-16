"use client";

// Liste déroulante avec recherche (modèle « combobox » WAI-ARIA) pour les
// listes longues : comptes, agents, écoles, inspecteurs. La valeur part dans un
// champ du même `name` : formulaires et actions serveur inchangés. Les options
// sont celles que le serveur a déjà filtrées selon les droits du lecteur.
// Les listes courtes et fixes (OUI/NON, statuts…) gardent le <Select> natif.

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { clsx } from "clsx";
import { filterOptions, type SearchOption } from "./search-select-filter";

export type { SearchOption } from "./search-select-filter";

const MAX_SHOWN = 60;

export function SearchSelect({
  name,
  options,
  defaultValue = "",
  value: controlled,
  onChange,
  placeholder = "Rechercher…",
  emptyLabel = "Aucun résultat",
  required,
  disabled,
  id,
  "aria-label": ariaLabel,
  className,
}: {
  name?: string;
  options: readonly SearchOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const auto = useId();
  const inputId = id ?? `${auto}-saisie`;
  const listId = `${auto}-liste`;
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => filterOptions(options, open ? query : ""), [options, query, open]);
  const shown = matches.slice(0, MAX_SHOWN);

  function choose(o: SearchOption | null) {
    const v = o?.value ?? "";
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
    setQuery("");
    setOpen(false);
  }

  function move(delta: number) {
    if (!open) setOpen(true);
    setActive((i) => {
      const next = Math.max(0, Math.min(shown.length - 1, i + delta));
      listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      if (open && shown[active]) {
        e.preventDefault();
        choose(shown[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(0, shown.length - 1));
    }
  }

  return (
    <div className={clsx("relative", className)}>
      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            const i = selected ? options.findIndex((o) => o.value === selected.value) : 0;
            setActive(i >= 0 && i < MAX_SHOWN ? i : 0);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-16 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {selected && !disabled && !required && (
            <button
              type="button"
              aria-label="Effacer la sélection"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                choose(null);
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={14} aria-hidden />
            </button>
          )}
          <ChevronDown size={16} aria-hidden className="text-gray-400" />
        </div>
      </div>

      {/* Valeur envoyée avec le formulaire ; « required » contrôlé par le navigateur. */}
      {name && (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={value}
          required={required}
          onChange={() => {}}
          onFocus={() => inputRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      )}

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2.5 text-gray-500" role="presentation">
              {emptyLabel}
            </li>
          ) : (
            shown.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={clsx(
                  "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2",
                  i === active ? "bg-blue-50 text-blue-900" : "text-gray-800",
                  o.value === value && "font-medium"
                )}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-gray-500">{o.hint}</span>}
              </li>
            ))
          )}
          {matches.length > MAX_SHOWN && (
            <li role="presentation" className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
              {matches.length - MAX_SHOWN} autre(s) résultat(s) : précisez la recherche.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
