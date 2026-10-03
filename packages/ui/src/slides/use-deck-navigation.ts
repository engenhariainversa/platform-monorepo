"use client";

import { useEffect, useReducer, useRef } from "react";
import { createSlideSync } from "./sync";
import { indexFromHash, navReducer, type NavAction } from "./navigation";

/**
 * Slide index shared by the player and the presenter view: initialised from and
 * written back to the URL hash (`#7`), and mirrored across windows of the same
 * deck through BroadcastChannel.
 */
export function useDeckNavigation(presentationId: string, count: number) {
  const [state, dispatch] = useReducer(navReducer, { index: 0, count });
  const syncRef = useRef<ReturnType<typeof createSlideSync> | null>(null);
  // Index last received from the other window; not echoed back.
  const remoteIndex = useRef<number | null>(null);
  const indexRef = useRef(state.index);
  indexRef.current = state.index;

  useEffect(() => dispatch({ type: "resize", count }), [count]);

  useEffect(() => {
    const apply = () => dispatch({ type: "goto", index: indexFromHash(window.location.hash, count) });
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [count]);

  useEffect(() => {
    const hash = `#${state.index + 1}`;
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
  }, [state.index]);

  useEffect(() => {
    const sync = createSlideSync(presentationId);
    syncRef.current = sync;
    const unsubscribe = sync.subscribe((index) => {
      // Already there: no re-render follows, so a marker set now would go stale
      // and swallow the next local move to this index.
      if (index === indexRef.current) return;
      remoteIndex.current = index;
      dispatch({ type: "goto", index });
    });
    return () => {
      unsubscribe();
      sync.close();
      syncRef.current = null;
    };
  }, [presentationId]);

  useEffect(() => {
    if (remoteIndex.current === state.index) {
      remoteIndex.current = null;
      return;
    }
    syncRef.current?.post(state.index);
  }, [state.index]);

  return { index: state.index, count: state.count, dispatch };
}

/** Arrow/space/PageUp/PageDown/Home/End, ignored while typing in a field. */
export function navActionForKey(event: KeyboardEvent): NavAction | null {
  const target = event.target as HTMLElement | null;
  if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
    return null;
  }
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
    case " ":
    case "PageDown":
      return { type: "next" };
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return { type: "prev" };
    case "Home":
      return { type: "first" };
    case "End":
      return { type: "last" };
    default:
      return null;
  }
}
