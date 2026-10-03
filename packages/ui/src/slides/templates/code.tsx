import { Highlight, Prism } from "prism-react-renderer";
import type { CodeContent } from "@repo/slides";
import { PRISM_LANGUAGE } from "../prism-languages";
import { codeTheme } from "../code-theme";
import { SLIDE_PADDING } from "../canvas";

export function CodeSlide({ content }: { content: CodeContent }) {
  const highlighted = new Set(content.highlightLines ?? []);
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      {content.title && (
        <h2 className="font-headline font-bold text-[56px] leading-[1.1] text-on-surface">
          {content.title}
        </h2>
      )}
      <div className="mt-[32px] min-h-0 flex-1 overflow-hidden rounded-xl border-[2px] border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b-[2px] border-outline-variant px-[32px] py-[12px]">
          <span className="font-code text-[20px] uppercase tracking-[0.15em] text-on-surface-variant">
            {content.language}
          </span>
        </div>
        <Highlight prism={Prism} theme={codeTheme} code={content.code.replace(/\n$/, "")} language={PRISM_LANGUAGE[content.language]}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="py-[20px] font-code text-[22px] leading-[29px]" style={{ fontVariantLigatures: "none" }}>
              {tokens.map((line, i) => {
                const isHighlighted = highlighted.has(i + 1);
                const { key: _lineKey, ...lineProps } = getLineProps({ line });
                return (
                  <div
                    key={i}
                    {...lineProps}
                    data-highlighted={isHighlighted ? "true" : undefined}
                    className={`flex px-[32px] ${isHighlighted ? "bg-primary/15" : ""}`}
                  >
                    <span className="w-[56px] shrink-0 select-none text-right pr-[24px] text-outline">
                      {i + 1}
                    </span>
                    <span>
                      {line.map((token, j) => {
                        const { key: _tokenKey, ...tokenProps } = getTokenProps({ token });
                        return <span key={j} {...tokenProps} />;
                      })}
                    </span>
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
      {content.caption && (
        <p className="mt-[24px] text-[26px] text-on-surface-variant">{content.caption}</p>
      )}
    </div>
  );
}
