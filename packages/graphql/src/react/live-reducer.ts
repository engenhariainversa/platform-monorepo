import { REACTION_KINDS, type LiveClientState, type LiveEvent, type LiveState, type ReactionKind } from "@repo/types";

export type LiveClientAction =
  /** `liveState` query result (on load and on every poll). */
  | { type: "state"; state: LiveState }
  /** One `liveEvents` event; `receivedAt` is the client's ISO time. */
  | { type: "event"; event: LiveEvent; receivedAt: string };

const zeroTotals = (): Record<ReactionKind, number> =>
  Object.fromEntries(REACTION_KINDS.map((kind) => [kind, 0])) as Record<ReactionKind, number>;

export const INITIAL_LIVE_STATE: LiveClientState = {
  isLive: false,
  startedAt: null,
  slideId: null,
  pointer: null,
  viewerCount: null,
  peakViewers: null,
  showViewerCount: true,
  showReactionsOnScreen: true,
  reactionTotals: zeroTotals(),
  lastReactions: null,
  endedSeq: 0,
  lostSeq: 0,
};

const notLive = (state: LiveClientState, counter: "endedSeq" | "lostSeq"): LiveClientState => ({
  ...INITIAL_LIVE_STATE,
  reactionTotals: zeroTotals(),
  endedSeq: state.endedSeq + (counter === "endedSeq" ? 1 : 0),
  lostSeq: state.lostSeq + (counter === "lostSeq" ? 1 : 0),
});

export function liveReducer(state: LiveClientState, action: LiveClientAction): LiveClientState {
  if (action.type === "state") {
    const server = action.state;
    if (!server.isLive) return state.isLive ? notLive(state, "lostSeq") : state;
    const totals = server.reactionTotals
      ? { ...zeroTotals(), ...Object.fromEntries(server.reactionTotals.map((t) => [t.kind, t.count])) }
      : state.reactionTotals;
    return {
      ...state,
      isLive: true,
      startedAt: server.startedAt,
      slideId: server.slideId,
      showViewerCount: server.showViewerCount,
      showReactionsOnScreen: server.showReactionsOnScreen,
      viewerCount: server.viewerCount,
      peakViewers: server.peakViewers ?? state.peakViewers,
      reactionTotals: totals as Record<ReactionKind, number>,
    };
  }

  const { event } = action;
  switch (event.type) {
    case "STARTED":
      return {
        ...INITIAL_LIVE_STATE,
        reactionTotals: zeroTotals(),
        endedSeq: state.endedSeq,
        lostSeq: state.lostSeq,
        isLive: true,
        startedAt: action.receivedAt,
        slideId: event.slideId,
      };
    case "SLIDE":
      // Also covers a missed STARTED: a slide event means the session is live.
      return { ...state, isLive: true, startedAt: state.startedAt ?? action.receivedAt, slideId: event.slideId };
    case "POINTER":
      return { ...state, pointer: event.pointer };
    case "VIEWERS":
      return { ...state, viewerCount: event.viewerCount, peakViewers: event.peakViewers ?? state.peakViewers };
    case "REACTIONS": {
      const counts = event.reactions ?? [];
      const totals = { ...state.reactionTotals };
      for (const { kind, count } of counts) totals[kind] = (totals[kind] ?? 0) + count;
      return { ...state, reactionTotals: totals, lastReactions: { seq: (state.lastReactions?.seq ?? 0) + 1, counts } };
    }
    case "OPTIONS":
      return {
        ...state,
        showViewerCount: event.showViewerCount ?? state.showViewerCount,
        showReactionsOnScreen: event.showReactionsOnScreen ?? state.showReactionsOnScreen,
      };
    case "ENDED":
      return notLive(state, "endedSeq");
    default:
      return state;
  }
}
