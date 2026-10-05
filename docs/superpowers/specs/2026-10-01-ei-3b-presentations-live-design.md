# Design Document: Presentations — Live Sessions (EI-3b)

Card: **EI-3** · Sub-project **3b** of 2. Depends on 3a
([`2026-10-01-ei-3a-presentations-authoring-design.md`](2026-10-01-ei-3a-presentations-authoring-design.md)),
which must be in production first.

## 1. Summary

When Pedro presents a `PUBLIC` presentation — online over a screen share or in person
on a projector — the audience can open the public link and **follow along in real
time**: the current slide, his **laser pointer**, a **viewer count** and quick
**emoji reactions**. A **temporary, revocable presenter link** lets him run and control
a presentation from another computer without logging in.

### Goals

1. Live sessions started explicitly by the presenter; the public page follows the
   presenter's slide, with an escape to browse freely.
2. A laser pointer broadcast to followers.
3. Temporary presenter links (expiring, revocable, immediate effect).
4. Viewer count, visible to the presenter and optionally to the audience.
5. Emoji reactions from the audience, shown to the presenter and on the projected screen.

### Success criteria

- Two browsers (presenter + viewer): the viewer's slide changes within ~300 ms of the
  presenter's; the pointer moves smoothly; the "Seguir apresentador" button appears
  exactly when the slides differ.
- A presenter link works on a machine with no CMS session, and revoking it closes its
  socket and disables the page immediately.
- Reaction floods from one client are throttled; fan-out stays bounded by the server
  aggregation regardless of audience size.

### Non-goals (3b)

Chat, multiple backend instances (Redis PubSub), recording or replay, persisting live
history or reaction totals, live sessions on non-`PUBLIC` presentations.

---

## 2. Decision log

| # | Decision | Alternatives rejected |
|---|---|---|
| L1 | GraphQL Subscriptions over `graphql-ws`, enabled in the existing `GraphQLModule` | A separate socket.io gateway |
| L2 | Followers follow by default; manual navigation enters free mode; "Seguir apresentador" shows whenever the viewer's slide ≠ presenter's | Locked follow; free by default |
| L3 | Live state in memory, keyed by **slide id**; presenter is the source of truth and re-asserts state on reconnect | Persisting live state in Postgres |
| L4 | Presenter link lives on the **landing** with the token in the URL **fragment** | CMS route; token in the query string |
| L5 | Only `PUBLIC` presentations can go live | Live for private decks |
| L6 | Fixed reaction set (enum), rate-limited per socket, aggregated server-side | Free-text reactions; per-viewerId limits |
| L7 | Viewer count shown to the audience behind a presenter toggle (default on) | Always shown; presenter only |

### 2.1 State of subscriptions today

Subscriptions are **not** configured: `GraphQLModule.forRoot` in
`apps/backend/src/app.module.ts` has no `subscriptions` option, there is no
`@Subscription`, `PubSub` or websocket link. `graphql-ws` and
`subscriptions-transport-ws` appear in `pnpm-lock.yaml` only as transitive or optional
peer dependencies of `@nestjs/graphql` and `@apollo/client`. 3b enables what the stack
already supports; it does not build a parallel websocket server.

---

## 3. Backend

### 3.1 Enabling subscriptions

- Add `graphql-ws`, `ws` and `graphql-subscriptions` to `apps/backend/package.json`
  explicitly.
- `GraphQLModule.forRoot({ subscriptions: { "graphql-ws": { path: "/graphql",
  onConnect, onDisconnect } } })`.
- **Auth on sockets**: a websocket operation has no `req`, so the passport guards
  cannot read a header. `onConnect` reads `connectionParams.authorization`
  (`Bearer <JWT>`, `Bearer ei_…` or `Bearer eip_…`) and `connectionParams.viewerId`,
  validates the credential with the same services as the HTTP strategies, and stores
  `{ user?, authKind, presenterLinkId?, viewerId, socketId, ip }` in `ctx.extra`.
  An invalid credential rejects the connection; no credential is allowed (anonymous
  viewer). The module `context` function builds `req.user` / `req.authKind` from
  `ctx.extra` when the operation arrives over the socket, so `RolesGuard` and the
  existing guards keep working.
- `onConnect` checks `Origin` against `CORS_ORIGINS` (when set).
- `ip` comes from `CF-Connecting-IP`, falling back to `X-Forwarded-For`, then the
  socket address.
