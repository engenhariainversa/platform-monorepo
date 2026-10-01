# EI-3b Presentations — Live Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the audience of a `PUBLIC` presentation follow the presenter in real time (slide, laser pointer, viewer count, emoji reactions) and let Pedro control a presentation from another computer through a temporary, revocable presenter link.

**Architecture:** GraphQL Subscriptions over `graphql-ws` are enabled in the existing `GraphQLModule`; sockets authenticate in `onConnect` and every socket operation re-runs the passport strategies through a synthetic `req`. An in-memory `LiveSessionService` (one backend instance, `graphql-subscriptions` PubSub) owns sessions, pointer throttling, viewer counting and reaction aggregation. On the client, `@repo/graphql` gains a websocket link and a `useLiveSession` hook; `@repo/ui/src/slides/live` holds the overlays and the presenter composites shared by the CMS (`/apresentar`) and the landing (`/apresentacoes/[slug]`, `/apresentacoes/controle`).

**Tech Stack:** NestJS 11 + `@nestjs/graphql` 13 (Apollo driver), `graphql-ws` 6, `ws` 8, `graphql-subscriptions` 3, Prisma 5 + Postgres 16, `@apollo/client` 4 (`GraphQLWsLink`), Next.js 14 App Router, Tailwind 3, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-ei-3b-presentations-live-design.md`

**Depends on:** EI-3a fully implemented (`docs/superpowers/plans/2026-10-01-ei-3a-presentations-authoring.md`). This plan uses its backend test harness (`apps/backend/test/helpers.ts`), `PresentationsService`, `ApiKeysService`, `generateToken`/`hashToken`, `AuthenticatedUser`, the guards in `auth/jwt-or-api-key.guard.ts`, `PresentationPlayer`, `PresenterView`, `SlideCanvas` (`overlay` slot) and the Vitest setups of `@repo/ui` and `cms`.

## Global Constraints

- Run every command from the repo root with `pnpm --filter <name> <script>`; never `cd apps/x && pnpm …` in scripts, Dockerfiles or CI.
- Check the Docker daemon (`docker info > /dev/null 2>&1`) before any `docker`/`docker compose` command; if it is down, stop and report.
- Commands that touch the database run **inside the running dev stack**: `docker compose -f docker-compose.dev.yml exec <service> <cmd>`, abbreviated `dcx <service> <cmd>`. Commands that need no database may use a one-off container: `docker compose -f docker-compose.dev.yml run --rm --no-deps <service> <cmd>`, abbreviated `dcr <service> <cmd>`.
- **Adding a dependency**: edit the `package.json` by hand, then refresh the lockfile with the pnpm version the images use: `docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:20-alpine npx -y pnpm@9.0.0 install --lockfile-only` (abbreviated `lockfile-refresh`), then rebuild the dev images: `docker compose -f docker-compose.dev.yml build`.
- **Never `prisma db push`.** Schema changes only through `pnpm --filter @repo/database db:migrate:dev --name <name>`.
- Commit messages in English, Conventional Commits style (`feat(backend): …`), ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Ports stay fixed: backend 4050, CMS 4051, landing 4052.
- User-facing copy is Brazilian Portuguese; code, identifiers and comments are English.
- Presenter link token: `eip_` + 32 random bytes base64url; only the SHA-256 hex hash is stored. Expiries (exact): `TWO_HOURS`, `TWELVE_HOURS`, `ONE_DAY`, `SEVEN_DAYS`.
- Websocket close codes (exact): `4403` (invalid/revoked/expired credential, foreign origin), `4429` (more than 10 concurrent sockets from one IP).
- Rate limits (exact): pointer ≤ 40 updates/s per session (25 ms minimum interval); reactions per **socket**: 1 per 300 ms and at most 10 per 5 s; `REACTIONS` aggregated in 250 ms windows; `VIEWERS` at most one event every 2 s per session; ≤ 10 sockets per IP.
- Reaction kinds (exact, in this order): `CLAP` 👏, `FIRE` 🔥, `MIND_BLOWN` 🤯, `LAUGH` 😂, `HEART` ❤️, `THINKING` 🤔.
- Live event types (exact): `STARTED`, `SLIDE`, `POINTER`, `VIEWERS`, `REACTIONS`, `OPTIONS`, `ENDED`.
- Only `PUBLIC`, non-trashed presentations can go live. Error message (exact): `"Torne a apresentação pública para transmitir"`. Gone-link message (exact): `"Link revogado ou expirado"`.
- Live state is in memory only: nothing about sessions, viewers or reactions is written to Postgres.
- A presenter link never passes a guard other than `GqlPresenterLinkGuard`, `GqlLiveControlGuard` and `GqlOptionalLiveGuard`. Do not add the `"presenter-link"` strategy to any other guard, and never combine it with `RolesGuard` (the link resolves to its creator's user row, so `RolesGuard` would grant the creator's permissions).
- No new secret. `LANDING_URL` (backend) is plain configuration with the fallback `https://engenhariainversa.com.br`; the websocket URL is derived from `NEXT_PUBLIC_API_URL`.
- **Keepalive**: the spec asks for a 30 s server ping. `@nestjs/graphql` does not expose the `keepAlive` argument of `graphql-ws`'s `useServer`; the adapter's default (12 s) already satisfies the intent (below Cloudflare's ~100 s idle timeout), and the client link pings every 30 s (Task 8). Task 1 verifies the default.
- Contract additions to spec §3.7 (additive, needed by the presenter view, which the spec requires to show peak and totals): `LiveState.peakViewers: Int`, `LiveState.reactionTotals: [ReactionCount!]`, `LiveEvent.peakViewers: Int` — all `null` for non-presenters.

## Review Focus

1. **"Hide pointer" dropped by the throttle** — the presenter's laser hides (idle, leaving the canvas) right after a move; if the 40/s throttle drops that update, every follower keeps a frozen dot on screen. A change of `visible` must always be delivered. (Task 4: test `always delivers a visibility change, even inside the throttle window`.)
2. **Missing or garbage `viewerId`** — a browser without `localStorage`, an old tab or a script sends no `viewerId`, a number, or a 10 kB string. The socket must still connect and count as its own viewer, never merge with other anonymous sockets or crash. (Task 1: tests for `normalizeViewerId`.)
3. **Viewer already on the page when the session starts** — viewers keep `liveEvents` open before any session exists; they must be counted when it starts and the first `VIEWERS` event must carry them. (Task 5: test `counts viewers that subscribed before the session started`.)
4. **Presenter moves to a slide the viewer's page does not have** — a slide added or un-hidden after the viewer loaded the page. The viewer must stay where they are (no jump to slide 1, no crash) and the page must refresh its deck. (Task 10: tests for `needsDeckRefresh` and the player's `followSlideId`; Task 13 wires `router.refresh()`.)
5. **Rapid double-advance with echo lag** — the presenter presses → twice; the `SLIDE` echo of the first press arrives after the second. Applying it would yank the presenter back one slide. (Task 11: tests for `absorbEcho`.)

---

## File Structure

### Backend (`apps/backend`)

| File | Responsibility |
|---|---|
| `test/ws.ts` | websocket test helpers: `listen`, `wsClient`, `openSocket`, `wsRequest`, `subscribeTo`, `closeCodeOf` |
| `src/live/socket-registry.ts` | open sockets: per-IP cap, close by predicate, expiry timers, remove listeners |
| `src/live/socket-auth.service.ts` | `onConnect` / `onDisconnect` / socket `context`; `clientIp`, `originAllowed`, `normalizeViewerId` |
| `src/live/live-session.service.ts` | in-memory sessions, PubSub, pointer throttle, viewers, reactions; `eventFor` |
| `src/live/live.types.ts` | GraphQL enums and object types of spec §3.7 |
| `src/live/live.guards.ts` | `GqlLiveControlGuard`, `GqlOptionalLiveGuard` |
| `src/live/live.resolver.ts` | `liveState`, `liveEvents`, `startLive`, `stopLive`, `setLiveSlide`, `movePointer`, `setLiveOptions`, `sendReaction` |
| `src/live/live.module.ts` | module; wires unpublish → end session, socket removal → drop viewer, link revocation → close sockets |
| `src/presenter-links/presenter-links.service.ts` | create / list / revoke / `authenticate(token)` |
| `src/presenter-links/presenter-links.types.ts` | `PresenterLink`, `CreatedPresenterLink`, `PresenterLinkExpiry` |
| `src/presenter-links/presenter-links.resolver.ts` | `presenterLinks`, `createPresenterLink`, `revokePresenterLink`, `presentationForPresenter` |
| `src/presenter-links/presenter-links.module.ts` | module |
| `src/auth/presenter-link.strategy.ts` | passport strategy `"presenter-link"` |
| `src/auth/presenter-link.guard.ts` | `GqlPresenterLinkGuard` |

Modified: `src/app.module.ts` (`forRootAsync`, subscriptions), `src/auth/auth.module.ts` (export `JwtModule`), `src/auth/auth-kind.ts`, `src/api-keys/api-key-token.ts`, `src/presentations/presentations.service.ts` (`onUnpublished`, reserved slugs), `package.json`.

### Database (`packages/database`)

Modified `prisma/schema.prisma` (`PresenterLink`); new migration `prisma/migrations/<ts>_add_presenter_links/`.

### Shared front-end packages

| File | Responsibility |
|---|---|
| `packages/types/src/live.ts` | `ReactionKind`, `LiveState`, `LiveEvent`, `PresenterLink`, `LiveClientState`, `PresenterControls` |
| `packages/graphql/src/client/ws.ts` | `toWsUrl`, `isSocketOperation`, `shouldRetrySocket`, `getViewerId`, `SOCKET_CLOSE_FORBIDDEN` |
| `packages/graphql/src/client/presenter-token.ts` | `extractPresenterToken`, `PRESENTER_TOKEN_STORAGE_KEY` |
| `packages/graphql/src/client/errors.ts` | `isUnauthenticatedError` |
| `packages/graphql/src/queries/live.ts` | live + presenter link documents |
| `packages/graphql/src/react/live-reducer.ts` | `liveReducer`, `INITIAL_LIVE_STATE` |
| `packages/graphql/src/react/use-live-session.ts` | `useLiveSession`, `usePresenterControls`, `useSendReaction` |
| `packages/ui/src/slides/live/follow.ts` | follow-mode reducer, `showFollowButton`, `followTargetIndex`, `needsDeckRefresh` |
| `packages/ui/src/slides/live/reaction-queue.ts` | floating reactions queue (≤ 20, overflow grouped) |
| `packages/ui/src/slides/live/remote-slide.ts` | `absorbEcho` (ignore the echoes of this window's own slide commands) |
| `packages/ui/src/slides/live/laser.ts` | `normalizedPoint`, laser constants |
| `packages/ui/src/slides/live/*.tsx` | `PointerLayer`, `ReactionsLayer`, `ReactionBar`, `LiveBadge`, `FollowButton`, `LaserSurface`, `LivePresenterPanel`, `LivePresenterPlayer`, `LivePresenterView` |

Modified: `packages/graphql/src/client/create-client.ts`, `packages/graphql/src/react/apollo-wrapper.tsx`, `packages/graphql/src/react/index.ts`, `packages/ui/src/slides/player.tsx` (`followSlideId`, `chrome`), `packages/ui/src/slides/presenter-view.tsx` (`livePanel`, `overlay`).

### Apps

| File | Responsibility |
|---|---|
| `apps/cms/app/apresentar/[id]/page.tsx`, `apresentador/page.tsx` | live presenter player and presenter view |
| `apps/cms/components/presentations/presenter-links-panel.tsx` | generate / list / revoke presenter links |
| `apps/landing/components/public-deck.tsx` | viewer: follow, badge, counter, pointer, reactions |
| `apps/landing/components/presenter-link.tsx` | token handling + dedicated Apollo client + "Link revogado ou expirado" |
| `apps/landing/app/apresentacoes/controle/{layout,page,apresentador/page}.tsx` | presenter link pages |
| `docs/infra/websockets.md` | production server checklist (spec §5) |

---

## Interface Catalogue

Every task below uses these names exactly.

### Backend

```ts
// auth/auth-kind.ts (extended in Task 2)
export type AuthKind = "jwt" | "apiKey" | "presenterLink";
export type AuthenticatedUser = User & { role: Role; authKind?: AuthKind; apiKeyId?: string;
  presenterLinkId?: string; presenterPresentationId?: string; presenterLinkExpiresAt?: Date };

// api-keys/api-key-token.ts (widened in Task 2)
export function generateToken(prefix: "ei_" | "eip_"): { token: string; hash: string; displayPrefix: string };

// live/socket-registry.ts
export const MAX_SOCKETS_PER_IP = 10;
export const CLOSE_FORBIDDEN = 4403;
export const CLOSE_TOO_MANY = 4429;
export interface SocketEntry { socketId: string; ip: string; close: (code: number, reason: string) => void;
  presenterLinkId?: string; expiresAt?: Date }
class SocketRegistry {
  add(entry: SocketEntry): boolean;            // false when the IP is at the cap (entry not stored)
  remove(socketId: string): void;              // notifies onRemove listeners
  countForIp(ip: string): number;
  closeWhere(predicate: (entry: SocketEntry) => boolean, code: number, reason: string): number;
  onRemove(listener: (socketId: string) => void): void;
}

// live/socket-auth.service.ts
export interface SocketSession { socketId: string; ip: string; viewerId: string; authorization: string | null }
export interface SocketRequest { headers: { authorization?: string }; socketSession: SocketSession;
  user?: AuthenticatedUser | null; livePresenter?: boolean }
export function clientIp(headers: IncomingHttpHeaders, remoteAddress: string | undefined): string;
export function originAllowed(origin: string | undefined, allowed: string[] | undefined): boolean;
export function normalizeViewerId(value: unknown, fallback: string): string;
class SocketAuthService {
  authenticate(authorization: string | null): Promise<AuthenticatedUser | null>; // throws UnauthorizedException
  onConnect(ctx: SocketContext): Promise<boolean>;
  onDisconnect(ctx: SocketContext): void;
  context(ctx: SocketContext): { req: SocketRequest };
}

// presenter-links/presenter-links.service.ts
export const LINK_GONE = "Link revogado ou expirado";
export const PRESENTER_LINK_TTL_MS: Record<"TWO_HOURS" | "TWELVE_HOURS" | "ONE_DAY" | "SEVEN_DAYS", number>;
export function landingUrl(): string;   // process.env.LANDING_URL ?? "https://engenhariainversa.com.br", no trailing slash
class PresenterLinksService {
  create(presentationId: string, userId: string, name: string, expiresIn: keyof typeof PRESENTER_LINK_TTL_MS):
    Promise<{ presenterLink: PresenterLink; token: string; url: string }>;
  list(presentationId: string): Promise<PresenterLink[]>;     // newest first
  revoke(id: string): Promise<PresenterLink>;                 // notifies onRevoked listeners
  authenticate(token: string): Promise<AuthenticatedUser>;    // throws UnauthorizedException(LINK_GONE)
  onRevoked(listener: (linkId: string) => void): void;
}

// presentations/presentations.service.ts (added in Tasks 2 and 3)
export const RESERVED_SLUGS = ["controle"];
class PresentationsService { onUnpublished(listener: (presentationId: string) => void): void; /* … */ }

// live/live-session.service.ts
export const REACTION_KINDS = ["CLAP", "FIRE", "MIND_BLOWN", "LAUGH", "HEART", "THINKING"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export type LiveEventKind = "STARTED" | "SLIDE" | "POINTER" | "VIEWERS" | "REACTIONS" | "OPTIONS" | "ENDED";
export interface LivePointerData { x: number; y: number; visible: boolean }
export interface ReactionCountData { kind: ReactionKind; count: number }
export interface LiveEventData { type: LiveEventKind; slideId?: string; pointer?: LivePointerData;
  viewerCount?: number; peakViewers?: number; reactions?: ReactionCountData[];
  showViewerCount?: boolean; showReactionsOnScreen?: boolean;
  audienceVisible?: boolean /* internal: VIEWERS may be shown to the audience */ }
export interface LiveSession { presentationId: string; slug: string; startedAt: Date; slideId: string;
  pointer: LivePointerData | null; showViewerCount: boolean; showReactionsOnScreen: boolean;
  peakViewers: number; reactionTotals: Record<ReactionKind, number> }
export interface LiveStateData { isLive: boolean; startedAt: Date | null; slideId: string | null;
  showViewerCount: boolean; showReactionsOnScreen: boolean; viewerCount: number | null;
  peakViewers: number | null; reactionTotals: ReactionCountData[] | null }
export function eventFor(event: LiveEventData, presenter: boolean): LiveEventData | null;
class LiveSessionService {
  get(presentationId: string): LiveSession | undefined;
  findBySlug(slug: string): LiveSession | undefined;
  events(presentationId: string): AsyncIterableIterator<LiveEventData>;
  start(input: { presentationId: string; slug: string; slideId: string }): LiveSession;   // idempotent
  stop(presentationId: string): boolean;                                                   // idempotent
  setSlide(presentationId: string, slideId: string): boolean;
  state(presentationId: string, presenter: boolean): LiveStateData;
  viewerCount(presentationId: string): number;
  movePointer(presentationId: string, x: number, y: number, visible: boolean): boolean;   // Task 4
  setOptions(presentationId: string, options: { showViewerCount?: boolean | null; showReactionsOnScreen?: boolean | null }): LiveSession | null; // Task 4
  addViewer(presentationId: string, viewerId: string, socketId: string): void;            // Task 5
  removeViewer(presentationId: string, viewerId: string, socketId: string): void;         // Task 5
  dropSocket(socketId: string): void;                                                      // Task 5
  react(presentationId: string, kind: ReactionKind, socketId: string): boolean;           // Task 6
}
```

### Backend test helpers (`apps/backend/test/ws.ts`, Task 1)

```ts
export async function listen(app: INestApplication): Promise<string>;   // "ws://127.0.0.1:<port>/graphql"
export function wsClient(url: string, connectionParams?: Record<string, unknown>, headers?: Record<string, string>): Client;
export function openSocket(url: string, connectionParams?: Record<string, unknown>, headers?: Record<string, string>):
  Promise<{ client: Client; closed: Promise<number> }>;                 // resolves once connected
export function closeCodeOf(url: string, connectionParams?: Record<string, unknown>, headers?: Record<string, string>): Promise<number>;
export function wsRequest<T = any>(client: Client, query: string, variables?: Record<string, unknown>): Promise<GqlResponse<T>>;
export function subscribeTo<T = any>(client: Client, query: string, variables?: Record<string, unknown>):
  { events: T[]; errors: unknown[]; stop(): void;
    waitUntil(predicate: (events: T[]) => boolean, timeoutMs?: number): Promise<T[]>;
    waitFor(count: number, timeoutMs?: number): Promise<T[]> };
export const sleep: (ms: number) => Promise<void>;
```

### Front-end

```ts
// @repo/types — live.ts
export const REACTION_KINDS = ["CLAP", "FIRE", "MIND_BLOWN", "LAUGH", "HEART", "THINKING"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export type LiveEventType = "STARTED" | "SLIDE" | "POINTER" | "VIEWERS" | "REACTIONS" | "OPTIONS" | "ENDED";
export type LivePointer = { x: number; y: number; visible: boolean };
export type ReactionCount = { kind: ReactionKind; count: number };
export type LiveState = { isLive: boolean; startedAt: string | null; slideId: string | null;
  showViewerCount: boolean; showReactionsOnScreen: boolean; viewerCount: number | null;
  peakViewers: number | null; reactionTotals: ReactionCount[] | null };
export type LiveEvent = { type: LiveEventType; slideId: string | null; pointer: LivePointer | null;
  viewerCount: number | null; peakViewers: number | null; reactions: ReactionCount[] | null;
  showViewerCount: boolean | null; showReactionsOnScreen: boolean | null };
export type PresenterLinkExpiry = "TWO_HOURS" | "TWELVE_HOURS" | "ONE_DAY" | "SEVEN_DAYS";
export type PresenterLink = { id: string; name: string; prefix: string; expiresAt: string;
  lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
export type LiveClientState = { isLive: boolean; startedAt: string | null; slideId: string | null;
  pointer: LivePointer | null; viewerCount: number | null; peakViewers: number | null;
  showViewerCount: boolean; showReactionsOnScreen: boolean;
  reactionTotals: Record<ReactionKind, number>;
  lastReactions: { seq: number; counts: ReactionCount[] } | null;
  endedSeq: number;   // +1 on every ENDED event
  lostSeq: number };  // +1 when a poll says "not live" although no ENDED arrived (backend restart)
export interface PresenterControls {
  start(slideId: string): Promise<void>; stop(): Promise<void>; setSlide(slideId: string): void;
  movePointer(x: number, y: number, visible: boolean): void;
  setOptions(options: { showViewerCount?: boolean; showReactionsOnScreen?: boolean }): void }

// @repo/graphql — client
export const SOCKET_OPERATIONS = ["MovePointer", "SendReaction"];
export const SOCKET_CLOSE_FORBIDDEN = 4403;
export function toWsUrl(httpUrl: string, origin?: string): string;
export function isSocketOperation(query: DocumentNode): boolean;
export function shouldRetrySocket(event: unknown): boolean;        // false for close code 4403
export function getViewerId(): string;                              // localStorage "ei_viewer_id", in-memory fallback
export const PRESENTER_TOKEN_STORAGE_KEY = "ei_presenter_token";
export function extractPresenterToken(hash: string): string | null; // "#t=eip_…" → "eip_…"
export function isUnauthenticatedError(error: unknown): boolean;    // GraphQL code UNAUTHENTICATED (Task 14)
// CreateApolloClientOptions gains: live?: boolean | { onClosed?: (code: number) => void }
// ApolloWrapper gains: live?: boolean

// @repo/graphql — queries/live.ts
GET_LIVE_STATE($slug) · LIVE_EVENTS($slug) (subscription) · START_LIVE($presentationId,$slideId)
STOP_LIVE($presentationId) · SET_LIVE_SLIDE($presentationId,$slideId)
MOVE_POINTER($presentationId,$x,$y,$visible)   // operation name "MovePointer"
SET_LIVE_OPTIONS($presentationId,$showViewerCount,$showReactionsOnScreen)
SEND_REACTION($slug,$kind)                      // operation name "SendReaction"
GET_PRESENTER_LINKS($presentationId) · CREATE_PRESENTER_LINK($presentationId,$name,$expiresIn)
REVOKE_PRESENTER_LINK($id) · GET_PRESENTATION_FOR_PRESENTER

// @repo/graphql/react
export const INITIAL_LIVE_STATE: LiveClientState;
export type LiveClientAction = { type: "state"; state: LiveState } | { type: "event"; event: LiveEvent; receivedAt: string };
export function liveReducer(state: LiveClientState, action: LiveClientAction): LiveClientState;
export function useLiveSession(slug: string | null, options?: { pollMs?: number }): LiveClientState;
export function usePresenterControls(presentationId: string): PresenterControls;
export function useSendReaction(slug: string): (kind: ReactionKind) => void;

// @repo/ui — slides/live
export const REACTION_EMOJI: Record<ReactionKind, string>;
export type FollowState = { following: boolean; presenterSlideId: string | null; viewerSlideId: string | null };
export type FollowAction = { type: "presenter"; slideId: string | null } | { type: "viewer"; slideId: string } | { type: "follow" };
export const INITIAL_FOLLOW_STATE: FollowState;
export function followReducer(state: FollowState, action: FollowAction): FollowState;
export function showFollowButton(state: FollowState): boolean;
export function followTargetIndex(slideIds: string[], followSlideId: string | null | undefined): number | null;
export function needsDeckRefresh(presenterSlideId: string | null, slideIds: string[]): boolean;
export type FloatingReaction = { id: number; kind: ReactionKind; count: number; bornAt: number };
export const MAX_FLOATING = 20; export const FLOAT_MS = 2500;
export function addReactions(current: FloatingReaction[], counts: ReactionCount[], now: number, nextId: () => number): FloatingReaction[];
export type SentSlide = { id: string; at: number };
export function absorbEcho(remoteSlideId: string, sent: SentSlide[], now: number): { apply: boolean; sent: SentSlide[] };
export function normalizedPoint(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): { x: number; y: number };
export function PointerLayer(props: { pointer: LivePointer | null }): JSX.Element | null;
export function ReactionsLayer(props: { lastReactions: LiveClientState["lastReactions"]; fontSize?: number }): JSX.Element;
export function ReactionBar(props: { onReact: (kind: ReactionKind) => void; hidden: boolean; onToggleHidden: () => void }): JSX.Element;
export function LiveBadge(props: { viewerCount: number | null }): JSX.Element;
export function FollowButton(props: { onClick: () => void }): JSX.Element;
export function LaserSurface(props: { onMove: (x: number, y: number, visible: boolean) => void }): JSX.Element;
export function LivePresenterPanel(props: { live: LiveClientState; controls: PresenterControls;
  laser?: { on: boolean; toggle: () => void } }): JSX.Element;
export function LivePresenterPlayer(props: { presentationId: string; slides: PlayerSlide[]; context?: SlideContext;
  presenterHref?: string; isPublic: boolean; live: LiveClientState; controls: PresenterControls }): JSX.Element;
export function LivePresenterView(props: { presentationId: string; title: string; slides: PlayerSlide[];
  context?: SlideContext; live: LiveClientState; controls: PresenterControls }): JSX.Element;
// PresentationPlayer gains: followSlideId?: string | null; chrome?: ReactNode
// PresenterView gains: livePanel?: ReactNode; overlay?: ReactNode
```

---

## Tasks

| # | Task | Area |
|---|---|---|
| 1 | Enable `graphql-ws` subscriptions with socket authentication, origin check and per-IP cap | backend |
| 2 | Presenter links: model, migration, service, passport strategy and GraphQL | backend |
| 3 | `LiveSessionService` core: start / stop / slide, `liveState`, `liveEvents` | backend |
| 4 | Laser pointer throttle and live options | backend |
| 5 | Viewer counting | backend |
| 6 | Emoji reactions: per-socket rate limit and aggregation | backend |
| 7 | Close sockets on presenter link revocation and expiry | backend |
| 8 | `@repo/graphql`: websocket link, live types and documents | shared |
| 9 | `liveReducer`, `useLiveSession` and presenter control hooks | shared |
| 10 | UI: follow mode, pointer and reaction overlays, player hooks | ui |
| 11 | UI: laser surface, presenter player, panel and presenter view | ui |
| 12 | CMS: live presenter pages and presenter links panel | cms |
| 13 | Landing: live viewer on `/apresentacoes/[slug]` | landing |
| 14 | Landing: presenter link page `/apresentacoes/controle` | landing |
| 15 | Production websocket checklist and final verification | infra |

---

### Task 1: Enable `graphql-ws` subscriptions with socket authentication, origin check and per-IP cap

Turns on the websocket transport of the existing `/graphql` endpoint. A socket authenticates once in `onConnect` (JWT or `ei_` key in `connectionParams.authorization`; none = anonymous viewer) and, for every operation, the module `context` builds a synthetic `req` carrying the same `Authorization` header — so the passport guards re-validate the credential on **every** operation, exactly as over HTTP.

**Files:**
- Create: `apps/backend/src/live/socket-registry.ts`, `apps/backend/src/live/socket-auth.service.ts`, `apps/backend/src/live/live.module.ts`
- Create: `apps/backend/test/ws.ts`
- Test: `apps/backend/src/live/socket-registry.test.ts`, `apps/backend/src/live/socket-auth.test.ts`, `apps/backend/src/live/socket.integration.test.ts`
- Modify: `apps/backend/package.json`, `pnpm-lock.yaml`, `apps/backend/src/app.module.ts`, `apps/backend/src/auth/auth.module.ts`

**Interfaces:**
- Consumes: `ApiKeysService.authenticate` and `ApiKeysModule` (3a Task 5–6); `AuthService.validateUserById` (existing); `AuthenticatedUser` (3a Task 5); `createTestApp`, `createUser`, `jwtFor`, `gql`, `errorCode`, `resetDatabase`, `GqlResponse` (3a Task 3).
- Produces: `SocketRegistry`, `MAX_SOCKETS_PER_IP`, `CLOSE_FORBIDDEN`, `CLOSE_TOO_MANY`, `SocketEntry`; `SocketAuthService`, `SocketSession`, `SocketRequest`, `SocketContext`, `clientIp`, `originAllowed`, `normalizeViewerId`; `LiveModule` (exports `SocketRegistry`, `SocketAuthService`); test helpers in `test/ws.ts` (catalogue). Resolvers read the socket session from `context.req.socketSession` (undefined over HTTP).

- [ ] **Step 1: Add the dependencies**

`apps/backend/package.json`:
- `"dependencies"`: add `"graphql-subscriptions": "^3.0.0"`, `"graphql-ws": "^6.0.8"`, `"ws": "^8.20.1"`.
- `"devDependencies"`: add `"@types/ws": "^8.5.13"`.

(`graphql-ws` 6.0.8 and `ws` 8.20.1 are already in `pnpm-lock.yaml` as dependencies of `@nestjs/graphql`; this makes them explicit.)

Run: `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build backend && docker compose -f docker-compose.dev.yml up -d db backend`.

Verify the adapter's default keepalive (see Global Constraints):
`dcx backend sh -c "grep -rn 'keepAlive = ' node_modules/.pnpm/graphql-ws@*/node_modules/graphql-ws/dist/use/ | head -3"`
Expected: a line with `keepAlive = 12e3` (or `12_000`) in the `ws` adapter. If the default is larger than 60 s or absent, stop and report — the keepalive would then need a custom `ws` server and that changes this task.

- [ ] **Step 2: Write the failing unit tests**

`apps/backend/src/live/socket-registry.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { MAX_SOCKETS_PER_IP, SocketRegistry } from "./socket-registry";

const entry = (socketId: string, ip = "1.1.1.1", extra: Record<string, unknown> = {}) => ({
  socketId,
  ip,
  close: vi.fn(),
  ...extra,
});

describe("SocketRegistry", () => {
  it("accepts up to 10 sockets per IP and refuses the 11th", () => {
    const registry = new SocketRegistry();
    for (let i = 0; i < MAX_SOCKETS_PER_IP; i++) expect(registry.add(entry(`s${i}`))).toBe(true);
    expect(registry.add(entry("s10"))).toBe(false);
    expect(registry.countForIp("1.1.1.1")).toBe(10);
    expect(registry.add(entry("other", "2.2.2.2"))).toBe(true);
  });

  it("frees the slot when a socket is removed and notifies listeners once", () => {
    const registry = new SocketRegistry();
    const removed: string[] = [];
    registry.onRemove((id) => removed.push(id));
    for (let i = 0; i < MAX_SOCKETS_PER_IP; i++) registry.add(entry(`s${i}`));
    registry.remove("s3");
    registry.remove("s3");
    expect(removed).toEqual(["s3"]);
    expect(registry.add(entry("again"))).toBe(true);
  });

  it("closes the sockets matching a predicate", () => {
    const registry = new SocketRegistry();
    const a = entry("a", "1.1.1.1", { presenterLinkId: "link-1" });
    const b = entry("b", "1.1.1.1", { presenterLinkId: "link-2" });
    registry.add(a);
    registry.add(b);
    expect(registry.closeWhere((e) => e.presenterLinkId === "link-1", 4403, "bye")).toBe(1);
    expect(a.close).toHaveBeenCalledWith(4403, "bye");
    expect(b.close).not.toHaveBeenCalled();
  });
});
```

`apps/backend/src/live/socket-auth.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { clientIp, normalizeViewerId, originAllowed } from "./socket-auth.service";

describe("clientIp", () => {
  it("prefers CF-Connecting-IP, then the first X-Forwarded-For hop, then the socket address", () => {
    expect(clientIp({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8" }, "10.0.0.1")).toBe("9.9.9.9");
    expect(clientIp({ "x-forwarded-for": "8.8.8.8, 10.0.0.2" }, "10.0.0.1")).toBe("8.8.8.8");
    expect(clientIp({}, "10.0.0.1")).toBe("10.0.0.1");
    expect(clientIp({}, undefined)).toBe("unknown");
  });
});

describe("originAllowed", () => {
  it("allows everything when CORS_ORIGINS is not configured", () => {
    expect(originAllowed("https://evil.test", undefined)).toBe(true);
    expect(originAllowed("https://evil.test", [])).toBe(true);
  });
  it("allows listed origins and non-browser clients (no Origin header)", () => {
    const allowed = ["https://cms.test", "https://site.test"];
    expect(originAllowed("https://cms.test", allowed)).toBe(true);
    expect(originAllowed(undefined, allowed)).toBe(true);
  });
  it("rejects a browser origin that is not listed", () => {
    expect(originAllowed("https://evil.test", ["https://cms.test"])).toBe(false);
  });
});

describe("normalizeViewerId", () => {
  it("keeps a sane client id", () => {
    expect(normalizeViewerId("3f2a-viewer", "socket-1")).toBe("3f2a-viewer");
  });
  it("falls back to the socket id for missing or garbage values", () => {
    expect(normalizeViewerId(undefined, "socket-1")).toBe("socket-1");
    expect(normalizeViewerId("", "socket-1")).toBe("socket-1");
    expect(normalizeViewerId(42, "socket-1")).toBe("socket-1");
    expect(normalizeViewerId({ id: "x" }, "socket-1")).toBe("socket-1");
    expect(normalizeViewerId("x".repeat(10_000), "socket-1")).toBe("socket-1");
  });
});
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live`
Expected: FAIL — cannot find `./socket-registry` and `./socket-auth.service`.

- [ ] **Step 3: Implement the registry**

`apps/backend/src/live/socket-registry.ts`:
```ts
import { Injectable } from "@nestjs/common";

export const MAX_SOCKETS_PER_IP = 10;
/** Invalid, revoked or expired credential; foreign origin. Clients stop reconnecting. */
export const CLOSE_FORBIDDEN = 4403;
/** More than MAX_SOCKETS_PER_IP concurrent sockets from one IP. */
export const CLOSE_TOO_MANY = 4429;

export interface SocketEntry {
  socketId: string;
  ip: string;
  close: (code: number, reason: string) => void;
  /** Set when the socket authenticated with a presenter link. */
  presenterLinkId?: string;
  /** When set, the socket is closed with 4403 at this instant (Task 7). */
  expiresAt?: Date;
}

/** Every acknowledged websocket. In memory: one backend instance (spec §3.2). */
@Injectable()
export class SocketRegistry {
  private readonly sockets = new Map<string, SocketEntry>();
  private readonly removeListeners = new Set<(socketId: string) => void>();

  add(entry: SocketEntry): boolean {
    if (this.countForIp(entry.ip) >= MAX_SOCKETS_PER_IP) return false;
    this.sockets.set(entry.socketId, entry);
    return true;
  }

  remove(socketId: string): void {
    if (!this.sockets.delete(socketId)) return;
    for (const listener of this.removeListeners) listener(socketId);
  }

  countForIp(ip: string): number {
    let count = 0;
    for (const entry of this.sockets.values()) if (entry.ip === ip) count += 1;
    return count;
  }

  closeWhere(predicate: (entry: SocketEntry) => boolean, code: number, reason: string): number {
    let closed = 0;
    for (const entry of [...this.sockets.values()]) {
      if (!predicate(entry)) continue;
      entry.close(code, reason);
      closed += 1;
    }
    return closed;
  }

  onRemove(listener: (socketId: string) => void): void {
    this.removeListeners.add(listener);
  }
}
```

- [ ] **Step 4: Implement socket authentication**

`apps/backend/src/live/socket-auth.service.ts`:
```ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "http";
import type { Context } from "graphql-ws";
import type { WebSocket } from "ws";
import { ApiKeysService } from "../api-keys/api-keys.service";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { AuthService } from "../auth/auth.service";
import { CLOSE_TOO_MANY, SocketRegistry } from "./socket-registry";

/** What the server knows about one acknowledged socket. */
export interface SocketSession {
  socketId: string;
  ip: string;
  /** Client-chosen (localStorage); used only to count a browser once. Never trusted for limits. */
  viewerId: string;
  /** The `Authorization` value sent in connectionParams, replayed on every operation. */
  authorization: string | null;
}

export interface SocketExtra {
  socket: WebSocket;
  request: IncomingMessage;
  session?: SocketSession;
}
export type SocketContext = Context<Record<string, unknown> | undefined, SocketExtra>;

/** The `req` resolvers and guards see for an operation that arrived over a socket. */
export interface SocketRequest {
  headers: { authorization?: string };
  socketSession: SocketSession;
  user?: AuthenticatedUser | null;
  livePresenter?: boolean;
}

const MAX_VIEWER_ID = 64;

export function clientIp(headers: IncomingHttpHeaders, remoteAddress: string | undefined): string {
  const cf = headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const forwarded = headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  if (first) return first;
  return remoteAddress ?? "unknown";
}

/**
 * Browsers always send Origin on a websocket handshake; a missing header means a
 * non-browser client (wscat, tests), which a CORS-style check does not concern.
 */
export function originAllowed(origin: string | undefined, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!origin) return true;
  return allowed.includes(origin);
}

export function normalizeViewerId(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_VIEWER_ID) return fallback;
  return value;
}

function corsOrigins(): string[] | undefined {
  return process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly registry: SocketRegistry,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  /** Same credentials as the HTTP strategies. null = anonymous viewer. */
  async authenticate(authorization: string | null): Promise<AuthenticatedUser | null> {
    if (!authorization) return null;
    const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
    if (!token) throw new UnauthorizedException("Credencial inválida");
    if (token.startsWith("ei_")) return this.apiKeys.authenticate(token);

    let payload: { sub: string };
    try {
      payload = this.jwt.verify<{ sub: string }>(token);
    } catch {
      throw new UnauthorizedException("Sessão inválida");
    }
    const user = await this.auth.validateUserById(payload.sub);
    if (!user) throw new UnauthorizedException("Sessão inválida");
    return user as AuthenticatedUser;
  }

  /** Returning false makes graphql-ws close the socket with 4403 (Forbidden). */
  async onConnect(ctx: SocketContext): Promise<boolean> {
    const { socket, request } = ctx.extra;
    if (!originAllowed(request.headers.origin, corsOrigins())) return false;

    const params = ctx.connectionParams ?? {};
    const authorization =
      typeof params.authorization === "string" && params.authorization ? params.authorization : null;
    try {
      await this.authenticate(authorization);
    } catch {
      return false;
    }

    const socketId = randomUUID();
    const session: SocketSession = {
      socketId,
      ip: clientIp(request.headers, request.socket.remoteAddress),
      viewerId: normalizeViewerId(params.viewerId, socketId),
      authorization,
    };
    const accepted = this.registry.add({
      socketId,
      ip: session.ip,
      close: (code, reason) => socket.close(code, reason),
    });
    if (!accepted) {
      socket.close(CLOSE_TOO_MANY, "Too many connections");
      return false;
    }
    ctx.extra.session = session;
    return true;
  }

  onDisconnect(ctx: SocketContext): void {
    const session = ctx.extra.session;
    if (session) this.registry.remove(session.socketId);
  }

  /**
   * A fresh `req` per operation. It carries the Authorization header, so the
   * passport guards validate the credential again on every operation.
   */
  context(ctx: SocketContext): { req: SocketRequest } {
    const session = ctx.extra.session as SocketSession;
    return {
      req: {
        headers: session.authorization ? { authorization: session.authorization } : {},
        socketSession: session,
      },
    };
  }
}
```

`apps/backend/src/live/live.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { SocketAuthService } from "./socket-auth.service";
import { SocketRegistry } from "./socket-registry";

@Module({
  imports: [AuthModule, ApiKeysModule],
  providers: [SocketRegistry, SocketAuthService],
  exports: [SocketRegistry, SocketAuthService],
})
export class LiveModule {}
```

`apps/backend/src/auth/auth.module.ts` — `SocketAuthService` needs `JwtService`: change `exports: [AuthService],` to:
```ts
  exports: [AuthService, JwtModule],
```

- [ ] **Step 5: Enable subscriptions in the GraphQL module**

`apps/backend/src/app.module.ts` — add the imports:
```ts
import { LiveModule } from "./live/live.module";
import { SocketAuthService, type SocketContext } from "./live/socket-auth.service";
```
Replace the whole `GraphQLModule.forRoot<ApolloDriverConfig>({ … })` entry with:
```ts
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [LiveModule],
      inject: [SocketAuthService],
      useFactory: (socketAuth: SocketAuthService) => ({
        autoSchemaFile: join(process.cwd(), "src/schema.gql"),
        playground: false,
        plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
        subscriptions: {
          "graphql-ws": {
            path: "/graphql",
            onConnect: (ctx) => socketAuth.onConnect(ctx as unknown as SocketContext),
            onDisconnect: (ctx) => socketAuth.onDisconnect(ctx as unknown as SocketContext),
          },
        },
        // HTTP operations arrive as { req, res }; socket operations arrive as the
        // graphql-ws context, recognised by the session stored in onConnect.
        context: (ctx: { req?: unknown; res?: unknown; extra?: { session?: unknown } }) =>
          ctx.extra?.session
            ? socketAuth.context(ctx as unknown as SocketContext)
            : { req: ctx.req, res: ctx.res },
      }),
    }),
```
and add `LiveModule,` to the `imports` array after `PresentationsModule,`.

- [ ] **Step 6: Write the websocket test helpers**

`apps/backend/test/ws.ts`:
```ts
import type { INestApplication } from "@nestjs/common";
import { createClient, type Client } from "graphql-ws";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import type { GqlResponse } from "./helpers";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Starts the HTTP server on a random port and returns the websocket URL. */
export async function listen(app: INestApplication): Promise<string> {
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `ws://127.0.0.1:${port}/graphql`;
}

