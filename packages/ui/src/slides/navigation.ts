export type PlayerSlide = {
  id: string;
  template: string;
  content: Record<string, unknown>;
  notes: string | null;
  hidden: boolean;
};

export function visibleSlides(slides: PlayerSlide[]): PlayerSlide[] {
  return slides.filter((slide) => !slide.hidden);
}

export type NavState = { index: number; count: number };
export type NavAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "first" }
  | { type: "last" }
  | { type: "goto"; index: number }
  | { type: "resize"; count: number };

function clamp(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** Pure slide navigation. Returns the same object when the index does not move. */
export function navReducer(state: NavState, action: NavAction): NavState {
  if (action.type === "resize") {
    const index = clamp(state.index, action.count);
    return index === state.index && action.count === state.count
      ? state
      : { index, count: action.count };
  }
  const target =
    action.type === "next" ? state.index + 1
    : action.type === "prev" ? state.index - 1
    : action.type === "first" ? 0
    : action.type === "last" ? state.count - 1
    : action.index;
  const index = clamp(target, state.count);
  return index === state.index ? state : { ...state, index };
}

/** "#7" → 6 (1-based in the URL, clamped). Anything else → 0. */
export function indexFromHash(hash: string, count: number): number {
  const match = /^#(\d+)$/.exec(hash);
  if (!match) return 0;
  return clamp(Number(match[1]) - 1, count);
}

/** 65 400 ms → "01:05"; past an hour → "1:02:05". */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
