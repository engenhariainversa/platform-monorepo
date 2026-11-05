"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import type { LiveClientState, LiveEvent, LiveState, PresenterControls, ReactionKind } from "@repo/types";
import {
  GET_LIVE_STATE,
  LIVE_EVENTS,
  MOVE_POINTER,
  SEND_REACTION,
  SET_LIVE_OPTIONS,
  SET_LIVE_SLIDE,
  START_LIVE,
  STOP_LIVE,
} from "../queries/live-session";
import { INITIAL_LIVE_STATE, liveReducer } from "./live-reducer";

/** A poll result older than this, relative to the last event, could undo that event. */
const POLL_GRACE_MS = 2000;

/**
 * The live session of a PUBLIC presentation, by slug. Reads `liveState` on load
 * and keeps `liveEvents` open for as long as the page is open, so a session
 * that starts later is noticed. The poll reconciles anything missed while the
 * socket was reconnecting. Pass `null` to stay idle (private presentation).
 */
export function useLiveSession(slug: string | null, options: { pollMs?: number } = {}): LiveClientState {
  const { pollMs = 30_000 } = options;
  const [live, dispatch] = useReducer(liveReducer, INITIAL_LIVE_STATE);
  const lastEventAt = useRef(0);

  const { data } = useQuery<{ liveState: LiveState }>(GET_LIVE_STATE, {
    variables: { slug: slug ?? "" },
    skip: !slug,
    pollInterval: pollMs,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (!data?.liveState) return;
    if (Date.now() - lastEventAt.current < POLL_GRACE_MS) return;
    dispatch({ type: "state", state: data.liveState });
  }, [data]);

  useSubscription<{ liveEvents: LiveEvent }>(LIVE_EVENTS, {
    variables: { slug: slug ?? "" },
    skip: !slug,
    onData: ({ data: result }) => {
      const event = result.data?.liveEvents;
      if (!event) return;
      lastEventAt.current = Date.now();
      dispatch({ type: "event", event, receivedAt: new Date().toISOString() });
    },
  });

  return live;
}

/** Live commands for a presenter. Fire-and-forget ones swallow errors: the next poll reconciles. */
export function usePresenterControls(presentationId: string): PresenterControls {
  const [startLive] = useMutation(START_LIVE);
  const [stopLive] = useMutation(STOP_LIVE);
  const [setLiveSlide] = useMutation(SET_LIVE_SLIDE);
  const [movePointer] = useMutation(MOVE_POINTER);
  const [setLiveOptions] = useMutation(SET_LIVE_OPTIONS);

  return useMemo<PresenterControls>(
    () => ({
      async start(slideId) {
        await startLive({ variables: { presentationId, slideId } });
      },
      async stop() {
        await stopLive({ variables: { presentationId } });
      },
      setSlide(slideId) {
        void setLiveSlide({ variables: { presentationId, slideId } }).catch(() => {});
      },
      movePointer(x, y, visible) {
        void movePointer({ variables: { presentationId, x, y, visible } }).catch(() => {});
      },
      setOptions(liveOptions) {
        void setLiveOptions({ variables: { presentationId, ...liveOptions } }).catch(() => {});
      },
    }),
    [presentationId, startLive, stopLive, setLiveSlide, movePointer, setLiveOptions],
  );
}

/** The audience's reaction button. The server throttles; a refused reaction is silent. */
export function useSendReaction(slug: string): (kind: ReactionKind) => void {
  const [sendReaction] = useMutation(SEND_REACTION);
  return useCallback(
    (kind: ReactionKind) => {
      void sendReaction({ variables: { slug, kind } }).catch(() => {});
    },
    [slug, sendReaction],
  );
}
