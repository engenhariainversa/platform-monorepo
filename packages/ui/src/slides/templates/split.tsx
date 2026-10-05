import type { SplitContent } from "@repo/slides";
import type { SlideContext } from "../slide-renderer";
import { SLIDE_PADDING } from "../canvas";

export function SplitSlide({ content, context }: { content: SplitContent; context: Required<SlideContext> }) {
  const paragraphs = content.body.split(/\n\s*\n/).filter((p) => p.trim() !== "");
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={context.resolveUrl(content.image.url)}
      alt={content.image.alt}
      className="h-full w-full rounded-xl border-[2px] border-outline-variant object-cover"
    />
  );
  return (
    <div className={`absolute inset-0 grid grid-cols-2 gap-[80px] ${SLIDE_PADDING}`}>
      {content.imageSide === "left" && <div className="min-h-0">{image}</div>}
      <div className="flex min-h-0 flex-col justify-center">
        <h2 className="font-headline font-bold text-[64px] leading-[1.1] text-on-surface">
          {content.title}
        </h2>
        <div className="mt-[40px] space-y-[24px]">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[30px] leading-[1.5] text-on-surface-variant">
              {p}
            </p>
          ))}
        </div>
      </div>
      {content.imageSide === "right" && <div className="min-h-0">{image}</div>}
    </div>
  );
}
