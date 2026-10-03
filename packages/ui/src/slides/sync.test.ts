import { describe, expect, it } from "vitest";
import { createSlideSync } from "./sync";

// Node 20 ships a global BroadcastChannel, so two instances in one process
// talk to each other like two browser windows do.
describe("createSlideSync", () => {
  it("delivers the index posted by another instance on the same deck", async () => {
    const a = createSlideSync("deck-1");
    const b = createSlideSync("deck-1");
    const received = new Promise<number>((resolve) => b.subscribe(resolve));
    a.post(4);
    await expect(received).resolves.toBe(4);
    a.close();
    b.close();
  });

  it("does not deliver to another deck", async () => {
    const a = createSlideSync("deck-1");
    const other = createSlideSync("deck-2");
    let got: number | null = null;
    other.subscribe((i) => (got = i));
    a.post(2);
    await new Promise((r) => setTimeout(r, 50));
    expect(got).toBeNull();
    a.close();
    other.close();
  });

  it("is a no-op without BroadcastChannel", () => {
    const original = globalThis.BroadcastChannel;
    // @ts-expect-error simulating an environment without the API
    delete globalThis.BroadcastChannel;
    try {
      const sync = createSlideSync("deck-1");
      expect(() => sync.post(1)).not.toThrow();
      expect(typeof sync.subscribe(() => {})).toBe("function");
      sync.close();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });
});
