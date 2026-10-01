import type { z } from "zod";
import { agenda } from "./templates/agenda";
import { bullets } from "./templates/bullets";
import { cover } from "./templates/cover";
import { section } from "./templates/section";

export type { SlideTemplateDefinition } from "./definition";

/** Display order of the template gallery. */
export const SLIDE_TEMPLATE_KEYS = ["cover", "agenda", "section", "bullets"] as const;
export type SlideTemplateKey = (typeof SLIDE_TEMPLATE_KEYS)[number];

export const SLIDE_TEMPLATES = { cover, agenda, section, bullets } as const;

export type SlideContentByTemplate = {
  [K in SlideTemplateKey]: z.output<(typeof SLIDE_TEMPLATES)[K]["schema"]>;
};
export type CoverContent = SlideContentByTemplate["cover"];
export type AgendaContent = SlideContentByTemplate["agenda"];
export type SectionContent = SlideContentByTemplate["section"];
export type BulletsContent = SlideContentByTemplate["bullets"];

export function isSlideTemplateKey(value: string): value is SlideTemplateKey {
  return (SLIDE_TEMPLATE_KEYS as readonly string[]).includes(value);
}
