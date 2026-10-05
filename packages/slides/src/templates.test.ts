import { describe, expect, it } from "vitest";
import { SLIDE_TEMPLATE_KEYS, parseSlideContent } from "./index";

const issuesOf = (template: string, content: unknown) => {
  const r = parseSlideContent(template, content);
  return r.ok ? [] : r.issues;
};

describe("template catalogue", () => {
  it("has the 11 templates in gallery order", () => {
    expect(SLIDE_TEMPLATE_KEYS).toEqual([
      "cover", "agenda", "section", "bullets", "split", "code",
      "closing", "quote", "comparison", "stats", "image",
    ]);
  });
});

describe("split", () => {
  const base = { title: "T", body: "Texto", image: { url: "/uploads/a.png" } };
  it("defaults imageSide to right and alt to empty", () => {
    expect(parseSlideContent("split", base)).toMatchObject({
      ok: true,
      data: { imageSide: "right", image: { url: "/uploads/a.png", alt: "" } },
    });
  });
  it("rejects a relative non-upload URL", () => {
    expect(issuesOf("split", { ...base, image: { url: "img/a.png" } })).toContainEqual({
      path: "image.url",
      message: "Use uma URL http(s) ou um caminho /uploads/…",
    });
  });
});

describe("code", () => {
  const base = { language: "kotlin", code: "fun main() {}" };
  it("keeps indentation (no trim) and accepts highlight lines", () => {
    const r = parseSlideContent("code", { ...base, code: "  val x = 1\n", highlightLines: [1] });
    expect(r).toMatchObject({ ok: true, data: { code: "  val x = 1\n" } });
  });
  it("rejects more than 24 lines", () => {
    expect(issuesOf("code", { ...base, code: Array(25).fill("x").join("\n") })).toContainEqual({
      path: "code",
      message: "Máximo de 24 linhas",
    });
  });
  it("rejects blank code", () => {
    expect(issuesOf("code", { ...base, code: "   \n " })).toContainEqual({ path: "code", message: "Obrigatório" });
  });
  it("rejects unknown languages", () => {
    expect(issuesOf("code", { ...base, language: "cobol" })[0].path).toBe("language");
  });
});

describe("closing", () => {
  it("defaults title and showSocialLinks", () => {
    expect(parseSlideContent("closing", {})).toMatchObject({
      ok: true,
      data: { title: "Obrigado!", showSocialLinks: true },
    });
  });
  it("accepts # as a CTA url", () => {
    expect(parseSlideContent("closing", { cta: { text: "Inscreva-se", url: "#" } })).toMatchObject({ ok: true });
  });
});

describe("comparison", () => {
  it("requires both columns and defaults highlight to none", () => {
    const col = { label: "Antes", items: ["a"] };
    expect(parseSlideContent("comparison", { title: "T", left: col, right: col })).toMatchObject({
      ok: true,
      data: { highlight: "none" },
    });
    expect(issuesOf("comparison", { title: "T", left: col })).toContainEqual({ path: "right", message: "Esperado um objeto" });
  });
});

describe("stats", () => {
  it("needs between 2 and 4 items", () => {
    const item = { value: "15k", label: "Devs" };
    expect(issuesOf("stats", { items: [item] })).toContainEqual({ path: "items", message: "Mínimo de 2 itens" });
    expect(issuesOf("stats", { items: Array(5).fill(item) })).toContainEqual({ path: "items", message: "Máximo de 4 itens" });
  });
});

describe("quote and image", () => {
  it("quote requires the quote text", () => {
    expect(issuesOf("quote", { author: "Linus" })).toContainEqual({ path: "quote", message: "Obrigatório" });
  });
  it("image defaults fit to contain", () => {
    expect(parseSlideContent("image", { image: { url: "https://x.dev/a.png", alt: "A" } })).toMatchObject({
      ok: true,
      data: { fit: "contain" },
    });
  });
});