/** `ws` lets tests send handshake headers (Origin, CF-Connecting-IP); browsers cannot. */
function socketImpl(headers?: Record<string, string>) {
  return class extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address, protocols, { headers });
    }
  };
}

export function wsClient(
  url: string,
  connectionParams: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Client {
  return createClient({ url, webSocketImpl: socketImpl(headers), connectionParams, retryAttempts: 0, lazy: true });
}

/** Connects eagerly. Resolves once acknowledged; `closed` resolves with the close code. */
export function openSocket(
  url: string,
  connectionParams: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Promise<{ client: Client; closed: Promise<number> }> {
  return new Promise((resolve, reject) => {
    let resolveClosed: (code: number) => void = () => {};
    const closed = new Promise<number>((r) => (resolveClosed = r));
    let connected = false;
    const client = createClient({
      url,
      webSocketImpl: socketImpl(headers),
      connectionParams,
      retryAttempts: 0,
      lazy: false,
      onNonLazyError: () => {},
      on: {
        connected: () => {
          connected = true;
          resolve({ client, closed });
        },
        closed: (event) => {
          const code = (event as { code: number }).code;
          resolveClosed(code);
          if (!connected) reject(new Error(`socket closed before ack: ${code}`));
        },
      },
    });
  });
}

/** The close code of a connection the server refuses. */
export function closeCodeOf(
  url: string,
  connectionParams: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Promise<number> {
  return openSocket(url, connectionParams, headers).then(
    ({ client }) => {
      void client.dispose();
      throw new Error("expected the server to refuse the socket");
    },
    (error: Error) => Number(/(\d+)$/.exec(error.message)?.[1]),
  );
}

/** A query or mutation over the socket, shaped like the HTTP helper's response. */
export function wsRequest<T = any>(
  client: Client,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GqlResponse<T>> {
  return new Promise((resolve, reject) => {
    let result: GqlResponse<T> = {};
    client.subscribe<T>(
      { query, variables },
      {
        next: (value) => (result = value as GqlResponse<T>),
        error: (error) => (Array.isArray(error) ? resolve({ errors: error }) : reject(error)),
        complete: () => resolve(result),
      },
    );
  });
}

export function subscribeTo<T = any>(client: Client, query: string, variables?: Record<string, unknown>) {
  const events: T[] = [];
  const errors: unknown[] = [];
  const stop = client.subscribe<T>(
    { query, variables },
    {
      next: (value) => {
        if (value.errors) errors.push(...value.errors);
        if (value.data) events.push(value.data as T);
      },
      error: (error) => errors.push(error),
      complete: () => {},
    },
  );
  return {
    events,
    errors,
    stop,
    /** Polls until `predicate(events)` holds; fails with what was received otherwise. */
    async waitUntil(predicate: (events: T[]) => boolean, timeoutMs = 5000): Promise<T[]> {
      const deadline = Date.now() + timeoutMs;
      while (!predicate(events)) {
        if (errors.length) throw new Error(`subscription error: ${JSON.stringify(errors)}`);
        if (Date.now() > deadline) throw new Error(`condition not met; events: ${JSON.stringify(events)}`);
        await sleep(20);
      }
      return events;
    },
    waitFor(count: number, timeoutMs = 5000): Promise<T[]> {
      return this.waitUntil((received) => received.length >= count, timeoutMs);
    },
  };
}
```

- [ ] **Step 7: Write the failing integration test**

`apps/backend/src/live/socket.integration.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { closeCodeOf, listen, openSocket, wsClient, wsRequest } from "../../test/ws";

const CREATE_KEY = `mutation { createApiKey(name: "ws", expiresIn: ONE_HOUR) { token apiKey { id } } }`;
const REVOKE_KEY = `mutation ($id: ID!) { revokeApiKey(id: $id) { id } }`;
const DECKS = `{ presentations { id } }`;

describe("graphql-ws transport", () => {
  let app: INestApplication;
  let url: string;
  const disposables: { dispose(): void | Promise<void> }[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);
  afterEach(async () => {
    delete process.env.CORS_ORIGINS;
    await Promise.all(disposables.splice(0).map((c) => c.dispose()));
  });

  const client = (params?: Record<string, unknown>, headers?: Record<string, string>) => {
    const c = wsClient(url, params, headers);
    disposables.push(c);
    return c;
  };

  it("answers anonymous operations over the socket", async () => {
    const res = await wsRequest(client(), "{ hello }");
    expect(res.data?.hello).toContain("Engenhariainversa");
    expect(errorCode(await wsRequest(client(), "{ me { id } }"))).toBe("UNAUTHENTICATED");
  });

  it("authenticates a JWT sent in connectionParams", async () => {
    const user = await createUser({ admin: true });
    const res = await wsRequest(client({ authorization: `Bearer ${jwtFor(app, user)}` }), "{ me { id } }");
    expect(res.data?.me.id).toBe(user.id);
  });

  it("refuses a socket with an invalid credential (4403)", async () => {
    expect(await closeCodeOf(url, { authorization: "Bearer not-a-token" })).toBe(4403);
    expect(await closeCodeOf(url, { authorization: "Bearer ei_unknown" })).toBe(4403);
  });

  it("validates the credential again on every operation", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const key = (await gql(app, CREATE_KEY, undefined, jwt)).data.createApiKey;
    const socket = client({ authorization: `Bearer ${key.token}` });
    expect((await wsRequest(socket, DECKS)).data?.presentations).toEqual([]);

    await gql(app, REVOKE_KEY, { id: key.apiKey.id }, jwt);
    const after = await wsRequest(socket, DECKS);
    expect(errorCode(after)).toBe("UNAUTHENTICATED");
    expect(after.errors?.[0].message).toBe("Chave revogada");
  });

  it("checks Origin against CORS_ORIGINS, letting non-browser clients through", async () => {
    process.env.CORS_ORIGINS = "https://cms.test, https://site.test";
    expect(await closeCodeOf(url, {}, { Origin: "https://evil.test" })).toBe(4403);
    const allowed = await openSocket(url, {}, { Origin: "https://site.test" });
    disposables.push(allowed.client);
    const noOrigin = await openSocket(url);
    disposables.push(noOrigin.client);
  });

  it("caps concurrent sockets per IP at 10 (4429) and frees the slot on close", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.7" };
    const open = [];
    for (let i = 0; i < 10; i++) open.push(await openSocket(url, {}, headers));
    disposables.push(...open.map((o) => o.client));
    expect(await closeCodeOf(url, {}, headers)).toBe(4429);

    await open[0].client.dispose();
    await open[0].closed;
    const again = await openSocket(url, {}, headers);
    disposables.push(again.client);
  });
});
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live`
Expected before Step 5 is applied: the integration file FAILS (the socket handshake is refused: no subscription server). After Steps 3–5: all three files PASS.

If "authenticates a JWT sent in connectionParams" fails with `UNAUTHENTICATED`, the module `context` is not being called for socket operations with the graphql-ws context: add `console.log(Object.keys(ctx))` inside the `context` function, re-run, and adapt the discriminator (`ctx.extra?.session`) to the shape printed — do not move authentication out of the guards.

- [ ] **Step 8: Run the whole backend suite**

Run: `dcx backend pnpm --filter backend test`
Expected: every file PASSES (the 3a suites still pass: HTTP operations keep receiving `{ req, res }`).

- [ ] **Step 9: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml apps/backend/src/app.module.ts apps/backend/src/auth/auth.module.ts apps/backend/src/live apps/backend/test/ws.ts
git commit -m "feat(backend): enable graphql-ws subscriptions with socket authentication

Sockets authenticate in onConnect and every operation re-runs the passport
strategies. Origin is checked against CORS_ORIGINS and each IP is capped at
ten concurrent sockets.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Presenter links: model, migration, service, passport strategy and GraphQL

A presenter link is a bearer token (`eip_…`) scoped to **one** presentation: it can read that presentation in full and (from Task 3) run its live controls. It can never edit anything.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`; Create: `packages/database/prisma/migrations/<timestamp>_add_presenter_links/migration.sql` (generated)
- Create: `apps/backend/src/presenter-links/presenter-links.service.ts`, `presenter-links.types.ts`, `presenter-links.resolver.ts`, `presenter-links.module.ts`
- Create: `apps/backend/src/auth/presenter-link.strategy.ts`, `apps/backend/src/auth/presenter-link.guard.ts`
- Test: `apps/backend/src/presenter-links/presenter-links.service.test.ts`, `apps/backend/src/presenter-links/presenter-links.resolver.test.ts`
- Modify: `apps/backend/src/auth/auth-kind.ts`, `apps/backend/src/api-keys/api-key-token.ts`, `apps/backend/src/presentations/presentations.service.ts` (reserved slug), `apps/backend/src/presentations/presentations.service.test.ts`, `apps/backend/src/live/socket-auth.service.ts`, `apps/backend/src/live/live.module.ts`, `apps/backend/src/app.module.ts`, `docker-compose.dev.yml`, `docker-compose.yml`

**Interfaces:**
- Consumes: `generateToken`, `hashToken` (3a Task 5); `assertWritable`, `PresentationsService.getById`, `PresentationsModule` (3a Tasks 7, 9); `PresentationType` (3a Task 9); `GqlAuthGuard`, `RolesGuard`, `@Resource`, `@CurrentUser` (existing); `SocketAuthService` (Task 1).
- Produces: Prisma model `PresenterLink`; `AuthKind` with `"presenterLink"` and the `presenterLink*` fields of `AuthenticatedUser`; `generateToken("eip_")`; `PresenterLinksService`, `LINK_GONE`, `PRESENTER_LINK_TTL_MS`, `landingUrl`; passport strategy `"presenter-link"`; `GqlPresenterLinkGuard`; GraphQL `PresenterLink`, `CreatedPresenterLink`, `PresenterLinkExpiry`, `presenterLinks`, `createPresenterLink`, `revokePresenterLink`, `presentationForPresenter`; `RESERVED_SLUGS`; sockets accept `Bearer eip_…`.

- [ ] **Step 1: Add the model and generate the migration**

Append to `packages/database/prisma/schema.prisma`:
```prisma
// Temporary bearer token ("eip_…") that lets its holder present ONE presentation
// from a machine without a CMS session: read it in full and run the live
// controls. Only the SHA-256 of the token is stored.
model PresenterLink {
  id             String       @id @default(uuid())
  presentationId String       @map("presentation_id")
  presentation   Presentation @relation(fields: [presentationId], references: [id], onDelete: Cascade)
  name           String
  // First 8 characters after "eip_", shown in the CMS list.
  prefix         String
  hash           String       @unique
  createdById    String       @map("created_by_id")
  createdBy      User         @relation(fields: [createdById], references: [id])
  expiresAt      DateTime     @map("expires_at")
  lastUsedAt     DateTime?    @map("last_used_at")
  revokedAt      DateTime?    @map("revoked_at")
  createdAt      DateTime     @default(now()) @map("created_at")

  @@map("presenter_links")
}
```
In `model Presentation` add after `slides      Slide[]`:
```prisma
  presenterLinks PresenterLink[]
```
In `model User` add after `apiKeys       ApiKey[]`:
```prisma
  presenterLinks PresenterLink[]
```

Run: `dcx backend pnpm --filter @repo/database db:migrate:dev --name add_presenter_links`
Expected: `Applying migration ..._add_presenter_links`, client regenerated. The SQL creates `presenter_links` with a unique index on `hash` and an `ON DELETE CASCADE` foreign key to `presentations`. If the new migration folder is owned by root: `sudo chown -R "$(id -u):$(id -g)" packages/database/prisma/migrations`.

Run: `dcx backend pnpm --filter @repo/database build`

- [ ] **Step 2: Write the failing service tests**

`apps/backend/src/presenter-links/presenter-links.service.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";
import { hashToken } from "../api-keys/api-key-token";
import { PresentationsService } from "../presentations/presentations.service";
import { LINK_GONE, PresenterLinksService, landingUrl } from "./presenter-links.service";

const presentations = new PresentationsService();
const service = new PresenterLinksService();

describe("PresenterLinksService", () => {
  let userId: string;
  let deckId: string;
  beforeEach(async () => {
    await resetDatabase();
    userId = (await createUser()).id;
    deckId = (await presentations.create({ title: "Deck" }, userId)).id;
  });
  afterEach(() => {
    delete process.env.LANDING_URL;
  });

  it("creates an eip_ token, stores only its hash and returns the landing URL once", async () => {
    process.env.LANDING_URL = "http://localhost:4052/";
    const { presenterLink, token, url } = await service.create(deckId, userId, "  Notebook do evento ", "TWO_HOURS");
    expect(token).toMatch(/^eip_[A-Za-z0-9_-]{43}$/);
    expect(url).toBe(`http://localhost:4052/apresentacoes/controle#t=${token}`);
    expect(presenterLink.name).toBe("Notebook do evento");
    expect(presenterLink.prefix).toBe(token.slice(4, 12));
    const row = await prisma.presenterLink.findUniqueOrThrow({ where: { id: presenterLink.id } });
    expect(row.hash).toBe(hashToken(token));
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime();
    expect(Math.abs(ttl - 2 * 3600_000)).toBeLessThan(5_000);
  });

  it("falls back to the production landing URL", () => {
    expect(landingUrl()).toBe("https://engenhariainversa.com.br");
  });

  it("rejects an empty name and a trashed presentation", async () => {
    await expect(service.create(deckId, userId, "  ", "ONE_DAY")).rejects.toThrow("Nome obrigatório");
    await presentations.softDelete(deckId);
    await expect(service.create(deckId, userId, "x", "ONE_DAY")).rejects.toThrow("Apresentação na lixeira");
  });

  it("authenticates as the creator, scoped to the presentation", async () => {
    const { presenterLink, token } = await service.create(deckId, userId, "k", "ONE_DAY");
    const user = await service.authenticate(token);
    expect(user.id).toBe(userId);
    expect(user.authKind).toBe("presenterLink");
    expect(user.presenterLinkId).toBe(presenterLink.id);
    expect(user.presenterPresentationId).toBe(deckId);
    expect(user.presenterLinkExpiresAt?.getTime()).toBe(presenterLink.expiresAt.getTime());
  });

  it("rejects unknown, expired, revoked and trashed-presentation links with one message", async () => {
    await expect(service.authenticate("eip_nope")).rejects.toThrow(LINK_GONE);

    const expired = await service.create(deckId, userId, "old", "TWO_HOURS");
    await prisma.presenterLink.update({
      where: { id: expired.presenterLink.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(service.authenticate(expired.token)).rejects.toThrow(LINK_GONE);

    const revoked = await service.create(deckId, userId, "rev", "TWO_HOURS");
    await service.revoke(revoked.presenterLink.id);
    await expect(service.authenticate(revoked.token)).rejects.toThrow(LINK_GONE);

    const live = await service.create(deckId, userId, "ok", "TWO_HOURS");
    await presentations.softDelete(deckId);
    await expect(service.authenticate(live.token)).rejects.toThrow(LINK_GONE);
  });

  it("lists newest first, revokes idempotently and notifies listeners once", async () => {
    const a = await service.create(deckId, userId, "a", "ONE_DAY");
    const b = await service.create(deckId, userId, "b", "ONE_DAY");
    expect((await service.list(deckId)).map((l) => l.id)).toEqual([b.presenterLink.id, a.presenterLink.id]);

    const revokedIds: string[] = [];
    service.onRevoked((id) => revokedIds.push(id));
    const once = await service.revoke(a.presenterLink.id);
    const twice = await service.revoke(a.presenterLink.id);
    expect(twice.revokedAt?.getTime()).toBe(once.revokedAt?.getTime());
    expect(revokedIds).toEqual([a.presenterLink.id]);
  });
});
```

Add to `apps/backend/src/presentations/presentations.service.test.ts`, inside `describe("create", …)`:
```ts
    it("keeps the presenter link route's slug reserved", async () => {
      expect(await codeOf(() => service.create({ title: "X", slug: "controle" }, userId))).toBe("INVALID_SLUG");
      const generated = await service.create({ title: "Controle" }, userId);
      expect(generated.slug).toBe("controle-2");
      expect(await codeOf(() => service.update(generated.id, { slug: "controle" }))).toBe("INVALID_SLUG");
    });
```

Run: `dcx backend pnpm --filter backend exec vitest run src/presenter-links src/presentations/presentations.service.test.ts`
Expected: FAIL — `./presenter-links.service` not found; the reserved-slug test fails (`controle` accepted).

- [ ] **Step 3: Extend the auth kinds and the token helper**

`apps/backend/src/auth/auth-kind.ts` — replace the two type declarations:
```ts
export type AuthKind = "jwt" | "apiKey" | "presenterLink";

/**
 * `req.user` for JWT sessions, API keys and presenter links. A key or a link
 * resolves to its creator's user row; `authKind` says which credential was
 * presented, and guards decide what that credential may do.
 */
export type AuthenticatedUser = User & {
  role: Role;
  authKind?: AuthKind;
  apiKeyId?: string;
  presenterLinkId?: string;
  /** The only presentation a presenter link may read and control. */
  presenterPresentationId?: string;
  presenterLinkExpiresAt?: Date;
};
```

`apps/backend/src/api-keys/api-key-token.ts` — widen the prefix:
```ts
export function generateToken(prefix: "ei_" | "eip_"): { token: string; hash: string; displayPrefix: string } {
```

- [ ] **Step 4: Reserve the `controle` slug**

`/apresentacoes/controle` is the presenter link page (Task 14); a presentation with that slug would be unreachable. In `apps/backend/src/presentations/presentations.service.ts`:

Add below `const MAX_TITLE = 120;`:
```ts
/** Slugs taken by static routes under /apresentacoes on the landing. */
export const RESERVED_SLUGS = ["controle"];
const isUsableSlug = (slug: string) => isValidSlug(slug) && !RESERVED_SLUGS.includes(slug);
```
In `update`, replace `if (!isValidSlug(input.slug)) throw invalidSlug(input.slug);` with:
```ts
      if (!isUsableSlug(input.slug)) throw invalidSlug(input.slug);
```
In `resolveSlug`, replace `if (!isValidSlug(explicit)) throw invalidSlug(explicit);` with:
```ts
      if (!isUsableSlug(explicit)) throw invalidSlug(explicit);
```
and replace `const used = new Set(existing.map((e) => e.slug));` with:
```ts
    const used = new Set([...existing.map((e) => e.slug), ...RESERVED_SLUGS]);
```

- [ ] **Step 5: Implement the service**

`apps/backend/src/presenter-links/presenter-links.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { prisma, type PresenterLink } from "@repo/database";
import { generateToken, hashToken } from "../api-keys/api-key-token";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { assertWritable } from "../presentations/presentations.service";

const HOUR = 3600_000;

export const PRESENTER_LINK_TTL_MS = {
  TWO_HOURS: 2 * HOUR,
  TWELVE_HOURS: 12 * HOUR,
  ONE_DAY: 24 * HOUR,
  SEVEN_DAYS: 7 * 24 * HOUR,
} as const;
export type PresenterLinkExpiryKey = keyof typeof PRESENTER_LINK_TTL_MS;

/** One message for unknown, revoked, expired and trashed: the holder needs no detail. */
export const LINK_GONE = "Link revogado ou expirado";

const LAST_USED_RESOLUTION_MS = 60_000;

/** Where the landing is served; the presenter link page lives there (spec L4). */
export function landingUrl(): string {
  return (process.env.LANDING_URL ?? "https://engenhariainversa.com.br").replace(/\/+$/, "");
}

@Injectable()
export class PresenterLinksService {
  private readonly revokeListeners = new Set<(linkId: string) => void>();

  /** Called once per link, when it is revoked (Task 7 closes its sockets). */
  onRevoked(listener: (linkId: string) => void): void {
    this.revokeListeners.add(listener);
  }

  async create(
    presentationId: string,
    userId: string,
    name: string,
    expiresIn: PresenterLinkExpiryKey,
  ): Promise<{ presenterLink: PresenterLink; token: string; url: string }> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException("Nome obrigatório");
    if (trimmed.length > 80) throw new BadRequestException("Nome com no máximo 80 caracteres");
    await assertWritable(presentationId);

    const { token, hash, displayPrefix } = generateToken("eip_");
    const presenterLink = await prisma.presenterLink.create({
      data: {
        presentationId,
        name: trimmed,
        prefix: displayPrefix,
        hash,
        createdById: userId,
        expiresAt: new Date(Date.now() + PRESENTER_LINK_TTL_MS[expiresIn]),
      },
    });
    // The token rides in the fragment: it is never sent to the landing server
    // nor written to access logs (spec L4).
    return { presenterLink, token, url: `${landingUrl()}/apresentacoes/controle#t=${token}` };
  }

  list(presentationId: string): Promise<PresenterLink[]> {
    return prisma.presenterLink.findMany({ where: { presentationId }, orderBy: { createdAt: "desc" } });
  }

  async revoke(id: string): Promise<PresenterLink> {
    const link = await prisma.presenterLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException("Link não encontrado");
    if (link.revokedAt) return link;
    const revoked = await prisma.presenterLink.update({ where: { id }, data: { revokedAt: new Date() } });
    for (const listener of this.revokeListeners) listener(id);
    return revoked;
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const link = await prisma.presenterLink.findUnique({
      where: { hash: hashToken(token) },
      include: {
        createdBy: { include: { role: true } },
        presentation: { select: { deletedAt: true } },
      },
    });
    if (!link || link.revokedAt || link.expiresAt.getTime() <= Date.now() || link.presentation.deletedAt) {
      throw new UnauthorizedException(LINK_GONE);
    }

    if (!link.lastUsedAt || Date.now() - link.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      await prisma.presenterLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    }

    return {
      ...link.createdBy,
      authKind: "presenterLink",
      presenterLinkId: link.id,
      presenterPresentationId: link.presentationId,
      presenterLinkExpiresAt: link.expiresAt,
    };
  }
}
```

Run: `dcx backend pnpm --filter backend exec vitest run src/presenter-links/presenter-links.service.test.ts src/presentations/presentations.service.test.ts src/api-keys`
Expected: PASS (the 3a token tests still pass with the widened prefix).

- [ ] **Step 6: Write the failing resolver test**

`apps/backend/src/presenter-links/presenter-links.resolver.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { closeCodeOf, listen, wsClient, wsRequest } from "../../test/ws";

const CREATE_DECK = `mutation ($input: CreatePresentationInput!) { createPresentation(input: $input) { id slug } }`;
const CREATE_LINK = `mutation ($p: ID!, $name: String!, $e: PresenterLinkExpiry!) {
  createPresenterLink(presentationId: $p, name: $name, expiresIn: $e) { url presenterLink { id name prefix expiresAt revokedAt } }
}`;
const LINKS = `query ($p: ID!) { presenterLinks(presentationId: $p) { id name revokedAt } }`;
const REVOKE = `mutation ($id: ID!) { revokePresenterLink(id: $id) { id revokedAt } }`;
const FOR_PRESENTER = `{ presentationForPresenter { id title visibility slideCount slides { id notes hidden } } }`;
const CREATE_KEY = `mutation { createApiKey(name: "k", expiresIn: ONE_HOUR) { token } }`;

const deckInput = {
  title: "Privada",
  slides: [
    { template: "cover", content: { title: "Capa" } },
    { template: "bullets", content: { title: "T", items: ["a"] }, notes: "segredo", hidden: true },
  ],
};

describe("presenter links over GraphQL", () => {
  let app: INestApplication;
  let url: string;
  let jwt: string;
  let deckId: string;

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase();
    jwt = jwtFor(app, await createUser({ admin: true }));
    deckId = (await gql(app, CREATE_DECK, { input: deckInput }, jwt)).data.createPresentation.id;
  });

  const createLink = async (presentationId = deckId) => {
    const res = await gql(app, CREATE_LINK, { p: presentationId, name: "Evento", e: "TWO_HOURS" }, jwt);
    const { url: linkUrl, presenterLink } = res.data.createPresenterLink;
    return { token: linkUrl.split("#t=")[1] as string, linkUrl: linkUrl as string, id: presenterLink.id as string };
  };

  it("creates a link whose URL carries the token in the fragment, and lists it without the token", async () => {
    const { linkUrl, token } = await createLink();
    expect(linkUrl).toMatch(/\/apresentacoes\/controle#t=eip_[A-Za-z0-9_-]{43}$/);
    const listed = await gql(app, LINKS, { p: deckId }, jwt);
    expect(listed.data.presenterLinks).toHaveLength(1);
    expect(JSON.stringify(listed.data)).not.toContain(token);
  });

  it("serves the private presentation in full to its link", async () => {
    const { token } = await createLink();
    const res = await gql(app, FOR_PRESENTER, undefined, token);
    expect(res.errors).toBeUndefined();
    expect(res.data.presentationForPresenter).toMatchObject({ id: deckId, visibility: "PRIVATE", slideCount: 2 });
    expect(res.data.presentationForPresenter.slides[1]).toMatchObject({ notes: "segredo", hidden: true });
  });

  it("gives a link no other power: no edits, no library, no session, no key or link management", async () => {
    const { token } = await createLink();
    const denied = [
      gql(app, `mutation ($id: ID!) { updatePresentation(id: $id, input: { title: "x" }) { id } }`, { id: deckId }, token),
      gql(app, `mutation ($id: ID!) { deletePresentation(id: $id) }`, { id: deckId }, token),
      gql(app, `query ($id: ID!) { presentation(id: $id) { id } }`, { id: deckId }, token),
      gql(app, `{ presentations { id } }`, undefined, token),
      gql(app, `{ me { id } }`, undefined, token),
      gql(app, CREATE_KEY, undefined, token),
      gql(app, CREATE_LINK, { p: deckId, name: "x", e: "ONE_DAY" }, token),
      gql(app, LINKS, { p: deckId }, token),
    ];
    for (const res of await Promise.all(denied)) expect(errorCode(res)).toBe("UNAUTHENTICATED");
  });

  it("requires a CMS session to manage links: API keys and JWT-less callers are refused", async () => {
    const key = (await gql(app, CREATE_KEY, undefined, jwt)).data.createApiKey.token;
    expect(errorCode(await gql(app, CREATE_LINK, { p: deckId, name: "x", e: "ONE_DAY" }, key))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, LINKS, { p: deckId }))).toBe("UNAUTHENTICATED");
    const plain = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, LINKS, { p: deckId }, plain))).toBe("FORBIDDEN");
    expect(errorCode(await gql(app, FOR_PRESENTER, undefined, jwt))).toBe("UNAUTHENTICATED");
  });

  it("stops working the moment it is revoked", async () => {
    const { token, id } = await createLink();
    await gql(app, REVOKE, { id }, jwt);
    const res = await gql(app, FOR_PRESENTER, undefined, token);
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
    expect(res.errors?.[0].message).toBe("Link revogado ou expirado");
  });

  it("is accepted on the socket, and refused there once revoked (4403)", async () => {
    const { token, id } = await createLink();
    const socket = wsClient(url, { authorization: `Bearer ${token}` });
    const res = await wsRequest(socket, FOR_PRESENTER);
    expect(res.data?.presentationForPresenter.id).toBe(deckId);
    await socket.dispose();

    await gql(app, REVOKE, { id }, jwt);
    expect(await closeCodeOf(url, { authorization: `Bearer ${token}` })).toBe(4403);
  });
});
```

Run: `dcx backend pnpm --filter backend exec vitest run src/presenter-links/presenter-links.resolver.test.ts`
Expected: FAIL — `Unknown type "PresenterLinkExpiry"`.

- [ ] **Step 7: Implement the strategy and guard**

`apps/backend/src/auth/presenter-link.strategy.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { PresenterLinksService } from "../presenter-links/presenter-links.service";
import type { AuthenticatedUser } from "./auth-kind";

