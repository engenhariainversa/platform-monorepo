"use client";

import { SLIDE_TEMPLATES, type SlideTemplateKey } from "@repo/slides";
import { FieldInput } from "./field-input";
import { setAt, type Path } from "./form-state";

export type SlideFormProps = {
  template: SlideTemplateKey;
  value: Record<string, unknown>;
  /** From issuesByPath(parseSlideContent(...).issues); "" holds root-level issues. */
  issues: Record<string, string>;
  onChange: (next: Record<string, unknown>) => void;
};

/** The template's form, generated from the registry's field descriptors. */
export function SlideForm({ template, value, issues, onChange }: SlideFormProps) {
  const fields = SLIDE_TEMPLATES[template].fields;
  const handleChange = (path: Path, next: unknown) => onChange(setAt(value, path, next));

  return (
    <div className="space-y-4">
      {issues[""] && <p className="text-xs text-error">{issues[""]}</p>}
      {fields.map((field) => (
        <FieldInput key={field.name} field={field} path={[field.name]} value={value[field.name]} issues={issues} onChange={handleChange} />
      ))}
    </div>
  );
}
