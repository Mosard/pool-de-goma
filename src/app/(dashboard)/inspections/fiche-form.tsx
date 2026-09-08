"use client";

import { Button, Card, Input, Label, Select, Textarea, Badge } from "@/components/ui";
import { FICHE_DEFINITIONS, type FicheType } from "@/lib/fiches";
import { saveFicheAction } from "./actions";

export function FicheForm({
  inspectionId,
  type,
  existingData,
  completed,
  readOnly,
}: {
  inspectionId: string;
  type: FicheType;
  existingData?: Record<string, string>;
  completed: boolean;
  readOnly: boolean;
}) {
  const def = FICHE_DEFINITIONS[type];
  const action = saveFicheAction.bind(null, inspectionId, type);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{def.title}</h3>
        <Badge color={completed ? "green" : "gray"}>{completed ? "Complétée" : "À remplir"}</Badge>
      </div>
      <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {def.fields.map((field) => (
          <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <Label htmlFor={`${type}-${field.name}`}>{field.label}</Label>
            {field.type === "select" ? (
              <Select
                id={`${type}-${field.name}`}
                name={field.name}
                defaultValue={existingData?.[field.name] ?? ""}
                disabled={readOnly}
              >
                <option value="" disabled>Choisir</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea
                id={`${type}-${field.name}`}
                name={field.name}
                rows={3}
                defaultValue={existingData?.[field.name] ?? ""}
                disabled={readOnly}
              />
            ) : (
              <Input
                id={`${type}-${field.name}`}
                name={field.name}
                type={field.type}
                defaultValue={existingData?.[field.name] ?? ""}
                disabled={readOnly}
              />
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="sm:col-span-2">
            <Button type="submit">Enregistrer la fiche</Button>
          </div>
        )}
      </form>
    </Card>
  );
}
