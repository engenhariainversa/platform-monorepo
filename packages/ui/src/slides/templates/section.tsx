import type { SectionContent } from "@repo/slides";
import { PIPELINE_GRADIENT, SLIDE_PADDING } from "../canvas";

export function SectionSlide({ content }: { content: SectionContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${SLIDE_PADDING}`}>
      {content.number && (
        <span className="font-code font-medium text-[160px] leading-none text-primary/40">
          {content.number}
        </span>
      )}
      <h2 className="mt-[24px] font-headline font-extrabold text-[112px] leading-[1.05] tracking-[-0.02em] text-on-surface">
        {content.title}
      </h2>
      <div className="mt-[40px] h-[6px] w-[280px] rounded-full" style={{ background: PIPELINE_GRADIENT }} />
      {content.tagline && (
        <p className="mt-[40px] max-w-[1300px] text-[36px] leading-[1.4] text-on-surface-variant">
          {content.tagline}
        </p>
      )}
    </div>
  );
}
