import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SLIDE_TEMPLATES, SLIDE_TEMPLATE_KEYS } from "@repo/slides";
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

describe("SlideRenderer — all templates", () => {
  it.each(SLIDE_TEMPLATE_KEYS)("renders the %s example without the warning", (key) => {
    const html = renderToStaticMarkup(
      <SlideRenderer template={key} content={SLIDE_TEMPLATES[key].example} slideNumber={1} />,
    );
    expect(html).not.toContain("Slide inválido");
  });

  it("highlights code tokens for a language prism-react-renderer does not bundle", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="code"
        content={{ language: "bash", code: 'echo "oi"\nadb shell pm list packages' }}
      />,
    );
    expect(html).toContain("token");
    expect(html).toContain("adb shell pm list packages");
  });

  it("marks highlighted code lines", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="code"
        content={{ language: "ts", code: "const a = 1;\nconst b = 2;", highlightLines: [2] }}
      />,
    );
    expect(html.match(/data-highlighted="true"/g)).toHaveLength(1);
  });

  it("resolves image URLs through the context", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="image"
        content={{ image: { url: "/uploads/a.png", alt: "Diagrama" }, fit: "contain" }}
        context={{ resolveUrl: (url) => `https://api.example.com${url}` }}
      />,
    );
    expect(html).toContain('src="https://api.example.com/uploads/a.png"');
    expect(html).toContain('alt="Diagrama"');
  });

  it("lists social links on the closing slide only when enabled", () => {
    const context = { socialLinks: [{ label: "YouTube", url: "https://youtube.com/@ei" }] };
    const on = renderToStaticMarkup(
      <SlideRenderer template="closing" content={{ title: "Obrigado!", showSocialLinks: true }} context={context} />,
    );
    expect(on).toContain("YouTube");
    const off = renderToStaticMarkup(
      <SlideRenderer template="closing" content={{ title: "Obrigado!", showSocialLinks: false }} context={context} />,
    );
    expect(off).not.toContain("YouTube");
  });
});