/**
 * Bearer tokens starting with "eip_" are presenter links. Anything else is
 * "not mine" (null), so passport tries the next strategy of the guard. A dead
 * link throws, which stops the chain with "Link revogado ou expirado".
 */
@Injectable()
export class PresenterLinkStrategy extends PassportStrategy(Strategy, "presenter-link") {
  constructor(private readonly presenterLinks: PresenterLinksService) {
    super();
  }

  async validate(req: { headers?: { authorization?: string } }): Promise<AuthenticatedUser | null> {
    const match = /^Bearer\s+(eip_\S+)$/i.exec(req.headers?.authorization ?? "");
    if (!match) return null;
    return this.presenterLinks.authenticate(match[1]);
  }
}
```

`apps/backend/src/auth/presenter-link.guard.ts`:
```ts
import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

/**
 * Operations only a presenter link may call. Never pair it with RolesGuard: the
 * link resolves to its creator's user row, and RolesGuard would then grant the
 * creator's permissions.
 */
@Injectable()
export class GqlPresenterLinkGuard extends AuthGuard("presenter-link") {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }
}
```

- [ ] **Step 8: Implement types, resolver and module**

`apps/backend/src/presenter-links/presenter-links.types.ts`:
```ts
import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum PresenterLinkExpiry {
  TWO_HOURS = "TWO_HOURS",
  TWELVE_HOURS = "TWELVE_HOURS",
  ONE_DAY = "ONE_DAY",
  SEVEN_DAYS = "SEVEN_DAYS",
}
registerEnumType(PresenterLinkExpiry, { name: "PresenterLinkExpiry" });

@ObjectType("PresenterLink")
export class PresenterLinkType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: "First 8 characters after eip_, for identification" })
  prefix!: string;

  @Field()
  expiresAt!: Date;

  @Field(() => Date, { nullable: true })
  lastUsedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  revokedAt!: Date | null;

  @Field()
  createdAt!: Date;
}

@ObjectType("CreatedPresenterLink")
export class CreatedPresenterLinkType {
  @Field(() => PresenterLinkType)
  presenterLink!: PresenterLinkType;

  @Field({ description: "The presenter page URL with the token in the fragment. Returned only here." })
  url!: string;
}
```

`apps/backend/src/presenter-links/presenter-links.resolver.ts`:
```ts
import { UnauthorizedException, UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GqlAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { GqlPresenterLinkGuard } from "../auth/presenter-link.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { PresentationsService } from "../presentations/presentations.service";
import { PresentationType } from "../presentations/presentations.types";
import { LINK_GONE, PresenterLinksService } from "./presenter-links.service";
import { CreatedPresenterLinkType, PresenterLinkExpiry, PresenterLinkType } from "./presenter-links.types";

@Resolver()
export class PresenterLinksResolver {
  constructor(
    private readonly presenterLinks: PresenterLinksService,
    private readonly presentations: PresentationsService,
  ) {}

  // ── Management: CMS session only (GqlAuthGuard = JWT) ──

  @Query(() => [PresenterLinkType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "update")
  presenterLinks(@Args("presentationId", { type: () => ID }) presentationId: string) {
    return this.presenterLinks.list(presentationId);
  }

  @Mutation(() => CreatedPresenterLinkType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "update")
  async createPresenterLink(
    @CurrentUser() user: AuthenticatedUser,
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("name") name: string,
    @Args("expiresIn", { type: () => PresenterLinkExpiry }) expiresIn: PresenterLinkExpiry,
  ) {
    const { presenterLink, url } = await this.presenterLinks.create(presentationId, user.id, name, expiresIn);
    return { presenterLink, url };
  }

  @Mutation(() => PresenterLinkType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "update")
  revokePresenterLink(@Args("id", { type: () => ID }) id: string) {
    return this.presenterLinks.revoke(id);
  }

  // ── The link itself ────────────────────────────────────

  /** The one presentation the link is scoped to, in full (notes and hidden slides). */
  @Query(() => PresentationType)
  @UseGuards(GqlPresenterLinkGuard)
  async presentationForPresenter(@CurrentUser() user: AuthenticatedUser) {
    const presentation = await this.presentations.getById(user.presenterPresentationId as string);
    if (!presentation || presentation.deletedAt) throw new UnauthorizedException(LINK_GONE);
    return presentation;
  }
}
```

`apps/backend/src/presenter-links/presenter-links.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { GqlPresenterLinkGuard } from "../auth/presenter-link.guard";
import { PresenterLinkStrategy } from "../auth/presenter-link.strategy";
import { PresentationsModule } from "../presentations/presentations.module";
import { PresenterLinksResolver } from "./presenter-links.resolver";
import { PresenterLinksService } from "./presenter-links.service";

@Module({
  imports: [PassportModule, PresentationsModule],
  providers: [PresenterLinksService, PresenterLinkStrategy, PresenterLinksResolver, GqlPresenterLinkGuard],
  exports: [PresenterLinksService],
})
export class PresenterLinksModule {}
```

`apps/backend/src/app.module.ts`: `import { PresenterLinksModule } from "./presenter-links/presenter-links.module";` and add `PresenterLinksModule,` to `imports` after `PresentationsModule,`.

- [ ] **Step 9: Accept presenter links on the socket**

`apps/backend/src/live/live.module.ts`: add `import { PresenterLinksModule } from "../presenter-links/presenter-links.module";` and change `imports` to `[AuthModule, ApiKeysModule, PresenterLinksModule]`.

`apps/backend/src/live/socket-auth.service.ts`:
- add `import { PresenterLinksService } from "../presenter-links/presenter-links.service";`
- add the constructor parameter `private readonly presenterLinks: PresenterLinksService,` after `apiKeys`
- in `authenticate`, add before the `ei_` line:
```ts
    if (token.startsWith("eip_")) return this.presenterLinks.authenticate(token);
```
- in `onConnect`, keep the authenticated user (Task 7 uses the link id and expiry). Replace
```ts
    try {
      await this.authenticate(authorization);
    } catch {
      return false;
    }
```
with
```ts
    let user: AuthenticatedUser | null;
    try {
      user = await this.authenticate(authorization);
    } catch {
      return false;
    }
```
and replace the `this.registry.add({ … })` call with:
```ts
    const accepted = this.registry.add({
      socketId,
      ip: session.ip,
      close: (code, reason) => socket.close(code, reason),
      presenterLinkId: user?.presenterLinkId,
      expiresAt: user?.presenterLinkExpiresAt,
    });
```

- [ ] **Step 10: Configure `LANDING_URL`**

`docker-compose.dev.yml`, `backend.environment`, add:
```yaml
      # Where presenter link URLs point (the landing serves /apresentacoes/controle).
      - LANDING_URL=http://localhost:4052
```
`docker-compose.yml`, `backend.environment`, add after the `CORS_ORIGINS` line:
```yaml
      - LANDING_URL=https://engenhariainversa.com.br
```
(Plain configuration like `CORS_ORIGINS`, not a secret: nothing changes in `deploy.yml` or `.env.example`.)

Run: `docker compose -f docker-compose.dev.yml up -d backend`

- [ ] **Step 11: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend test`
Expected: every file PASSES. `src/schema.gql` now contains `type PresenterLink`, `type CreatedPresenterLink`, `enum PresenterLinkExpiry`, `presentationForPresenter`.

- [ ] **Step 12: Commit**

```bash
git add packages/database/prisma apps/backend/src docker-compose.dev.yml docker-compose.yml
git commit -m "feat(backend): add temporary presenter links scoped to one presentation

A link (eip_ token, stored as a SHA-256 hash) reads its presentation in full
over HTTP and the socket, and nothing else. The slug \"controle\" is reserved
for the presenter page.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `LiveSessionService` core: start / stop / slide, `liveState`, `liveEvents`

**Files:**
- Create: `apps/backend/src/live/live-session.service.ts`, `apps/backend/src/live/live.types.ts`, `apps/backend/src/live/live.guards.ts`, `apps/backend/src/live/live.resolver.ts`
- Test: `apps/backend/src/live/live-session.service.test.ts`, `apps/backend/src/live/live.integration.test.ts`
- Modify: `apps/backend/src/live/live.module.ts`, `apps/backend/src/presentations/presentations.service.ts` (`onUnpublished`)

**Interfaces:**
- Consumes: `SocketRequest`, `SocketSession` (Task 1); `"presenter-link"` strategy, `AuthenticatedUser.presenterPresentationId` (Task 2); `PresentationsService.getById`, `badInput`, `notFound` (3a Task 7); `PermissionsService.canAccess` (existing, global); `"api-key"` / `"jwt"` strategies (3a).
- Produces: `LiveSessionService` (`get`, `findBySlug`, `events`, `start`, `stop`, `setSlide`, `state`, `viewerCount`), `eventFor`, `REACTION_KINDS`, `ReactionKind`, `LiveEventData`, `LiveSession`, `LiveStateData`, `liveTopic`; GraphQL types of spec §3.7 (`LiveState`, `LiveEvent`, `LivePointer`, `ReactionCount`, enums `LiveEventType`, `ReactionKind`); `GqlLiveControlGuard`, `GqlOptionalLiveGuard`; `liveState`, `liveEvents`, `startLive`, `stopLive`, `setLiveSlide`; `PresentationsService.onUnpublished`.
- The service is pure in-memory and synchronous (no Prisma), so its unit tests use fake timers and no database. The resolver does the database checks.

- [ ] **Step 1: Write the failing unit tests**

`apps/backend/src/live/live-session.service.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, eventFor, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

/** Every event the service publishes, in order (synchronous: no async iterator involved). */
function record(service: LiveSessionService): LiveEventData[] {
  const events: LiveEventData[] = [];
  vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
    events.push(event as LiveEventData);
  });
  return events;
}
const types = (events: LiveEventData[]) => events.map((e) => e.type);

describe("LiveSessionService — sessions", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = record(service);
  });
  afterEach(() => vi.useRealTimers());

  it("starts a session and announces it", () => {
    const session = service.start(DECK);
    expect(session).toMatchObject({ presentationId: "deck-1", slug: "minha-live", slideId: "s1", pointer: null });
    expect(session.showViewerCount).toBe(true);
    expect(session.showReactionsOnScreen).toBe(true);
    expect(events[0]).toEqual({ type: "STARTED", slideId: "s1" });
    expect(service.get("deck-1")).toBe(session);
    expect(service.findBySlug("minha-live")).toBe(session);
  });

  it("start is idempotent: a second start keeps the session and only moves the slide", () => {
    const first = service.start(DECK);
    vi.advanceTimersByTime(60_000);
    events.length = 0;
    const again = service.start({ ...DECK, slideId: "s2" });
    expect(again).toBe(first);
    expect(again.startedAt.toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(events).toEqual([{ type: "SLIDE", slideId: "s2" }]);

    events.length = 0;
    service.start({ ...DECK, slideId: "s2" });
    expect(events).toEqual([]);
  });

  it("setSlide publishes only real changes and does nothing when not live", () => {
    expect(service.setSlide("deck-1", "s2")).toBe(false);
    service.start(DECK);
    events.length = 0;
    expect(service.setSlide("deck-1", "s2")).toBe(true);
    expect(service.setSlide("deck-1", "s2")).toBe(true);
    expect(events).toEqual([{ type: "SLIDE", slideId: "s2" }]);
  });

  it("stop ends the session once", () => {
    service.start(DECK);
    events.length = 0;
    expect(service.stop("deck-1")).toBe(true);
    expect(service.stop("deck-1")).toBe(false);
    expect(types(events)).toEqual(["ENDED"]);
    expect(service.get("deck-1")).toBeUndefined();
    expect(service.findBySlug("minha-live")).toBeUndefined();
  });

  it("reports state for viewers and presenters", () => {
    expect(service.state("deck-1", true)).toEqual({
      isLive: false, startedAt: null, slideId: null, showViewerCount: true,
      showReactionsOnScreen: true, viewerCount: null, peakViewers: null, reactionTotals: null,
    });
    service.start(DECK);
    expect(service.state("deck-1", false)).toMatchObject({
      isLive: true, slideId: "s1", viewerCount: 0, peakViewers: null, reactionTotals: null,
    });
    const forPresenter = service.state("deck-1", true);
    expect(forPresenter.peakViewers).toBe(0);
    expect(forPresenter.reactionTotals).toEqual([
      { kind: "CLAP", count: 0 }, { kind: "FIRE", count: 0 }, { kind: "MIND_BLOWN", count: 0 },
      { kind: "LAUGH", count: 0 }, { kind: "HEART", count: 0 }, { kind: "THINKING", count: 0 },
    ]);
  });
});

describe("eventFor", () => {
  it("passes ordinary events through to everyone", () => {
    const slide: LiveEventData = { type: "SLIDE", slideId: "s2" };
    expect(eventFor(slide, false)).toEqual(slide);
    expect(eventFor(slide, true)).toEqual(slide);
  });

  it("gives VIEWERS with the peak to presenters, always", () => {
    const viewers: LiveEventData = { type: "VIEWERS", viewerCount: 7, peakViewers: 9, audienceVisible: false };
    expect(eventFor(viewers, true)).toEqual({ type: "VIEWERS", viewerCount: 7, peakViewers: 9 });
  });

  it("gives the audience VIEWERS without the peak, and nothing while the counter is hidden", () => {
    expect(eventFor({ type: "VIEWERS", viewerCount: 7, peakViewers: 9, audienceVisible: true }, false)).toEqual({
      type: "VIEWERS",
      viewerCount: 7,
    });
    expect(eventFor({ type: "VIEWERS", viewerCount: 7, peakViewers: 9, audienceVisible: false }, false)).toBeNull();
  });
});
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/live-session.service.test.ts`
Expected: FAIL — cannot find `./live-session.service`.

- [ ] **Step 2: Implement the service**

`apps/backend/src/live/live-session.service.ts`:
```ts
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
    if (!session) return NOT_LIVE;
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
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/live-session.service.test.ts`
Expected: PASS.

- [ ] **Step 3: Let presentations announce when they stop being public**

`apps/backend/src/presentations/presentations.service.ts` — inside `class PresentationsService`, add at the top:
```ts
  private readonly unpublishedListeners = new Set<(presentationId: string) => void>();

  /** Called when a presentation is trashed or stops being PUBLIC (ends its live session). */
  onUnpublished(listener: (presentationId: string) => void): void {
    this.unpublishedListeners.add(listener);
  }

  private notifyUnpublished(presentationId: string): void {
    for (const listener of this.unpublishedListeners) listener(presentationId);
  }
```
In `update`, replace `return await prisma.presentation.update({ where: { id }, data, include: WITH_SLIDES });` with:
```ts
      const updated = await prisma.presentation.update({ where: { id }, data, include: WITH_SLIDES });
      if (updated.visibility !== "PUBLIC") this.notifyUnpublished(id);
      return updated;
```
In `softDelete`, replace `return true;` with:
```ts
    this.notifyUnpublished(id);
    return true;
```

- [ ] **Step 4: Write the failing integration test**

`apps/backend/src/live/live.integration.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { listen, sleep, subscribeTo, wsClient, wsRequest } from "../../test/ws";
import { LiveSessionService } from "./live-session.service";

const CREATE_DECK = `mutation ($input: CreatePresentationInput!) {
  createPresentation(input: $input) { id slug slides { id } }
}`;
const UPDATE_DECK = `mutation ($id: ID!, $input: UpdatePresentationInput!) { updatePresentation(id: $id, input: $input) { id } }`;
const DELETE_DECK = `mutation ($id: ID!) { deletePresentation(id: $id) }`;
const CREATE_LINK = `mutation ($p: ID!) { createPresenterLink(presentationId: $p, name: "x", expiresIn: TWO_HOURS) { url } }`;
const STATE = `query ($slug: String!) { liveState(slug: $slug) { isLive slideId viewerCount peakViewers showViewerCount } }`;
const EVENTS = `subscription ($slug: String!) { liveEvents(slug: $slug) { type slideId viewerCount peakViewers } }`;
const START = `mutation ($p: ID!, $s: ID!) { startLive(presentationId: $p, slideId: $s) { isLive slideId peakViewers } }`;
const STOP = `mutation ($p: ID!) { stopLive(presentationId: $p) }`;
const SLIDE = `mutation ($p: ID!, $s: ID!) { setLiveSlide(presentationId: $p, slideId: $s) }`;

