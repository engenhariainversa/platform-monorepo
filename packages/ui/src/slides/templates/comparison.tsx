import type { ComparisonContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

type Side = ComparisonContent["left"];

function Column({ side, highlighted }: { side: Side; highlighted: boolean }) {
  return (
    <div
      className={`rounded-xl border-[3px] px-[48px] py-[40px] ${
        highlighted ? "border-primary bg-primary/10" : "border-outline-variant bg-surface-container"
      }`}
    >
      <p
        className={`font-label font-semibold uppercase tracking-[0.15em] text-[28px] ${
          highlighted ? "text-primary" : "text-on-surface-variant"
        }`}
      >
        {side.label}
      </p>
      <ul className="mt-[32px] space-y-[24px]">
        {side.items.map((item, i) => (
          <li key={i} className="flex items-start gap-[20px] text-[32px] leading-[1.35] text-on-surface">
            <span className="mt-[14px] h-[12px] w-[12px] shrink-0 rounded-[2px] bg-secondary-container" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonSlide({ content }: { content: ComparisonContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      <h2 className="font-headline font-bold text-[64px] leading-[1.1] text-on-surface">
        {content.title}
      </h2>
      <div className="mt-[56px] grid flex-1 grid-cols-2 items-start gap-[48px]">
        <Column side={content.left} highlighted={content.highlight === "left"} />
        <Column side={content.right} highlighted={content.highlight === "right"} />
      </div>
    </div>
  );
}
