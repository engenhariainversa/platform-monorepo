import { describe, expect, it } from "vitest";
import type { Presentation, Slide } from "@repo/types";
import {
  coverInfo,
  ogTitleFontSize,
  presentationDescription,
  presentationImageUrl,
  presentationMetadata,
  presentationUrl,
} from "./presentation-meta";

const BASE = "https://engenhariainversa.com.br";

function slide(overrides: Partial<Slide>): Slide {
  return { id: "s1", order: 0, template: "cover", content: {}, notes: null, hidden: false, ...overrides };
}

function deck(overrides: Partial<Presentation> = {}): Presentation {
  return {
    id: "p1",
    slug: "como-criar-um-site-em-15-minutos",
    title: "Como criar um site em 15 minutos",
    description: "Descrição do deck",
    visibility: "PUBLIC",
    slideCount: 1,
    slides: [
      slide({
        content: { label: "LIVE #12", title: "Site em 15 minutos", subtitle: "Do zero ao deploy", date: "1 de outubro" },
      }),
    ],
    deletedAt: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("coverInfo", () => {
  it("reads the cover slide", () => {
    expect(coverInfo(deck())).toEqual({
      label: "LIVE #12",
      title: "Site em 15 minutos",
      subtitle: "Do zero ao deploy",
      date: "1 de outubro",
    });
  });

  it("uses the first visible cover in slide order", () => {
    const presentation = deck({
      slides: [
        slide({ id: "c", order: 2, content: { title: "Terceira" } }),
        slide({ id: "a", order: 0, hidden: true, content: { title: "Oculta" } }),
        slide({ id: "b", order: 1, content: { title: "Segunda" } }),
      ],
    });
    expect(coverInfo(presentation).title).toBe("Segunda");
  });

  it("falls back to the deck title without a cover", () => {
    const presentation = deck({ slides: [slide({ template: "bullets", content: { title: "Tópicos" } })] });
    expect(coverInfo(presentation)).toEqual({
      label: null,
      title: "Como criar um site em 15 minutos",
      subtitle: null,
      date: null,
    });
  });

  it("ignores blank and non-string fields", () => {
    const presentation = deck({ slides: [slide({ content: { title: "  ", subtitle: 42, label: "" } })] });
    expect(coverInfo(presentation)).toEqual({
      label: null,
      title: "Como criar um site em 15 minutos",
      subtitle: null,
      date: null,
    });
  });
});

describe("presentationDescription", () => {
  it("prefers the cover subtitle", () => {
    expect(presentationDescription(deck())).toBe("Do zero ao deploy");
  });

  it("falls back to the deck description", () => {
    expect(presentationDescription(deck({ slides: [] }))).toBe("Descrição do deck");
  });

  it("falls back to a generic line", () => {
    expect(presentationDescription(deck({ slides: [], description: null }))).toBe(
      "Apresentação de Pedro Goiano no Engenharia Inversa.",
    );
  });

  it("collapses whitespace and truncates at a word boundary", () => {
    const long = `${"palavra ".repeat(40)}fim`;
    const description = presentationDescription(deck({ slides: [], description: `linha um\n\n${long}` }));
    expect(description.startsWith("linha um palavra")).toBe(true);
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith("palavra…")).toBe(true);
  });
});

describe("urls", () => {
  it("builds the canonical URL", () => {
    expect(presentationUrl("minha-live", BASE)).toBe(`${BASE}/apresentacoes/minha-live`);
  });

  it("versions the image URL with the last update", () => {
    expect(presentationImageUrl(deck(), BASE)).toBe(
      `${BASE}/apresentacoes/como-criar-um-site-em-15-minutos/og.png?v=${Date.parse("2026-10-02T12:00:00.000Z")}`,
    );
  });
});

describe("presentationMetadata", () => {
  it("emits Open Graph and Twitter Card tags for a public deck", () => {
    const metadata = presentationMetadata(deck(), BASE);
    const url = `${BASE}/apresentacoes/como-criar-um-site-em-15-minutos`;
    const image = {
      url: `${url}/og.png?v=${Date.parse("2026-10-02T12:00:00.000Z")}`,
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "Como criar um site em 15 minutos — Pedro Goiano, Engenharia Inversa",
    };
    expect(metadata.title).toBe("Como criar um site em 15 minutos | Engenharia Inversa");
    expect(metadata.description).toBe("Do zero ao deploy");
    expect(metadata.alternates).toEqual({ canonical: url });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url,
      siteName: "Engenharia Inversa",
      title: "Como criar um site em 15 minutos",
      description: "Do zero ao deploy",
      images: [image],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Como criar um site em 15 minutos",
      description: "Do zero ao deploy",
      images: [image],
    });
  });

  it("leaks nothing when the deck is missing or not public", () => {
    const metadata = presentationMetadata(null, BASE);
    expect(metadata).toEqual({
      title: "Apresentação não encontrada | Engenharia Inversa",
      robots: { index: false, follow: false },
    });
  });
});

describe("ogTitleFontSize", () => {
  it("shrinks as the title grows", () => {
    const sizes = [10, 30, 50, 90].map((length) => ogTitleFontSize("x".repeat(length)));
    expect(sizes).toEqual([92, 78, 66, 56]);
  });
});
