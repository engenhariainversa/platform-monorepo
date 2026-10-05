import type { CoverContent } from "@repo/slides";
import { PIPELINE_GRADIENT } from "../canvas";

export function CoverSlide({ content }: { content: CoverContent }) {
  return (
    <div className="absolute inset-0 flex items-center gap-[64px] px-[120px]">
      <div className="absolute right-[-160px] top-1/2 h-[900px] w-[900px] -translate-y-1/2 rounded-full bg-primary/10 blur-[160px]" />
      <div className="relative flex-1 space-y-[40px]">
        {content.label && (
          <span className="block font-label font-semibold uppercase tracking-[0.2em] text-[28px] text-secondary-container">
            {content.label}
          </span>
        )}
        <h1 className="font-headline font-extrabold text-[104px] leading-[1.05] tracking-[-0.02em] text-on-surface">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="max-w-[1000px] text-[36px] leading-[1.4] text-on-surface-variant">
            {content.subtitle}
          </p>
        )}
        <div className="h-[6px] w-[360px] rounded-full" style={{ background: PIPELINE_GRADIENT }} />
        {content.date && (
          <p className="font-code text-[28px] text-on-surface-variant">{content.date}</p>
        )}
      </div>
      {content.showMascot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/logo-mascot.png"
          alt=""
          className="relative w-[600px] shrink-0 drop-shadow-[0_20px_50px_rgba(230,126,34,0.3)]"
        />
      )}
    </div>
  );
}
