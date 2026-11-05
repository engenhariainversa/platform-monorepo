// Live sessions (EI-3b). Mirrors the backend's live GraphQL types; dates arrive
// as ISO strings.
export const REACTION_KINDS = ["CLAP", "FIRE", "MIND_BLOWN", "LAUGH", "HEART", "THINKING"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type LiveEventType = "STARTED" | "SLIDE" | "POINTER" | "VIEWERS" | "REACTIONS" | "OPTIONS" | "ENDED";

/** `x`/`y` are 0..1 across the 1920×1080 canvas. */
export type LivePointer = { x: number; y: number; visible: boolean };
export type ReactionCount = { kind: ReactionKind; count: number };

export type LiveState = {
  isLive: boolean;
  startedAt: string | null;
  slideId: string | null;
  showViewerCount: boolean;
  showReactionsOnScreen: boolean;
  /** null for the audience while the counter is hidden */
  viewerCount: number | null;
  /** presenters only */
  peakViewers: number | null;
  /** presenters only */
  reactionTotals: ReactionCount[] | null;
};

export type LiveEvent = {
  type: LiveEventType;
  slideId: string | null;
  pointer: LivePointer | null;
  viewerCount: number | null;
  peakViewers: number | null;
  reactions: ReactionCount[] | null;
  showViewerCount: boolean | null;
  showReactionsOnScreen: boolean | null;
};

export type PresenterLinkExpiry = "TWO_HOURS" | "TWELVE_HOURS" | "ONE_DAY" | "SEVEN_DAYS";

export type PresenterLink = {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** What a page knows about the live session of one presentation. */
export type LiveClientState = {
  isLive: boolean;
  startedAt: string | null;
  slideId: string | null;
  pointer: LivePointer | null;
  viewerCount: number | null;
  peakViewers: number | null;
  showViewerCount: boolean;
  showReactionsOnScreen: boolean;
  reactionTotals: Record<ReactionKind, number>;
  /** The latest REACTIONS batch; `seq` changes on every batch. */
  lastReactions: { seq: number; counts: ReactionCount[] } | null;
  /** +1 on every ENDED event (someone ended the session). */
  endedSeq: number;
  /** +1 when a poll says "not live" although no ENDED arrived (the backend restarted). */
  lostSeq: number;
};

/** The live commands of a presenter (CMS session or presenter link). */
export interface PresenterControls {
  start(slideId: string): Promise<void>;
  stop(): Promise<void>;
  setSlide(slideId: string): void;
  movePointer(x: number, y: number, visible: boolean): void;
  setOptions(options: { showViewerCount?: boolean; showReactionsOnScreen?: boolean }): void;
}
