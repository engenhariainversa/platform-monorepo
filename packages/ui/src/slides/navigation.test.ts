import { describe, expect, it } from "vitest";
import { formatElapsed, indexFromHash, navReducer, visibleSlides, type PlayerSlide } from "./navigation";

const slide = (id: string, hidden = false): PlayerSlide => ({
  id, template: "bullets", content: {}, notes: null, hidden,
});

describe("visibleSlides", () => {
  it("drops hidden slides and keeps order", () => {
    expect(visibleSlides([slide("a"), slide("b", true), slide("c")]).map((s) => s.id)).toEqual(["a", "c"]);
  });
});

describe("navReducer", () => {
  const at = (index: number, count = 5) => ({ index, count });

  it("moves forward and back within bounds", () => {
    expect(navReducer(at(0), { type: "next" })).toEqual(at(1));
    expect(navReducer(at(4), { type: "next" })).toEqual(at(4));
    expect(navReducer(at(0), { type: "prev" })).toEqual(at(0));
    expect(navReducer(at(3), { type: "prev" })).toEqual(at(2));
  });

  it("jumps to first, last and an arbitrary slide (clamped)", () => {
    expect(navReducer(at(3), { type: "first" })).toEqual(at(0));
    expect(navReducer(at(0), { type: "last" })).toEqual(at(4));
    expect(navReducer(at(0), { type: "goto", index: 2 })).toEqual(at(2));
    expect(navReducer(at(0), { type: "goto", index: 99 })).toEqual(at(4));
    expect(navReducer(at(2), { type: "goto", index: -3 })).toEqual(at(0));
  });

  it("returns the same object when nothing changes", () => {
    const state = at(4);
    expect(navReducer(state, { type: "next" })).toBe(state);
    expect(navReducer(state, { type: "goto", index: 4 })).toBe(state);
  });

  it("clamps the index when the deck shrinks", () => {
    expect(navReducer(at(4, 5), { type: "resize", count: 3 })).toEqual(at(2, 3));
    expect(navReducer(at(1, 5), { type: "resize", count: 0 })).toEqual(at(0, 0));
  });

  it("stays at 0 on an empty deck", () => {
    expect(navReducer(at(0, 0), { type: "next" })).toEqual(at(0, 0));
    expect(navReducer(at(0, 0), { type: "last" })).toEqual(at(0, 0));
  });
});

describe("indexFromHash", () => {
  it("reads a 1-based slide number", () => {
    expect(indexFromHash("#7", 10)).toBe(6);
  });
  it("clamps out-of-range numbers", () => {
    expect(indexFromHash("#99", 10)).toBe(9);
    expect(indexFromHash("#0", 10)).toBe(0);
  });
  it("falls back to the first slide on anything else", () => {
    expect(indexFromHash("", 10)).toBe(0);
    expect(indexFromHash("#abc", 10)).toBe(0);
    expect(indexFromHash("#t=eip_x", 10)).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("formats minutes and seconds, adding hours past 60 minutes", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65_400)).toBe("01:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });
});
