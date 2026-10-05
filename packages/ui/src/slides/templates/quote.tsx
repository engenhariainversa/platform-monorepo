import type { QuoteContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

export function QuoteSlide({ content }: { content: QuoteContent }) {
  const attribution = [content.author, content.role].filter(Boolean).join(" — ");
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${SLIDE_PADDING}`}>
      <span className="font-headline font-extrabold text-[240px] leading-[0.6] text-primary/30">“</span>
      <blockquote className="mt-[24px] max-w-[1500px] font-headline font-semibold text-[64px] leading-[1.25] text-on-surface">
        {content.quote}
      </blockquote>
      {attribution && (
        <p className="mt-[56px] font-label font-semibold text-[32px] text-secondary-container">
          {attribution}
        </p>
      )}
    </div>
  );
}
