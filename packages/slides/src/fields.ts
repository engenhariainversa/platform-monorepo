export type FieldKind =
  | "text"
  | "textarea"
  | "code"
  | "select"
  | "boolean"
  | "image"
  | "list"
  | "group"
  | "objectList";

/** Drives the CMS form for one content key. Declared by hand next to each schema. */
export interface FieldDescriptor {
  name: string;
  label: string;
  kind: FieldKind;
  optional?: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
  minItems?: number;
  maxItems?: number;
  fields?: FieldDescriptor[];
  help?: string;
}
