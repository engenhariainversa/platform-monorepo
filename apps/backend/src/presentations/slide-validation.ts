import { isSlideTemplateKey, parseSlideContent, type SlideTemplateKey } from "@repo/slides";
import { invalidSlideContent, unknownTemplate } from "./presentation-errors";

export interface SlideInputData {
  template: string;
  content: unknown;
  notes?: string | null;
  hidden?: boolean | null;
}

export interface ValidSlide {
  template: SlideTemplateKey;
  content: Record<string, unknown>;
  notes: string;
  hidden: boolean;
}

export function validateSlide(input: SlideInputData, slideIndex: number): ValidSlide {
  if (!isSlideTemplateKey(input.template)) throw unknownTemplate(slideIndex, input.template);
  const parsed = parseSlideContent(input.template, input.content);
  if (!parsed.ok) throw invalidSlideContent(slideIndex, input.template, parsed.issues);
  return {
    template: parsed.template,
    content: parsed.data,
    notes: input.notes ?? "",
    hidden: input.hidden ?? false,
  };
}

/** Validates every slide before anything is written; the first failure wins. */
export function validateSlides(inputs: SlideInputData[]): ValidSlide[] {
  return inputs.map((input, index) => validateSlide(input, index));
}
