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
