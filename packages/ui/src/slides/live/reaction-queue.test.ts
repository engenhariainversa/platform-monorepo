import { describe, expect, it } from "vitest";
import { FLOAT_MS, MAX_FLOATING, addReactions } from "./reaction-queue";

const ids = () => {
  let n = 0;
  return () => n++;
};

describe("addReactions", () => {
  it("adds one floating emoji per reaction", () => {
    const items = addReactions([], [{ kind: "FIRE", count: 2 }, { kind: "CLAP", count: 1 }], 1000, ids());
    expect(items.map((i) => [i.kind, i.count])).toEqual([["FIRE", 1], ["FIRE", 1], ["CLAP", 1]]);
    expect(items.every((i) => i.bornAt === 1000)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("groups what does not fit on screen: 20 singles, the rest as ×N", () => {
    const items = addReactions([], [{ kind: "FIRE", count: 32 }], 1000, ids());
    expect(items).toHaveLength(MAX_FLOATING + 1);
    expect(items.at(-1)).toMatchObject({ kind: "FIRE", count: 12 });
  });

  it("merges later overflow into the existing group instead of growing without bound", () => {
    const next = ids();
    let items = addReactions([], [{ kind: "FIRE", count: 32 }], 1000, next);
    items = addReactions(items, [{ kind: "FIRE", count: 50 }, { kind: "HEART", count: 5 }], 1100, next);
    expect(items).toHaveLength(MAX_FLOATING + 2);
    expect(items.find((i) => i.kind === "FIRE" && i.count > 1)).toMatchObject({ count: 62, bornAt: 1100 });
    expect(items.find((i) => i.kind === "HEART")).toMatchObject({ count: 5 });
  });

  it("drops emojis that finished floating", () => {
    const next = ids();
    const first = addReactions([], [{ kind: "FIRE", count: 2 }], 1000, next);
    const later = addReactions(first, [{ kind: "CLAP", count: 1 }], 1000 + FLOAT_MS, next);
    expect(later.map((i) => i.kind)).toEqual(["CLAP"]);
  });
});
