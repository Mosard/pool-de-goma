// Champ de saisie d'après sa définition (defs.ts) : libellé visible, erreur
// sous le champ, aucun champ obligatoire.

import { Field, Input, Select, Textarea } from "@/components/ui";
import type { FieldDef } from "@/lib/personnel-file/defs";

export function FieldInput({ field: f, value, error, idPrefix }: { field: FieldDef; value: string; error?: string; idPrefix: string }) {
  const id = `${idPrefix}-${f.key}`;
  const invalid = error ? { "aria-invalid": true, "aria-describedby": `${id}-err` } : {};
  let control: React.ReactNode;
  switch (f.kind) {
    case "yesno":
      control = (
        <Select id={id} name={f.key} defaultValue={value} {...invalid}>
          <option value="">—</option>
          <option value="OUI">OUI</option>
          <option value="NON">NON</option>
        </Select>
      );
      break;
    case "choice":
      control = (
        <Select id={id} name={f.key} defaultValue={value} {...invalid}>
          <option value="">—</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
      break;
    case "list":
    case "textarea":
      control = <Textarea id={id} name={f.key} defaultValue={value} rows={f.kind === "list" ? 3 : 2} {...invalid} />;
      break;
    case "date":
      control = <Input id={id} name={f.key} type="date" defaultValue={value} min="1900-01-01" max="2100-12-31" {...invalid} />;
      break;
    case "year":
      control = <Input id={id} name={f.key} inputMode="numeric" maxLength={4} placeholder="AAAA" defaultValue={value} className="tabular-nums" {...invalid} />;
      break;
    case "number":
      control = <Input id={id} name={f.key} inputMode="numeric" maxLength={2} defaultValue={value} className="tabular-nums" {...invalid} />;
      break;
    case "email":
      control = <Input id={id} name={f.key} type="email" autoComplete="off" defaultValue={value} {...invalid} />;
      break;
    case "tel":
      control = <Input id={id} name={f.key} type="tel" inputMode="tel" defaultValue={value} {...invalid} />;
      break;
    default:
      control = <Input id={id} name={f.key} defaultValue={value} maxLength={f.maxLength ?? 200} {...invalid} />;
  }
  return (
    <div className={f.kind === "list" || f.kind === "textarea" || f.label.length > 60 ? "sm:col-span-2" : undefined}>
      <Field label={f.label}>{control}</Field>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