const slides = [
  { template: "cover", content: { title: "Capa" } },
  { template: "bullets", content: { title: "T", items: ["a"] } },
];

describe("live sessions", () => {
  let app: INestApplication;
  let url: string;
  let jwt: string;
  let deck: { id: string; slug: string; slides: { id: string }[] };
  const disposables: { dispose(): void | Promise<void> }[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase();
    jwt = jwtFor(app, await createUser({ admin: true }));
    deck = (await gql(app, CREATE_DECK, { input: { title: "Live", visibility: "PUBLIC", slides } }, jwt)).data
      .createPresentation;
  });
  afterEach(async () => {
    // Sessions are in memory and outlive resetDatabase.
    app.get(LiveSessionService).stop(deck.id);
    await Promise.all(disposables.splice(0).map((c) => c.dispose()));
  });

  const socket = (params?: Record<string, unknown>) => {
    const c = wsClient(url, params);
    disposables.push(c);
    return c;
  };
  const eventTypes = (events: { liveEvents: { type: string } }[]) => events.map((e) => e.liveEvents.type);
  const has = (type: string) => (events: { liveEvents: { type: string } }[]) => eventTypes(events).includes(type);

  it("lets an anonymous viewer follow a session started over a presenter's socket", async () => {
    const viewer = subscribeTo(socket(), EVENTS, { slug: deck.slug });
    await sleep(200);
    const presenter = socket({ authorization: `Bearer ${jwt}` });

    const started = await wsRequest(presenter, START, { p: deck.id, s: deck.slides[0].id });
    expect(started.data?.startLive).toMatchObject({ isLive: true, slideId: deck.slides[0].id });
    await wsRequest(presenter, SLIDE, { p: deck.id, s: deck.slides[1].id });
    await wsRequest(presenter, STOP, { p: deck.id });

    // VIEWERS events (Task 5) interleave with these; wait for the last one instead of counting.
    const events = await viewer.waitUntil(has("ENDED"));
    const relevant = events.filter((e) => e.liveEvents.type !== "VIEWERS");
    expect(eventTypes(relevant)).toEqual(["STARTED", "SLIDE", "ENDED"]);
    expect(relevant[0].liveEvents.slideId).toBe(deck.slides[0].id);
    expect(relevant[1].liveEvents.slideId).toBe(deck.slides[1].id);
  });

  it("answers liveState publicly, before and during a session", async () => {
    expect((await gql(app, STATE, { slug: deck.slug })).data.liveState).toMatchObject({ isLive: false, slideId: null });
    await gql(app, START, { p: deck.id, s: deck.slides[1].id }, jwt);
    const anon = (await gql(app, STATE, { slug: deck.slug })).data.liveState;
    expect(anon).toMatchObject({ isLive: true, slideId: deck.slides[1].id, peakViewers: null });
    expect((await gql(app, STATE, { slug: deck.slug }, jwt)).data.liveState.peakViewers).toBe(0);
    expect((await gql(app, STATE, { slug: "nao-existe" })).data.liveState.isLive).toBe(false);
  });

  it("only lets presenters control a session", async () => {
    const vars = { p: deck.id, s: deck.slides[0].id };
    expect(errorCode(await gql(app, START, vars))).toBe("UNAUTHENTICATED");
    const plain = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, START, vars, plain))).toBe("FORBIDDEN");
    const key = (await gql(app, `mutation { createApiKey(name: "k", expiresIn: ONE_HOUR) { token } }`, undefined, jwt))
      .data.createApiKey.token;
    expect(errorCode(await gql(app, START, vars, key))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, STOP, { p: deck.id }))).toBe("UNAUTHENTICATED");
  });

  it("lets a presenter link control its own presentation and no other", async () => {
    const other = (await gql(app, CREATE_DECK, { input: { title: "Outra", visibility: "PUBLIC", slides } }, jwt)).data
      .createPresentation;
    const token = (await gql(app, CREATE_LINK, { p: deck.id }, jwt)).data.createPresenterLink.url.split("#t=")[1];

    const mine = await gql(app, START, { p: deck.id, s: deck.slides[0].id }, token);
    expect(mine.data.startLive.isLive).toBe(true);
    expect(errorCode(await gql(app, START, { p: other.id, s: other.slides[0].id }, token))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, STOP, { p: other.id }, token))).toBe("UNAUTHENTICATED");
  });

  it("refuses to go live on a non-public presentation or with a foreign slide", async () => {
    const priv = (await gql(app, CREATE_DECK, { input: { title: "Privada", slides } }, jwt)).data.createPresentation;
    const res = await gql(app, START, { p: priv.id, s: priv.slides[0].id }, jwt);
    expect(res.errors?.[0].message).toBe("Torne a apresentação pública para transmitir");
    const foreign = await gql(app, START, { p: deck.id, s: priv.slides[0].id }, jwt);
    expect(errorCode(foreign)).toBe("BAD_USER_INPUT");
    expect(app.get(LiveSessionService).get(deck.id)).toBeUndefined();
  });

  it("ends the session when the presentation turns private or is trashed", async () => {
    const viewer = subscribeTo(socket(), EVENTS, { slug: deck.slug });
    await sleep(200);
    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);
    await gql(app, UPDATE_DECK, { id: deck.id, input: { visibility: "PRIVATE" } }, jwt);
    await viewer.waitUntil(has("ENDED"));
    expect(eventTypes(viewer.events).filter((t) => t !== "VIEWERS")).toEqual(["STARTED", "ENDED"]);
    expect((await gql(app, STATE, { slug: deck.slug })).data.liveState.isLive).toBe(false);

    await gql(app, UPDATE_DECK, { id: deck.id, input: { visibility: "PUBLIC" } }, jwt);
    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);
    await gql(app, DELETE_DECK, { id: deck.id }, jwt);
    expect(app.get(LiveSessionService).get(deck.id)).toBeUndefined();
  });

  it("refuses liveEvents on a private presentation", async () => {
    const priv = (await gql(app, CREATE_DECK, { input: { title: "Privada", slides } }, jwt)).data.createPresentation;
    const sub = subscribeTo(socket(), EVENTS, { slug: priv.slug });
    await sleep(300);
    expect(sub.events).toEqual([]);
    expect(JSON.stringify(sub.errors)).toContain("Apresentação privada");
  });
});
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/live.integration.test.ts`
Expected: FAIL — `Cannot query field "liveState"`.

- [ ] **Step 5: Implement the GraphQL types**

`apps/backend/src/live/live.types.ts`:
```ts
import { Field, Float, ID, Int, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum LiveEventTypeEnum {
  STARTED = "STARTED",
  SLIDE = "SLIDE",
  POINTER = "POINTER",
  VIEWERS = "VIEWERS",
  REACTIONS = "REACTIONS",
  OPTIONS = "OPTIONS",
  ENDED = "ENDED",
}
registerEnumType(LiveEventTypeEnum, { name: "LiveEventType" });

export enum ReactionKindEnum {
  CLAP = "CLAP",
  FIRE = "FIRE",
  MIND_BLOWN = "MIND_BLOWN",
  LAUGH = "LAUGH",
  HEART = "HEART",
  THINKING = "THINKING",
}
registerEnumType(ReactionKindEnum, { name: "ReactionKind" });

@ObjectType("LivePointer")
export class LivePointerType {
  @Field(() => Float, { description: "0..1 across the 1920×1080 canvas" })
  x!: number;

  @Field(() => Float)
  y!: number;

  @Field()
  visible!: boolean;
}

@ObjectType("ReactionCount")
export class ReactionCountType {
  @Field(() => ReactionKindEnum)
  kind!: ReactionKindEnum;

  @Field(() => Int)
  count!: number;
}

@ObjectType("LiveState")
export class LiveStateType {
  @Field()
  isLive!: boolean;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => ID, { nullable: true })
  slideId!: string | null;

  @Field()
  showViewerCount!: boolean;

  @Field()
  showReactionsOnScreen!: boolean;

  @Field(() => Int, { nullable: true, description: "null for the audience while the counter is hidden" })
  viewerCount!: number | null;

  @Field(() => Int, { nullable: true, description: "Presenters only" })
  peakViewers!: number | null;

  @Field(() => [ReactionCountType], { nullable: true, description: "Presenters only" })
  reactionTotals!: ReactionCountType[] | null;
}

@ObjectType("LiveEvent")
export class LiveEventObject {
  @Field(() => LiveEventTypeEnum)
  type!: LiveEventTypeEnum;

  @Field(() => ID, { nullable: true, description: "STARTED, SLIDE" })
  slideId?: string;

  @Field(() => LivePointerType, { nullable: true, description: "POINTER" })
  pointer?: LivePointerType;

  @Field(() => Int, { nullable: true, description: "VIEWERS" })
  viewerCount?: number;

  @Field(() => Int, { nullable: true, description: "VIEWERS, presenters only" })
  peakViewers?: number;

  @Field(() => [ReactionCountType], { nullable: true, description: "REACTIONS" })
  reactions?: ReactionCountType[];

  @Field(() => Boolean, { nullable: true, description: "OPTIONS" })
  showViewerCount?: boolean;

  @Field(() => Boolean, { nullable: true, description: "OPTIONS" })
  showReactionsOnScreen?: boolean;
}
```

- [ ] **Step 6: Implement the guards**

`apps/backend/src/live/live.guards.ts`:
```ts
import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { PermissionsService } from "../permissions/permissions.service";

/**
 * Live controls: a CMS session with presentations:update, or the presenter
 * link of that very presentation (`presentationId` argument). API keys are not
 * accepted: "api-key" is deliberately absent from the strategy list.
 */
@Injectable()
export class GqlLiveControlGuard extends AuthGuard(["presenter-link", "jwt"]) {
  constructor(private readonly permissions: PermissionsService) {
    super();
  }

  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context); // throws 401 without a valid credential
    const gql = GqlExecutionContext.create(context);
    const user = gql.getContext().req.user as AuthenticatedUser;
    const { presentationId } = gql.getArgs<{ presentationId: string }>();

    if (user.authKind === "presenterLink") {
      if (user.presenterPresentationId !== presentationId) {
        throw new UnauthorizedException("Este link não controla esta apresentação");
      }
      return true;
    }
    const allowed = await this.permissions.canAccess("presentations", "update", {
      id: user.role.id,
      isAdmin: user.role.isAdmin,
    });
    if (!allowed) throw new ForbiddenException();
    return true;
  }
}

/**
 * Public live reads. Anonymous callers pass with `req.user = null`; a dead
 * credential still fails, so a revoked presenter link is never served as a viewer.
 */
@Injectable()
export class GqlOptionalLiveGuard extends AuthGuard(["presenter-link", "api-key", "jwt"]) {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }

  handleRequest<TUser = any>(err: unknown, user: TUser | false): TUser | null {
    if (err) throw err;
    return user || null;
  }
}
```

- [ ] **Step 7: Implement the resolver and wire the module**

`apps/backend/src/live/live.resolver.ts`:
```ts
import { UnauthorizedException, UseGuards } from "@nestjs/common";
import { Args, Context, ID, Mutation, Query, Resolver, Subscription } from "@nestjs/graphql";
import { prisma } from "@repo/database";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { CurrentUser } from "../common/current-user.decorator";
import { PermissionsService } from "../permissions/permissions.service";
import { badInput, notFound } from "../presentations/presentation-errors";
import { PresentationsService } from "../presentations/presentations.service";
import { LiveSessionService, eventFor, type LiveEventData } from "./live-session.service";
import { GqlLiveControlGuard, GqlOptionalLiveGuard } from "./live.guards";
import { LiveEventObject, LiveStateType } from "./live.types";
import type { SocketRequest } from "./socket-auth.service";

type LiveContext = { req: Partial<SocketRequest> };

@Resolver()
export class LiveResolver {
  constructor(
    private readonly live: LiveSessionService,
    private readonly presentations: PresentationsService,
    private readonly permissions: PermissionsService,
  ) {}

  /** A CMS session with presentations:update, or the presenter link of this presentation. */
  private async isPresenter(user: AuthenticatedUser | null, presentationId: string): Promise<boolean> {
    if (!user) return false;
    if (user.authKind === "presenterLink") return user.presenterPresentationId === presentationId;
    if (user.authKind === "apiKey") return false;
    return this.permissions.canAccess("presentations", "update", { id: user.role.id, isAdmin: user.role.isAdmin });
  }

  /** Live is public-only (spec L5): anything else looks like "no such deck". */
  private async publicDeck(slug: string): Promise<{ id: string } | null> {
    const deck = await prisma.presentation.findUnique({
      where: { slug },
      select: { id: true, visibility: true, deletedAt: true },
    });
    return deck && deck.visibility === "PUBLIC" && !deck.deletedAt ? { id: deck.id } : null;
  }

  @Query(() => LiveStateType)
  @UseGuards(GqlOptionalLiveGuard)
  async liveState(@Args("slug") slug: string, @CurrentUser() user: AuthenticatedUser | null) {
    const deck = await this.publicDeck(slug);
    if (!deck) return this.live.state("", false);
    return this.live.state(deck.id, await this.isPresenter(user, deck.id));
  }

  @Subscription(() => LiveEventObject, {
    filter: (payload: LiveEventData, _variables: unknown, context: LiveContext) =>
      eventFor(payload, context.req.livePresenter === true) !== null,
    resolve: (payload: LiveEventData, _args: unknown, context: LiveContext) =>
      eventFor(payload, context.req.livePresenter === true),
  })
  @UseGuards(GqlOptionalLiveGuard)
  async liveEvents(
    @Args("slug") slug: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Context() context: LiveContext,
  ) {
    const deck = await this.publicDeck(slug);
    if (!deck) throw new UnauthorizedException("Apresentação privada");
    // The context object lives as long as the subscription: filter/resolve read it.
    context.req.livePresenter = await this.isPresenter(user, deck.id);
    return this.live.events(deck.id);
  }

  @Mutation(() => LiveStateType)
  @UseGuards(GqlLiveControlGuard)
  async startLive(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("slideId", { type: () => ID }) slideId: string,
  ) {
    const presentation = await this.presentations.getById(presentationId);
    if (!presentation || presentation.deletedAt) throw notFound("Apresentação não encontrada");
    if (presentation.visibility !== "PUBLIC") throw badInput("Torne a apresentação pública para transmitir");
    if (!presentation.slides.some((slide) => slide.id === slideId)) {
      throw badInput("O slide não pertence a esta apresentação");
    }
    this.live.start({ presentationId, slug: presentation.slug, slideId });
    return this.live.state(presentationId, true);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlLiveControlGuard)
  stopLive(@Args("presentationId", { type: () => ID }) presentationId: string) {
    this.live.stop(presentationId);
    return true;
  }

  /** false when there is no session: the presenter's player then re-sends startLive. */
  @Mutation(() => Boolean)
  @UseGuards(GqlLiveControlGuard)
  setLiveSlide(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("slideId", { type: () => ID }) slideId: string,
  ) {
    return this.live.setSlide(presentationId, slideId);
  }
}
```

Replace `apps/backend/src/live/live.module.ts` with:
```ts
import { Module, type OnModuleInit } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { PresentationsModule } from "../presentations/presentations.module";
import { PresentationsService } from "../presentations/presentations.service";
import { PresenterLinksModule } from "../presenter-links/presenter-links.module";
import { LiveSessionService } from "./live-session.service";
import { GqlLiveControlGuard, GqlOptionalLiveGuard } from "./live.guards";
import { LiveResolver } from "./live.resolver";
import { SocketAuthService } from "./socket-auth.service";
import { SocketRegistry } from "./socket-registry";

@Module({
  imports: [PassportModule, AuthModule, ApiKeysModule, PresenterLinksModule, PresentationsModule],
  providers: [
    SocketRegistry,
    SocketAuthService,
    LiveSessionService,
    LiveResolver,
    GqlLiveControlGuard,
    GqlOptionalLiveGuard,
  ],
  exports: [SocketRegistry, SocketAuthService, LiveSessionService],
})
export class LiveModule implements OnModuleInit {
  constructor(
    private readonly presentations: PresentationsService,
    private readonly live: LiveSessionService,
  ) {}

  onModuleInit(): void {
    // Turning a live presentation private, or trashing it, ends the session.
    this.presentations.onUnpublished((presentationId) => this.live.stop(presentationId));
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend test`
Expected: every file PASSES, including the 3a presentation suites (the `onUnpublished` hook has no listeners there).

If `liveEvents` delivers nothing, check the two usual causes before changing code: the topic (`liveTopic(deck.id)` on both sides) and the subscription `resolve` returning `null` for an event (`eventFor`).

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/live apps/backend/src/presentations/presentations.service.ts apps/backend/src/schema.gql
git commit -m "feat(backend): add live sessions with slide following over subscriptions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Laser pointer throttle and live options

**Files:**
- Modify: `apps/backend/src/live/live-session.service.ts`, `apps/backend/src/live/live.resolver.ts`
- Test: `apps/backend/src/live/live-pointer.test.ts`; add one case to `apps/backend/src/live/live.integration.test.ts`

**Interfaces:**
- Consumes: `LiveSessionService` internals (`sessions`, `runtimes`, `publish`) and `GqlLiveControlGuard` (Task 3).
- Produces: `POINTER_MIN_INTERVAL_MS`, `LiveSessionService.movePointer`, `LiveSessionService.setOptions`; mutations `movePointer(presentationId, x, y, visible): Boolean!` and `setLiveOptions(presentationId, showViewerCount, showReactionsOnScreen): LiveState!`.

- [ ] **Step 1: Write the failing tests**

`apps/backend/src/live/live-pointer.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

describe("LiveSessionService — pointer and options", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = [];
    vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
      events.push(event as LiveEventData);
    });
    service.start(DECK);
    events.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("does nothing when the presentation is not live", () => {
    expect(service.movePointer("other", 0.5, 0.5, true)).toBe(false);
    expect(service.setOptions("other", { showViewerCount: false })).toBeNull();
    expect(events).toEqual([]);
  });

  it("publishes pointer positions clamped to the canvas", () => {
    expect(service.movePointer("deck-1", 1.7, -0.2, true)).toBe(true);
    expect(events).toEqual([{ type: "POINTER", pointer: { x: 1, y: 0, visible: true } }]);
    expect(service.get("deck-1")?.pointer).toEqual({ x: 1, y: 0, visible: true });
  });

  it("drops updates above 40 per second", () => {
    let accepted = 0;
    for (let ms = 0; ms < 1000; ms += 5) {
      if (service.movePointer("deck-1", ms / 1000, 0.5, true)) accepted += 1;
      vi.advanceTimersByTime(5);
    }
    expect(accepted).toBe(40);
    expect(events).toHaveLength(40);
  });

  it("always delivers a visibility change, even inside the throttle window", () => {
    service.movePointer("deck-1", 0.4, 0.4, true);
    vi.advanceTimersByTime(3);
    expect(service.movePointer("deck-1", 0.41, 0.4, true)).toBe(false);
    expect(service.movePointer("deck-1", 0.41, 0.4, false)).toBe(true);
    expect(events.at(-1)).toEqual({ type: "POINTER", pointer: { x: 0.41, y: 0.4, visible: false } });
    vi.advanceTimersByTime(1);
    expect(service.movePointer("deck-1", 0.5, 0.5, true)).toBe(true);
  });

  it("changes options and announces both flags", () => {
    const session = service.setOptions("deck-1", { showViewerCount: false });
    expect(session).toMatchObject({ showViewerCount: false, showReactionsOnScreen: true });
    expect(events).toEqual([{ type: "OPTIONS", showViewerCount: false, showReactionsOnScreen: true }]);

    events.length = 0;
    service.setOptions("deck-1", { showReactionsOnScreen: false, showViewerCount: null });
    expect(events).toEqual([{ type: "OPTIONS", showViewerCount: false, showReactionsOnScreen: false }]);

    events.length = 0;
    service.setOptions("deck-1", {});
    expect(events).toEqual([]);
  });
});
```

Add to `apps/backend/src/live/live.integration.test.ts`, inside the `describe`:
```ts
  it("broadcasts the pointer and option changes to viewers", async () => {
    const POINTER = `mutation ($p: ID!, $x: Float!, $y: Float!, $v: Boolean!) {
      movePointer(presentationId: $p, x: $x, y: $y, visible: $v)
    }`;
    const OPTIONS = `mutation ($p: ID!) { setLiveOptions(presentationId: $p, showReactionsOnScreen: false) {
      showViewerCount showReactionsOnScreen
    } }`;
    const FULL = `subscription ($slug: String!) { liveEvents(slug: $slug) {
      type pointer { x y visible } showViewerCount showReactionsOnScreen
    } }`;
    const viewer = subscribeTo(socket(), FULL, { slug: deck.slug });
    await sleep(200);
    const presenter = socket({ authorization: `Bearer ${jwt}` });
    await wsRequest(presenter, START, { p: deck.id, s: deck.slides[0].id });

    expect((await wsRequest(presenter, POINTER, { p: deck.id, x: 0.25, y: 0.75, v: true })).data?.movePointer).toBe(true);
    const options = await wsRequest(presenter, OPTIONS, { p: deck.id });
    expect(options.data?.setLiveOptions).toEqual({ showViewerCount: true, showReactionsOnScreen: false });
    expect(errorCode(await gql(app, POINTER, { p: deck.id, x: 0, y: 0, v: true }))).toBe("UNAUTHENTICATED");

    await viewer.waitUntil((events) => events.some((e) => e.liveEvents.type === "OPTIONS"));
    const byType = (type: string) => viewer.events.find((e) => e.liveEvents.type === type)?.liveEvents;
    expect(byType("POINTER").pointer).toEqual({ x: 0.25, y: 0.75, visible: true });
    expect(byType("OPTIONS")).toMatchObject({ showViewerCount: true, showReactionsOnScreen: false });
  });
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/live-pointer.test.ts`
Expected: FAIL — `service.movePointer is not a function`.

- [ ] **Step 2: Implement pointer and options in the service**

`apps/backend/src/live/live-session.service.ts` — add below `export const liveTopic`:
```ts
/** 40 pointer updates per second, per session. */
export const POINTER_MIN_INTERVAL_MS = 25;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
```
Add these methods to the class, above `private publish`:
```ts
  /**
   * Publishes the laser position; never touches the database. Updates above
   * 40/s are dropped — except a change of `visible`: a dropped "hide" would
   * leave a frozen dot on every follower's screen.
   */
  movePointer(presentationId: string, x: number, y: number, visible: boolean): boolean {
    const session = this.sessions.get(presentationId);
    const runtime = this.runtimes.get(presentationId);
    if (!session || !runtime) return false;

    const now = Date.now();
    const visibilityChanged = (session.pointer?.visible ?? false) !== visible;
    if (!visibilityChanged && now - runtime.lastPointerAt < POINTER_MIN_INTERVAL_MS) return false;

    runtime.lastPointerAt = now;
    session.pointer = { x: clamp01(x), y: clamp01(y), visible };
    this.publish(presentationId, { type: "POINTER", pointer: session.pointer });
    return true;
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
    session.showViewerCount = showViewerCount;
    session.showReactionsOnScreen = showReactionsOnScreen;
    this.publish(presentationId, { type: "OPTIONS", showViewerCount, showReactionsOnScreen });
    return session;
  }
```

- [ ] **Step 3: Add the mutations**

`apps/backend/src/live/live.resolver.ts` — add `Float` to the `@nestjs/graphql` import and these methods to the class:
```ts
  @Mutation(() => Boolean)
  @UseGuards(GqlLiveControlGuard)
  movePointer(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("x", { type: () => Float }) x: number,
    @Args("y", { type: () => Float }) y: number,
    @Args("visible") visible: boolean,
  ) {
    return this.live.movePointer(presentationId, x, y, visible);
  }

  @Mutation(() => LiveStateType)
  @UseGuards(GqlLiveControlGuard)
  setLiveOptions(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("showViewerCount", { type: () => Boolean, nullable: true }) showViewerCount?: boolean | null,
    @Args("showReactionsOnScreen", { type: () => Boolean, nullable: true }) showReactionsOnScreen?: boolean | null,
  ) {
    this.live.setOptions(presentationId, { showViewerCount, showReactionsOnScreen });
    return this.live.state(presentationId, true);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend exec vitest run src/live`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/live apps/backend/src/schema.gql
git commit -m "feat(backend): broadcast the presenter's laser pointer and live options

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Viewer counting

A viewer is a distinct `viewerId` with an open `liveEvents` subscription; presenters are not counted. `VIEWERS` goes out at most once every 2 s per session.

**Files:**
- Modify: `apps/backend/src/live/live-session.service.ts`, `apps/backend/src/live/live.resolver.ts`, `apps/backend/src/live/live.module.ts`
- Test: `apps/backend/src/live/live-viewers.test.ts`; add one case to `apps/backend/src/live/live.integration.test.ts`

**Interfaces:**
- Consumes: `LiveSessionService` internals (`watchers`, `runtimes`, `publish`, `setOptions`, `start`) (Tasks 3–4); `SocketRegistry.onRemove` and `SocketRequest.socketSession` (Task 1).
- Produces: `VIEWERS_MIN_INTERVAL_MS`, `LiveSessionService.addViewer`, `removeViewer`, `dropSocket`; `liveEvents` registers non-presenter subscribers as viewers and unregisters them when the subscription or the socket ends.

- [ ] **Step 1: Write the failing tests**

`apps/backend/src/live/live-viewers.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

describe("LiveSessionService — viewers", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  const viewers = () => events.filter((e) => e.type === "VIEWERS");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = [];
    vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
      events.push(event as LiveEventData);
    });
  });
  afterEach(() => vi.useRealTimers());

  it("counts distinct viewerIds: two tabs of one browser count once", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-1", "ana", "socket-2");
    service.addViewer("deck-1", "bia", "socket-3");
    expect(service.viewerCount("deck-1")).toBe(2);

    service.removeViewer("deck-1", "ana", "socket-1");
    expect(service.viewerCount("deck-1")).toBe(2);
    service.removeViewer("deck-1", "ana", "socket-2");
    expect(service.viewerCount("deck-1")).toBe(1);
  });

  it("counts viewers that subscribed before the session started", () => {
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-1", "bia", "socket-2");
    expect(events).toEqual([]);

    const session = service.start(DECK);
    expect(session.peakViewers).toBe(2);
    expect(events).toEqual([
      { type: "STARTED", slideId: "s1" },
      { type: "VIEWERS", viewerCount: 2, peakViewers: 2, audienceVisible: true },
    ]);
  });

  it("coalesces VIEWERS to at most one every 2 seconds, always ending on the latest count", () => {
    service.start(DECK);
    events.length = 0;
    vi.advanceTimersByTime(2000);

    service.addViewer("deck-1", "v1", "s1");
    expect(viewers()).toEqual([{ type: "VIEWERS", viewerCount: 1, peakViewers: 1, audienceVisible: true }]);

    for (let i = 2; i <= 30; i++) service.addViewer("deck-1", `v${i}`, `s${i}`);
    expect(viewers()).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(viewers()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(viewers()).toHaveLength(2);
    expect(viewers()[1]).toMatchObject({ viewerCount: 30, peakViewers: 30 });

    vi.advanceTimersByTime(10_000);
    expect(viewers()).toHaveLength(2);
  });

  it("keeps the peak after viewers leave", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "s1");
    service.addViewer("deck-1", "bia", "s2");
    service.removeViewer("deck-1", "ana", "s1");
    vi.advanceTimersByTime(2000);
    expect(service.state("deck-1", true)).toMatchObject({ viewerCount: 1, peakViewers: 2 });
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 1, peakViewers: 2 });
  });

  it("drops every subscription of a closed socket", () => {
    service.start(DECK);
    service.start({ presentationId: "deck-2", slug: "outra", slideId: "x" });
    service.addViewer("deck-1", "ana", "socket-1");
    service.addViewer("deck-2", "ana", "socket-1");
    service.addViewer("deck-1", "bia", "socket-2");
    service.dropSocket("socket-1");
    expect(service.viewerCount("deck-1")).toBe(1);
    expect(service.viewerCount("deck-2")).toBe(0);
  });

  it("marks VIEWERS hidden from the audience while the counter is off, and re-announces when it turns on", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "s1");
    service.setOptions("deck-1", { showViewerCount: false });
    vi.advanceTimersByTime(2000);
    service.addViewer("deck-1", "bia", "s2");
    vi.advanceTimersByTime(2000);
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 2, audienceVisible: false });
    expect(service.state("deck-1", false).viewerCount).toBeNull();
    expect(service.state("deck-1", true).viewerCount).toBe(2);

    service.setOptions("deck-1", { showViewerCount: true });
    expect(viewers().at(-1)).toMatchObject({ viewerCount: 2, audienceVisible: true });
  });

  it("stops the pending VIEWERS timer when the session ends", () => {
    service.start(DECK);
    service.addViewer("deck-1", "ana", "s1");
    service.addViewer("deck-1", "bia", "s2");
    service.stop("deck-1");
    events.length = 0;
    vi.advanceTimersByTime(5000);
    expect(events).toEqual([]);
  });
});
```

Add to `apps/backend/src/live/live.integration.test.ts`, inside the `describe`:
```ts
  it("counts viewers by viewerId and never counts presenters", async () => {
    const PRESENTER_STATE = `query ($slug: String!) { liveState(slug: $slug) { viewerCount peakViewers } }`;
    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);

    subscribeTo(socket({ viewerId: "ana" }), EVENTS, { slug: deck.slug });
    subscribeTo(socket({ viewerId: "ana" }), EVENTS, { slug: deck.slug });
    const bia = wsClient(url, { viewerId: "bia" });
    subscribeTo(bia, EVENTS, { slug: deck.slug });
    subscribeTo(socket({ authorization: `Bearer ${jwt}`, viewerId: "pedro" }), EVENTS, { slug: deck.slug });
    await sleep(300);

    expect((await gql(app, PRESENTER_STATE, { slug: deck.slug }, jwt)).data.liveState).toEqual({
      viewerCount: 2,
      peakViewers: 2,
    });

    await bia.dispose();
    await sleep(300);
    expect((await gql(app, PRESENTER_STATE, { slug: deck.slug }, jwt)).data.liveState).toEqual({
      viewerCount: 1,
      peakViewers: 2,
    });
    expect((await gql(app, PRESENTER_STATE, { slug: deck.slug })).data.liveState).toEqual({
      viewerCount: 1,
      peakViewers: null,
    });
  });
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/live-viewers.test.ts`
Expected: FAIL — `service.addViewer is not a function`.

- [ ] **Step 2: Implement viewer tracking in the service**

`apps/backend/src/live/live-session.service.ts` — add below `POINTER_MIN_INTERVAL_MS`:
```ts
/** VIEWERS goes out at most once every 2 s per session. */
export const VIEWERS_MIN_INTERVAL_MS = 2000;
```
In `start`, add as the last statement before `return session;` (after the `STARTED` publish):
```ts
    this.publishViewers(input.presentationId);
