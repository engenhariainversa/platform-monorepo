import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

describe("LiveSessionService — viewers", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  const viewers = () => events.filter((e) => e.type === "VIEWERS");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = [];
    vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
      events.push(event as LiveEventData);
    });
  });
  afterEach(() => vi.useRealTimers());

  it("counts distinct viewerIds: two tabs of one browser count once", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-1", "ana", "socket-2");
    service.addViewer("deck-1", "bia", "socket-3");
    expect(service.viewerCount("deck-1")).toBe(2);

    service.removeViewer("deck-1", "ana", "socket-1");
    expect(service.viewerCount("deck-1")).toBe(2);
    service.removeViewer("deck-1", "ana", "socket-2");
    expect(service.viewerCount("deck-1")).toBe(1);
  });

  it("counts viewers that subscribed before the session started", () => {
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-1", "bia", "socket-2");
    expect(events).toEqual([]);

    const session = service.start(DECK);
    expect(session.peakViewers).toBe(2);
    expect(events).toEqual([
      { type: "STARTED", slideId: "s1" },
      { type: "VIEWERS", viewerCount: 2, peakViewers: 2, audienceVisible: true },
    ]);
  });

  it("coalesces VIEWERS to at most one every 2 seconds, always ending on the latest count", () => {
    service.start(DECK);
    events.length = 0;
    vi.advanceTimersByTime(2000);

    service.addViewer("deck-1", "v1", "s1");
    expect(viewers()).toEqual([{ type: "VIEWERS", viewerCount: 1, peakViewers: 1, audienceVisible: true }]);

    for (let i = 2; i <= 30; i++) service.addViewer("deck-1", `v${i}`, `s${i}`);
    expect(viewers()).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(viewers()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(viewers()).toHaveLength(2);
    expect(viewers()[1]).toMatchObject({ viewerCount: 30, peakViewers: 30 });

    vi.advanceTimersByTime(10_000);
    expect(viewers()).toHaveLength(2);
  });

  it("keeps the peak after viewers leave", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "s1");
    service.addViewer("deck-1", "bia", "s2");
    service.removeViewer("deck-1", "ana", "s1");
    vi.advanceTimersByTime(2000);
    expect(service.state("deck-1", true)).toMatchObject({ viewerCount: 1, peakViewers: 2 });
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 1, peakViewers: 2 });
  });

  it("drops every subscription of a closed socket", () => {
    service.start(DECK);
    service.start({ presentationId: "deck-2", slug: "outra", slideId: "x" });
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-2", "ana", "socket-1");
    service.addViewer("deck-1", "bia", "socket-2");
    service.dropSocket("socket-1");
    expect(service.viewerCount("deck-1")).toBe(1);
    expect(service.viewerCount("deck-2")).toBe(0);
  });

  it("marks VIEWERS hidden from the audience while the counter is off, and re-announces when it turns on", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "s1");
    service.setOptions("deck-1", { showViewerCount: false });
    vi.advanceTimersByTime(2000);
    service.addViewer("deck-1", "bia", "s2");
    vi.advanceTimersByTime(2000);
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 2, audienceVisible: false });
    expect(service.state("deck-1", false).viewerCount).toBeNull();
    expect(service.state("deck-1", true).viewerCount).toBe(2);

    service.setOptions("deck-1", { showViewerCount: true });
    // The re-announce goes through the 2 s window like any other VIEWERS.
    vi.advanceTimersByTime(2000);
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 2, audienceVisible: true });
  });

  it("keeps re-announces within the 2 s limit when the counter is toggled quickly", () => {
    const times: number[] = [];
    (service as any).pubSub.publish.mockImplementation(async (_topic: unknown, event: unknown) => {
      events.push(event as LiveEventData);
      if ((event as LiveEventData).type === "VIEWERS") times.push(Date.now());
    });
    service.start(DECK);
    vi.advanceTimersByTime(2000);
    service.addViewer("deck-1", "ana", "s1");
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      service.setOptions("deck-1", { showViewerCount: false });
      service.setOptions("deck-1", { showViewerCount: true });
    }
    service.addViewer("deck-1", "bia", "s2");
    vi.advanceTimersByTime(10_000);

    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(2000);
    expect(times.length).toBeLessThanOrEqual(3);
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 2, peakViewers: 2, audienceVisible: true });
  });

  it("keeps a socket counted while another of its subscriptions to the deck is open", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-1", "ana", "socket-1");
    service.removeViewer("deck-1", "ana", "socket-1");
    expect(service.viewerCount("deck-1")).toBe(1);
    service.removeViewer("deck-1", "ana", "socket-1");
    expect(service.viewerCount("deck-1")).toBe(0);

    service.addViewer("deck-1", "bia", "socket-2");
    service.addViewer("deck-1", "bia", "socket-2");
    service.dropSocket("socket-2");
    expect(service.viewerCount("deck-1")).toBe(0);
  });

  it("stops the pending VIEWERS timer when the session ends", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "s1");
    service.addViewer("deck-1", "bia", "s2");
    service.stop("deck-1");
    events.length = 0;
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([]);
  });
});
