import type { z } from "zod";
import { SLIDE_TEMPLATES, type SlideTemplateKey } from "./registry";

/**
 * Content for `to`, built from its defaults plus every field of `content` that
 * `to` also has and whose value passes that field's schema. Always valid for `to`.
 */
export function switchTemplate(
  content: Record<string, unknown>,
  to: SlideTemplateKey,
): Record<string, unknown> {
  const def = SLIDE_TEMPLATES[to];
  const shape = (def.schema as unknown as z.ZodObject).shape as Record<string, z.ZodType>;
  const next: Record<string, unknown> = structuredClone(def.defaults) as Record<string, unknown>;

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const value = content[key];
    if (value === undefined) continue;
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) next[key] = structuredClone(value);
  }
  return next;
}
