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
  /** Latest throttled update waiting for the window to end (trailing delivery). */
  pendingPointer: LivePointerData | null;
  pointerTimer: NodeJS.Timeout | null;
  lastViewersAt: number;
  viewersTimer: NodeJS.Timeout | null;
  reactionWindow: Map<ReactionKind, number>;
  reactionTimer: NodeJS.Timeout | null;
}

export const liveTopic = (presentationId: string) => `live:${presentationId}`;

/** 40 pointer updates per second, per session. */
export const POINTER_MIN_INTERVAL_MS = 25;
/** VIEWERS goes out at most once every 2 s per session. */
export const VIEWERS_MIN_INTERVAL_MS = 2000;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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
   * presentationId → viewerId → socketId → open subscriptions. Kept outside the session on
   * purpose: viewers subscribe before a session exists and must be counted the
   * moment it starts.
   */
  private readonly watchers = new Map<string, Map<string, Map<string, number>>>();

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
      pendingPointer: null,
      pointerTimer: null,
      lastViewersAt: 0,
      viewersTimer: null,
      reactionWindow: new Map(),
      reactionTimer: null,
    });
    this.publish(input.presentationId, { type: "STARTED", slideId: input.slideId });
    this.publishViewers(input.presentationId);
    return session;
  }

  stop(presentationId: string): boolean {
    if (!this.sessions.delete(presentationId)) return false;
    const runtime = this.runtimes.get(presentationId);
    if (runtime?.pointerTimer) clearTimeout(runtime.pointerTimer);
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

  /**
   * Publishes the laser position; never touches the database. At most one
   * publish per POINTER_MIN_INTERVAL_MS (40/s). Inside the window a position-only
   * update is dropped, but a change of `visible` is deferred and delivered when
   * the window ends (latest pending state wins): a lost "hide" would leave a
   * frozen dot on every follower's screen, and bypassing the window would make
   * the rate unbounded. Returns true only when published immediately.
   */
  movePointer(presentationId: string, x: number, y: number, visible: boolean): boolean {
    const session = this.sessions.get(presentationId);
    const runtime = this.runtimes.get(presentationId);
    if (!session || !runtime) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

    const pointer = { x: clamp01(x), y: clamp01(y), visible };
    const now = Date.now();
    const elapsed = now - runtime.lastPointerAt;

    if (elapsed >= POINTER_MIN_INTERVAL_MS) {
      this.clearPendingPointer(runtime);
      this.emitPointer(presentationId, session, runtime, pointer, now);
      return true;
    }

    const lastVisible = runtime.pendingPointer?.visible ?? session.pointer?.visible ?? false;
    if (!runtime.pendingPointer && lastVisible === visible) return false;

    runtime.pendingPointer = pointer;
    if (!runtime.pointerTimer) {
      runtime.pointerTimer = setTimeout(() => {
        runtime.pointerTimer = null;
        const pending = runtime.pendingPointer;
        runtime.pendingPointer = null;
        if (pending && this.runtimes.get(presentationId) === runtime) {
          this.emitPointer(presentationId, session, runtime, pending, Date.now());
        }
      }, POINTER_MIN_INTERVAL_MS - elapsed);
    }
    return false;
  }

  private clearPendingPointer(runtime: SessionRuntime): void {
    if (runtime.pointerTimer) clearTimeout(runtime.pointerTimer);
    runtime.pointerTimer = null;
    runtime.pendingPointer = null;
  }

  private emitPointer(
    presentationId: string,
    session: LiveSession,
    runtime: SessionRuntime,
    pointer: LivePointerData,
    now: number,
  ): void {
    runtime.lastPointerAt = now;
    session.pointer = pointer;
    this.publish(presentationId, { type: "POINTER", pointer });
  }

  /** null when not live. Publishes OPTIONS only when something changed. */
  setOptions(
    presentationId: string,
    options: { showViewerCount?: boolean | null; showReactionsOnScreen?: boolean | null },
  ): LiveSession | null {
    const session = this.sessions.get(presentationId);
    if (!session) return null;
    const showViewerCount = options.showViewerCount ?? session.showViewerCount;
    const showReactionsOnScreen = options.showReactionsOnScreen ?? session.showReactionsOnScreen;
    if (showViewerCount === session.showViewerCount && showReactionsOnScreen === session.showReactionsOnScreen) {
      return session;
    }
    const counterTurnedOn = showViewerCount && !session.showViewerCount;
    session.showViewerCount = showViewerCount;
    session.showReactionsOnScreen = showReactionsOnScreen;
    this.publish(presentationId, { type: "OPTIONS", showViewerCount, showReactionsOnScreen });
    // The audience got no VIEWERS while the counter was hidden: give it the number now.
    // Through the same 2 s gate as every other VIEWERS.
    if (counterTurnedOn) this.scheduleViewers(presentationId);
    return session;
  }

  addViewer(presentationId: string, viewerId: string, socketId: string): void {
    let byViewer = this.watchers.get(presentationId);
    if (!byViewer) this.watchers.set(presentationId, (byViewer = new Map()));
    let sockets = byViewer.get(viewerId);
    if (!sockets) byViewer.set(viewerId, (sockets = new Map()));
    // A socket may hold several subscriptions to one deck: count them.
    sockets.set(socketId, (sockets.get(socketId) ?? 0) + 1);
    this.viewersChanged(presentationId);
  }

  removeViewer(presentationId: string, viewerId: string, socketId: string): void {
    this.release(presentationId, viewerId, socketId, false);
  }

  /** A socket closed: forget it everywhere (the subscription cleanup may not have run). */
  dropSocket(socketId: string): void {
    for (const [presentationId, byViewer] of [...this.watchers]) {
      for (const [viewerId, sockets] of [...byViewer]) {
        if (sockets.has(socketId)) this.release(presentationId, viewerId, socketId, true);
      }
    }
  }

  /** Ends one subscription of the socket, or all of them (`all`). */
  private release(presentationId: string, viewerId: string, socketId: string, all: boolean): void {
    const byViewer = this.watchers.get(presentationId);
    const sockets = byViewer?.get(viewerId);
    const open = sockets?.get(socketId);
    if (!byViewer || !sockets || open === undefined) return;
    if (!all && open > 1) {
      sockets.set(socketId, open - 1);
      return; // the socket still watches: the count did not change
    }
    sockets.delete(socketId);
    if (sockets.size === 0) byViewer.delete(viewerId);
    if (byViewer.size === 0) this.watchers.delete(presentationId);
    this.viewersChanged(presentationId);
  }

  private viewersChanged(presentationId: string): void {
    const session = this.sessions.get(presentationId);
    if (!session) return;
    session.peakViewers = Math.max(session.peakViewers, this.viewerCount(presentationId));
    this.scheduleViewers(presentationId);
  }

  /** Publishes VIEWERS now if the 2 s window allows, else once when it ends (with the latest count). */
  private scheduleViewers(presentationId: string): void {
    const runtime = this.runtimes.get(presentationId);
    if (!this.sessions.has(presentationId) || !runtime) return;
    if (runtime.viewersTimer) return; // one is already scheduled; it will carry the latest count

    const wait = runtime.lastViewersAt + VIEWERS_MIN_INTERVAL_MS - Date.now();
    if (wait <= 0) {
      this.publishViewers(presentationId);
      return;
    }
    runtime.viewersTimer = setTimeout(() => {
      runtime.viewersTimer = null;
      this.publishViewers(presentationId);
    }, wait);
  }

  private publishViewers(presentationId: string): void {
    const session = this.sessions.get(presentationId);
    const runtime = this.runtimes.get(presentationId);
    if (!session || !runtime) return;
    runtime.lastViewersAt = Date.now();
    this.publish(presentationId, {
      type: "VIEWERS",
      viewerCount: this.viewerCount(presentationId),
      peakViewers: session.peakViewers,
      audienceVisible: session.showViewerCount,
    });
  }

  private publish(presentationId: string, event: LiveEventData): void {
    void this.pubSub.publish(liveTopic(presentationId), event);
  }
}
