import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, eventFor, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

/** Every event the service publishes, in order (synchronous: no async iterator involved). */
function record(service: LiveSessionService): LiveEventData[] {
  const events: LiveEventData[] = [];
  vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
    events.push(event as LiveEventData);
  });
  return events;
}
const types = (events: LiveEventData[]) => events.map((e) => e.type);

describe("LiveSessionService — sessions", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = record(service);
  });
  afterEach(() => vi.useRealTimers());

  it("starts a session and announces it", () => {
    const session = service.start(DECK);
    expect(session).toMatchObject({ presentationId: "deck-1", slug: "minha-live", slideId: "s1", pointer: null });
    expect(session.showViewerCount).toBe(true);
    expect(session.showReactionsOnScreen).toBe(true);
    expect(events[0]).toEqual({ type: "STARTED", slideId: "s1" });
    expect(service.get("deck-1")).toBe(session);
    expect(service.findBySlug("minha-live")).toBe(session);
  });

  it("start is idempotent: a second start keeps the session and only moves the slide", () => {
    const first = service.start(DECK);
    vi.advanceTimersByTime(60_000);
    events.length = 0;
    const again = service.start({ ...DECK, slideId: "s2" });
    expect(again).toBe(first);
    expect(again.startedAt.toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(events).toEqual([{ type: "SLIDE", slideId: "s2" }]);

    events.length = 0;
    service.start({ ...DECK, slideId: "s2" });
    expect(events).toEqual([]);
  });

  it("setSlide publishes only real changes and does nothing when not live", () => {
    expect(service.setSlide("deck-1", "s2")).toBe(false);
    service.start(DECK);
    events.length = 0;
    expect(service.setSlide("deck-1", "s2")).toBe(true);
    expect(service.setSlide("deck-1", "s2")).toBe(true);
    expect(events).toEqual([{ type: "SLIDE", slideId: "s2" }]);
  });

  it("stop ends the session once", () => {
    service.start(DECK);
    events.length = 0;
    expect(service.stop("deck-1")).toBe(true);
    expect(service.stop("deck-1")).toBe(false);
    expect(types(events)).toEqual(["ENDED"]);
    expect(service.get("deck-1")).toBeUndefined();
    expect(service.findBySlug("minha-live")).toBeUndefined();
  });

  it("reports state for viewers and presenters", () => {
    expect(service.state("deck-1", true)).toEqual({
      isLive: false, startedAt: null, slideId: null, showViewerCount: true,
      showReactionsOnScreen: true, viewerCount: null, peakViewers: null, reactionTotals: null,
    });
    service.start(DECK);
    expect(service.state("deck-1", false)).toMatchObject({
      isLive: true, slideId: "s1", viewerCount: 0, peakViewers: null, reactionTotals: null,
    });
    const forPresenter = service.state("deck-1", true);
    expect(forPresenter.peakViewers).toBe(0);
    expect(forPresenter.reactionTotals).toEqual([
      { kind: "CLAP", count: 0 }, { kind: "FIRE", count: 0 }, { kind: "MIND_BLOWN", count: 0 },
      { kind: "LAUGH", count: 0 }, { kind: "HEART", count: 0 }, { kind: "THINKING", count: 0 },
    ]);
  });
});

describe("eventFor", () => {
  it("passes ordinary events through to everyone", () => {
    const slide: LiveEventData = { type: "SLIDE", slideId: "s2" };
    expect(eventFor(slide, false)).toEqual(slide);
    expect(eventFor(slide, true)).toEqual(slide);
  });

  it("gives VIEWERS with the peak to presenters, always", () => {
    const viewers: LiveEventData = { type: "VIEWERS", viewerCount: 7, peakViewers: 9, audienceVisible: false };
    expect(eventFor(viewers, true)).toEqual({ type: "VIEWERS", viewerCount: 7, peakViewers: 9 });
  });

  it("gives the audience VIEWERS without the peak, and nothing while the counter is hidden", () => {
    expect(eventFor({ type: "VIEWERS", viewerCount: 7, peakViewers: 9, audienceVisible: true }, false)).toEqual({
      type: "VIEWERS",
      viewerCount: 7,
    });
    expect(eventFor({ type: "VIEWERS", viewerCount: 7, peakViewers: 9, audienceVisible: false }, false)).toBeNull();
  });
});
