import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

describe("LiveSessionService — reactions", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  const reactions = () => events.filter((e) => e.type === "REACTIONS");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = [];
    vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
      events.push(event as LiveEventData);
    });
    service.start(DECK);
    events.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("refuses reactions when the presentation is not live", () => {
    expect(service.react("other", "FIRE", "socket-1")).toBe(false);
  });

  it("allows one reaction per 300 ms per socket", () => {
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
    vi.advanceTimersByTime(299);
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
  });

  it("allows a burst of at most 10 per 5 seconds per socket", () => {
    let accepted = 0;
    for (let i = 0; i < 16; i++) {
      if (service.react("deck-1", "CLAP", "socket-1")) accepted += 1;
      vi.advanceTimersByTime(300);
    }
    expect(accepted).toBe(10); // 16 × 300 ms = 4.8 s: still inside the first window
    vi.advanceTimersByTime(200);
    expect(service.react("deck-1", "CLAP", "socket-1")).toBe(true);
  });

  it("limits each socket on its own", () => {
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
    expect(service.react("deck-1", "FIRE", "socket-2")).toBe(true);
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(false);
  });

  it("sums reactions in 250 ms windows: fan-out is bounded whatever the audience size", () => {
    for (let i = 0; i < 500; i++) service.react("deck-1", i % 2 ? "FIRE" : "CLAP", `socket-${i}`);
    expect(reactions()).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(reactions()).toEqual([
      { type: "REACTIONS", reactions: [{ kind: "CLAP", count: 250 }, { kind: "FIRE", count: 250 }] },
    ]);

    vi.advanceTimersByTime(1000);
    expect(reactions()).toHaveLength(1); // nothing to report: no empty events
  });

  it("publishes at most 4 REACTIONS events per second under a constant flood", () => {
    for (let ms = 0; ms < 1000; ms += 10) {
      service.react("deck-1", "HEART", `socket-${ms}`);
      vi.advanceTimersByTime(10);
    }
    expect(reactions().length).toBeLessThanOrEqual(4);
    expect(reactions().reduce((sum, e) => sum + (e.reactions?.[0].count ?? 0), 0)).toBeGreaterThanOrEqual(75);
  });

  it("keeps per-kind totals for the presenter, gone when the session ends", () => {
    service.react("deck-1", "FIRE", "a");
    service.react("deck-1", "FIRE", "b");
    service.react("deck-1", "THINKING", "c");
    const totals = service.state("deck-1", true).reactionTotals;
    expect(totals?.find((t) => t.kind === "FIRE")?.count).toBe(2);
    expect(totals?.find((t) => t.kind === "THINKING")?.count).toBe(1);

    service.stop("deck-1");
    events.length = 0;
    vi.advanceTimersByTime(1000);
    expect(events).toEqual([]); // the pending window died with the session
    service.start(DECK);
    expect(service.state("deck-1", true).reactionTotals?.every((t) => t.count === 0)).toBe(true);
  });

  it("forgets a socket's limiter when the socket closes", () => {
    service.react("deck-1", "FIRE", "socket-1");
    service.dropSocket("socket-1");
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
  });
});
