"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils";

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

// Inlined on purpose: the CMS stylesheet does not define the landing's
// `.technical-grid` / `.pipeline-line` utilities, and the canvas must look the
// same in both apps and in print.
const TECHNICAL_GRID = "radial-gradient(rgba(164, 140, 125, 0.1) 1px, transparent 1px)";
export const PIPELINE_GRADIENT =
  "linear-gradient(90deg, #ffb783 0%, #ebbf01 50%, #243648 100%)";

/** Content padding for templates that sit above the footer bar. */
export const SLIDE_PADDING = "px-[120px] pt-[96px] pb-[160px]";

export type SlideCanvasProps = {
  children: ReactNode;
  showFooter?: boolean;
  slideNumber?: number;
  overlay?: ReactNode;
  className?: string;
};

/**
 * A fixed 1920×1080 surface scaled to the width of its container. Every size
 * inside is absolute, so a thumbnail, the editor preview, fullscreen and the
 * printed page are pixel-identical apart from the scale factor.
 */
export function SlideCanvas({
  children,
  showFooter = true,
  slideNumber,
  overlay,
  className,
}: SlideCanvasProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  // null until measured: the surface stays hidden for that first frame instead
  // of flashing at full size.
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SLIDE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className={cn("relative w-full overflow-hidden bg-background", className)}
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left bg-background text-on-surface font-body"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : "visible",
          backgroundImage: TECHNICAL_GRID,
          backgroundSize: "32px 32px",
        }}
      >
        <div className="absolute inset-0">{children}</div>
        {showFooter && <SlideFooter slideNumber={slideNumber} />}
        {overlay && <div className="absolute inset-0">{overlay}</div>}
      </div>
    </div>
  );
}

function SlideFooter({ slideNumber }: { slideNumber?: number }) {
  return (
    <div className="absolute left-[120px] right-[120px] bottom-[48px] flex items-center gap-[32px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/engenharia-inversa-logo.svg" alt="" className="h-[44px] w-auto" />
      <div className="h-[4px] flex-1 rounded-full" style={{ background: PIPELINE_GRADIENT }} />
      {slideNumber !== undefined && (
        <span className="font-code text-[24px] text-on-surface-variant tabular-nums">
          {String(slideNumber).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
