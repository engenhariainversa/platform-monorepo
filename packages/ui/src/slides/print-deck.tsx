"use client";

import { useEffect, useMemo } from "react";
import { SlideRenderer, type SlideContext } from "./slide-renderer";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./canvas";
import { visibleSlides, type PlayerSlide } from "./navigation";

export type PrintDeckProps = {
  slides: PlayerSlide[];
  context?: SlideContext;
  autoPrint?: boolean;
};

function waitForImages(): Promise<unknown> {
  return Promise.all(
    Array.from(document.images).map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
    ),
  );
}

/**
 * Every visible slide at 1920×1080, one per page. The canvases measure a
 * 1920px-wide container, so they render at scale 1.
 */
export function PrintDeck({ slides, context, autoPrint = true }: PrintDeckProps) {
  const shown = useMemo(() => visibleSlides(slides), [slides]);

  useEffect(() => {
    if (!autoPrint) return;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      await waitForImages();
      // Two frames: let the canvases apply their measured scale first.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!cancelled) window.print();
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPrint]);

  return (
    <>
      <style>{`
        @page { size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px; margin: 0; }
        html, body { margin: 0; padding: 0; background: #021525; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <div style={{ width: SLIDE_WIDTH }}>
        {shown.map((slide, i) => (
          <div
            key={slide.id}
            style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, breakAfter: "page", pageBreakAfter: "always", overflow: "hidden" }}
          >
            <SlideRenderer template={slide.template} content={slide.content} slideNumber={i + 1} context={context} />
          </div>
        ))}
      </div>
    </>
  );
}
