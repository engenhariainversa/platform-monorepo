import type { BulletsContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

export function BulletsSlide({ content }: { content: BulletsContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      <h2 className="font-headline font-bold text-[72px] leading-[1.1] text-on-surface">
        {content.title}
      </h2>
      <ul className="mt-[64px] space-y-[32px]">
        {content.items.map((item, i) => (
          <li key={i} className="flex items-start gap-[32px]">
            <span className="mt-[18px] h-[16px] w-[16px] shrink-0 rounded-[3px] bg-primary-container" />
            <span className="text-[40px] leading-[1.35] text-on-surface">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
