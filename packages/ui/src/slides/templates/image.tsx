import type { ImageContent } from "@repo/slides";
import type { SlideContext } from "../slide-renderer";

export function ImageSlide({ content, context }: { content: ImageContent; context: Required<SlideContext> }) {
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={context.resolveUrl(content.image.url)}
        alt={content.image.alt}
        className={`h-full w-full ${content.fit === "cover" ? "object-cover" : "object-contain"}`}
      />
      {content.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent px-[120px] pb-[56px] pt-[120px]">
          <p className="text-[32px] text-on-surface">{content.caption}</p>
        </div>
      )}
    </div>
  );
}
