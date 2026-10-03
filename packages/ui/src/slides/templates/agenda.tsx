import type { AgendaContent } from "@repo/slides";
import { PIPELINE_GRADIENT, SLIDE_PADDING } from "../canvas";

/** The steps drawn as a numbered pipeline: nodes joined by the brand gradient. */
export function AgendaSlide({ content }: { content: AgendaContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      <h2 className="font-headline font-bold text-[72px] leading-[1.1] text-on-surface">
        {content.title}
      </h2>
      <div className="relative mt-auto mb-auto">
        <div
          className="absolute left-[48px] right-[48px] top-[47px] h-[6px] rounded-full"
          style={{ background: PIPELINE_GRADIENT }}
        />
        <ol className="relative flex justify-between gap-[24px]">
          {content.steps.map((step, i) => (
            <li key={i} className="flex flex-1 flex-col items-start gap-[24px]">
              <span className="flex h-[100px] w-[100px] items-center justify-center rounded-full border-[4px] border-primary bg-surface-container-lowest font-code font-medium text-[36px] text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-headline font-semibold text-[32px] leading-[1.2] text-on-surface">
                {step.title}
              </span>
              {step.description && (
                <span className="text-[22px] leading-[1.4] text-on-surface-variant">
                  {step.description}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
