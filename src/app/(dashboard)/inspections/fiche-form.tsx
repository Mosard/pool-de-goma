"use client";

import { Button, Card, Input, Label, Select, Textarea, Badge } from "@/components/ui";
import { parseFieldsSchema } from "@/lib/form-schema";
import { saveFicheAction } from "./actions";

type TemplateProp = {
  id: string;
  title: string;
  fieldsSchema: unknown;
  category: { label: string };
};

export function FicheForm({
  inspectionId,
  template,
  existingData,
  completed,
  readOnly,
}: {
  inspectionId: string;
  template: TemplateProp;
  existingData?: Record<string, string>;
  completed: boolean;
  readOnly: boolean;
}) {
  const fields = parseFieldsSchema(template.fieldsSchema);
  const action = saveFicheAction.bind(null, inspectionId, template.id);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{template.title}</h3>
          <p className="text-xs text-gray-400">{template.category.label}</p>
        </div>
        <Badge color={completed ? "green" : "gray"}>{completed ? "Complétée" : "À remplir"}</Badge>
      </div>
      <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <Label htmlFor={`${template.id}-${field.name}`}>{field.label}</Label>
            {field.type === "select" ? (
              <Select
                id={`${template.id}-${field.name}`}
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
                id={`${template.id}-${field.name}`}
                name={field.name}
                rows={3}
                defaultValue={existingData?.[field.name] ?? ""}
                disabled={readOnly}
              />
            ) : (
              <Input
                id={`${template.id}-${field.name}`}
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
