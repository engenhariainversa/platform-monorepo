import { describe, expect, it } from "vitest";
import { createSlideSync, createSyncGate } from "./sync";

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

/**
 * Two "windows" wired like `useDeckNavigation`: the post decision runs after
 * every index change (the effect), and the first run is the mount.
 */
function fakeWindow(initial: number) {
  const sync = createSlideSync("deck-gate");
  const gate = createSyncGate();
  const posted: number[] = [];
  const w = {
    index: initial,
    posted,
    /** One effect run, as after a render with this index. */
    render(index: number) {
      w.index = index;
      if (gate.shouldPost(index)) {
        posted.push(index);
        sync.post(index);
      }
    },
    close: () => sync.close(),
  };
  sync.subscribe((index) => {
    gate.receive(index);
    if (index !== w.index) w.render(index);
  });
  w.render(initial); // mount
  return w;
}

const settle = () => new Promise((r) => setTimeout(r, 30));

describe("createSyncGate", () => {
  it("does not announce the index on first mount", () => {
    const gate = createSyncGate();
    expect(gate.shouldPost(0)).toBe(false);
    expect(gate.shouldPost(5)).toBe(true);
  });

  it("does not echo back an index received from the other window", () => {
    const gate = createSyncGate();
    gate.shouldPost(0);
    gate.receive(3);
    expect(gate.shouldPost(3)).toBe(false);
  });

  it("converges when two messages arrive before a re-render (0 then 3)", () => {
    const gate = createSyncGate();
    gate.shouldPost(3); // audience mounted on slide 4
    gate.receive(0);
    gate.receive(3); // batched: the index never leaves 3, no effect runs
    expect(gate.shouldPost(0)).toBe(true); // a later local move to 0 is announced
  });

  it("announces a return to a previously received index", () => {
    const gate = createSyncGate();
    gate.shouldPost(0);
    gate.receive(2);
    expect(gate.shouldPost(2)).toBe(false);
    expect(gate.shouldPost(3)).toBe(true);
    expect(gate.shouldPost(2)).toBe(true);
  });

  it("keeps two windows in sync over BroadcastChannel without flashing", async () => {
    const audience = fakeWindow(0);
    audience.render(3);
    await settle();
    // Presenter opens at #4: its mount run sees 0, then the hash goto renders 3.
    const presenter = fakeWindow(0);
    presenter.render(3);
    await settle();
    expect(presenter.posted).toEqual([3]); // 0 was never broadcast
    expect(audience.index).toBe(3);

    presenter.render(4);
    await settle();
    expect(audience.index).toBe(4);
    expect(audience.posted).toEqual([3]); // no echo of 4

    audience.render(3);
    await settle();
    expect(presenter.index).toBe(3);
    presenter.render(4); // back to an index it once received
    await settle();
    expect(audience.index).toBe(4);
    audience.close();
    presenter.close();
  });
});
