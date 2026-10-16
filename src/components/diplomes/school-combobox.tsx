"use client";

import { useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ChevronsUpDown } from "lucide-react";
import { normalizeName } from "@/lib/diplomes/criteria";

export type SchoolOptionGroup = { pool: string; schools: string[] };

const MAX_OPTIONS = 50;

/**
 * Liste déroulante avec recherche intégrée (motif ARIA « combobox » + listbox).
 * Les suggestions viennent des établissements publiés de la plateforme ; la
 * saisie libre reste permise, car le référentiel du service des titres n'est
 * pas encore connu. La valeur envoyée est le nom (aucun identifiant interne).
 */
export function SchoolCombobox({
  id,
  name,
  groups,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  groups: SchoolOptionGroup[];
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const options = useMemo(() => {
    const query = normalizeName(value);
    const flat: { pool: string; school: string }[] = [];
    for (const g of groups) {
      for (const school of g.schools) {
        if (!query || normalizeName(school).includes(query)) flat.push({ pool: g.pool, school });
      }
    }
    return flat.slice(0, MAX_OPTIONS);
  }, [groups, value]);

  const showList = open && options.length > 0;

  function choose(school: string) {
    setValue(school);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(options[active].school);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={150}
        value={value}
        placeholder={groups.length > 0 ? "Rechercher ou saisir le nom de l'établissement" : "Saisir le nom de l'établissement"}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={clsx(
          "w-full rounded-xl border bg-white py-3 pl-3.5 pr-10 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 sm:text-sm",
          invalid ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
        )}
      />
      <ChevronsUpDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />

      <ul
        id={listId}
        role="listbox"
        aria-label="Établissements enregistrés"
        hidden={!showList}
        className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
      >
        {options.map((o, i) => {
          const selected = normalizeName(o.school) === normalizeName(value);
          return (
            <li
              key={`${o.pool}-${o.school}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={selected}
              // mousedown : choisir avant que le champ ne perde le focus.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.school);
              }}
              onMouseEnter={() => setActive(i)}
              className={clsx(
                "flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm",
                i === active ? "bg-blue-50 text-blue-900" : "text-gray-800"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{o.school}</span>
                <span className="block text-xs text-gray-500">POOL de {o.pool}</span>
              </span>
              {selected && <Check size={16} className="shrink-0 text-blue-600" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
