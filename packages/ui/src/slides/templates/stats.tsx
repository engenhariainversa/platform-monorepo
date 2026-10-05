import type { StatsContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

export function StatsSlide({ content }: { content: StatsContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      {content.title && (
        <h2 className="font-headline font-bold text-[72px] leading-[1.1] text-on-surface">
          {content.title}
        </h2>
      )}
      <div className="my-auto grid gap-[40px]" style={{ gridTemplateColumns: `repeat(${content.items.length}, minmax(0, 1fr))` }}>
        {content.items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border-[2px] border-outline-variant bg-surface-container px-[48px] py-[56px]"
          >
            <p className="font-headline font-extrabold text-[120px] leading-none text-secondary-container">
              {item.value}
            </p>
            <p className="mt-[24px] font-label font-semibold uppercase tracking-[0.12em] text-[28px] text-on-surface-variant">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