- `keepAlive`: 30 s (graphql-ws ping), below Cloudflare's ~100 s idle timeout.

### 3.2 `LiveSessionService` (in memory)

```ts
type LiveSession = {
  presentationId: string;
  slug: string;
  startedAt: Date;
  slideId: string;
  pointer: { x: number; y: number; visible: boolean } | null;
  showViewerCount: boolean;        // default true
  showReactionsOnScreen: boolean;  // default true
  viewers: Map<string /* viewerId */, Set<string /* socketId */>>;
  peakViewers: number;
  reactionTotals: Record<ReactionKind, number>;
};
```

- One `Map<presentationId, LiveSession>`; a `PubSub` from `graphql-subscriptions`;
  topic `live:<presentationId>`.
- `startLive` and `setLiveSlide` are idempotent. If the backend restarts mid-session,
  the presenter player reconnects and re-sends `startLive` + `setLiveSlide`.
- Slides are tracked by **id**, so reordering or hiding slides mid-session does not
  misalign anyone. If the current slide is deleted or hidden, followers stay where they
  are until the next `setLiveSlide`.
- `startLive` on a non-`PUBLIC` presentation fails with
  `"Torne a apresentação pública para transmitir"`. Turning a live presentation private
  or trashing it ends the session (`ENDED`).
- **Limit**: one backend instance, in-memory PubSub — matches production today. Scaling
  out requires a Redis PubSub and moving the session map out of process.

### 3.3 Presenter links

```prisma
model PresenterLink {
  id             String       @id @default(uuid())
  presentationId String       @map("presentation_id")
  presentation   Presentation @relation(fields: [presentationId], references: [id], onDelete: Cascade)
  name           String
  prefix         String
  hash           String       @unique // SHA-256 of "eip_…"
  createdById    String       @map("created_by_id")
  createdBy      User         @relation(fields: [createdById], references: [id])
  expiresAt      DateTime     @map("expires_at")
  lastUsedAt     DateTime?    @map("last_used_at")
  revokedAt      DateTime?    @map("revoked_at")
  createdAt      DateTime     @default(now()) @map("created_at")

  @@map("presenter_links")
}
```

Migration `add_presenter_links`. Token `eip_` + 32 random bytes base64url.

- **Scope**: read that one presentation in full (private included, with notes and
  hidden slides) and run the live controls for it. No edits, no other presentation.
- Accepted as `Authorization: Bearer eip_…` over HTTP (a `presenter-link` passport
  strategy, used by `presentationForPresenter` and the live mutations) and over the
  socket (`connectionParams`).
- Validated on **every** operation, not only at connect time.
- **Revocation / expiry**: `revokePresenterLink` marks `revokedAt` and closes every
  socket opened with that link (`LiveSessionService` keeps `presenterLinkId → sockets`)
  with close code `4403`. A timer closes sockets at `expiresAt`. The page shows
  "Link revogado ou expirado".

### 3.4 Viewer count

- A viewer is a distinct `viewerId` with an open `liveEvents` subscription. Each
  browser generates a random `viewerId` (`localStorage`, in-memory fallback) and sends
  it in `connectionParams`; two tabs of the same browser count once.
- Connections authenticated as presenter (JWT with `presentations:update` or a
  presenter link) are **not** counted.
- Increment on subscribe, decrement on `onComplete` / socket close; dead connections
  are dropped by the keepalive.
- `VIEWERS` events are coalesced to **at most one every 2 s** per session.
- `peakViewers` is kept for the presenter view.

### 3.5 Reactions

- `enum ReactionKind { CLAP FIRE MIND_BLOWN LAUGH HEART THINKING }` →
  👏 🔥 🤯 😂 ❤️ 🤔.
- `sendReaction(slug, kind)` — anonymous, over the socket, only while the session is
  live. Returns `false` (no error) when throttled or not live.
- **Rate limits** (per **socket**; `viewerId` is client-chosen and not trusted for this):
  token bucket of 1 per 300 ms with a burst of 10 per 5 s.
- **Connection cap**: at most 10 concurrent sockets per IP; the 11th is rejected in
  `onConnect` (close code `4429`).
- **Aggregation**: reactions are summed in 250 ms windows and published as
  `REACTIONS { counts }` — at most 4 events/s per session regardless of audience size.
- Totals live in the session and disappear when it ends.

### 3.6 Pointer

- `movePointer(presentationId, x, y, visible)`, `x`/`y` normalized `0..1` on the
  1920×1080 canvas, values clamped.
