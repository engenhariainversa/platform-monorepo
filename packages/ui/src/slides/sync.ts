type SlideMessage = { type: "slide"; index: number };

/**
 * Keeps the player and the presenter window on the same slide. Both open a
 * BroadcastChannel named after the deck; no server involved. Without the API
 * (old browsers, SSR) every method is a no-op.
 */
export function createSlideSync(presentationId: string) {
  if (typeof BroadcastChannel === "undefined") {
    return { post(_index: number) {}, subscribe(_cb: (index: number) => void) { return () => {}; }, close() {} };
  }
  const channel = new BroadcastChannel(`presentation:${presentationId}`);
  return {
    post(index: number) {
      channel.postMessage({ type: "slide", index } satisfies SlideMessage);
    },
    subscribe(cb: (index: number) => void) {
      const handler = (event: MessageEvent<SlideMessage>) => {
        if (event.data?.type === "slide" && Number.isInteger(event.data.index)) cb(event.data.index);
      };
      channel.addEventListener("message", handler);
      return () => channel.removeEventListener("message", handler);
    },
    close() {
      channel.close();
    },
  };
}

/**
 * Decides when a window announces its slide index. Tracks the last index both
 * windows agree on (posted or received) and never clears it, so an index
 * received from the other window is not echoed back, a burst of messages
 * converges, and moving back to an earlier index is announced again. The first
 * call is the mount, before the URL hash is applied: it only records the index,
 * so opening a window never drags the other one to slide 1.
 */
export function createSyncGate() {
  let shared: number | undefined;
  return {
    receive(index: number) {
      shared = index;
    },
    shouldPost(index: number): boolean {
      if (shared === undefined) {
        shared = index;
        return false;
      }
      if (index === shared) return false;
      shared = index;
      return true;
    },
  };
}