```
In `setOptions`, replace the three statements `session.showViewerCount = showViewerCount;`, `session.showReactionsOnScreen = showReactionsOnScreen;` and the `OPTIONS` publish with:
```ts
    const counterTurnedOn = showViewerCount && !session.showViewerCount;
    session.showViewerCount = showViewerCount;
    session.showReactionsOnScreen = showReactionsOnScreen;
    this.publish(presentationId, { type: "OPTIONS", showViewerCount, showReactionsOnScreen });
    // The audience got no VIEWERS while the counter was hidden: give it the number now.
    if (counterTurnedOn) this.publishViewers(presentationId);
```
Add these methods to the class, above `private publish`:
```ts
  addViewer(presentationId: string, viewerId: string, socketId: string): void {
    let byViewer = this.watchers.get(presentationId);
    if (!byViewer) this.watchers.set(presentationId, (byViewer = new Map()));
    let sockets = byViewer.get(viewerId);
    if (!sockets) byViewer.set(viewerId, (sockets = new Set()));
    sockets.add(socketId);
    this.viewersChanged(presentationId);
  }

  removeViewer(presentationId: string, viewerId: string, socketId: string): void {
    const byViewer = this.watchers.get(presentationId);
    const sockets = byViewer?.get(viewerId);
    if (!byViewer || !sockets?.delete(socketId)) return;
    if (sockets.size === 0) byViewer.delete(viewerId);
    if (byViewer.size === 0) this.watchers.delete(presentationId);
    this.viewersChanged(presentationId);
  }

  /** A socket closed: forget it everywhere (the subscription cleanup may not have run). */
  dropSocket(socketId: string): void {
    for (const [presentationId, byViewer] of [...this.watchers]) {
      for (const [viewerId, sockets] of [...byViewer]) {
        if (sockets.has(socketId)) this.removeViewer(presentationId, viewerId, socketId);
      }
    }
  }

  private viewersChanged(presentationId: string): void {
    const session = this.sessions.get(presentationId);
    const runtime = this.runtimes.get(presentationId);
    if (!session || !runtime) return;
    session.peakViewers = Math.max(session.peakViewers, this.viewerCount(presentationId));
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
```

A fresh session now publishes `VIEWERS` right after `STARTED`. The Task 3 and Task 4 unit tests already allow for it (they assert `events[0]` or clear `events` after `start`), so they need no change — Step 4 confirms.

- [ ] **Step 3: Register viewers in the subscription**

`apps/backend/src/live/live.resolver.ts` — add this helper above the class:
```ts
/** Runs `cleanup` exactly once when the subscription ends (complete, error or socket close). */
function withCleanup<T>(iterator: AsyncIterableIterator<T>, cleanup: () => void): AsyncIterableIterator<T> {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
  };
  return {
    next: () => iterator.next(),
    return: async (value?: unknown) => {
      finish();
      return iterator.return ? iterator.return(value) : ({ value: undefined, done: true } as IteratorResult<T>);
    },
    throw: async (error?: unknown) => {
      finish();
      return iterator.throw ? iterator.throw(error) : Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
```
In `liveEvents`, replace `return this.live.events(deck.id);` with:
```ts
    const iterator = this.live.events(deck.id);
    const session = context.req.socketSession;
    // Presenters watch the same events but are not audience.
    if (context.req.livePresenter || !session) return iterator;

    this.live.addViewer(deck.id, session.viewerId, session.socketId);
    return withCleanup(iterator, () => this.live.removeViewer(deck.id, session.viewerId, session.socketId));
```

`apps/backend/src/live/live.module.ts` — inject the registry and drop viewers when a socket goes away. Change the constructor and `onModuleInit` to:
```ts
  constructor(
    private readonly presentations: PresentationsService,
    private readonly live: LiveSessionService,
    private readonly registry: SocketRegistry,
  ) {}

  onModuleInit(): void {
    // Turning a live presentation private, or trashing it, ends the session.
    this.presentations.onUnpublished((presentationId) => this.live.stop(presentationId));
    // Belt and braces: a socket that dies without completing its subscription.
    this.registry.onRemove((socketId) => this.live.dropSocket(socketId));
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend exec vitest run src/live`
Expected: PASS (all live unit and integration files).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/live
git commit -m "feat(backend): count live viewers by browser, excluding presenters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Emoji reactions: per-socket rate limit and aggregation

**Files:**
- Modify: `apps/backend/src/live/live-session.service.ts`, `apps/backend/src/live/live.resolver.ts`
- Test: `apps/backend/src/live/live-reactions.test.ts`; add one case to `apps/backend/src/live/live.integration.test.ts`

**Interfaces:**
- Consumes: `LiveSessionService` internals (`sessions`, `runtimes`, `publish`, `dropSocket`, `stop`) (Tasks 3–5); `ReactionKindEnum` (Task 3); `SocketRequest.socketSession` (Task 1).
- Produces: `REACTION_MIN_INTERVAL_MS`, `REACTION_BURST`, `REACTION_BURST_WINDOW_MS`, `REACTION_WINDOW_MS`, `LiveSessionService.react`; mutation `sendReaction(slug, kind): Boolean!` (anonymous; `false` when throttled, not live, or not sent over a socket).

- [ ] **Step 1: Write the failing tests**

`apps/backend/src/live/live-reactions.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSessionService, type LiveEventData } from "./live-session.service";

const DECK = { presentationId: "deck-1", slug: "minha-live", slideId: "s1" };

describe("LiveSessionService — reactions", () => {
  let service: LiveSessionService;
  let events: LiveEventData[];
  const reactions = () => events.filter((e) => e.type === "REACTIONS");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    service = new LiveSessionService();
    events = [];
    vi.spyOn((service as any).pubSub, "publish").mockImplementation(async (_topic: unknown, event: unknown) => {
      events.push(event as LiveEventData);
    });
    service.start(DECK);
    events.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("refuses reactions when the presentation is not live", () => {
    expect(service.react("other", "FIRE", "socket-1")).toBe(false);
  });

  it("allows one reaction per 300 ms per socket", () => {
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
    vi.advanceTimersByTime(299);
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
  });

  it("allows a burst of at most 10 per 5 seconds per socket", () => {
    let accepted = 0;
    for (let i = 0; i < 16; i++) {
      if (service.react("deck-1", "CLAP", "socket-1")) accepted += 1;
      vi.advanceTimersByTime(300);
    }
    expect(accepted).toBe(10); // 16 × 300 ms = 4.8 s: still inside the first window
    vi.advanceTimersByTime(200);
    expect(service.react("deck-1", "CLAP", "socket-1")).toBe(true);
  });

  it("limits each socket on its own", () => {
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
    expect(service.react("deck-1", "FIRE", "socket-2")).toBe(true);
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(false);
  });

  it("sums reactions in 250 ms windows: fan-out is bounded whatever the audience size", () => {
    for (let i = 0; i < 500; i++) service.react("deck-1", i % 2 ? "FIRE" : "CLAP", `socket-${i}`);
    expect(reactions()).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(reactions()).toEqual([
      { type: "REACTIONS", reactions: [{ kind: "CLAP", count: 250 }, { kind: "FIRE", count: 250 }] },
    ]);

    vi.advanceTimersByTime(1000);
    expect(reactions()).toHaveLength(1); // nothing to report: no empty events
  });

  it("publishes at most 4 REACTIONS events per second under a constant flood", () => {
    for (let ms = 0; ms < 1000; ms += 10) {
      service.react("deck-1", "HEART", `socket-${ms}`);
      vi.advanceTimersByTime(10);
    }
    expect(reactions().length).toBeLessThanOrEqual(4);
    expect(reactions().reduce((sum, e) => sum + (e.reactions?.[0].count ?? 0), 0)).toBeGreaterThanOrEqual(75);
  });

  it("keeps per-kind totals for the presenter, gone when the session ends", () => {
    service.react("deck-1", "FIRE", "a");
    service.react("deck-1", "FIRE", "b");
    service.react("deck-1", "THINKING", "c");
    const totals = service.state("deck-1", true).reactionTotals;
    expect(totals?.find((t) => t.kind === "FIRE")?.count).toBe(2);
    expect(totals?.find((t) => t.kind === "THINKING")?.count).toBe(1);

    service.stop("deck-1");
    events.length = 0;
    vi.advanceTimersByTime(1000);
    expect(events).toEqual([]); // the pending window died with the session
    service.start(DECK);
    expect(service.state("deck-1", true).reactionTotals?.every((t) => t.count === 0)).toBe(true);
  });

  it("forgets a socket's limiter when the socket closes", () => {
    service.react("deck-1", "FIRE", "socket-1");
    service.dropSocket("socket-1");
    expect(service.react("deck-1", "FIRE", "socket-1")).toBe(true);
  });
});
```

Add to `apps/backend/src/live/live.integration.test.ts`, inside the `describe`:
```ts
  it("accepts anonymous reactions over the socket only, while live", async () => {
    const REACT = `mutation ($slug: String!, $kind: ReactionKind!) { sendReaction(slug: $slug, kind: $kind) }`;
    const REACTIONS = `subscription ($slug: String!) { liveEvents(slug: $slug) { type reactions { kind count } } }`;
    const anon = socket({ viewerId: "ana" });

    expect((await wsRequest(anon, REACT, { slug: deck.slug, kind: "FIRE" })).data?.sendReaction).toBe(false);

    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);
    const watcher = subscribeTo(socket({ viewerId: "bia" }), REACTIONS, { slug: deck.slug });
    await sleep(200);

    expect((await wsRequest(anon, REACT, { slug: deck.slug, kind: "FIRE" })).data?.sendReaction).toBe(true);
    expect((await wsRequest(anon, REACT, { slug: deck.slug, kind: "FIRE" })).data?.sendReaction).toBe(false);
    expect((await gql(app, REACT, { slug: deck.slug, kind: "FIRE" })).data.sendReaction).toBe(false);
    expect(errorCode(await wsRequest(anon, REACT, { slug: deck.slug, kind: "PARTY" }))).toBeDefined();

    await sleep(400);
    const event = watcher.events.find((e) => e.liveEvents.type === "REACTIONS");
    expect(event?.liveEvents.reactions).toEqual([{ kind: "FIRE", count: 1 }]);
  });
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/live-reactions.test.ts`
Expected: FAIL — `service.react is not a function`.

- [ ] **Step 2: Implement reactions in the service**

`apps/backend/src/live/live-session.service.ts` — add below `VIEWERS_MIN_INTERVAL_MS`:
```ts
/** Per socket: one reaction per 300 ms, and at most 10 in any 5 s. */
export const REACTION_MIN_INTERVAL_MS = 300;
export const REACTION_BURST = 10;
export const REACTION_BURST_WINDOW_MS = 5000;
/** Reactions are summed and published once per window: at most 4 events/s per session. */
export const REACTION_WINDOW_MS = 250;
```
Add a field to the class, below `watchers`:
```ts
  /** socketId → timestamps of its accepted reactions inside the burst window. */
  private readonly reactionLimiters = new Map<string, number[]>();
```
In `dropSocket`, add as the first statement:
```ts
    this.reactionLimiters.delete(socketId);
```
Add these methods above `private publish`:
```ts
  /**
   * false (not an error) when not live or throttled. The limit is per socket:
   * `viewerId` is chosen by the client and cannot be trusted for this.
   */
  react(presentationId: string, kind: ReactionKind, socketId: string): boolean {
    const session = this.sessions.get(presentationId);
    const runtime = this.runtimes.get(presentationId);
    if (!session || !runtime) return false;

    const now = Date.now();
    const recent = (this.reactionLimiters.get(socketId) ?? []).filter((at) => now - at < REACTION_BURST_WINDOW_MS);
    const last = recent[recent.length - 1];
    const throttled =
      (last !== undefined && now - last < REACTION_MIN_INTERVAL_MS) || recent.length >= REACTION_BURST;
    if (!throttled) recent.push(now);
    this.reactionLimiters.set(socketId, recent);
    if (throttled) return false;

    session.reactionTotals[kind] += 1;
    runtime.reactionWindow.set(kind, (runtime.reactionWindow.get(kind) ?? 0) + 1);
    if (!runtime.reactionTimer) {
      runtime.reactionTimer = setTimeout(() => this.flushReactions(presentationId), REACTION_WINDOW_MS);
    }
    return true;
  }

  private flushReactions(presentationId: string): void {
    const runtime = this.runtimes.get(presentationId);
    if (!runtime) return;
    runtime.reactionTimer = null;
    const reactions = REACTION_KINDS.filter((kind) => runtime.reactionWindow.has(kind)).map((kind) => ({
      kind,
      count: runtime.reactionWindow.get(kind) as number,
    }));
    runtime.reactionWindow.clear();
    if (reactions.length > 0) this.publish(presentationId, { type: "REACTIONS", reactions });
  }
```

- [ ] **Step 3: Add the mutation**

`apps/backend/src/live/live.resolver.ts` — import `ReactionKindEnum` from `./live.types` and add:
```ts
  /**
   * Anonymous, and only over a socket: the rate limit is per socket, so an
   * HTTP request (which has none) is refused with false.
   */
  @Mutation(() => Boolean)
  sendReaction(
    @Args("slug") slug: string,
    @Args("kind", { type: () => ReactionKindEnum }) kind: ReactionKindEnum,
    @Context() context: LiveContext,
  ) {
    const socket = context.req?.socketSession;
    const session = this.live.findBySlug(slug);
    if (!socket || !session) return false;
    return this.live.react(session.presentationId, kind, socket.socketId);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend exec vitest run src/live`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/live apps/backend/src/schema.gql
git commit -m "feat(backend): add rate-limited, aggregated emoji reactions to live sessions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Close sockets on presenter link revocation and expiry

A revoked link already fails on its next operation (Task 2). This task makes revocation and expiry **immediate** for open sockets: they are closed with `4403`, which the client treats as "stop reconnecting" (Task 8) and the presenter page turns into "Link revogado ou expirado" (Task 14).

**Files:**
- Modify: `apps/backend/src/live/socket-registry.ts`, `apps/backend/src/live/live.module.ts`
- Test: add cases to `apps/backend/src/live/socket-registry.test.ts`; Create: `apps/backend/src/live/presenter-link-sockets.integration.test.ts`

**Interfaces:**
- Consumes: `SocketEntry.presenterLinkId` / `expiresAt`, already passed by `SocketAuthService.onConnect` (Task 2 Step 9); `PresenterLinksService.onRevoked` (Task 2); `openSocket` (Task 1).
- Produces: `SocketRegistry` closes an entry with `4403` at its `expiresAt`; `LiveModule` closes every socket of a revoked link.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/live/socket-registry.test.ts` (and add `afterEach` to the `vitest` import):
```ts
describe("SocketRegistry — expiry", () => {
  afterEach(() => vi.useRealTimers());

  it("closes a socket with 4403 when its credential expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const registry = new SocketRegistry();
    const link = entry("a", "1.1.1.1", { presenterLinkId: "link-1", expiresAt: new Date("2026-10-01T14:00:00Z") });
    const anonymous = entry("b");
    registry.add(link);
    registry.add(anonymous);

    vi.advanceTimersByTime(2 * 3600_000 - 1);
    expect(link.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(link.close).toHaveBeenCalledWith(4403, "Link revogado ou expirado");
    expect(anonymous.close).not.toHaveBeenCalled();
  });

  it("does not fire the expiry of a socket that already left", () => {
    vi.useFakeTimers();
    const registry = new SocketRegistry();
    const link = entry("a", "1.1.1.1", { expiresAt: new Date(Date.now() + 1000) });
    registry.add(link);
    registry.remove("a");
    vi.advanceTimersByTime(5000);
    expect(link.close).not.toHaveBeenCalled();
  });

  it("closes at once a socket whose credential is already expired", () => {
    vi.useFakeTimers();
    const registry = new SocketRegistry();
    const link = entry("a", "1.1.1.1", { expiresAt: new Date(Date.now() - 1) });
    registry.add(link);
    vi.advanceTimersByTime(0);
    expect(link.close).toHaveBeenCalledWith(4403, "Link revogado ou expirado");
  });
});
```

`apps/backend/src/live/presenter-link-sockets.integration.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { listen, openSocket, sleep } from "../../test/ws";

const CREATE_DECK = `mutation { createPresentation(input: { title: "Live", visibility: PUBLIC }) { id } }`;
const CREATE_LINK = `mutation ($p: ID!) {
  createPresenterLink(presentationId: $p, name: "Evento", expiresIn: TWO_HOURS) { url presenterLink { id } }
}`;
const REVOKE = `mutation ($id: ID!) { revokePresenterLink(id: $id) { id } }`;

describe("presenter link sockets", () => {
  let app: INestApplication;
  let url: string;
  let jwt: string;

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase();
    jwt = jwtFor(app, await createUser({ admin: true }));
  });

  it("disconnects every socket of a link the moment it is revoked, and no other", async () => {
    const deckId = (await gql(app, CREATE_DECK, undefined, jwt)).data.createPresentation.id;
    const created = (await gql(app, CREATE_LINK, { p: deckId }, jwt)).data.createPresenterLink;
    const other = (await gql(app, CREATE_LINK, { p: deckId }, jwt)).data.createPresenterLink;
    const tokenOf = (c: { url: string }) => c.url.split("#t=")[1];

    const first = await openSocket(url, { authorization: `Bearer ${tokenOf(created)}` });
    const second = await openSocket(url, { authorization: `Bearer ${tokenOf(created)}` });
    const untouched = await openSocket(url, { authorization: `Bearer ${tokenOf(other)}` });
    let untouchedClosed = false;
    void untouched.closed.then(() => (untouchedClosed = true));

    await gql(app, REVOKE, { id: created.presenterLink.id }, jwt);

    expect(await first.closed).toBe(4403);
    expect(await second.closed).toBe(4403);
    await sleep(200);
    expect(untouchedClosed).toBe(false);
    await untouched.client.dispose();
  });
});
```

Run: `dcx backend pnpm --filter backend exec vitest run src/live/socket-registry.test.ts src/live/presenter-link-sockets.integration.test.ts`
Expected: FAIL — the expiry cases never see `close`; the integration test times out waiting for `first.closed`.

- [ ] **Step 2: Add expiry timers to the registry**

`apps/backend/src/live/socket-registry.ts`:
- add below `CLOSE_TOO_MANY`:
```ts
const GONE_REASON = "Link revogado ou expirado";
```
- add a field to the class: `private readonly expiryTimers = new Map<string, NodeJS.Timeout>();`
- in `add`, before `return true;`:
```ts
    if (entry.expiresAt) {
      // Longest expiry is 7 days, well inside setTimeout's ~24.8-day limit.
      const wait = Math.max(0, entry.expiresAt.getTime() - Date.now());
      this.expiryTimers.set(
        entry.socketId,
        setTimeout(() => entry.close(CLOSE_FORBIDDEN, GONE_REASON), wait),
      );
    }
```
- in `remove`, after the early return (`if (!this.sockets.delete(socketId)) return;`):
```ts
    const timer = this.expiryTimers.get(socketId);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(socketId);
```

- [ ] **Step 3: Close sockets on revocation**

`apps/backend/src/live/live.module.ts`:
- add imports: `import { PresenterLinksService } from "../presenter-links/presenter-links.service";` and change the registry import to `import { CLOSE_FORBIDDEN, SocketRegistry } from "./socket-registry";`
- add the constructor parameter `private readonly presenterLinks: PresenterLinksService,`
- add to `onModuleInit`:
```ts
    // Revocation takes effect on open sockets immediately (spec §3.3).
    this.presenterLinks.onRevoked((linkId) =>
      this.registry.closeWhere((entry) => entry.presenterLinkId === linkId, CLOSE_FORBIDDEN, "Link revogado ou expirado"),
    );
```

- [ ] **Step 4: Run the whole backend suite**

Run: `dcx backend pnpm --filter backend test`
Expected: every file PASSES.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/live
git commit -m "feat(backend): close presenter link sockets on revocation and expiry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `@repo/graphql`: websocket link, live types and documents

**Files:**
- Create: `packages/types/src/live.ts`; Modify: `packages/types/src/index.ts`
- Create: `packages/graphql/vitest.config.ts`, `packages/graphql/src/client/ws.ts`, `packages/graphql/src/client/presenter-token.ts`, `packages/graphql/src/queries/live.ts`
- Test: `packages/graphql/src/client/ws.test.ts`, `packages/graphql/src/client/presenter-token.test.ts`
- Modify: `packages/graphql/package.json`, `pnpm-lock.yaml`, `packages/graphql/src/client/create-client.ts`, `packages/graphql/src/client/index.ts`, `packages/graphql/src/queries/index.ts`, `packages/graphql/src/react/apollo-wrapper.tsx`, `packages/graphql/src/react/index.ts`, `apps/cms/app/layout.tsx`, `apps/landing/app/layout.tsx`

**Interfaces:**
- Consumes: the backend contract of Tasks 2–6.
- Produces: everything listed under "Front-end → `@repo/types` — live.ts", "`@repo/graphql` — client" and "`@repo/graphql` — queries/live.ts" in the catalogue; `createApolloClient({ live })`; `<ApolloWrapper live>`; `useSubscription` and `useApolloClient` re-exported from `@repo/graphql/react`. Test command: `dcr cms pnpm --filter @repo/graphql test`.

- [ ] **Step 1: Add the dependency and the test runner**

`packages/graphql/package.json`:
- `"scripts"`: add `"test": "vitest run"`.
- `"dependencies"`: add `"graphql-ws": "^6.0.8"`.
- `"devDependencies"`: add `"vitest": "^3.2.0"`.

`packages/graphql/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

// Only pure helpers and reducers are unit-tested here; hooks are verified in the browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Run: `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build cms landing` (the config file and `package.json` are not dev volumes; only `src` is).

- [ ] **Step 2: Add the shared types**

`packages/types/src/live.ts`:
```ts
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
```
`packages/types/src/index.ts`: add `export * from "./live";`

- [ ] **Step 3: Write the failing tests**

`packages/graphql/src/client/ws.test.ts`:
```ts
import { gql } from "@apollo/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewerId, isSocketOperation, shouldRetrySocket, toWsUrl } from "./ws";

describe("toWsUrl", () => {
  it("derives the websocket URL from the HTTP endpoint", () => {
    expect(toWsUrl("http://localhost:4050/graphql")).toBe("ws://localhost:4050/graphql");
    expect(toWsUrl("https://api.engenhariainversa.com.br/graphql")).toBe("wss://api.engenhariainversa.com.br/graphql");
  });
  it("resolves a relative endpoint against the page origin", () => {
    expect(toWsUrl("/graphql", "https://engenhariainversa.com.br")).toBe("wss://engenhariainversa.com.br/graphql");
  });
});

describe("isSocketOperation", () => {
  it("routes subscriptions and the two high-frequency mutations over the socket", () => {
    expect(isSocketOperation(gql`subscription LiveEvents($slug: String!) { liveEvents(slug: $slug) { type } }`)).toBe(true);
    expect(isSocketOperation(gql`mutation MovePointer($p: ID!) { movePointer(presentationId: $p, x: 0, y: 0, visible: true) }`)).toBe(true);
    expect(isSocketOperation(gql`mutation SendReaction($s: String!) { sendReaction(slug: $s, kind: FIRE) }`)).toBe(true);
  });
  it("keeps everything else on HTTP", () => {
    expect(isSocketOperation(gql`query GetLiveState($slug: String!) { liveState(slug: $slug) { isLive } }`)).toBe(false);
    expect(isSocketOperation(gql`mutation StartLive($p: ID!, $s: ID!) { startLive(presentationId: $p, slideId: $s) { isLive } }`)).toBe(false);
    expect(isSocketOperation(gql`{ hello }`)).toBe(false);
  });
});

describe("shouldRetrySocket", () => {
  it("stops reconnecting after 4403 (revoked or expired credential) and retries otherwise", () => {
    expect(shouldRetrySocket({ code: 4403 })).toBe(false);
    expect(shouldRetrySocket({ code: 1006 })).toBe(true);
    expect(shouldRetrySocket(new Error("network"))).toBe(true);
  });
});

describe("getViewerId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is stable without localStorage (in-memory fallback)", () => {
    vi.stubGlobal("localStorage", undefined);
    const id = getViewerId();
    expect(id.length).toBeGreaterThan(8);
    expect(getViewerId()).toBe(id);
  });

  it("persists in localStorage so two tabs share one id", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const id = getViewerId();
    expect(store.get("ei_viewer_id")).toBe(id);
    expect(getViewerId()).toBe(id);
  });

  it("survives a storage that throws (private mode)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(getViewerId()).toBe(getViewerId());
  });
});
```

`packages/graphql/src/client/presenter-token.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { extractPresenterToken } from "./presenter-token";

describe("extractPresenterToken", () => {
  it("reads the token from the URL fragment", () => {
    expect(extractPresenterToken("#t=eip_AbC-123_xyz")).toBe("eip_AbC-123_xyz");
  });
  it("ignores slide hashes and anything that is not a presenter token", () => {
    expect(extractPresenterToken("#7")).toBeNull();
    expect(extractPresenterToken("")).toBeNull();
    expect(extractPresenterToken("#t=ei_apikey")).toBeNull();
    expect(extractPresenterToken("#t=eip_bad token")).toBeNull();
  });
});
```

Run: `dcr cms pnpm --filter @repo/graphql test`
Expected: FAIL — cannot resolve `./ws` and `./presenter-token`.

- [ ] **Step 4: Implement the helpers**

`packages/graphql/src/client/ws.ts`:
```ts
import { Kind, OperationTypeNode, type DocumentNode } from "graphql";

/**
 * Mutations sent over the socket instead of HTTP: they are frequent (pointer)
 * or rate-limited per socket (reactions). Matched by operation name.
 */
export const SOCKET_OPERATIONS = ["MovePointer", "SendReaction"];

/** The server closed the socket for good: revoked/expired credential or foreign origin. */
export const SOCKET_CLOSE_FORBIDDEN = 4403;

