import { describe, expect, it } from "vitest";
import type { LiveEvent, LiveEventType, LiveState } from "@repo/types";
import { INITIAL_LIVE_STATE, liveReducer } from "./live-reducer";

const event = (type: LiveEventType, fields: Partial<LiveEvent> = {}) => ({
  type: "event" as const,
  receivedAt: "2026-10-01T12:00:00.000Z",
  event: {
    type, slideId: null, pointer: null, viewerCount: null, peakViewers: null,
    reactions: null, showViewerCount: null, showReactionsOnScreen: null, ...fields,
  },
});
const serverState = (fields: Partial<LiveState> = {}) => ({
  type: "state" as const,
  state: {
    isLive: true, startedAt: "2026-10-01T11:50:00.000Z", slideId: "s1", showViewerCount: true,
    showReactionsOnScreen: true, viewerCount: 3, peakViewers: null, reactionTotals: null, ...fields,
  },
});
const live = () => liveReducer(INITIAL_LIVE_STATE, event("STARTED", { slideId: "s1" }));

describe("liveReducer", () => {
  it("starts not live", () => {
    expect(INITIAL_LIVE_STATE).toMatchObject({ isLive: false, slideId: null, endedSeq: 0, lostSeq: 0 });
  });

  it("goes live on STARTED, stamping the start with the receive time", () => {
    expect(live()).toMatchObject({ isLive: true, slideId: "s1", startedAt: "2026-10-01T12:00:00.000Z" });
  });

  it("adopts the server state on load, including a session that started before the page opened", () => {
    const state = liveReducer(INITIAL_LIVE_STATE, serverState({ slideId: "s4", viewerCount: 12 }));
    expect(state).toMatchObject({ isLive: true, slideId: "s4", viewerCount: 12, startedAt: "2026-10-01T11:50:00.000Z" });
  });

  it("follows SLIDE, POINTER, VIEWERS and OPTIONS", () => {
    let state = live();
    state = liveReducer(state, event("SLIDE", { slideId: "s2" }));
    state = liveReducer(state, event("POINTER", { pointer: { x: 0.2, y: 0.8, visible: true } }));
    state = liveReducer(state, event("VIEWERS", { viewerCount: 9, peakViewers: 11 }));
    state = liveReducer(state, event("OPTIONS", { showViewerCount: false, showReactionsOnScreen: true }));
    expect(state).toMatchObject({
      slideId: "s2", pointer: { x: 0.2, y: 0.8, visible: true }, viewerCount: 9, peakViewers: 11,
      showViewerCount: false, showReactionsOnScreen: true,
    });
  });

  it("keeps the known peak when a VIEWERS event carries none (audience)", () => {
    let state = liveReducer(live(), event("VIEWERS", { viewerCount: 9, peakViewers: 11 }));
    state = liveReducer(state, event("VIEWERS", { viewerCount: 4 }));
    expect(state).toMatchObject({ viewerCount: 4, peakViewers: 11 });
  });

  it("treats a SLIDE for a session it did not see start as live", () => {
    const state = liveReducer(INITIAL_LIVE_STATE, event("SLIDE", { slideId: "s3" }));
    expect(state).toMatchObject({ isLive: true, slideId: "s3" });
  });

  it("accumulates reaction totals and exposes each batch with a new seq", () => {
    let state = liveReducer(live(), event("REACTIONS", { reactions: [{ kind: "FIRE", count: 3 }] }));
    state = liveReducer(state, event("REACTIONS", { reactions: [{ kind: "FIRE", count: 2 }, { kind: "CLAP", count: 1 }] }));
    expect(state.reactionTotals).toMatchObject({ FIRE: 5, CLAP: 1, HEART: 0 });
    expect(state.lastReactions).toEqual({ seq: 2, counts: [{ kind: "FIRE", count: 2 }, { kind: "CLAP", count: 1 }] });
  });

  it("takes the presenter's totals and peak from the server state", () => {
    const state = liveReducer(live(), serverState({ peakViewers: 20, reactionTotals: [{ kind: "HEART", count: 7 }] }));
    expect(state.peakViewers).toBe(20);
    expect(state.reactionTotals.HEART).toBe(7);
  });

  it("resets on ENDED and counts it", () => {
    let state = liveReducer(live(), event("REACTIONS", { reactions: [{ kind: "FIRE", count: 3 }] }));
    state = liveReducer(state, event("ENDED"));
    expect(state).toMatchObject({ isLive: false, slideId: null, pointer: null, endedSeq: 1, lostSeq: 0 });
    expect(state.reactionTotals.FIRE).toBe(0);
  });

  it("flags a lost session when the server says not live without an ENDED (backend restart)", () => {
    const state = liveReducer(live(), serverState({ isLive: false, slideId: null, startedAt: null }));
    expect(state).toMatchObject({ isLive: false, endedSeq: 0, lostSeq: 1 });
  });

  it("returns the same object for a not-live poll while not live", () => {
    const action = serverState({ isLive: false, slideId: null, startedAt: null });
    expect(liveReducer(INITIAL_LIVE_STATE, action)).toBe(INITIAL_LIVE_STATE);
  });
});
