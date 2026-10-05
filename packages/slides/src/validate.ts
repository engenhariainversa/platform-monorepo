import { z } from "zod";
import { SLIDE_TEMPLATES, isSlideTemplateKey, type SlideTemplateKey } from "./registry";

export interface SlideIssue {
  /** Dot path into the content ("steps.2.title"); "" = the content root; "template" = unknown key. */
  path: string;
  message: string;
}

export type ParseSlideResult =
  | { ok: true; template: SlideTemplateKey; data: Record<string, unknown> }
  | { ok: false; issues: SlideIssue[] };

export function parseSlideContent(template: string, content: unknown): ParseSlideResult {
  if (!isSlideTemplateKey(template)) {
    return { ok: false, issues: [{ path: "template", message: `Modelo desconhecido: ${template}` }] };
  }
  const result = (SLIDE_TEMPLATES[template].schema as z.ZodType).safeParse(content);
  if (result.success) {
    return { ok: true, template, data: result.data as Record<string, unknown> };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}

/** JSON Schema of the content an API client must send (input side: defaults are optional). */
export function slideTemplateJsonSchema(template: SlideTemplateKey): Record<string, unknown> {
  return z.toJSONSchema(SLIDE_TEMPLATES[template].schema as z.ZodType, {
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
}