const VIEWER_ID_KEY = "ei_viewer_id";
let memoryViewerId: string | null = null;

/** `http→ws`, `https→wss`. No extra environment variable needed. */
export function toWsUrl(httpUrl: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  const url = new URL(httpUrl, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function isSocketOperation(query: DocumentNode): boolean {
  for (const definition of query.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    if (definition.operation === OperationTypeNode.SUBSCRIPTION) return true;
    return SOCKET_OPERATIONS.includes(definition.name?.value ?? "");
  }
  return false;
}

/** graphql-ws `shouldRetry`: keep reconnecting unless the server said "forbidden". */
export function shouldRetrySocket(event: unknown): boolean {
  return (event as { code?: number } | null)?.code !== SOCKET_CLOSE_FORBIDDEN;
}

function newViewerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * A random id per browser, so two tabs count as one viewer. Not an identity:
 * the server only uses it to de-duplicate the audience counter.
 */
export function getViewerId(): string {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      const stored = storage.getItem(VIEWER_ID_KEY);
      if (stored) return stored;
      const created = newViewerId();
      storage.setItem(VIEWER_ID_KEY, created);
      return created;
    }
  } catch {
    // Storage blocked (private mode, sandboxed iframe): fall back to memory.
  }
  return (memoryViewerId ??= newViewerId());
}
```

`packages/graphql/src/client/presenter-token.ts`:
```ts
/** sessionStorage key: a reload of the presenter page (or its popup) keeps working. */
export const PRESENTER_TOKEN_STORAGE_KEY = "ei_presenter_token";

/** `#t=eip_…` → the token. The fragment never reaches a server or an access log. */
export function extractPresenterToken(hash: string): string | null {
  return /^#t=(eip_[A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;
}
```

`packages/graphql/src/client/index.ts`: add `export * from "./ws";` and `export * from "./presenter-token";`

Run: `dcr cms pnpm --filter @repo/graphql test`
Expected: PASS.

- [ ] **Step 5: Add the websocket link to the client**

`packages/graphql/src/client/create-client.ts` — replace the imports at the top with:
```ts
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { removeTypenameFromVariables } from "@apollo/client/link/remove-typename";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getViewerId, isSocketOperation, shouldRetrySocket, toWsUrl } from "./ws";
```
Add to `CreateApolloClientOptions`:
```ts
  /**
   * Enables live sessions: subscriptions (and the `MovePointer` / `SendReaction`
   * mutations) go over a websocket derived from `uri`. `onClosed` receives the
   * close code; 4403 means the credential was revoked or expired.
   */
  live?: boolean | { onClosed?: (code: number) => void };
```
Replace the final `return new ApolloClient({ … });` with:
```ts
  const httpChain = from([removeTypenameLink, authLink, httpLink]);

  // The socket only exists in the browser, and only connects on first use (lazy).
  let link: ApolloLink = httpChain;
  if (options.live && typeof window !== "undefined") {
    const onClosed = typeof options.live === "object" ? options.live.onClosed : undefined;
    const wsLink = new GraphQLWsLink(
      createClient({
        url: toWsUrl(options.uri),
        lazy: true,
        // Client ping every 30 s, below Cloudflare's ~100 s idle timeout.
        keepAlive: 30_000,
        retryAttempts: Infinity,
        shouldRetry: shouldRetrySocket,
        connectionParams: () => {
          const token = options.getToken?.();
          return {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            viewerId: getViewerId(),
          };
        },
        on: {
          closed: (event) => {
            const code = (event as { code?: number } | null)?.code;
            if (typeof code === "number") onClosed?.(code);
          },
        },
      }),
    );
    link = ApolloLink.split(({ query }) => isSocketOperation(query), from([removeTypenameLink, wsLink]), httpChain);
  }

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
    ssrMode: typeof window === "undefined",
  });
```
(Delete the old `link: from([removeTypenameLink, authLink, httpLink]),` return.)

`packages/graphql/src/react/apollo-wrapper.tsx` — add the prop to `ApolloWrapperProps`:
```ts
  /** Open a websocket for live sessions (subscriptions). Lazy: connects on first use. */
  live?: boolean;
```
destructure it (`live = false,`) and pass `live,` to `createApolloClient({ … })`.

`packages/graphql/src/react/index.ts` — replace the hooks export line with:
```ts
export { ApolloProvider, useApolloClient, useMutation, useQuery, useSubscription } from "@apollo/client/react";
```

`apps/cms/app/layout.tsx`: `<ApolloWrapper tokenCookieName="cms_token" live>`.
`apps/landing/app/layout.tsx`: `<ApolloWrapper live>`.

- [ ] **Step 6: Add the documents**

`packages/graphql/src/queries/live.ts`:
```ts
import { gql } from "@apollo/client";
import { PRESENTATION_FIELDS } from "./presentations";

const LIVE_STATE_FIELDS = `
  isLive
  startedAt
  slideId
  showViewerCount
  showReactionsOnScreen
  viewerCount
  peakViewers
  reactionTotals { kind count }
`;

const PRESENTER_LINK_FIELDS = `
  id
  name
  prefix
  expiresAt
  lastUsedAt
  revokedAt
  createdAt
`;

export const GET_LIVE_STATE = gql`
  query GetLiveState($slug: String!) {
    liveState(slug: $slug) { ${LIVE_STATE_FIELDS} }
  }
`;

export const LIVE_EVENTS = gql`
  subscription LiveEvents($slug: String!) {
    liveEvents(slug: $slug) {
      type
      slideId
      pointer { x y visible }
      viewerCount
      peakViewers
      reactions { kind count }
      showViewerCount
      showReactionsOnScreen
    }
  }
`;

export const START_LIVE = gql`
  mutation StartLive($presentationId: ID!, $slideId: ID!) {
    startLive(presentationId: $presentationId, slideId: $slideId) { ${LIVE_STATE_FIELDS} }
  }
`;

export const STOP_LIVE = gql`
  mutation StopLive($presentationId: ID!) {
    stopLive(presentationId: $presentationId)
  }
`;

export const SET_LIVE_SLIDE = gql`
  mutation SetLiveSlide($presentationId: ID!, $slideId: ID!) {
    setLiveSlide(presentationId: $presentationId, slideId: $slideId)
  }
`;

// Operation name "MovePointer" is in SOCKET_OPERATIONS: sent over the websocket.
export const MOVE_POINTER = gql`
  mutation MovePointer($presentationId: ID!, $x: Float!, $y: Float!, $visible: Boolean!) {
    movePointer(presentationId: $presentationId, x: $x, y: $y, visible: $visible)
  }
`;

export const SET_LIVE_OPTIONS = gql`
  mutation SetLiveOptions($presentationId: ID!, $showViewerCount: Boolean, $showReactionsOnScreen: Boolean) {
    setLiveOptions(
      presentationId: $presentationId
      showViewerCount: $showViewerCount
      showReactionsOnScreen: $showReactionsOnScreen
    ) { ${LIVE_STATE_FIELDS} }
  }
`;

// Operation name "SendReaction" is in SOCKET_OPERATIONS: the server rate-limits per socket.
export const SEND_REACTION = gql`
  mutation SendReaction($slug: String!, $kind: ReactionKind!) {
    sendReaction(slug: $slug, kind: $kind)
  }
`;

export const GET_PRESENTER_LINKS = gql`
  query GetPresenterLinks($presentationId: ID!) {
    presenterLinks(presentationId: $presentationId) { ${PRESENTER_LINK_FIELDS} }
  }
`;

export const CREATE_PRESENTER_LINK = gql`
  mutation CreatePresenterLink($presentationId: ID!, $name: String!, $expiresIn: PresenterLinkExpiry!) {
    createPresenterLink(presentationId: $presentationId, name: $name, expiresIn: $expiresIn) {
      url
      presenterLink { ${PRESENTER_LINK_FIELDS} }
    }
  }
`;

export const REVOKE_PRESENTER_LINK = gql`
  mutation RevokePresenterLink($id: ID!) {
    revokePresenterLink(id: $id) { ${PRESENTER_LINK_FIELDS} }
  }
`;

export const GET_PRESENTATION_FOR_PRESENTER = gql`
  query GetPresentationForPresenter {
    presentationForPresenter { ${PRESENTATION_FIELDS} }
  }
`;
```
`packages/graphql/src/queries/index.ts`: add `export * from "./live";`

- [ ] **Step 7: Verify**

Run: `dcr cms pnpm --filter @repo/graphql test` — Expected: PASS.
Run: `dcr cms pnpm --filter cms exec tsc --noEmit && dcr landing pnpm --filter landing exec tsc --noEmit` — Expected: no errors.

With the dev stack up (`docker compose -f docker-compose.dev.yml up -d`), open `http://localhost:4052/` and the CMS dashboard: both render as before, and the browser's Network → WS tab shows **no** socket yet (the link is lazy; nothing subscribes until Task 12/13).

- [ ] **Step 8: Commit**

```bash
git add packages/types packages/graphql apps/cms/app/layout.tsx apps/landing/app/layout.tsx pnpm-lock.yaml
git commit -m "feat(graphql): add a websocket link, live types and live documents

Subscriptions and the pointer/reaction mutations go over graphql-ws, derived
from NEXT_PUBLIC_API_URL. A 4403 close stops reconnecting.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `liveReducer`, `useLiveSession` and presenter control hooks

**Files:**
- Create: `packages/graphql/src/react/live-reducer.ts`, `packages/graphql/src/react/use-live-session.ts`
- Test: `packages/graphql/src/react/live-reducer.test.ts`
- Modify: `packages/graphql/src/react/index.ts`

**Interfaces:**
- Consumes: `LiveState`, `LiveEvent`, `LiveClientState`, `PresenterControls`, `ReactionKind`, `REACTION_KINDS` (`@repo/types`, Task 8); the documents of Task 8.
- Produces (from `@repo/graphql/react`): `INITIAL_LIVE_STATE`, `LiveClientAction`, `liveReducer`, `useLiveSession(slug, { pollMs })`, `usePresenterControls(presentationId)`, `useSendReaction(slug)`.

- [ ] **Step 1: Write the failing tests**

`packages/graphql/src/react/live-reducer.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { LiveEvent, LiveEventType, LiveState } from "@repo/types";
import { INITIAL_LIVE_STATE, liveReducer } from "./live-reducer";

const event = (type: LiveEventType, fields: Partial<LiveEvent> = {}) => ({
  type: "event" as const,
  receivedAt: "2026-10-01T12:00:00.000Z",
  event: {
    type, slideId: null, pointer: null, viewerCount: null, peakViewers: null,
    reactions: null, showViewerCount: null, showReactionsOnScreen: null, ...fields,
  },
});
const serverState = (fields: Partial<LiveState> = {}) => ({
  type: "state" as const,
  state: {
    isLive: true, startedAt: "2026-10-01T11:50:00.000Z", slideId: "s1", showViewerCount: true,
    showReactionsOnScreen: true, viewerCount: 3, peakViewers: null, reactionTotals: null, ...fields,
  },
});
const live = () => liveReducer(INITIAL_LIVE_STATE, event("STARTED", { slideId: "s1" }));

describe("liveReducer", () => {
  it("starts not live", () => {
    expect(INITIAL_LIVE_STATE).toMatchObject({ isLive: false, slideId: null, endedSeq: 0, lostSeq: 0 });
  });

  it("goes live on STARTED, stamping the start with the receive time", () => {
    expect(live()).toMatchObject({ isLive: true, slideId: "s1", startedAt: "2026-10-01T12:00:00.000Z" });
  });

  it("adopts the server state on load, including a session that started before the page opened", () => {
    const state = liveReducer(INITIAL_LIVE_STATE, serverState({ slideId: "s4", viewerCount: 12 }));
    expect(state).toMatchObject({ isLive: true, slideId: "s4", viewerCount: 12, startedAt: "2026-10-01T11:50:00.000Z" });
  });

  it("follows SLIDE, POINTER, VIEWERS and OPTIONS", () => {
    let state = live();
    state = liveReducer(state, event("SLIDE", { slideId: "s2" }));
    state = liveReducer(state, event("POINTER", { pointer: { x: 0.2, y: 0.8, visible: true } }));
    state = liveReducer(state, event("VIEWERS", { viewerCount: 9, peakViewers: 11 }));
    state = liveReducer(state, event("OPTIONS", { showViewerCount: false, showReactionsOnScreen: true }));
    expect(state).toMatchObject({
      slideId: "s2", pointer: { x: 0.2, y: 0.8, visible: true }, viewerCount: 9, peakViewers: 11,
      showViewerCount: false, showReactionsOnScreen: true,
    });
  });

  it("keeps the known peak when a VIEWERS event carries none (audience)", () => {
    let state = liveReducer(live(), event("VIEWERS", { viewerCount: 9, peakViewers: 11 }));
    state = liveReducer(state, event("VIEWERS", { viewerCount: 4 }));
    expect(state).toMatchObject({ viewerCount: 4, peakViewers: 11 });
  });

  it("treats a SLIDE for a session it did not see start as live", () => {
    const state = liveReducer(INITIAL_LIVE_STATE, event("SLIDE", { slideId: "s3" }));
    expect(state).toMatchObject({ isLive: true, slideId: "s3" });
  });

  it("accumulates reaction totals and exposes each batch with a new seq", () => {
    let state = liveReducer(live(), event("REACTIONS", { reactions: [{ kind: "FIRE", count: 3 }] }));
    state = liveReducer(state, event("REACTIONS", { reactions: [{ kind: "FIRE", count: 2 }, { kind: "CLAP", count: 1 }] }));
    expect(state.reactionTotals).toMatchObject({ FIRE: 5, CLAP: 1, HEART: 0 });
    expect(state.lastReactions).toEqual({ seq: 2, counts: [{ kind: "FIRE", count: 2 }, { kind: "CLAP", count: 1 }] });
  });

  it("takes the presenter's totals and peak from the server state", () => {
    const state = liveReducer(live(), serverState({ peakViewers: 20, reactionTotals: [{ kind: "HEART", count: 7 }] }));
    expect(state.peakViewers).toBe(20);
    expect(state.reactionTotals.HEART).toBe(7);
  });

  it("resets on ENDED and counts it", () => {
    let state = liveReducer(live(), event("REACTIONS", { reactions: [{ kind: "FIRE", count: 3 }] }));
    state = liveReducer(state, event("ENDED"));
    expect(state).toMatchObject({ isLive: false, slideId: null, pointer: null, endedSeq: 1, lostSeq: 0 });
    expect(state.reactionTotals.FIRE).toBe(0);
  });

  it("flags a lost session when the server says not live without an ENDED (backend restart)", () => {
    const state = liveReducer(live(), serverState({ isLive: false, slideId: null, startedAt: null }));
    expect(state).toMatchObject({ isLive: false, endedSeq: 0, lostSeq: 1 });
  });

  it("returns the same object for a not-live poll while not live", () => {
    const action = serverState({ isLive: false, slideId: null, startedAt: null });
    expect(liveReducer(INITIAL_LIVE_STATE, action)).toBe(INITIAL_LIVE_STATE);
  });
});
```

Run: `dcr cms pnpm --filter @repo/graphql test`
Expected: FAIL — cannot resolve `./live-reducer`.

- [ ] **Step 2: Implement the reducer**

`packages/graphql/src/react/live-reducer.ts`:
```ts
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
```

Run: `dcr cms pnpm --filter @repo/graphql test`
Expected: PASS.

- [ ] **Step 3: Implement the hooks**

`packages/graphql/src/react/use-live-session.ts`:
```ts
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
} from "../queries/live";
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
```

`packages/graphql/src/react/index.ts`: add
```ts
export * from "./live-reducer";
export * from "./use-live-session";
```

- [ ] **Step 4: Verify**

Run: `dcr cms pnpm --filter @repo/graphql test` — Expected: PASS.
Run: `dcr cms pnpm --filter cms exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/graphql/src/react
git commit -m "feat(graphql): add the live session reducer and hooks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: UI: follow mode, pointer and reaction overlays, player hooks

**Files:**
- Create: `packages/ui/src/slides/live/emoji.ts`, `follow.ts`, `reaction-queue.ts`, `pointer-layer.tsx`, `reactions-layer.tsx`, `reaction-bar.tsx`, `live-badge.tsx`, `follow-button.tsx`, `index.ts`
- Test: `packages/ui/src/slides/live/follow.test.ts`, `packages/ui/src/slides/live/reaction-queue.test.ts`
- Modify: `packages/ui/package.json` (add `@repo/types`), `pnpm-lock.yaml`, `packages/ui/src/slides/player.tsx`, `packages/ui/src/slides/index.ts`

**Interfaces:**
- Consumes: `LivePointer`, `ReactionCount`, `ReactionKind`, `REACTION_KINDS`, `LiveClientState` (`@repo/types`, Task 8); `PresentationPlayer`, `useDeckNavigation` (3a Task 13); `SlideCanvas`'s `overlay` slot — rendered **inside** the scaled 1920×1080 surface, so overlay sizes are canvas pixels and percentages are canvas-relative (3a Task 11).
- Produces: `REACTION_EMOJI`; `FollowState`, `FollowAction`, `INITIAL_FOLLOW_STATE`, `followReducer`, `showFollowButton`, `needsDeckRefresh`, `followTargetIndex`; `FloatingReaction`, `MAX_FLOATING`, `FLOAT_MS`, `addReactions`; `PointerLayer`, `ReactionsLayer`, `ReactionBar`, `LiveBadge`, `FollowButton`; `PresentationPlayer` props `followSlideId` and `chrome`.

Follow rules (spec L2): the viewer follows by default; navigating by hand to a different slide enters free mode; the "Seguir apresentador" button shows **exactly** when the viewer's slide differs from the presenter's; clicking it, or walking back onto the presenter's slide, resumes following.

- [ ] **Step 1: Add `@repo/types` to `@repo/ui`**

`packages/ui/package.json` `"dependencies"`: add `"@repo/types": "workspace:*"`.
Run: `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build cms landing`.

- [ ] **Step 2: Write the failing tests**

`packages/ui/src/slides/live/follow.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  INITIAL_FOLLOW_STATE,
  followReducer,
  followTargetIndex,
  needsDeckRefresh,
  showFollowButton,
  type FollowAction,
} from "./follow";

const run = (...actions: FollowAction[]) => actions.reduce(followReducer, INITIAL_FOLLOW_STATE);

describe("followReducer", () => {
  it("follows by default and shows no button when nothing is live", () => {
    const state = run({ type: "viewer", slideId: "s1" });
    expect(state.following).toBe(true);
    expect(showFollowButton(state)).toBe(false);
  });

  it("keeps following when the page's first slide differs from the presenter's (deep link while live)", () => {
    const state = run({ type: "presenter", slideId: "s4" }, { type: "viewer", slideId: "s1" });
    expect(state.following).toBe(true);
    expect(showFollowButton(state)).toBe(true); // until the player jumps
    const jumped = followReducer(state, { type: "viewer", slideId: "s4" });
    expect(jumped.following).toBe(true);
    expect(showFollowButton(jumped)).toBe(false);
  });

  it("enters free mode when the viewer navigates away, showing the button", () => {
    const state = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s2" },
    );
    expect(state.following).toBe(false);
    expect(showFollowButton(state)).toBe(true);
  });

  it("stays in free mode while the presenter moves, button visible exactly when the slides differ", () => {
    let state = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s3" },
    );
    state = followReducer(state, { type: "presenter", slideId: "s2" });
    expect(state.following).toBe(false);
    expect(showFollowButton(state)).toBe(true);
    state = followReducer(state, { type: "presenter", slideId: "s3" }); // presenter lands on the viewer's slide
    expect(showFollowButton(state)).toBe(false);
  });

  it("resumes following on the button, and when the viewer walks back onto the presenter's slide", () => {
    const free = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s2" },
    );
    expect(followReducer(free, { type: "follow" }).following).toBe(true);
    expect(followReducer(free, { type: "viewer", slideId: "s1" }).following).toBe(true);
  });

  it("goes back to following-by-default when the session ends", () => {
    const state = run(
      { type: "viewer", slideId: "s1" },
      { type: "presenter", slideId: "s1" },
      { type: "viewer", slideId: "s2" },
      { type: "presenter", slideId: null },
    );
    expect(state).toMatchObject({ following: true, presenterSlideId: null });
    expect(showFollowButton(state)).toBe(false);
  });
});

describe("followTargetIndex", () => {
  it("finds the slide to jump to", () => {
    expect(followTargetIndex(["a", "b", "c"], "c")).toBe(2);
  });
  it("returns null (stay put) for an unknown slide or when not following", () => {
    expect(followTargetIndex(["a", "b"], "zzz")).toBeNull();
    expect(followTargetIndex(["a", "b"], null)).toBeNull();
    expect(followTargetIndex([], "a")).toBeNull();
  });
});

describe("needsDeckRefresh", () => {
  it("asks for a refresh when the presenter is on a slide this page does not have", () => {
    expect(needsDeckRefresh("new-slide", ["a", "b"])).toBe(true);
    expect(needsDeckRefresh("a", ["a", "b"])).toBe(false);
    expect(needsDeckRefresh(null, ["a", "b"])).toBe(false);
  });
});
```

`packages/ui/src/slides/live/reaction-queue.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FLOAT_MS, MAX_FLOATING, addReactions } from "./reaction-queue";

const ids = () => {
  let n = 0;
  return () => n++;
};

describe("addReactions", () => {
  it("adds one floating emoji per reaction", () => {
    const items = addReactions([], [{ kind: "FIRE", count: 2 }, { kind: "CLAP", count: 1 }], 1000, ids());
    expect(items.map((i) => [i.kind, i.count])).toEqual([["FIRE", 1], ["FIRE", 1], ["CLAP", 1]]);
    expect(items.every((i) => i.bornAt === 1000)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("groups what does not fit on screen: 20 singles, the rest as ×N", () => {
    const items = addReactions([], [{ kind: "FIRE", count: 32 }], 1000, ids());
    expect(items).toHaveLength(MAX_FLOATING + 1);
    expect(items.at(-1)).toMatchObject({ kind: "FIRE", count: 12 });
  });

  it("merges later overflow into the existing group instead of growing without bound", () => {
    const next = ids();
    let items = addReactions([], [{ kind: "FIRE", count: 32 }], 1000, next);
    items = addReactions(items, [{ kind: "FIRE", count: 50 }, { kind: "HEART", count: 5 }], 1100, next);
    expect(items).toHaveLength(MAX_FLOATING + 2);
    expect(items.find((i) => i.kind === "FIRE" && i.count > 1)).toMatchObject({ count: 62, bornAt: 1100 });
    expect(items.find((i) => i.kind === "HEART")).toMatchObject({ count: 5 });
  });

  it("drops emojis that finished floating", () => {
    const next = ids();
    const first = addReactions([], [{ kind: "FIRE", count: 2 }], 1000, next);
    const later = addReactions(first, [{ kind: "CLAP", count: 1 }], 1000 + FLOAT_MS, next);
    expect(later.map((i) => i.kind)).toEqual(["CLAP"]);
  });
});
```

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: FAIL — cannot resolve `./follow` and `./reaction-queue`.

- [ ] **Step 3: Implement the pure logic**

`packages/ui/src/slides/live/emoji.ts`:
```ts
import type { ReactionKind } from "@repo/types";

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  CLAP: "👏",
  FIRE: "🔥",
  MIND_BLOWN: "🤯",
  LAUGH: "😂",
  HEART: "❤️",
  THINKING: "🤔",
};
```

`packages/ui/src/slides/live/follow.ts`:
```ts
export type FollowState = {
  following: boolean;
  /** null when no session is live */
  presenterSlideId: string | null;
  /** null until the player reports its first slide */
  viewerSlideId: string | null;
};

export type FollowAction =
  | { type: "presenter"; slideId: string | null }
  | { type: "viewer"; slideId: string }
  | { type: "follow" };

export const INITIAL_FOLLOW_STATE: FollowState = { following: true, presenterSlideId: null, viewerSlideId: null };

export function followReducer(state: FollowState, action: FollowAction): FollowState {
  switch (action.type) {
    case "presenter":
      // Session over: the next one is followed by default again.
      if (action.slideId === null) return { ...state, presenterSlideId: null, following: true };
      return { ...state, presenterSlideId: action.slideId };
    case "viewer": {
      const firstReport = state.viewerSlideId === null;
      const following =
        state.presenterSlideId === null
          ? true
          : firstReport
            ? state.following // the slide the page opened on is not a choice to leave the presenter
            : action.slideId === state.presenterSlideId;
      return { ...state, viewerSlideId: action.slideId, following };
    }
    case "follow":
      return { ...state, following: true };
    default:
      return state;
  }
}

/** Visible exactly when the viewer's slide differs from the presenter's. */
export function showFollowButton(state: FollowState): boolean {
  return (
    state.presenterSlideId !== null &&
    state.viewerSlideId !== null &&
    state.viewerSlideId !== state.presenterSlideId
  );
}

/** Index to jump to, or null to stay put (not following, or a slide this page does not have). */
export function followTargetIndex(slideIds: string[], followSlideId: string | null | undefined): number | null {
  if (!followSlideId) return null;
  const index = slideIds.indexOf(followSlideId);
  return index >= 0 ? index : null;
}

/** The presenter is on a slide added (or un-hidden) after this page loaded its deck. */
export function needsDeckRefresh(presenterSlideId: string | null, slideIds: string[]): boolean {
  return presenterSlideId !== null && !slideIds.includes(presenterSlideId);
}
```

`packages/ui/src/slides/live/reaction-queue.ts`:
```ts
import type { ReactionCount, ReactionKind } from "@repo/types";

export type FloatingReaction = { id: number; kind: ReactionKind; count: number; bornAt: number };

/** Single emojis on screen at once; what does not fit is grouped as "🔥×12". */
export const MAX_FLOATING = 20;
export const FLOAT_MS = 2500;

export function addReactions(
  current: FloatingReaction[],
  counts: ReactionCount[],
  now: number,
  nextId: () => number,
): FloatingReaction[] {
  // Copies: a carried-over group is updated below, and `current` must stay untouched.
  const items = current.filter((item) => now - item.bornAt < FLOAT_MS).map((item) => ({ ...item }));
  for (const { kind, count } of counts) {
    const singlesOnScreen = items.filter((item) => item.count === 1).length;
    const singles = Math.min(count, Math.max(0, MAX_FLOATING - singlesOnScreen));
    for (let i = 0; i < singles; i++) items.push({ id: nextId(), kind, count: 1, bornAt: now });

    const overflow = count - singles;
    if (overflow <= 0) continue;
    const group = items.find((item) => item.kind === kind && item.count > 1);
    if (group) {
      group.count += overflow;
      group.bornAt = now;
    } else {
      items.push({ id: nextId(), kind, count: overflow, bornAt: now });
    }
  }
  return items;
}
```

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: PASS.

- [ ] **Step 4: Implement the overlay components**

`packages/ui/src/slides/live/pointer-layer.tsx`:
```tsx
import type { LivePointer } from "@repo/types";

/**
 * The laser dot. Rendered in the canvas overlay, so `left`/`top` percentages
 * are relative to the 1920×1080 surface and the 28px size scales with it.
 */
export function PointerLayer({ pointer }: { pointer: LivePointer | null }) {
  if (!pointer) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container"
      style={{
        left: `${pointer.x * 100}%`,
        top: `${pointer.y * 100}%`,
        opacity: pointer.visible ? 1 : 0,
        boxShadow: "0 0 32px 12px rgba(255, 183, 131, 0.55)",
        // ~60 ms interpolation between network updates.
        transition: "left 60ms linear, top 60ms linear, opacity 200ms ease-out",
      }}
    />
  );
}
```

