// Forme des champs dynamiques d'un FormTemplate.fieldsSchema (remplace les
// fiches A1/C101/T1 codées en dur — voir prisma/seed.ts pour les modèles de
// démonstration actuels, marqués provisoires conformément au §10 du cahier
// des charges).

export type FormFieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  options?: string[];
  required?: boolean;
};

export type FormFieldsSchema = FormFieldDef[];

export function parseFieldsSchema(value: unknown): FormFieldsSchema {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is FormFieldDef =>
      typeof f === "object" && f !== null && typeof (f as FormFieldDef).name === "string"
  );
}
