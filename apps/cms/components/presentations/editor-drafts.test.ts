import { describe, expect, it } from "vitest";
import { mergeDrafts, moveId, type SlideDraft } from "./editor-drafts";

const server = (id: string, title: string) => ({
  id, order: 0, template: "bullets", content: { title, items: ["a"] }, notes: "", hidden: false,
});
const draft = (id: string, title: string): SlideDraft => ({
  id, template: "bullets", content: { title, items: ["a"] }, notes: "", hidden: false,
});

describe("mergeDrafts", () => {
  it("takes server order and content for slides without pending edits", () => {
    const merged = mergeDrafts([server("b", "B2"), server("a", "A2")], [draft("a", "A1"), draft("b", "B1")], new Set());
    expect(merged.map((d) => [d.id, d.content.title])).toEqual([["b", "B2"], ["a", "A2"]]);
  });

  it("keeps the local draft of a slide with a pending save", () => {
    const merged = mergeDrafts([server("a", "server")], [draft("a", "local")], new Set(["a"]));
    expect(merged[0].content.title).toBe("local");
  });

  it("adds new server slides and drops deleted ones", () => {
    const merged = mergeDrafts([server("c", "C")], [draft("a", "A")], new Set());
    expect(merged.map((d) => d.id)).toEqual(["c"]);
  });

  it("turns a null note into an empty string", () => {
    expect(mergeDrafts([{ ...server("a", "A"), notes: null }], [], new Set())[0].notes).toBe("");
  });
});

describe("moveId", () => {
  it("moves an id to a new position", () => {
    expect(moveId(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("ignores out-of-range targets", () => {
    expect(moveId(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
