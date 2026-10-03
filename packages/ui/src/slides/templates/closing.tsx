import type { ClosingContent } from "@repo/slides";
import type { SlideContext } from "../slide-renderer";
import { PIPELINE_GRADIENT, SLIDE_PADDING } from "../canvas";

export function ClosingSlide({ content, context }: { content: ClosingContent; context: Required<SlideContext> }) {
  const links = content.showSocialLinks
    ? context.socialLinks.filter((link) => link.url.trim() !== "")
    : [];
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${SLIDE_PADDING}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-mascot.png" alt="" className="h-[260px] w-auto drop-shadow-[0_20px_50px_rgba(230,126,34,0.3)]" />
      <h2 className="mt-[32px] font-headline font-extrabold text-[104px] leading-[1.05] text-on-surface">
        {content.title}
      </h2>
      <div className="mt-[32px] h-[6px] w-[280px] rounded-full" style={{ background: PIPELINE_GRADIENT }} />
      {content.message && (
        <p className="mt-[32px] max-w-[1300px] text-[34px] leading-[1.4] text-on-surface-variant">
          {content.message}
        </p>
      )}
      {content.cta && (
        <span className="mt-[40px] inline-block rounded-lg bg-primary px-[56px] py-[24px] font-bold uppercase text-[30px] text-on-primary">
          {content.cta.text}
          <span className="ml-[16px] font-code font-normal normal-case text-[22px] opacity-80">
            {content.cta.url}
          </span>
        </span>
      )}
      {links.length > 0 && (
        <ul className="mt-[40px] flex flex-wrap justify-center gap-[40px]">
          {links.map((link) => (
            <li key={link.url} className="font-label font-semibold text-[28px] text-tertiary">
              {link.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
