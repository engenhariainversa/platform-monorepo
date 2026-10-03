"use client";

import type { ReactNode } from "react";
import {
  parseSlideContent,
  type SlideContentByTemplate,
  type SlideTemplateKey,
} from "@repo/slides";
import { SlideCanvas } from "./canvas";
import { InvalidSlide } from "./invalid-slide";
import { CoverSlide } from "./templates/cover";
import { AgendaSlide } from "./templates/agenda";
import { SectionSlide } from "./templates/section";
import { BulletsSlide } from "./templates/bullets";
import { QuoteSlide } from "./templates/quote";
import { StatsSlide } from "./templates/stats";

/** Data a slide cannot hold itself, supplied by the hosting app. */
export type SlideContext = {
  socialLinks?: { label: string; url: string }[];
  /** Maps stored URLs (e.g. `/uploads/x.png`) to fetchable ones. Defaults to identity. */
  resolveUrl?: (url: string) => string;
};

type RendererProps<K extends SlideTemplateKey> = {
  content: SlideContentByTemplate[K];
  context: Required<SlideContext>;
};

const RENDERERS: { [K in SlideTemplateKey]?: (props: RendererProps<K>) => JSX.Element } = {
  cover: CoverSlide,
  agenda: AgendaSlide,
  section: SectionSlide,
  bullets: BulletsSlide,
  quote: QuoteSlide,
  stats: StatsSlide,
};

// Full-bleed templates draw edge to edge and carry no footer bar.
const NO_FOOTER = new Set<SlideTemplateKey>(["cover", "image"]);

export type SlideRendererProps = {
  template: string;
  content: unknown;
  slideNumber?: number;
  context?: SlideContext;
  overlay?: ReactNode;
};

/**
 * Validates the content against its template and draws it. Anything that does
 * not validate becomes a warning slide: one bad slide never takes the deck down.
 */
export function SlideRenderer({ template, content, slideNumber, context, overlay }: SlideRendererProps) {
  const parsed = parseSlideContent(template, content);
  const Renderer = parsed.ok
    ? (RENDERERS[parsed.template] as ((props: RendererProps<SlideTemplateKey>) => JSX.Element) | undefined)
    : undefined;

  if (!parsed.ok || !Renderer) {
    return (
      <SlideCanvas slideNumber={slideNumber} overlay={overlay}>
        <InvalidSlide template={template} />
      </SlideCanvas>
    );
  }

  const fullContext: Required<SlideContext> = {
    socialLinks: context?.socialLinks ?? [],
    resolveUrl: context?.resolveUrl ?? ((url) => url),
  };

  return (
    <SlideCanvas
      showFooter={!NO_FOOTER.has(parsed.template)}
      slideNumber={slideNumber}
      overlay={overlay}
    >
      <Renderer content={parsed.data as never} context={fullContext} />
    </SlideCanvas>
  );
}