`packages/ui/src/slides/live/reactions-layer.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveClientState } from "@repo/types";
import { REACTION_EMOJI } from "./emoji";
import { FLOAT_MS, addReactions, type FloatingReaction } from "./reaction-queue";

/**
 * Emojis rising from the bottom-right corner. Fill a `relative` box with it:
 * the canvas overlay (default 72px, canvas pixels) or a panel (pass `fontSize`).
 */
export function ReactionsLayer({
  lastReactions,
  fontSize = 72,
}: {
  lastReactions: LiveClientState["lastReactions"];
  fontSize?: number;
}) {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!lastReactions) return;
    setItems((current) => addReactions(current, lastReactions.counts, Date.now(), () => nextId.current++));
  }, [lastReactions]);

  // Clear the stage once the last batch finished floating.
  useEffect(() => {
    if (items.length === 0) return;
    const id = window.setTimeout(
      () => setItems((current) => current.filter((item) => Date.now() - item.bornAt < FLOAT_MS)),
      FLOAT_MS,
    );
    return () => window.clearTimeout(id);
  }, [items]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes ei-reaction-rise {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { transform: translateY(-60%) scale(1); opacity: 1; }
          100% { transform: translateY(-480%) scale(1); opacity: 0; }
        }
      `}</style>
      {items.map((item) => (
        <span
          key={item.id}
          className="absolute bottom-[6%] flex items-center font-code text-on-surface"
          style={{
            // Spread across the corner so simultaneous reactions do not stack.
            right: `${3 + ((item.id * 37) % 16)}%`,
            fontSize,
            lineHeight: 1,
            animation: `ei-reaction-rise ${FLOAT_MS}ms ease-out forwards`,
          }}
        >
          {REACTION_EMOJI[item.kind]}
          {item.count > 1 && <span style={{ fontSize: fontSize * 0.5, marginLeft: fontSize * 0.1 }}>×{item.count}</span>}
        </span>
      ))}
    </div>
  );
}
```

`packages/ui/src/slides/live/reaction-bar.tsx`:
```tsx
"use client";

import { useState } from "react";
import { REACTION_KINDS, type ReactionKind } from "@repo/types";
import { REACTION_EMOJI } from "./emoji";

const LABEL: Record<ReactionKind, string> = {
  CLAP: "Palmas",
  FIRE: "Fogo",
  MIND_BLOWN: "Mente explodida",
  LAUGH: "Risada",
  HEART: "Coração",
  THINKING: "Pensando",
};

/** The audience's six reactions. Floats over the page (and fullscreen); collapsible. */
export function ReactionBar({
  onReact,
  hidden,
  onToggleHidden,
}: {
  onReact: (kind: ReactionKind) => void;
  /** Whether this viewer hid everyone's floating reactions (local preference). */
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const [open, setOpen] = useState(true);
  const button = "rounded-full px-2 py-1 text-2xl transition-transform hover:scale-125 active:scale-95";

  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface-container/90 px-3 py-2 shadow-lg backdrop-blur">
      {open &&
        REACTION_KINDS.map((kind) => (
          <button key={kind} type="button" className={button} onClick={() => onReact(kind)} aria-label={LABEL[kind]} title={LABEL[kind]}>
            {REACTION_EMOJI[kind]}
          </button>
        ))}
      {open && (
        <button
          type="button"
          onClick={onToggleHidden}
          className="ml-1 rounded-full px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
        >
          {hidden ? "Mostrar reações" : "Ocultar reações"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
        aria-expanded={open}
      >
        {open ? "Recolher" : "Reagir"}
      </button>
    </div>
  );
}
```

`packages/ui/src/slides/live/live-badge.tsx`:
```tsx
/** "AO VIVO", plus the audience counter when the presenter shows it (`viewerCount` not null). */
export function LiveBadge({ viewerCount }: { viewerCount: number | null }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-surface-container/90 px-4 py-2 text-sm font-bold text-on-surface shadow-lg backdrop-blur">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
        AO VIVO
      </span>
      {viewerCount !== null && (
        <span className="font-code font-normal tabular-nums text-on-surface-variant">👁 {viewerCount} assistindo</span>
      )}
    </div>
  );
}
```

`packages/ui/src/slides/live/follow-button.tsx`:
```tsx
/** Shown only while the viewer's slide differs from the presenter's. */
export function FollowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary shadow-lg hover:brightness-110"
    >
      Seguir apresentador
    </button>
  );
}
```

`packages/ui/src/slides/live/index.ts`:
```ts
export * from "./emoji";
export * from "./follow";
export * from "./reaction-queue";
export * from "./pointer-layer";
export * from "./reactions-layer";
export * from "./reaction-bar";
export * from "./live-badge";
export * from "./follow-button";
```
`packages/ui/src/slides/index.ts`: add `export * from "./live";`

- [ ] **Step 5: Give the player its two live hooks**

`packages/ui/src/slides/player.tsx`:

Add `import { followTargetIndex } from "./live/follow";` and, in `PresentationPlayerProps`:
```ts
  /**
   * Jump to this slide whenever the value changes (live follow). A slide id the
   * deck does not have is ignored: the viewer stays where they are.
   */
  followSlideId?: string | null;
  /** Persistent UI over the player (badges, buttons). Outside the click-to-navigate stage. */
  chrome?: ReactNode;
```
Destructure both (`followSlideId, chrome,`) in the component signature. Add this effect right after the `onSlideChange` effect:
```ts
  useEffect(() => {
    const target = followTargetIndex(shown.map((slide) => slide.id), followSlideId);
    if (target !== null) dispatch({ type: "goto", index: target });
    // `shown` is a dependency on purpose: when the deck is refreshed and now
    // contains the followed slide, the jump happens then.
  }, [followSlideId, shown, dispatch]);
```
Render `chrome` inside the root `div`, right before the `{/* Progress */}` block:
```tsx
      {chrome}
```

- [ ] **Step 6: Verify**

Run: `dcr cms pnpm --filter @repo/ui test` — Expected: PASS (follow, reaction-queue and the 3a suites).
Run: `dcr cms pnpm --filter cms exec tsc --noEmit && dcr landing pnpm --filter landing exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): add live follow mode, pointer and reaction overlays

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: UI: laser surface, presenter player, panel and presenter view

**Files:**
- Create: `packages/ui/src/slides/live/laser.ts`, `remote-slide.ts`, `laser-surface.tsx`, `live-presenter-panel.tsx`, `live-presenter-player.tsx`, `live-presenter-view.tsx`
- Test: `packages/ui/src/slides/live/laser.test.ts`, `packages/ui/src/slides/live/remote-slide.test.ts`
- Modify: `packages/ui/src/slides/presenter-view.tsx`, `packages/ui/src/slides/live/index.ts`

**Interfaces:**
- Consumes: `LiveClientState`, `PresenterControls`, `LivePointer`, `REACTION_KINDS` (`@repo/types`); `PointerLayer`, `ReactionsLayer`, `LiveBadge`, `REACTION_EMOJI` (Task 10); `PresentationPlayer` with `followSlideId` / `toolbar` / `overlay` / `onSlideChange` (3a Task 13, Task 10); `PresenterView`, `formatElapsed`, `PlayerSlide`, `SlideContext` (3a).
- Produces: `normalizedPoint`, `LASER_IDLE_MS`, `LASER_MIN_INTERVAL_MS`; `SentSlide`, `ECHO_WINDOW_MS`, `absorbEcho`; `LaserSurface`, `LivePresenterPanel`, `LivePresenterPlayer`, `LivePresenterView`; `PresenterView` props `livePanel` and `overlay`. These composites take `live` and `controls` as props, so `@repo/ui` needs no GraphQL dependency; the apps build them with `useLiveSession` + `usePresenterControls` (Task 9).

Keys added for presenters: `L` toggles the laser, `R` toggles reactions on the projected screen.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/slides/live/laser.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { normalizedPoint } from "./laser";

const rect = { left: 100, top: 50, width: 800, height: 450 };

