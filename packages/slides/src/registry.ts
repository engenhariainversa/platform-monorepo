import type { z } from "zod";
import { agenda } from "./templates/agenda";
import { bullets } from "./templates/bullets";
import { closing } from "./templates/closing";
import { code } from "./templates/code";
import { comparison } from "./templates/comparison";
import { cover } from "./templates/cover";
import { image } from "./templates/image";
import { quote } from "./templates/quote";
import { section } from "./templates/section";
import { split } from "./templates/split";
import { stats } from "./templates/stats";

export type { SlideTemplateDefinition } from "./definition";

/** Display order of the template gallery. */
export const SLIDE_TEMPLATE_KEYS = [
  "cover", "agenda", "section", "bullets", "split", "code",
  "closing", "quote", "comparison", "stats", "image",
] as const;
export type SlideTemplateKey = (typeof SLIDE_TEMPLATE_KEYS)[number];

export const SLIDE_TEMPLATES = {
  cover, agenda, section, bullets, split, code, closing, quote, comparison, stats, image,
} as const;

export type SlideContentByTemplate = {
  [K in SlideTemplateKey]: z.output<(typeof SLIDE_TEMPLATES)[K]["schema"]>;
};
export type CoverContent = SlideContentByTemplate["cover"];
export type AgendaContent = SlideContentByTemplate["agenda"];
export type SectionContent = SlideContentByTemplate["section"];
export type BulletsContent = SlideContentByTemplate["bullets"];
export type SplitContent = SlideContentByTemplate["split"];
export type CodeContent = SlideContentByTemplate["code"];
export type ClosingContent = SlideContentByTemplate["closing"];
export type QuoteContent = SlideContentByTemplate["quote"];
export type ComparisonContent = SlideContentByTemplate["comparison"];
export type StatsContent = SlideContentByTemplate["stats"];
export type ImageContent = SlideContentByTemplate["image"];

export function isSlideTemplateKey(value: string): value is SlideTemplateKey {
  return (SLIDE_TEMPLATE_KEYS as readonly string[]).includes(value);
}
