import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

describe("LiveSessionService — pointer and options", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
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

  it("does nothing when the presentation is not live", () => {
    expect(service.movePointer("other", 0.5, 0.5, true)).toBe(false);
    expect(service.setOptions("other", { showViewerCount: false })).toBeNull();
    expect(events).toEqual([]);
  });

  it("publishes pointer positions clamped to the canvas", () => {
    expect(service.movePointer("deck-1", 1.7, -0.2, true)).toBe(true);
    expect(events).toEqual([{ type: "POINTER", pointer: { x: 1, y: 0, visible: true } }]);
    expect(service.get("deck-1")?.pointer).toEqual({ x: 1, y: 0, visible: true });
  });

  it("drops updates above 40 per second", () => {
    let accepted = 0;
    for (let ms = 0; ms < 1000; ms += 5) {
      if (service.movePointer("deck-1", ms / 1000, 0.5, true)) accepted += 1;
      vi.advanceTimersByTime(5);
    }
    expect(accepted).toBe(40);
    expect(events).toHaveLength(40);
  });

  it("always delivers a visibility change, deferred to the end of the throttle window", () => {
    service.movePointer("deck-1", 0.4, 0.4, true);
    events.length = 0;
    vi.advanceTimersByTime(3);
    expect(service.movePointer("deck-1", 0.41, 0.4, true)).toBe(false);
    expect(service.movePointer("deck-1", 0.41, 0.4, false)).toBe(false);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(21);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([{ type: "POINTER", pointer: { x: 0.41, y: 0.4, visible: false } }]);
    vi.advanceTimersByTime(25);
    expect(service.movePointer("deck-1", 0.5, 0.5, true)).toBe(true);
  });

  it("cannot exceed 40 per second by alternating visibility, and the last state wins", () => {
    let last = true;
    for (let ms = 0; ms < 1000; ms += 1) {
      last = ms % 2 === 0;
      service.movePointer("deck-1", ms / 1000, 0.5, last);
      vi.advanceTimersByTime(1);
    }
    vi.advanceTimersByTime(30);
    expect(events.length).toBeLessThanOrEqual(41);
    expect(events.at(-1)).toEqual({ type: "POINTER", pointer: { x: 0.999, y: 0.5, visible: false } });
    expect(service.get("deck-1")?.pointer?.visible).toBe(last);
  });

  it("ignores non-finite coordinates", () => {
    expect(service.movePointer("deck-1", Number.NaN, 0.5, true)).toBe(false);
    expect(events).toEqual([]);
  });

  it("stop() cancels a pending pointer update", () => {
    service.movePointer("deck-1", 0.4, 0.4, true);
    vi.advanceTimersByTime(3);
    service.movePointer("deck-1", 0.4, 0.4, false);
    service.stop("deck-1");
    events.length = 0;
    vi.advanceTimersByTime(100);
    expect(events).toEqual([]);
  });

  it("changes options and announces both flags", () => {
    const session = service.setOptions("deck-1", { showViewerCount: false });
    expect(session).toMatchObject({ showViewerCount: false, showReactionsOnScreen: true });
    expect(events).toEqual([{ type: "OPTIONS", showViewerCount: false, showReactionsOnScreen: true }]);

    events.length = 0;
    service.setOptions("deck-1", { showReactionsOnScreen: false, showViewerCount: null });
    expect(events).toEqual([{ type: "OPTIONS", showViewerCount: false, showReactionsOnScreen: false }]);

    events.length = 0;
    service.setOptions("deck-1", {});
    expect(events).toEqual([]);
  });
});