describe("normalizedPoint", () => {
  it("maps a mouse position to 0..1 on the canvas, whatever its on-screen scale", () => {
    expect(normalizedPoint(rect, 500, 275)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizedPoint(rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(normalizedPoint(rect, 900, 500)).toEqual({ x: 1, y: 1 });
  });
  it("clamps positions outside the canvas and survives a zero-sized rect", () => {
    expect(normalizedPoint(rect, 0, 9999)).toEqual({ x: 0, y: 1 });
    expect(normalizedPoint({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});
```

`packages/ui/src/slides/live/remote-slide.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ECHO_WINDOW_MS, absorbEcho } from "./remote-slide";

describe("absorbEcho", () => {
  it("applies a slide change that came from another controller", () => {
    expect(absorbEcho("s5", [], 1000)).toEqual({ apply: true, sent: [] });
    const sent = [{ id: "s2", at: 900 }];
    expect(absorbEcho("s5", sent, 1000)).toEqual({ apply: true, sent });
  });

  it("does not yank the presenter back when the echo of an earlier press arrives late", () => {
    // → pressed twice: s2 at t=0, s3 at t=50. The echo of s2 arrives at t=120.
    const sent = [{ id: "s2", at: 0 }, { id: "s3", at: 50 }];
    const afterFirstEcho = absorbEcho("s2", sent, 120);
    expect(afterFirstEcho).toEqual({ apply: false, sent: [{ id: "s3", at: 50 }] });
    expect(absorbEcho("s3", afterFirstEcho.sent, 170)).toEqual({ apply: false, sent: [] });
  });

  it("absorbs each sent slide once: the same slide coming from the other controller afterwards applies", () => {
    const afterEcho = absorbEcho("s2", [{ id: "s2", at: 0 }], 100);
    expect(absorbEcho("s2", afterEcho.sent, 300).apply).toBe(true);
  });

  it("forgets sent slides after the echo window", () => {
    const sent = [{ id: "s2", at: 0 }];
    expect(absorbEcho("s2", sent, ECHO_WINDOW_MS + 1)).toEqual({ apply: true, sent: [] });
  });
});
```

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: FAIL — cannot resolve `./laser` and `./remote-slide`.

- [ ] **Step 2: Implement the pure logic**

`packages/ui/src/slides/live/laser.ts`:
```ts
/** The laser hides after this long without mouse movement. */
export const LASER_IDLE_MS = 2000;
/** ~30 pointer updates per second, below the server's 40/s throttle. */
export const LASER_MIN_INTERVAL_MS = 33;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Mouse position → 0..1 on the canvas. `rect` is the canvas's on-screen box. */
export function normalizedPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return { x: clamp01((clientX - rect.left) / rect.width), y: clamp01((clientY - rect.top) / rect.height) };
}
```

`packages/ui/src/slides/live/remote-slide.ts`:
```ts
export type SentSlide = { id: string; at: number };

/** How long a `setLiveSlide` we sent may still come back as a SLIDE event. */
export const ECHO_WINDOW_MS = 2000;

/**
 * A presenter window receives every SLIDE event, including the echoes of its
 * own commands. Applying a late echo would move the presenter back to a slide
 * they already left; each sent slide therefore absorbs one matching event.
 * Anything else comes from another controller (CMS + presenter link) and applies.
 */
export function absorbEcho(
  remoteSlideId: string,
  sent: SentSlide[],
  now: number,
): { apply: boolean; sent: SentSlide[] } {
  const recent = sent.filter((entry) => now - entry.at < ECHO_WINDOW_MS);
  const index = recent.findIndex((entry) => entry.id === remoteSlideId);
  if (index === -1) return { apply: true, sent: recent };
  return { apply: false, sent: [...recent.slice(0, index), ...recent.slice(index + 1)] };
}
```

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: PASS.

- [ ] **Step 3: Implement `LaserSurface`**

`packages/ui/src/slides/live/laser-surface.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { LivePointer } from "@repo/types";
import { LASER_IDLE_MS, LASER_MIN_INTERVAL_MS, normalizedPoint } from "./laser";
import { PointerLayer } from "./pointer-layer";

/**
 * Covers the canvas (render it in the `overlay` slot) while the laser is on:
 * shows the dot locally and reports its position, at most ~30 times a second.
 * Hides after 2 s idle or when the mouse leaves. Clicks still reach the stage
 * underneath (they bubble), so click-to-navigate keeps working.
 */
export function LaserSurface({ onMove }: { onMove: (x: number, y: number, visible: boolean) => void }) {
  const [local, setLocal] = useState<LivePointer | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const lastPoint = useRef({ x: 0.5, y: 0.5 });
  const lastSentAt = useRef(0);
  const visible = useRef(false);
  const idleTimer = useRef<number | null>(null);

  const hide = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (!visible.current) return;
    visible.current = false;
    setLocal({ ...lastPoint.current, visible: false });
    onMoveRef.current(lastPoint.current.x, lastPoint.current.y, false);
  };

  // Laser switched off (unmount): the audience must not keep a frozen dot.
  useEffect(() => hide, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const point = normalizedPoint(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    lastPoint.current = point;
    setLocal({ ...point, visible: true });

    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(hide, LASER_IDLE_MS);

    const now = performance.now();
    const becameVisible = !visible.current;
    if (becameVisible || now - lastSentAt.current >= LASER_MIN_INTERVAL_MS) {
      visible.current = true;
      lastSentAt.current = now;
      onMoveRef.current(point.x, point.y, true);
    }
  };

  return (
    <div className="absolute inset-0 cursor-none" onMouseMove={handleMove} onMouseLeave={hide}>
      <PointerLayer pointer={local} />
    </div>
  );
}
```

- [ ] **Step 4: Implement `LivePresenterPanel`**

`packages/ui/src/slides/live/live-presenter-panel.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { REACTION_KINDS, type LiveClientState, type PresenterControls } from "@repo/types";
import { formatElapsed } from "../navigation";
import { REACTION_EMOJI } from "./emoji";
import { ReactionsLayer } from "./reactions-layer";

/** The live block of the presenter view: badge, audience, reactions and the two toggles. */
export function LivePresenterPanel({
  live,
  controls,
  laser,
}: {
  live: LiveClientState;
  controls: PresenterControls;
  laser?: { on: boolean; toggle: () => void };
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!live.isLive) {
    return (
      <div className="rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant">
        Fora do ar. Inicie a transmissão na janela dos slides ("Iniciar ao vivo").
      </div>
    );
  }

  const elapsed = live.startedAt ? Math.max(0, now - new Date(live.startedAt).getTime()) : 0;
  const toggle = "flex items-center gap-2 text-sm text-on-surface";

  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-container p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
          AO VIVO
          <span className="font-code font-normal tabular-nums text-on-surface-variant">{formatElapsed(elapsed)}</span>
        </span>
        <span className="font-code text-sm tabular-nums text-on-surface-variant">
          👁 {live.viewerCount ?? 0} agora · pico {live.peakViewers ?? 0}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 font-code text-sm tabular-nums">
        {REACTION_KINDS.map((kind) => (
          <span key={kind} title={kind}>
            {REACTION_EMOJI[kind]} {live.reactionTotals[kind]}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <label className={toggle}>
          <input
            type="checkbox"
            checked={live.showViewerCount}
            onChange={(e) => controls.setOptions({ showViewerCount: e.target.checked })}
          />
          Mostrar contador ao público
        </label>
        <label className={toggle}>
          <input
            type="checkbox"
            checked={live.showReactionsOnScreen}
            onChange={(e) => controls.setOptions({ showReactionsOnScreen: e.target.checked })}
          />
          Reações na tela projetada (R)
        </label>
        {laser && (
          <label className={toggle}>
            <input type="checkbox" checked={laser.on} onChange={laser.toggle} />
            Laser (L)
          </label>
        )}
      </div>

      <ReactionsLayer lastReactions={live.lastReactions} fontSize={28} />
    </div>
  );
}
```

- [ ] **Step 5: Implement `LivePresenterPlayer`**

`packages/ui/src/slides/live/live-presenter-player.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveClientState, PresenterControls } from "@repo/types";
import type { PlayerSlide } from "../navigation";
import { PresentationPlayer } from "../player";
import type { SlideContext } from "../slide-renderer";
import { LaserSurface } from "./laser-surface";
import { PointerLayer } from "./pointer-layer";
import { ReactionsLayer } from "./reactions-layer";
import { absorbEcho, type SentSlide } from "./remote-slide";

const isTyping = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  return !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
};

/**
 * The projected screen of a presenter (CMS `/apresentar/[id]` and the presenter
 * link page): the 3a player plus "Iniciar ao vivo", slide broadcasting, the
 * laser and on-screen reactions.
 */
export function LivePresenterPlayer({
  presentationId,
  slides,
  context,
  presenterHref,
  isPublic,
  live,
  controls,
}: {
  presentationId: string;
  slides: PlayerSlide[];
  context?: SlideContext;
  presenterHref?: string;
  /** Only PUBLIC presentations can go live. */
  isPublic: boolean;
  live: LiveClientState;
  controls: PresenterControls;
}) {
  const [laserOn, setLaserOn] = useState(false);
  const [followSlideId, setFollowSlideId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const liveRef = useRef(live);
  liveRef.current = live;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const currentSlide = useRef<PlayerSlide | null>(null);
  const sent = useRef<SentSlide[]>([]);
  const firstReport = useRef(true);
  /** This window should keep the session alive (re-assert after a backend restart). */
  const wantLive = useRef(false);

  // A slide change from the server: another controller's command, or our own echo.
  useEffect(() => {
    if (!live.isLive || !live.slideId) return;
    const result = absorbEcho(live.slideId, sent.current, Date.now());
    sent.current = result.sent;
    if (result.apply) setFollowSlideId(live.slideId);
  }, [live.isLive, live.slideId]);

  useEffect(() => {
    if (live.isLive) wantLive.current = true;
  }, [live.isLive]);

  // Someone ended the session on purpose: do not resurrect it.
  useEffect(() => {
    wantLive.current = false;
  }, [live.endedSeq]);

  // The backend lost the session (restart): the presenter is the source of truth.
  useEffect(() => {
    if (live.lostSeq === 0 || !wantLive.current || !currentSlide.current) return;
    void controlsRef.current.start(currentSlide.current.id).catch(() => {});
  }, [live.lostSeq]);

  const handleSlideChange = (_index: number, slide: PlayerSlide) => {
    currentSlide.current = slide;
    // Local navigation releases the follow target, so the same remote slide can be applied again later.
    setFollowSlideId((target) => (target === slide.id ? target : null));

    // The slide the page opened on is not a command: a reloaded presenter adopts the live slide instead.
    if (firstReport.current) {
      firstReport.current = false;
      return;
    }
    const current = liveRef.current;
    if (!current.isLive || slide.id === current.slideId) return;
    sent.current = [...sent.current, { id: slide.id, at: Date.now() }];
    controlsRef.current.setSlide(slide.id);
  };

  const toggleLive = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (liveRef.current.isLive) {
        wantLive.current = false;
        await controls.stop();
      } else if (currentSlide.current) {
        await controls.start(currentSlide.current.id);
        wantLive.current = true;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a transmissão");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.key === "l" || event.key === "L") setLaserOn((on) => !on);
      if ((event.key === "r" || event.key === "R") && liveRef.current.isLive) {
        controlsRef.current.setOptions({ showReactionsOnScreen: !liveRef.current.showReactionsOnScreen });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const button = "rounded px-2 py-1 hover:bg-surface-container-high disabled:opacity-50";
  const toolbar = (
    <>
      {live.isLive && (
        <span className="flex items-center gap-2 font-bold" title="Espectadores agora">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
          AO VIVO · 👁 {live.viewerCount ?? 0}
        </span>
      )}
      <button
        type="button"
        onClick={toggleLive}
        disabled={busy || (!isPublic && !live.isLive)}
        className={button}
        title={isPublic ? "Transmitir slide, laser e reações para o link público" : "Torne a apresentação pública para transmitir"}
      >
        {live.isLive ? "Encerrar" : "Iniciar ao vivo"}
      </button>
      {live.isLive && (
        <button type="button" onClick={() => setLaserOn((on) => !on)} className={button} title="Laser (L)">
          {laserOn ? "Laser ligado" : "Laser"}
        </button>
      )}
      {error && <span className="text-error">{error}</span>}
    </>
  );

  const overlay = live.isLive ? (
    <>
      {/* With the laser on, this window draws its own dot; otherwise it mirrors the other controller's. */}
      {laserOn ? <LaserSurface onMove={controls.movePointer} /> : <PointerLayer pointer={live.pointer} />}
      {live.showReactionsOnScreen && <ReactionsLayer lastReactions={live.lastReactions} />}
    </>
  ) : undefined;

  return (
    <PresentationPlayer
      presentationId={presentationId}
      slides={slides}
      context={context}
      presenterHref={presenterHref}
      onSlideChange={handleSlideChange}
      followSlideId={followSlideId}
      toolbar={toolbar}
      overlay={overlay}
    />
  );
}
```

- [ ] **Step 6: Extend `PresenterView` and add `LivePresenterView`**

`packages/ui/src/slides/presenter-view.tsx`:
- change the React import to `import { useEffect, useMemo, useState, type ReactNode } from "react";`
- add to `PresenterViewProps`:
```ts
  /** Live block shown above the notes (3b). */
  livePanel?: ReactNode;
  /** Rendered over the current-slide preview (laser). */
  overlay?: ReactNode;
```
- destructure `livePanel, overlay` in the component signature
- pass the overlay to the **current** slide only: change its renderer to
```tsx
            <SlideRenderer template={current.template} content={current.content} slideNumber={index + 1} context={context} overlay={overlay} />
```
- in the `<aside>`, add as its first child: `{livePanel}`

`packages/ui/src/slides/live/live-presenter-view.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { LiveClientState, PresenterControls } from "@repo/types";
import type { PlayerSlide } from "../navigation";
import { PresenterView } from "../presenter-view";
import type { SlideContext } from "../slide-renderer";
import { LaserSurface } from "./laser-surface";
import { LivePresenterPanel } from "./live-presenter-panel";
import { PointerLayer } from "./pointer-layer";

/**
 * The presenter window (opened with `P`): the 3a presenter view plus the live
 * panel and a laser on the current-slide preview. Slide changes travel to the
 * player window over BroadcastChannel; that window broadcasts them.
 */
export function LivePresenterView({
  presentationId,
  title,
  slides,
  context,
  live,
  controls,
}: {
  presentationId: string;
  title: string;
  slides: PlayerSlide[];
  context?: SlideContext;
  live: LiveClientState;
  controls: PresenterControls;
}) {
  const [laserOn, setLaserOn] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "l" || event.key === "L") setLaserOn((on) => !on);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const overlay = live.isLive ? (
    laserOn ? <LaserSurface onMove={controls.movePointer} /> : <PointerLayer pointer={live.pointer} />
  ) : undefined;

  return (
    <PresenterView
      presentationId={presentationId}
      title={title}
      slides={slides}
      context={context}
      overlay={overlay}
      livePanel={
        <LivePresenterPanel
          live={live}
          controls={controls}
          laser={{ on: laserOn, toggle: () => setLaserOn((on) => !on) }}
        />
      }
    />
  );
}
```

`packages/ui/src/slides/live/index.ts`: add
```ts
export * from "./laser";
export * from "./remote-slide";
export * from "./laser-surface";
export * from "./live-presenter-panel";
export * from "./live-presenter-player";
export * from "./live-presenter-view";
```

- [ ] **Step 7: Verify**

Run: `dcr cms pnpm --filter @repo/ui test` — Expected: PASS.
Run: `dcr cms pnpm --filter cms exec tsc --noEmit && dcr landing pnpm --filter landing exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/slides
git commit -m "feat(ui): add the live presenter player, panel and laser surface

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: CMS: live presenter pages and presenter links panel

**Files:**
- Modify: `apps/cms/app/apresentar/[id]/page.tsx`, `apps/cms/app/apresentar/[id]/apresentador/page.tsx`, `apps/cms/components/presentations/presentation-header.tsx`
- Create: `apps/cms/components/presentations/presenter-links-panel.tsx`

**Interfaces:**
- Consumes: `useLiveSession`, `usePresenterControls`, `useQuery`, `useMutation` (`@repo/graphql/react`, Tasks 8–9); `GET_PRESENTER_LINKS`, `CREATE_PRESENTER_LINK`, `REVOKE_PRESENTER_LINK` (Task 8); `LivePresenterPlayer`, `LivePresenterView` (Task 11); `useDeck` (3a Task 18); `apiKeyStatus`, `relativeTime` (`apps/cms/lib`, 3a Task 14 — a presenter link has the same `expiresAt` / `revokedAt` fields as an API key); `inputClass` (`components/presentations/field-input`, 3a Task 16); `PresenterLink`, `PresenterLinkExpiry`, `Presentation` (`@repo/types`).
- Produces: the CMS player and presenter window broadcast live; `PresenterLinksPanel({ presentationId })` in the editor header. The root layout already passes `live` to `ApolloWrapper` (Task 8), so the JWT cookie is sent in the socket's `connectionParams`.

- [ ] **Step 1: Make the player page live**

Replace `apps/cms/app/apresentar/[id]/page.tsx` with:
```tsx
"use client";

import { useParams } from "next/navigation";
import { useLiveSession, usePresenterControls } from "@repo/graphql/react";
import type { Presentation } from "@repo/types";
import { LivePresenterPlayer, type PlayerSlide, type SlideContext } from "@repo/ui";
import { useDeck } from "../../../components/presentations/use-deck";

// Hooks cannot run before the deck is loaded, hence the inner component.
function LiveDeck({
  presentation,
  slides,
  context,
}: {
  presentation: Presentation;
  slides: PlayerSlide[];
  context: SlideContext;
}) {
  const isPublic = presentation.visibility === "PUBLIC";
  // Presenters poll every 5 s: after a backend restart the session is re-asserted quickly.
  const live = useLiveSession(isPublic ? presentation.slug : null, { pollMs: 5000 });
  const controls = usePresenterControls(presentation.id);
  return (
    <LivePresenterPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      presenterHref={`/apresentar/${presentation.id}/apresentador`}
      isPublic={isPublic}
      live={live}
      controls={controls}
    />
  );
}

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return <LiveDeck presentation={presentation} slides={slides} context={context} />;
}
```

- [ ] **Step 2: Make the presenter window live**

Replace `apps/cms/app/apresentar/[id]/apresentador/page.tsx` with:
```tsx
"use client";

import { useParams } from "next/navigation";
import { useLiveSession, usePresenterControls } from "@repo/graphql/react";
import type { Presentation } from "@repo/types";
import { LivePresenterView, type PlayerSlide, type SlideContext } from "@repo/ui";
import { useDeck } from "../../../../components/presentations/use-deck";

function LiveView({
  presentation,
  slides,
  context,
}: {
  presentation: Presentation;
  slides: PlayerSlide[];
  context: SlideContext;
}) {
  const live = useLiveSession(presentation.visibility === "PUBLIC" ? presentation.slug : null, { pollMs: 5000 });
  const controls = usePresenterControls(presentation.id);
  return (
    <LivePresenterView
      presentationId={presentation.id}
      title={presentation.title}
      slides={slides}
      context={context}
      live={live}
      controls={controls}
    />
  );
}

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return <LiveView presentation={presentation} slides={slides} context={context} />;
}
```

- [ ] **Step 3: Build the presenter links panel**

Create `apps/cms/components/presentations/presenter-links-panel.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@repo/graphql/react";
import { CREATE_PRESENTER_LINK, GET_PRESENTER_LINKS, REVOKE_PRESENTER_LINK } from "@repo/graphql";
import type { PresenterLink, PresenterLinkExpiry } from "@repo/types";
import { apiKeyStatus, type ApiKeyStatus } from "../../lib/api-key-status";
import { relativeTime } from "../../lib/relative-time";
import { inputClass } from "./field-input";

const EXPIRY_OPTIONS: { value: PresenterLinkExpiry; label: string }[] = [
  { value: "TWO_HOURS", label: "2 horas" },
  { value: "TWELVE_HOURS", label: "12 horas" },
  { value: "ONE_DAY", label: "24 horas" },
  { value: "SEVEN_DAYS", label: "7 dias" },
];

// A presenter link has the same expiry/revocation fields as an API key.
const STATUS_LABEL: Record<ApiKeyStatus, string> = { active: "Ativo", expired: "Expirado", revoked: "Revogado" };
const STATUS_CLASS: Record<ApiKeyStatus, string> = {
  active: "bg-secondary/20 text-secondary",
  expired: "bg-surface-container-high text-on-surface-variant",
  revoked: "bg-error/20 text-error",
};

/**
 * "Links de apresentador": temporary URLs that open this presentation, with its
 * notes and live controls, on a machine without a CMS session.
 */
export function PresenterLinksPanel({ presentationId }: { presentationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
      >
        Links de apresentador
      </button>
      {open && <PresenterLinksModal presentationId={presentationId} onClose={() => setOpen(false)} />}
    </>
  );
}

function PresenterLinksModal({ presentationId, onClose }: { presentationId: string; onClose: () => void }) {
  const variables = { presentationId };
  const refetchQueries = [{ query: GET_PRESENTER_LINKS, variables }];
  const { data, loading } = useQuery<{ presenterLinks: PresenterLink[] }>(GET_PRESENTER_LINKS, {
    variables,
    fetchPolicy: "cache-and-network",
  });
  const [createLink, { loading: creating }] = useMutation<{
    createPresenterLink: { url: string; presenterLink: PresenterLink };
  }>(CREATE_PRESENTER_LINK, { refetchQueries });
  const [revokeLink] = useMutation(REVOKE_PRESENTER_LINK, { refetchQueries });

  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<PresenterLinkExpiry>("TWO_HOURS");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const links = data?.presenterLinks ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await createLink({ variables: { presentationId, name: name.trim(), expiresIn } });
      if (result.data?.createPresenterLink) {
        setUrl(result.data.createPresenterLink.url);
        setCopied(false);
        setName("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar o link");
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const handleRevoke = async (link: PresenterLink) => {
    if (!confirm(`Revogar o link "${link.name}"? Quem estiver usando é desconectado na hora.`)) return;
    try {
      await revokeLink({ variables: { id: link.id } });
    } catch (err) {
      console.error("Failed to revoke", err);
      alert("Não foi possível revogar o link.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl space-y-5 rounded-xl border border-outline-variant bg-surface-container p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Links de apresentador</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Abre esta apresentação — com anotações e controles ao vivo — em outro computador, sem login.
              O link não permite editar nada.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            Fechar
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block font-label text-xs text-on-surface-variant">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Notebook do evento"
              maxLength={80}
              required
              className={inputClass}
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block font-label text-xs text-on-surface-variant">Expira em</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value as PresenterLinkExpiry)}
              className={inputClass}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            Gerar link
          </button>
        </form>
        {error && <p className="text-sm text-error">{error}</p>}

        {url && (
          <div className="space-y-2 rounded-lg border border-secondary/40 bg-surface-container-high p-4">
            <p className="text-sm font-bold text-on-surface">Copie agora: este link não será mostrado de novo.</p>
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputClass} font-code text-xs`} />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-on-secondary"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {loading && links.length === 0 ? (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        ) : links.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhum link gerado para esta apresentação.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-on-surface-variant">
              <tr>
                <th className="py-2 font-label">Nome</th>
                <th className="py-2 font-label">Link</th>
                <th className="py-2 font-label">Expira</th>
                <th className="py-2 font-label">Último uso</th>
                <th className="py-2 font-label">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const status = apiKeyStatus(link);
                return (
                  <tr key={link.id} className="border-t border-outline-variant">
                    <td className="py-2 text-on-surface">{link.name}</td>
                    <td className="py-2 font-code text-on-surface-variant">eip_{link.prefix}…</td>
                    <td className="py-2 text-on-surface-variant">{relativeTime(link.expiresAt)}</td>
                    <td className="py-2 text-on-surface-variant">
                      {link.lastUsedAt ? relativeTime(link.lastUsedAt) : "nunca"}
                    </td>
                    <td className="py-2">
                      <span className={`rounded px-2 py-1 text-xs font-bold ${STATUS_CLASS[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {status === "active" && (
                        <button type="button" onClick={() => handleRevoke(link)} className="text-sm text-error hover:underline">
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

`apps/cms/components/presentations/presentation-header.tsx`: add `import { PresenterLinksPanel } from "./presenter-links-panel";` and, inside `<div className="flex gap-2 ml-auto">`, right after the `PDF` link:
```tsx
          <PresenterLinksPanel presentationId={presentation.id} />
```

- [ ] **Step 4: Verify in the browser**

Run: `dcr cms pnpm --filter cms exec tsc --noEmit` — Expected: no errors. `dcr cms pnpm --filter cms test` — Expected: PASS (3a helpers untouched).

With `docker compose -f docker-compose.dev.yml up -d`, logged in at `http://localhost:4051`:
1. Open a **Privado** deck in `/apresentar/<id>`: the toolbar shows "Iniciar ao vivo" disabled, with the hint "Torne a apresentação pública para transmitir". Network → WS shows no socket.
2. Make the deck **Público**, reload `/apresentar/<id>`: a socket to `ws://localhost:4050/graphql` opens (its first frame, `connection_init`, carries `authorization` and `viewerId`). Click "Iniciar ao vivo": the toolbar shows "AO VIVO · 👁 0" and "Encerrar".
3. Check from a terminal that the session exists and follows the slide (replace `<slug>`):
   `curl -s http://localhost:4050/graphql -H 'content-type: application/json' -d '{"query":"{ liveState(slug: \"<slug>\") { isLive slideId } }"}'` → `"isLive":true`; press → in the player and run it again: `slideId` changed.
4. Press `P`: the presenter window shows the live panel (badge, elapsed time, "👁 0 agora · pico 0", six reaction totals, the two toggles and "Laser (L)"). Press `L` in the player and move the mouse over the slide: an orange dot follows it and disappears after 2 s without movement.
5. Restart the backend (`docker compose -f docker-compose.dev.yml restart backend`): within ~10 s after it is back, the `curl` of item 3 answers `"isLive":true` again without touching the player.
6. Editor → "Links de apresentador": generate "Teste" (2 horas); the URL `http://localhost:4052/apresentacoes/controle#t=eip_…` is shown once with "Copiar"; the list shows `eip_xxxxxxxx…` Ativo; "Revogar" turns it Revogado.

- [ ] **Step 5: Commit**

```bash
git add apps/cms/app/apresentar apps/cms/components/presentations
git commit -m "feat(cms): present live and manage presenter links

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Landing: live viewer on `/apresentacoes/[slug]`

**Files:**
- Modify: `apps/landing/components/public-deck.tsx`

**Interfaces:**
- Consumes: `useLiveSession`, `useSendReaction` (Task 9); `followReducer`, `INITIAL_FOLLOW_STATE`, `showFollowButton`, `needsDeckRefresh`, `PointerLayer`, `ReactionsLayer`, `ReactionBar`, `LiveBadge`, `FollowButton`, `PresentationPlayer` with `followSlideId` / `chrome` / `overlay`, `visibleSlides` (Task 10, 3a Task 13); `usePublicDeck`, `PublicPrint` already in this file (3a Task 19). The landing's root layout already passes `live` to `ApolloWrapper` (Task 8): anonymous socket, `viewerId` only.
- Produces: the public page follows a live session. `PublicPrint` is unchanged.

- [ ] **Step 1: Rewrite `PublicDeck`**

In `apps/landing/components/public-deck.tsx`, replace the imports and the `PublicDeck` component (keep `usePublicDeck` and `PublicPrint` as they are):
```tsx
"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveSession, useQuery, useSendReaction } from "@repo/graphql/react";
import { GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import {
  FollowButton,
  INITIAL_FOLLOW_STATE,
  LiveBadge,
  PointerLayer,
  PresentationPlayer,
  PrintDeck,
  ReactionBar,
  ReactionsLayer,
  followReducer,
  needsDeckRefresh,
  showFollowButton,
  visibleSlides,
  type PlayerSlide,
  type SlideContext,
} from "@repo/ui";
```
```tsx
/**
 * Public player. When the presenter is live it follows their slide by default,
 * shows their laser and everyone's reactions; navigating by hand enters free
 * mode and "Seguir apresentador" brings the viewer back. Notes never reach
 * this page (the API strips them).
 */
export function PublicDeck({ presentation }: { presentation: Presentation }) {
  const router = useRouter();
  const { slides, context } = usePublicDeck(presentation);
  const live = useLiveSession(presentation.slug);
  const sendReaction = useSendReaction(presentation.slug);
  const [follow, dispatch] = useReducer(followReducer, INITIAL_FOLLOW_STATE);
  const [reactionsHidden, setReactionsHidden] = useState(false);
  const refreshedFor = useRef<string | null>(null);

  const presenterSlideId = live.isLive ? live.slideId : null;
  useEffect(() => {
    dispatch({ type: "presenter", slideId: presenterSlideId });
  }, [presenterSlideId]);

  // The presenter is on a slide added after this page loaded: fetch the deck
  // again (once per slide). Until it arrives the viewer simply stays put.
  const slideIds = useMemo(() => visibleSlides(slides).map((slide) => slide.id), [slides]);
  useEffect(() => {
    if (!needsDeckRefresh(presenterSlideId, slideIds)) return;
    if (refreshedFor.current === presenterSlideId) return;
    refreshedFor.current = presenterSlideId;
    router.refresh();
  }, [presenterSlideId, slideIds, router]);

  const onPresenterSlide = presenterSlideId !== null && follow.viewerSlideId === presenterSlideId;

  const overlay = live.isLive ? (
    <>
      {onPresenterSlide && <PointerLayer pointer={live.pointer} />}
      {!reactionsHidden && <ReactionsLayer lastReactions={live.lastReactions} />}
    </>
  ) : undefined;

  const chrome = live.isLive ? (
    <>
      <div className="absolute left-4 top-4">
        <LiveBadge viewerCount={live.showViewerCount ? live.viewerCount : null} />
      </div>
      {showFollowButton(follow) && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2">
          <FollowButton onClick={() => dispatch({ type: "follow" })} />
        </div>
      )}
      <ReactionBar
        onReact={sendReaction}
        hidden={reactionsHidden}
        onToggleHidden={() => setReactionsHidden((value) => !value)}
      />
    </>
  ) : undefined;

  return (
    <PresentationPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      onSlideChange={(_index, slide) => dispatch({ type: "viewer", slideId: slide.id })}
      followSlideId={follow.following ? presenterSlideId : null}
      overlay={overlay}
      chrome={chrome}
    />
  );
}
```

- [ ] **Step 2: Verify with two browsers**

Run: `dcr landing pnpm --filter landing exec tsc --noEmit` — Expected: no errors.

Browser A (logged in to the CMS): `http://localhost:4051/apresentar/<id>` of a **Público** deck with at least 4 slides. Browser B (a private window): `http://localhost:4052/apresentacoes/<slug>`.
1. Before going live, B is a normal deck: no badge, no reaction bar. Network → WS in B shows one socket with a `liveEvents` subscription.
2. A clicks "Iniciar ao vivo": B shows "AO VIVO" and "👁 1 assistindo" within ~2 s and jumps to A's slide. A's toolbar shows "👁 1".
3. A presses → three times: B changes slide each time, well under half a second.
4. B presses ←: B stays on its slide (free mode) and "Seguir apresentador" appears. A presses →: B does not move. B clicks the button: B jumps to A's slide and the button disappears. B presses → then ← (back onto A's slide): the button disappears again and B follows the next change.
5. A presses `L` and moves the mouse: B shows the orange dot moving smoothly; when B is on another slide the dot is not shown.
6. B clicks 🔥 a few times: the emoji floats up on B, on A's projected slide and in A's presenter window (`P`), where the 🔥 total grows. Clicking fast is throttled (some clicks produce nothing). "Ocultar reações" on B hides them on B only.
7. In A's presenter window, untick "Mostrar contador ao público": B's "👁 N assistindo" disappears; tick it: it returns. Untick "Reações na tela projetada" (or press `R` in the player): reactions stop floating on A's projected slide but still show on B.
8. In the CMS editor (another tab of A), add a slide at the end and navigate A's player to it (reload A's player first so it has the slide): B, which loaded the deck earlier, receives the new slide (the page refreshes its data) and follows.
9. A clicks "Encerrar": B's badge, bar and button disappear and B is a normal deck again, on the slide it was on.
10. A changes the deck to **Privado** while live (start again first): the session ends for B the same way.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/components/public-deck.tsx
git commit -m "feat(landing): follow the presenter live on public presentations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Landing: presenter link page `/apresentacoes/controle`

The link `…/apresentacoes/controle#t=eip_…` opens the same live player and presenter view as the CMS, on a machine with no CMS session. The token is read from the URL fragment, kept in `sessionStorage` (so a reload and the `P` popup work) and removed from the address bar.

**Files:**
- Create: `packages/graphql/src/client/errors.ts`; Test: `packages/graphql/src/client/errors.test.ts`; Modify: `packages/graphql/src/client/index.ts`
- Create: `apps/landing/components/presenter-link.tsx`
- Create: `apps/landing/app/apresentacoes/controle/layout.tsx`, `apps/landing/app/apresentacoes/controle/page.tsx`, `apps/landing/app/apresentacoes/controle/apresentador/page.tsx`

**Interfaces:**
- Consumes: `extractPresenterToken`, `PRESENTER_TOKEN_STORAGE_KEY`, `SOCKET_CLOSE_FORBIDDEN`, `createApolloClient({ live: { onClosed } })`, `GRAPHQL_URL`, `GET_PRESENTATION_FOR_PRESENTER`, `GET_SOCIAL_LINKS`, `getUploadUrl` (`@repo/graphql`, Task 8 and 3a); `ApolloProvider`, `useQuery`, `useLiveSession`, `usePresenterControls` (`@repo/graphql/react`); `LivePresenterPlayer`, `LivePresenterView` (Task 11). The slug `controle` is reserved by the backend (Task 2), so this static route shadows no presentation.
- Produces: `isUnauthenticatedError(error)` in `@repo/graphql`; `PresenterLinkProvider`, `PresenterLinkDeck({ view })`, `LinkGone` in the landing; routes `/apresentacoes/controle` and `/apresentacoes/controle/apresentador`.

- [ ] **Step 1: Write the failing test for the error helper**

`packages/graphql/src/client/errors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isUnauthenticatedError } from "./errors";

describe("isUnauthenticatedError", () => {
  it("recognises a GraphQL UNAUTHENTICATED error in Apollo's error shapes", () => {
    const graphQLError = { message: "Link revogado ou expirado", extensions: { code: "UNAUTHENTICATED" } };
    expect(isUnauthenticatedError({ errors: [graphQLError] })).toBe(true); // CombinedGraphQLErrors (Apollo 4)
    expect(isUnauthenticatedError({ graphQLErrors: [graphQLError] })).toBe(true); // ApolloError (Apollo 3)
  });
  it("does not mistake other failures for a dead link", () => {
    expect(isUnauthenticatedError(new Error("Failed to fetch"))).toBe(false);
    expect(isUnauthenticatedError({ errors: [{ message: "x", extensions: { code: "BAD_USER_INPUT" } }] })).toBe(false);
    expect(isUnauthenticatedError(undefined)).toBe(false);
    expect(isUnauthenticatedError(null)).toBe(false);
  });
});
```

Run: `dcr landing pnpm --filter @repo/graphql test`
Expected: FAIL — cannot resolve `./errors`.

- [ ] **Step 2: Implement it**

`packages/graphql/src/client/errors.ts`:
```ts
type GraphQLErrorLike = { extensions?: { code?: unknown } };

/**
 * True when the API refused the credential (expired/revoked key, link or
 * session). A network failure is not that: callers keep retrying instead of
 * telling the user their link is dead.
 */
export function isUnauthenticatedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { errors, graphQLErrors } = error as { errors?: unknown; graphQLErrors?: unknown };
  const list = Array.isArray(errors) ? errors : Array.isArray(graphQLErrors) ? graphQLErrors : [];
  return list.some((e: GraphQLErrorLike) => e?.extensions?.code === "UNAUTHENTICATED");
}
```
`packages/graphql/src/client/index.ts`: add `export * from "./errors";`

Run: `dcr landing pnpm --filter @repo/graphql test`
Expected: PASS.

- [ ] **Step 3: Build the provider and the deck component**

Create `apps/landing/components/presenter-link.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GET_PRESENTATION_FOR_PRESENTER,
  GET_SOCIAL_LINKS,
  GRAPHQL_URL,
  PRESENTER_TOKEN_STORAGE_KEY,
  SOCKET_CLOSE_FORBIDDEN,
  createApolloClient,
  extractPresenterToken,
  getUploadUrl,
  isUnauthenticatedError,
} from "@repo/graphql";
import { ApolloProvider, useLiveSession, usePresenterControls, useQuery } from "@repo/graphql/react";
import type { Presentation, SocialLink } from "@repo/types";
import { LivePresenterPlayer, LivePresenterView, type PlayerSlide, type SlideContext } from "@repo/ui";

/**
 * The token arrives in the URL fragment (never sent to a server). It is moved
 * to sessionStorage — so a reload and the presenter popup (which inherits a
 * copy of this tab's sessionStorage) keep working — and wiped from the address bar.
 */
function readPresenterToken(): string | null {
  const fromHash = extractPresenterToken(window.location.hash);
  if (fromHash) {
    try {
      sessionStorage.setItem(PRESENTER_TOKEN_STORAGE_KEY, fromHash);
    } catch {
      // Storage blocked: the token still works for this page load.
    }
    history.replaceState(null, "", window.location.pathname);
    return fromHash;
  }
  try {
    return sessionStorage.getItem(PRESENTER_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function LinkGone() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface-container-lowest p-8 text-center">
      <h1 className="font-headline text-3xl font-bold text-on-surface">Link revogado ou expirado</h1>
      <p className="max-w-md text-on-surface-variant">
        Peça um novo link de apresentador a quem compartilhou esta apresentação.
      </p>
    </div>
  );
}

/**
 * An Apollo client of its own, authenticated with the presenter link over HTTP
 * and over the socket. A 4403 close (link revoked or expired while the page is
 * open) replaces everything with the "gone" screen.
 */
export function PresenterLinkProvider({ children }: { children: ReactNode }) {
  // undefined = not read yet (first client render); null = no token.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [gone, setGone] = useState(false);

  useEffect(() => setToken(readPresenterToken()), []);

  const client = useMemo(
    () =>
      token
        ? createApolloClient({
            uri: GRAPHQL_URL,
            getToken: () => token,
            live: {
              onClosed: (code) => {
                if (code === SOCKET_CLOSE_FORBIDDEN) setGone(true);
              },
            },
          })
        : null,
    [token],
  );

  // Render nothing until the token left the address bar: the player writes the
  // slide number to the hash and must not see "#t=…".
  if (token === undefined) return null;
  if (!client || gone) return <LinkGone />;
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

function LiveDeck({
  presentation,
  slides,
  context,
  view,
}: {
  presentation: Presentation;
  slides: PlayerSlide[];
  context: SlideContext;
  view: "player" | "presenter";
}) {
  const isPublic = presentation.visibility === "PUBLIC";
  const live = useLiveSession(isPublic ? presentation.slug : null, { pollMs: 5000 });
  const controls = usePresenterControls(presentation.id);

  if (view === "presenter") {
    return (
      <LivePresenterView
        presentationId={presentation.id}
        title={presentation.title}
        slides={slides}
        context={context}
        live={live}
        controls={controls}
      />
    );
  }
  return (
    <LivePresenterPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      presenterHref="/apresentacoes/controle/apresentador"
      isPublic={isPublic}
      live={live}
      controls={controls}
    />
  );
}

/** The link's presentation, as the projected player or as the presenter window. */
export function PresenterLinkDeck({ view }: { view: "player" | "presenter" }) {
  // Polled: a revoked or expired link is noticed even on a private deck, which
  // opens no socket; and edits made in the CMS reach this machine.
  const { data, error } = useQuery<{ presentationForPresenter: Presentation }>(GET_PRESENTATION_FOR_PRESENTER, {
    fetchPolicy: "network-only",
    pollInterval: 30_000,
  });
  const { data: social } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);

  const presentation = data?.presentationForPresenter ?? null;
  const slides = useMemo<PlayerSlide[]>(
    () =>
      [...(presentation?.slides ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, template: s.template, content: s.content, notes: s.notes, hidden: s.hidden })),
    [presentation],
  );
  const context = useMemo<SlideContext>(
    () => ({
      socialLinks: [...(social?.socialLinks ?? [])].sort((a, b) => a.order - b.order),
      resolveUrl: (url) => getUploadUrl(url),
    }),
    [social],
  );

  if (isUnauthenticatedError(error)) return <LinkGone />;
  if (!presentation) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-container-lowest text-on-surface-variant">
        {error ? "Não foi possível carregar a apresentação. Tentando de novo…" : "Carregando…"}
      </div>
    );
  }
  return <LiveDeck presentation={presentation} slides={slides} context={context} view={view} />;
}
```

- [ ] **Step 4: Add the routes**

Create `apps/landing/app/apresentacoes/controle/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { PresenterLinkProvider } from "../../../components/presenter-link";

// A private control page: never indexed, and no Referer header leaves it.
export const metadata: Metadata = {
  title: "Controle da apresentação | Engenharia Inversa",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PresenterLinkLayout({ children }: { children: React.ReactNode }) {
  return <PresenterLinkProvider>{children}</PresenterLinkProvider>;
}
```

Create `apps/landing/app/apresentacoes/controle/page.tsx`:
```tsx
"use client";

import { PresenterLinkDeck } from "../../../components/presenter-link";

export default function PresenterLinkPage() {
  return <PresenterLinkDeck view="player" />;
}
```

Create `apps/landing/app/apresentacoes/controle/apresentador/page.tsx`:
```tsx
"use client";

import { PresenterLinkDeck } from "../../../../components/presenter-link";

export default function PresenterLinkPresenterPage() {
  return <PresenterLinkDeck view="presenter" />;
}
```

- [ ] **Step 5: Verify on a browser without a CMS session**

Run: `dcr landing pnpm --filter landing exec tsc --noEmit` — Expected: no errors.

In the CMS (browser A), generate a presenter link for a **Público** deck and another for a **Privado** deck. In a private window (browser B, no CMS cookie):
1. Open the public deck's link: the deck plays; the address bar shows `…/apresentacoes/controle#1` (no token); reloading keeps working; the HTML source of the page (`view-source:`) contains no `eip_`.
2. `http://localhost:4052/apresentacoes/controle` in a **fresh** private window (no token): "Link revogado ou expirado".
3. B clicks "Iniciar ao vivo": a third browser on `http://localhost:4052/apresentacoes/<slug>` follows B's slides, laser (`L`) and sees reactions. A's CMS player (`/apresentar/<id>`) follows B's slide changes too, and B follows A's: last command wins, and pressing → twice quickly on either side never jumps back.
4. B presses `P`: the presenter window opens at `/apresentacoes/controle/apresentador#N` with notes, the next slide and the live panel.
5. Open the private deck's link in B: it plays with notes in the presenter window; "Iniciar ao vivo" is disabled.
6. While B is live with the public link, A revokes it in the editor: B switches to "Link revogado ou expirado" within a second (socket closed with 4403), and does not come back on reload. The session itself stays live under A's control.
7. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4052/apresentacoes/controle` → `200`, and the deck with the generated slug `controle-2` (create a presentation titled "Controle" in the CMS) opens at `/apresentacoes/controle-2`.

- [ ] **Step 6: Commit**

```bash
git add packages/graphql/src/client apps/landing/components/presenter-link.tsx apps/landing/app/apresentacoes/controle
git commit -m "feat(landing): add the presenter link page at /apresentacoes/controle

The token is read from the URL fragment, kept in sessionStorage and wiped
from the address bar. A revoked or expired link shows a full-screen notice.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Production websocket checklist and final verification

The Engenharia Inversa runs on a different server from the development machine. This task documents the manual steps for **that** server (spec §5) and closes the plan with the full test run and the two-machine checklist. Nothing here changes local infrastructure.

**Files:**
- Create: `docs/infra/websockets.md`
- Modify: `CLAUDE.md` (Deploy section)

**Interfaces:**
- Consumes: everything above; the `test` job of `.github/workflows/deploy.yml` (3a Task 20) already runs `pnpm turbo run test`, which now includes the live suites and `@repo/graphql`'s tests.
- Produces: the production checklist; no code.

- [ ] **Step 1: Write the infrastructure checklist**

Create `docs/infra/websockets.md`:
````markdown
# Websockets in production (live presentations)

Live sessions (EI-3b) use GraphQL subscriptions over a websocket on the backend's
existing `/graphql` endpoint. These are **manual steps on the production server**, done
once, **before** deploying the first version that contains EI-3b. Design:
`docs/superpowers/specs/2026-10-01-ei-3b-presentations-live-design.md`.

## 1. nginx

In the `http` block (once per server):

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
```

In the `location` that proxies the backend's `/graphql` (API hostname):

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Then `nginx -t && nginx -s reload` (or the container equivalent).

`CF-Connecting-IP` matters: the backend caps each IP at 10 concurrent sockets. Without
the header every visitor appears to come from the proxy's address and the 11th viewer is
refused (close code `4429`).

## 2. Cloudflare

Zone → **Network → WebSockets**: enabled. The Tunnel forwards the upgrade; no ingress
change is needed when the API hostname already points at nginx.

## 3. Backend environment

- `CORS_ORIGINS` (set in `docker-compose.yml`) must list the landing and CMS origins:
  the socket's `Origin` is checked against it.
- `LANDING_URL` (set in `docker-compose.yml`) is the base of presenter link URLs.

Neither is a secret; no GitHub secret changes.

## 4. Reserved slug

`/apresentacoes/controle` is the presenter link page. Before the first deploy, make sure
no presentation created under EI-3a uses that slug:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, title FROM presentations WHERE slug = 'controle';"
```

Rename it in the CMS if a row comes back (new presentations can no longer take it).

## 5. Verify from outside, after deploying

```bash
npx wscat -c wss://<api-host>/graphql -s graphql-transport-ws
> {"type":"connection_init"}
< {"type":"connection_ack"}
```

A `connection_ack` proves nginx, Cloudflare and the backend agree. Then leave the socket
idle for 3 minutes: it must stay open (the server pings every 12 s, under Cloudflare's
~100 s idle timeout).

## Limits to keep in mind

- **One backend instance.** Sessions, viewers and reactions live in memory. A restart
  drops them; the presenter's player re-creates the session within a few seconds.
  Scaling out needs a Redis PubSub and the session map moved out of process.
- Every viewer of a public presentation holds a socket while the page is open, live or
  not. The per-IP cap and the keepalive bound it; revisit if traffic grows.
````

`CLAUDE.md` — at the end of the `## Deploy` section, add:
```markdown

Live presentations use GraphQL subscriptions over a websocket on the backend's
`/graphql`. The nginx and Cloudflare requirements of the production server are in
`docs/infra/websockets.md`; live state is in memory, so the backend runs as a single
instance.
```

- [ ] **Step 2: Run every test suite**

Run: `docker compose -f docker-compose.dev.yml up -d`, then `dcx backend sh -c "pnpm turbo run test"`
Expected: `@repo/slides`, `@repo/ui`, `@repo/graphql`, `cms` and `backend` all PASS.

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color .github/workflows/deploy.yml`
Expected: no output (the workflow is unchanged; the `test` job picks the new suites up through turbo).

Run the three production image builds, as in 3a Task 3 Step 7 (new dependencies must install in the production `deps` stage):
`docker build --target backend -t ei-backend-check . && docker build --target cms --build-arg NEXT_PUBLIC_API_URL=http://localhost:4050 --build-arg NEXT_PUBLIC_GRAPHQL_PATH=/graphql -t ei-cms-check . && docker build --target landing --build-arg NEXT_PUBLIC_API_URL=http://localhost:4050 --build-arg NEXT_PUBLIC_GRAPHQL_PATH=/graphql -t ei-landing-check .`
Expected: all three succeed. Then `docker image rm ei-backend-check ei-cms-check ei-landing-check`.

- [ ] **Step 3: Final manual checklist (spec §6) — two browsers, ideally two machines**

With the dev stack up, presenter on `http://localhost:4051/apresentar/<id>` (a **Público** deck), viewer on `http://localhost:4052/apresentacoes/<slug>`:

- [ ] Follow: the viewer's slide changes within ~300 ms of the presenter's.
- [ ] Free mode: manual navigation on the viewer stops following; "Seguir apresentador" appears exactly while the slides differ and disappears when they match.
- [ ] Pointer: `L` on the presenter shows a smooth dot on the viewer; it hides after 2 s idle and when the mouse leaves the slide; it is never left frozen on screen.
- [ ] Viewer count: two tabs of one browser count once; a second browser counts twice; the presenter's own windows are not counted; the audience toggle hides and shows the counter.
- [ ] Reactions: visible on the viewer, in the presenter window (with totals) and on the projected slide; `R` hides them on the projected slide only; clicking fast is throttled.
- [ ] Presenter link on a browser without a CMS session: plays, shows notes in the presenter window, controls the live session; CMS and link stay in sync.
- [ ] Revoking the link mid-session: its page shows "Link revogado ou expirado" immediately; the audience keeps watching.
- [ ] Backend restart mid-session (`docker compose -f docker-compose.dev.yml restart backend`): viewers reconnect by themselves and the session is live again within ~10 s without touching the presenter's page.
- [ ] Private deck: "Iniciar ao vivo" disabled; making a live deck private ends the session for the audience.
- [ ] `http://localhost:4052/` (home) and a public deck that is not live look and behave exactly as before 3b.

- [ ] **Step 4: Commit**

```bash
git add docs/infra/websockets.md CLAUDE.md
git commit -m "docs: add the production websocket checklist for live presentations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
