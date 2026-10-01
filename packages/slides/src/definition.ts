import type { z } from "zod";
import type { FieldDescriptor } from "./fields";

export interface SlideTemplateDefinition<
  S extends z.ZodType = z.ZodType,
  K extends string = string,
> {
  key: K;
  label: string;
  description: string;
  schema: S;
  defaults: z.output<S>;
  example: z.output<S>;
  fields: FieldDescriptor[];
}
