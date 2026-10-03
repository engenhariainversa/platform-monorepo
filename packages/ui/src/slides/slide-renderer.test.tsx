import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SLIDE_TEMPLATES } from "@repo/slides";
import { SlideRenderer } from "./slide-renderer";

const TEXT_TEMPLATES = ["cover", "agenda", "section", "bullets", "quote", "stats"] as const;

describe("SlideRenderer", () => {
  it.each(TEXT_TEMPLATES)("renders the %s example without the warning", (key) => {
    const html = renderToStaticMarkup(
      <SlideRenderer template={key} content={SLIDE_TEMPLATES[key].example} slideNumber={3} />,
    );
    expect(html).not.toContain("Slide inválido");
  });

  it("renders the cover title", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="cover"
        content={{ ...SLIDE_TEMPLATES.cover.defaults, title: "Engenharia reversa de apps" }}
      />,
    );
    expect(html).toContain("Engenharia reversa de apps");
  });

  it("renders every bullet item", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer template="bullets" content={{ title: "Pauta", items: ["Primeiro", "Segundo"] }} />,
    );
    expect(html).toContain("Primeiro");
    expect(html).toContain("Segundo");
  });

  it("shows the slide number in the footer and hides the footer on the cover", () => {
    const section = renderToStaticMarkup(
      <SlideRenderer template="section" content={SLIDE_TEMPLATES.section.example} slideNumber={7} />,
    );
    expect(section).toContain(">07<");
    const cover = renderToStaticMarkup(
      <SlideRenderer template="cover" content={SLIDE_TEMPLATES.cover.example} slideNumber={7} />,
    );
    expect(cover).not.toContain(">07<");
  });

  it("renders a warning for an unknown template", () => {
    const html = renderToStaticMarkup(<SlideRenderer template="nope" content={{}} />);
    expect(html).toContain("Slide inválido: nope");
  });

  it("renders a warning for invalid content instead of throwing", () => {
    const html = renderToStaticMarkup(<SlideRenderer template="cover" content={{ title: "" }} />);
    expect(html).toContain("Slide inválido: cover");
  });

  it("renders the overlay slot", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="quote"
        content={SLIDE_TEMPLATES.quote.example}
        overlay={<span data-testid="pointer">•</span>}
      />,
    );
    expect(html).toContain('data-testid="pointer"');
  });
});
