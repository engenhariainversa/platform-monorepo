import { describe, expect, it } from "vitest";
import { SLIDE_TEMPLATES, SLIDE_TEMPLATE_KEYS, parseSlideContent, switchTemplate } from "./index";

describe("switchTemplate", () => {
  it("keeps compatible same-name fields and fills the rest from defaults", () => {
    const next = switchTemplate({ title: "Meu título", items: ["a", "b"] }, "code");
    expect(next.title).toBe("Meu título");
    expect(next.code).toBe(SLIDE_TEMPLATES.code.defaults.code);
    expect(next).not.toHaveProperty("items");
  });

  it("drops a value that violates the new template's limit", () => {
    const next = switchTemplate({ title: "x".repeat(85) }, "section");
    expect(next.title).toBe(SLIDE_TEMPLATES.section.defaults.title);
  });

  it("drops a value of the wrong shape", () => {
    const next = switchTemplate({ title: "T", items: ["a", "b"] }, "stats");
    expect(next.items).toEqual(SLIDE_TEMPLATES.stats.defaults.items);
  });

  it("always produces valid content, for every pair of templates", () => {
    for (const from of SLIDE_TEMPLATE_KEYS) {
      for (const to of SLIDE_TEMPLATE_KEYS) {
        const next = switchTemplate(SLIDE_TEMPLATES[from].example as Record<string, unknown>, to);
        expect(parseSlideContent(to, next), `${from} → ${to}`).toMatchObject({ ok: true });
      }
    }
  });

  it("does not share references with the defaults", () => {
    const next = switchTemplate({}, "bullets");
    (next.items as string[]).push("mutated");
    expect(SLIDE_TEMPLATES.bullets.defaults.items).not.toContain("mutated");
  });
});
