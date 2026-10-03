"use client";

import { useEffect, useReducer, useRef } from "react";
import { createSlideSync, createSyncGate } from "./sync";
import { indexFromHash, navReducer, type NavAction } from "./navigation";

/**
 * Slide index shared by the player and the presenter view: initialised from and
 * written back to the URL hash (`#7`), and mirrored across windows of the same
 * deck through BroadcastChannel.
 */
export function useDeckNavigation(presentationId: string, count: number) {
  const [state, dispatch] = useReducer(navReducer, { index: 0, count });
  const syncRef = useRef<ReturnType<typeof createSlideSync> | null>(null);
  const gateRef = useRef<ReturnType<typeof createSyncGate> | null>(null);
  gateRef.current ??= createSyncGate();
  const gate = gateRef.current;

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
      gate.receive(index);
      dispatch({ type: "goto", index });
    });
    return () => {
      unsubscribe();
      sync.close();
      syncRef.current = null;
    };
  }, [presentationId, gate]);

  useEffect(() => {
    if (gate.shouldPost(state.index)) syncRef.current?.post(state.index);
  }, [state.index, gate]);

  return { index: state.index, count: state.count, dispatch };
}

/** Typing in a field, or a browser/OS shortcut (Ctrl/Cmd/Alt held). */
export function isIgnoredKeyEvent(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target as HTMLElement | null;
  return !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/** Arrow/space/PageUp/PageDown/Home/End, ignored while typing or with modifiers. */
export function navActionForKey(event: KeyboardEvent): NavAction | null {
  if (isIgnoredKeyEvent(event)) return null;
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
