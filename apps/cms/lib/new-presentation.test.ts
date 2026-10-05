import { describe, expect, it } from "vitest";
import { parseSlideContent } from "@repo/slides";
import { starterSlides } from "./new-presentation";

describe("starterSlides", () => {
  it("creates cover, agenda and closing, in that order", () => {
    expect(starterSlides("Minha live").map((s) => s.template)).toEqual(["cover", "agenda", "closing"]);
  });

  it("puts the presentation title on the cover", () => {
    expect(starterSlides("Minha live")[0].content.title).toBe("Minha live");
  });

  it("produces valid content even for a title longer than the cover allows", () => {
    for (const slide of starterSlides("x".repeat(200))) {
      expect(parseSlideContent(slide.template, slide.content).ok).toBe(true);
    }
  });
});