- Server drops pointer updates above 40/s per session; it only publishes, never writes
  to the database.

### 3.7 Contract

```graphql
enum LiveEventType { STARTED SLIDE POINTER VIEWERS REACTIONS OPTIONS ENDED }
enum ReactionKind { CLAP FIRE MIND_BLOWN LAUGH HEART THINKING }
enum PresenterLinkExpiry { TWO_HOURS TWELVE_HOURS ONE_DAY SEVEN_DAYS }

type LivePointer { x: Float!, y: Float!, visible: Boolean! }
type ReactionCount { kind: ReactionKind!, count: Int! }

type LiveState {
  isLive: Boolean!
  startedAt: DateTime
  slideId: ID
  showViewerCount: Boolean!
  showReactionsOnScreen: Boolean!
  viewerCount: Int        # null for anonymous readers when showViewerCount is false
}

type LiveEvent {
  type: LiveEventType!
  slideId: ID             # STARTED, SLIDE
  pointer: LivePointer    # POINTER
  viewerCount: Int        # VIEWERS (omitted for anonymous when hidden)
  reactions: [ReactionCount!]   # REACTIONS
  showViewerCount: Boolean       # OPTIONS
  showReactionsOnScreen: Boolean # OPTIONS
}

type PresenterLink { id: ID!, name: String!, prefix: String!, expiresAt: DateTime!,
                     lastUsedAt: DateTime, revokedAt: DateTime, createdAt: DateTime! }
type CreatedPresenterLink { presenterLink: PresenterLink!, url: String! }  # url only here

type Query {
  liveState(slug: String!): LiveState!                         # public (PUBLIC only)
  presentationForPresenter: Presentation!                      # presenter link only
  presenterLinks(presentationId: ID!): [PresenterLink!]!        # JWT only
}

type Mutation {
  # JWT (presentations:update) or presenter link of that presentation
  startLive(presentationId: ID!, slideId: ID!): LiveState!
  stopLive(presentationId: ID!): Boolean!
  setLiveSlide(presentationId: ID!, slideId: ID!): Boolean!
  movePointer(presentationId: ID!, x: Float!, y: Float!, visible: Boolean!): Boolean!
  setLiveOptions(presentationId: ID!, showViewerCount: Boolean,
                 showReactionsOnScreen: Boolean): LiveState!

  # anonymous
  sendReaction(slug: String!, kind: ReactionKind!): Boolean!

  # JWT only
  createPresenterLink(presentationId: ID!, name: String!,
                      expiresIn: PresenterLinkExpiry!): CreatedPresenterLink!
  revokePresenterLink(id: ID!): PresenterLink!
}

type Subscription {
  liveEvents(slug: String!): LiveEvent!   # public (PUBLIC only); presenters receive it too
}
```

Viewers call `liveState` on load and then keep `liveEvents` open for as long as the page
is open, so they notice a session that starts after they arrived.

---

## 4. Client

### 4.1 `@repo/graphql`

- Add `graphql-ws` explicitly. `createApolloClient` gains an optional websocket link:
  `split` sends **subscriptions and the operations `MovePointer` and `SendReaction`**
  over the socket and everything else over HTTP.
- The websocket URL is **derived** from `NEXT_PUBLIC_API_URL` (`http→ws`,
  `https→wss`) + `NEXT_PUBLIC_GRAPHQL_PATH`. No new secret or variable.
- `connectionParams` sends `authorization` (when available) and `viewerId`.
- Reconnect with backoff; a `4403` close stops reconnecting (revoked link).

### 4.2 Presenter (CMS `/apresentar/[id]` and the presenter link page)

- Player toolbar: **"Iniciar ao vivo" / "Encerrar"**, only for `PUBLIC` presentations
  (disabled with a hint otherwise).
- While live, every slide change sends `setLiveSlide`; presenter windows also subscribe
  to `liveEvents`, so two controllers (CMS + presenter link) stay in sync — last
  command wins.
- **Pointer**: `L` toggles the laser. An orange dot with glow (`primary-container`)
  follows the mouse over the canvas; hidden after 2 s idle or on leaving the canvas.
  Sent at most ~30/s (`requestAnimationFrame`). Works on the current-slide preview in
  the presenter view too.
- **Presenter view** additions: live badge and elapsed time; viewer count and peak;
  reactions rising plus per-kind totals; toggles "Mostrar contador ao público" and
  "Reações na tela projetada".
