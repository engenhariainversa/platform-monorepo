import { Injectable } from "@nestjs/common";
import { PubSub } from "graphql-subscriptions";

export const REACTION_KINDS = ["CLAP", "FIRE", "MIND_BLOWN", "LAUGH", "HEART", "THINKING"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export type LiveEventKind = "STARTED" | "SLIDE" | "POINTER" | "VIEWERS" | "REACTIONS" | "OPTIONS" | "ENDED";

export interface LivePointerData {
  x: number;
  y: number;
  visible: boolean;
}
export interface ReactionCountData {
  kind: ReactionKind;
  count: number;
}

/** What goes through the PubSub. `eventFor` turns it into what one subscriber receives. */
export interface LiveEventData {
  type: LiveEventKind;
  slideId?: string;
  pointer?: LivePointerData;
  viewerCount?: number;
  peakViewers?: number;
  reactions?: ReactionCountData[];
  showViewerCount?: boolean;
  showReactionsOnScreen?: boolean;
  /** Internal, VIEWERS only: whether the audience may see the count. */
  audienceVisible?: boolean;
}

export interface LiveSession {
  presentationId: string;
  slug: string;
  startedAt: Date;
  /** Slides are tracked by id, so reordering or hiding mid-session misaligns nobody. */
  slideId: string;
  pointer: LivePointerData | null;
  showViewerCount: boolean;
  showReactionsOnScreen: boolean;
  peakViewers: number;
  reactionTotals: Record<ReactionKind, number>;
}

export interface LiveStateData {
  isLive: boolean;
  startedAt: Date | null;
  slideId: string | null;
  showViewerCount: boolean;
  showReactionsOnScreen: boolean;
  viewerCount: number | null;
  peakViewers: number | null;
  reactionTotals: ReactionCountData[] | null;
}

/** Throttling state of one session (used by Tasks 4–6). */
interface SessionRuntime {
  lastPointerAt: number;
  lastViewersAt: number;
  viewersTimer: NodeJS.Timeout | null;
  reactionWindow: Map<ReactionKind, number>;
  reactionTimer: NodeJS.Timeout | null;
}

export const liveTopic = (presentationId: string) => `live:${presentationId}`;

const NOT_LIVE: LiveStateData = {
  isLive: false,
  startedAt: null,
  slideId: null,
  showViewerCount: true,
  showReactionsOnScreen: true,
  viewerCount: null,
  peakViewers: null,
  reactionTotals: null,
};

const emptyTotals = (): Record<ReactionKind, number> => ({
  CLAP: 0,
  FIRE: 0,
  MIND_BLOWN: 0,
  LAUGH: 0,
  HEART: 0,
  THINKING: 0,
});

/** The event one subscriber receives, or null when it must not receive it. */
export function eventFor(event: LiveEventData, presenter: boolean): LiveEventData | null {
  const { audienceVisible, ...publicEvent } = event;
  if (event.type !== "VIEWERS" || presenter) return publicEvent;
  if (!audienceVisible) return null;
  const { peakViewers: _peak, ...forAudience } = publicEvent;
  return forAudience;
}

/**
 * Live sessions, in memory. One backend instance only (spec §3.2): scaling out
 * needs a Redis PubSub and this state moved out of process. Nothing here is
 * persisted; after a restart the presenter's player re-sends startLive.
 */
@Injectable()
export class LiveSessionService {
  private readonly pubSub = new PubSub();
  private readonly sessions = new Map<string, LiveSession>();
  private readonly runtimes = new Map<string, SessionRuntime>();
  /**
   * presentationId → viewerId → socketIds. Kept outside the session on
   * purpose: viewers subscribe before a session exists and must be counted the
   * moment it starts.
   */
  private readonly watchers = new Map<string, Map<string, Set<string>>>();

  get(presentationId: string): LiveSession | undefined {
    return this.sessions.get(presentationId);
  }

  /** In-memory lookup for anonymous operations that only know the slug. */
  findBySlug(slug: string): LiveSession | undefined {
    for (const session of this.sessions.values()) if (session.slug === slug) return session;
    return undefined;
  }

  events(presentationId: string): AsyncIterableIterator<LiveEventData> {
    return this.pubSub.asyncIterableIterator<LiveEventData>(liveTopic(presentationId));
  }

  start(input: { presentationId: string; slug: string; slideId: string }): LiveSession {
    const existing = this.sessions.get(input.presentationId);
    if (existing) {
      existing.slug = input.slug;
      this.setSlide(input.presentationId, input.slideId);
      return existing;
    }
    const session: LiveSession = {
      presentationId: input.presentationId,
      slug: input.slug,
      startedAt: new Date(),
      slideId: input.slideId,
      pointer: null,
      showViewerCount: true,
      showReactionsOnScreen: true,
      peakViewers: this.viewerCount(input.presentationId),
      reactionTotals: emptyTotals(),
    };
    this.sessions.set(input.presentationId, session);
    this.runtimes.set(input.presentationId, {
      lastPointerAt: 0,
      lastViewersAt: 0,
      viewersTimer: null,
      reactionWindow: new Map(),
      reactionTimer: null,
    });
    this.publish(input.presentationId, { type: "STARTED", slideId: input.slideId });
    return session;
  }

  stop(presentationId: string): boolean {
    if (!this.sessions.delete(presentationId)) return false;
    const runtime = this.runtimes.get(presentationId);
    if (runtime?.viewersTimer) clearTimeout(runtime.viewersTimer);
    if (runtime?.reactionTimer) clearTimeout(runtime.reactionTimer);
    this.runtimes.delete(presentationId);
    this.publish(presentationId, { type: "ENDED" });
    return true;
  }

  setSlide(presentationId: string, slideId: string): boolean {
    const session = this.sessions.get(presentationId);
    if (!session) return false;
    if (session.slideId !== slideId) {
      session.slideId = slideId;
      this.publish(presentationId, { type: "SLIDE", slideId });
    }
    return true;
  }

  viewerCount(presentationId: string): number {
    return this.watchers.get(presentationId)?.size ?? 0;
  }

  state(presentationId: string, presenter: boolean): LiveStateData {
    const session = this.sessions.get(presentationId);
    if (!session) return { ...NOT_LIVE };
    return {
      isLive: true,
      startedAt: session.startedAt,
      slideId: session.slideId,
      showViewerCount: session.showViewerCount,
      showReactionsOnScreen: session.showReactionsOnScreen,
      viewerCount: presenter || session.showViewerCount ? this.viewerCount(presentationId) : null,
      peakViewers: presenter ? session.peakViewers : null,
      reactionTotals: presenter
        ? REACTION_KINDS.map((kind) => ({ kind, count: session.reactionTotals[kind] }))
        : null,
    };
  }

  private publish(presentationId: string, event: LiveEventData): void {
    void this.pubSub.publish(liveTopic(presentationId), event);
  }
}