- **Projected screen** (main player window): reactions float over the slide while
  `showReactionsOnScreen` is on; `R` toggles it.
- **Presenter links panel** in the editor header: generate (name + expiry), URL shown
  once with a copy button, list with revoke.

### 4.3 Presenter link page — landing `/apresentacoes/controle#t=eip_…`

- Client-only page: reads the token from the fragment, keeps it in memory (and
  `sessionStorage` so a reload works), clears it from the address bar with
  `history.replaceState`.
- Loads `presentationForPresenter`, renders the same player and presenter view as the
  CMS (`P` opens the presenter window at `/apresentacoes/controle/apresentador`, which
  reads the token from `sessionStorage`; windows sync over `BroadcastChannel`).
- On `401` / close `4403`: full-screen "Link revogado ou expirado".

### 4.4 Viewer — landing `/apresentacoes/[slug]`

- When live: **"AO VIVO"** badge; `👁 N assistindo` next to it when
  `showViewerCount` is on.
- Follows the presenter's `slideId` by default. Manual navigation (keys, swipe, click)
  enters free mode. The **"Seguir apresentador"** button is visible **whenever the
  viewer's slide differs from the presenter's** and hidden when they match; clicking it
  jumps to the presenter's slide and resumes following.
- Pointer rendered only when on the presenter's slide, interpolated with a ~60 ms
  transition.
- **Reaction bar** with the 6 emojis under the slide (floating and collapsible in
  fullscreen). Everyone's reactions float up from the bottom-right corner, at most ~20
  on screen; overflow is grouped ("🔥×12"). A local toggle hides reactions.
- When the session ends, the badge goes away and the page is a normal deck again.

---

## 5. Infrastructure — production server checklist

The Engenharia Inversa runs on a different server from this development machine. These
are manual steps on **that** server, done before deploying 3b; nothing here assumes
local infrastructure.

1. **nginx** — in the `http` block:
   ```nginx
   map $http_upgrade $connection_upgrade { default upgrade; '' close; }
   ```
   In the `location` that proxies the backend's `/graphql`:
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection $connection_upgrade;
   proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
   proxy_read_timeout 3600s;
   proxy_send_timeout 3600s;
   ```
2. **Cloudflare** — zone **Network → WebSockets** enabled. The Tunnel forwards the
   upgrade; no ingress change is needed if the API hostname already points at nginx.
3. **CORS_ORIGINS** on the backend must list the landing and CMS origins (the socket
   `Origin` check uses it).
4. **Verify from outside** after deploying:
   `wscat -c wss://<api-host>/graphql -s graphql-transport-ws`, send
   `{"type":"connection_init"}`, expect `{"type":"connection_ack"}`.

---

## 6. Testing

- **Backend unit** (Vitest, fake timers): `LiveSessionService` start/stop/slide
  idempotency; non-`PUBLIC` rejection; session ends on visibility change or trash;
  pointer throttle (40/s); reaction token bucket per socket; 250 ms aggregation;
  `VIEWERS` coalescing (≤ 1 / 2 s); viewer dedupe by `viewerId`; presenter connections
  not counted; per-IP socket cap; presenter link expiry/revocation closes sockets with
  `4403`; presenter link scope (other presentation → 401; edits → 401).
- **Backend integration**: a real `graphql-ws` client against the test server:
  anonymous `liveEvents` receives `STARTED`/`SLIDE`/`POINTER`/`ENDED`; JWT over
  `connectionParams` authorizes `startLive`; a revoked presenter link is disconnected.
- **Manual checklist** (two browsers / two machines): follow, free mode and the
  "Seguir apresentador" button; pointer; viewer count and the audience toggle;
  reactions on viewer, presenter view and projected screen; presenter link on a
  machine without a session; revoking it mid-session; backend restart mid-session
  (presenter re-asserts state).
- The `test` job added to `deploy.yml` in 3a covers these too.

---

## 7. Risks

- **Single instance**: in-memory state is lost on restart (presenter re-asserts it) and
  does not scale horizontally. Accepted for the current deployment.
- **Anonymous sockets**: every viewer holds a socket for as long as the public page is
  open, live or not. Mitigated by the per-IP cap and the keepalive; revisit if traffic
  grows (e.g. subscribe only while `liveState.isLive`, polling otherwise).
- **Presenter link in the fragment**: still visible to anyone at the presenting
  machine and stored in that tab's `sessionStorage`. Short expiries and revocation are
  the mitigation.
