# Design Document: Presentations — Authoring & Display (EI-3a)

Card: **EI-3** · Sub-project **3a** of 2 (3b: live sessions —
[`2026-10-01-ei-3b-presentations-live-design.md`](2026-10-01-ei-3b-presentations-live-design.md))

## 1. Summary

Pedro is starting to give talks and classes online and wants a presentation tool
inside the CMS, closer to a "slide template system" than to free-form Google Slides.
Every slide uses one of a fixed set of templates already styled with the Engenharia
Inversa identity. Presentations are stored in the database and form a library.

Most of the content is not typed in the CMS: Pedro discusses a talk with Claude, and
Claude creates the presentation through the CMS's own GraphQL API using a short-lived
API key that Pedro generates in the CMS. Pedro then reviews, adjusts and presents.

### Goals

1. A library of presentations in the CMS, each made of ordered slides built from
   **11 templates** in the Engenharia Inversa visual identity.
2. A structured editor (slide list · live preview · field form) for review and touch-ups.
3. A GraphQL contract that an external agent (Claude) can discover and use to create,
   replace, update, publish and delete presentations with **temporary API keys**.
4. Per-presentation visibility: `PUBLIC` (public link on the landing) and `PRIVATE`
   (only logged in; API answers 401, web page answers 404). `MEMBERS` exists in the
   model only.
5. Fullscreen presentation mode with a presenter view (notes, next slide, timer).
6. PDF export through the browser's print dialog.

### Success criteria

- Claude reads `slideTemplates`, sends one `createPresentation` with all slides, and
  Pedro opens it in the CMS editor with every slide rendering correctly.
- An invalid slide is rejected with an error pointing to the slide index and field path;
  nothing is written.
- A `PUBLIC` presentation opens at `/apresentacoes/<slug>` on the landing for anyone;
  a `PRIVATE` one returns 404 there and 401 from the API without credentials.
- Speaker notes and hidden slides never reach anonymous readers.
- The preview, fullscreen player and printed PDF render identically.

### Non-goals (3a)

Free-form slide design, inline (WYSIWYG) editing, undo/redo, version history,
multi-user co-editing, the members area, server-side PDF generation, rate limiting
and per-key audit logs, anything real-time (all of that is 3b).

---

## 2. Decision log

| # | Decision | Alternatives rejected |
|---|---|---|
| D1 | Fixed set of 11 templates, all in v1 | Core 7 first; free-form design |
| D2 | `Presentation` + `Slide` tables; slide `content` is JSONB validated by zod | Whole deck as one JSON document; one table per template |
| D3 | Structured editor: thumbnails · live preview · generated form | WYSIWYG inline editing; raw JSON editor |
| D4 | Temporary API keys with **full presentation CRUD** (incl. delete and publish) | Restricted scope (no delete / no publish) |
| D5 | PDF via browser print of a `/print` route | Server-side Chromium; no PDF |
| D6 | Public link lives on the **landing** (`/apresentacoes/<slug>`); private decks are presented from the CMS | Public route inside the CMS; new app |
| D7 | `@repo/slides` is a **compiled** package (schemas, types, registry, validation — no React); renderers live in `@repo/ui/src/slides` | Single source package compiled by Nest through `paths`; single compiled package with a React entrypoint |
| D8 | Soft delete with a trash; permanent delete requires a logged-in user (JWT) | Hard delete (the API key can delete, so this is the safety net for D4) |
| D9 | Vitest as the single test runner; a `test` job blocks the deploy | No automated tests |

---

## 3. Architecture

```
                    ┌────────────────────────────────────────┐
                    │ @repo/slides  (compiled, CJS + types)  │
                    │ zod schemas · registry · field         │
                    │ descriptors · parseSlideContent        │
                    └──────┬──────────────┬──────────────┬───┘
                           │              │              │
             ┌─────────────▼───┐  ┌───────▼──────┐  ┌────▼─────────┐
             │ apps/backend    │  │ apps/cms     │  │ apps/landing │
             │ presentations/  │  │ library,     │  │ /apresenta-  │
             │ api-keys/       │  │ editor, keys,│  │ coes/[slug]  │
             │ validates every │  │ /apresentar  │  │ + /print     │
             │ write           │  └───────┬──────┘  └────┬─────────┘
             └────────┬────────┘          │              │
                      │           ┌───────▼──────────────▼───────┐
              ┌───────▼───────┐   │ @repo/ui/src/slides (source) │
              │ @repo/database│   │ SlideCanvas · 11 renderers · │
              │ Presentation, │   │ SlideRenderer · Player       │
              │ Slide, ApiKey │   └──────────────────────────────┘
              └───────────────┘
   External agent (Claude) ──Bearer ei_…──▶ /graphql and POST /uploads
```

### 3.1 Why two packages (D7)

NestJS consumes plain CommonJS, so anything the backend imports must be compiled —
the reason `@repo/database` has a build step. Renderers are only consumed by the two
Next apps, and keeping them in the `@repo/ui` source package preserves hot reload while
iterating on the visuals. The cost: changing a schema requires rebuilding
`@repo/slides` (Turborepo orders it via `build.dependsOn: ["^build"]`).

---

## 4. `@repo/slides`

New package `packages/slides`, named `@repo/slides`, extending
`@repo/tsconfig/base.json`. `build` = `tsc`, `main` → `dist/index.js`,
`types` → `dist/index.d.ts`. Dependency: `zod@^4`.

Exports:

- `SLIDE_TEMPLATES` — the registry: for each template key, `{ key, label, description,
  schema, defaults, example, fields }`.
- `fields` — an ordered list of field descriptors that drives the CMS form:
  `{ name, label, kind: "text" | "textarea" | "list" | "image" | "code" | "select" |
  "pairs" | "boolean" | "group", ...options }`. Declared by hand next to each schema
  (zod introspection is too fragile to drive a UI).
- `parseSlideContent(template, content)` → `{ ok: true, data } | { ok: false, issues:
  { path: string; message: string }[] }`. Unknown template is an issue at path `template`.
- `slideTemplateJsonSchema(template)` — `z.toJSONSchema(schema)`.
- Inferred types: `SlideTemplateKey`, `SlideContent<K>`, `CoverContent`, etc.
- `PresentationVisibility` union mirroring the Prisma enum.

### 4.1 Template catalogue

Limits are deliberate: a slide that does not fit 1920×1080 is a validation error, not
a layout bug. All strings are trimmed; optional strings may be omitted.

| Key | Label | Content schema |
|---|---|---|
| `cover` | Capa | `label?` ≤40 (e.g. "LIVE #12") · `title` 1–90 · `subtitle?` ≤200 · `date?` ≤40 · `showMascot` bool = true |
| `agenda` | Introdução / Agenda | `title` ≤80 = "Agenda" · `steps` 2–7 × `{ title` ≤60 · `description?` ≤120 `}` — drawn as a numbered pipeline |
| `section` | Divisor de seção | `number?` ≤4 (e.g. "01") · `title` 1–80 · `tagline?` ≤160 |
| `bullets` | Tópicos | `title` 1–80 · `items` 1–6 × string ≤140 |
| `split` | Texto + imagem | `title` 1–80 · `body` ≤600 (blank lines separate paragraphs, as in `AboutSection`) · `image { url, alt` ≤140 `}` · `imageSide` `"left"\|"right"` = right |
| `code` | Código | `title?` ≤80 · `language` enum `ts js tsx kotlin swift dart bash json yaml sql diff` · `code` ≤2000 chars and ≤24 lines · `highlightLines?` int[] (1-based) · `caption?` ≤160 |
| `closing` | Encerramento | `title` ≤80 = "Obrigado!" · `message?` ≤240 · `cta? { text` ≤40 · `url }` · `showSocialLinks` bool = true |
| `quote` | Citação | `quote` 1–280 · `author?` ≤80 · `role?` ≤80 |
| `comparison` | Comparação | `title` 1–80 · `left` and `right`: `{ label` ≤40 · `items` 1–6 × string ≤120 `}` · `highlight` `"left"\|"right"\|"none"` = none |
| `stats` | Números | `title?` ≤80 · `items` 2–4 × `{ value` ≤12 · `label` ≤40 `}` |
| `image` | Imagem cheia | `image { url, alt` ≤140 `}` · `caption?` ≤160 · `fit` `"cover"\|"contain"` = contain |

`url` fields accept an absolute `http(s)://` URL or a path starting with `/uploads/`
(the existing upload endpoint). `cta.url` additionally accepts `#`.

Adding a 12th template = a new schema + registry entry + renderer. No migration
(`Slide.template` is a string, see §5).

---

## 5. Data model

One migration, `add_presentations`, created with
`pnpm --filter @repo/database db:migrate:dev --name add_presentations` inside the dev
container (never `db push`).

```prisma
enum PresentationVisibility {
  PUBLIC
  PRIVATE
  MEMBERS // modelled only; behaves as PRIVATE until the members area exists
}

model Presentation {
  id          String                 @id @default(uuid())
  slug        String                 @unique
  title       String
  description String?
  visibility  PresentationVisibility @default(PRIVATE)
  createdById String                 @map("created_by_id")
  createdBy   User                   @relation(fields: [createdById], references: [id])
  // Soft delete: set by deletePresentation (also reachable with an API key).
  // Only purgePresentation, which requires a logged-in user, removes the row.
  deletedAt   DateTime?              @map("deleted_at")
  createdAt   DateTime               @default(now()) @map("created_at")
  updatedAt   DateTime               @updatedAt @map("updated_at")
  slides      Slide[]

  @@map("presentations")
}

model Slide {
  id             String       @id @default(uuid())
  presentationId String       @map("presentation_id")
  presentation   Presentation @relation(fields: [presentationId], references: [id], onDelete: Cascade)
  order          Int          @default(0)
  // Template key from @repo/slides. A string, not an enum, so adding a template
  // needs no migration; the registry rejects unknown keys on every write.
  template       String
  content        Json
  notes          String       @default("")
  hidden         Boolean      @default(false)
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@index([presentationId, order])
  @@map("slides")
}

model ApiKey {
  id          String    @id @default(uuid())
  name        String
  prefix      String    // first 8 chars after "ei_", shown in the list
  hash        String    @unique // SHA-256 of the full token; the token is never stored
  createdById String    @map("created_by_id")
  createdBy   User      @relation(fields: [createdById], references: [id])
  expiresAt   DateTime  @map("expires_at")
  lastUsedAt  DateTime? @map("last_used_at")
  revokedAt   DateTime? @map("revoked_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("api_keys")
}
```

`User` gains the back-relations `presentations` and `apiKeys`.

Rules:

- **Ordering**: no `@@unique` on `order`. Reorders rewrite positions in one
  transaction; inserts use `max(order) + 1` inside the same transaction (the collision
  fixed in `01b0741` came from new rows defaulting to the same order).
- **Slug**: generated from the title (lowercase, accents stripped, non-alphanumerics →
  `-`), suffixed `-2`, `-3`… on collision. Editable; must match `^[a-z0-9]+(-[a-z0-9]+)*$`.
  Slugs of trashed presentations stay reserved until purge.
- **Updated timestamp**: every slide write also touches `Presentation.updatedAt`, which
  the editor uses to detect external changes (§7.2).
- **Images** are URLs; there is no media table.

---

## 6. API

New backend modules `apps/backend/src/presentations/` (resolver, service, types) and
`apps/backend/src/api-keys/`, following `content/`. `content` is exposed with the
`JSON` scalar from `graphql-type-json`. `presentations` and `apiKeys` are added to
`RESOURCES` in `permissions.service.ts`, so they show up on the permissions screen;
the seed grants them to `ADMIN` (admins pass anyway through `isAdmin`).

### 6.1 Authentication

- **API key strategy** — a new passport strategy `"api-key"`. If the bearer token starts
  with `ei_`, hash it (SHA-256), look up `ApiKey.hash`, reject when missing, expired
  (`401 "Chave expirada"`) or revoked (`401 "Chave revogada"`), and return the **key's
  creator** as `req.user` with `req.authKind = "apiKey"` and `req.apiKeyId`.
  `lastUsedAt` is written at most once per minute per key.
- **`GqlJwtOrApiKeyGuard`** = `AuthGuard(["jwt", "api-key"])` adapted to the GraphQL
  context. Used **only** on presentation and slide operations and on `POST /uploads`.
  Every other resolver keeps the JWT-only `GqlAuthGuard`, so a key gets 401 there —
  including the API-key and permission management operations.
- **`OptionalAuthGuard`** — same strategies, but never fails; used by
  `presentationBySlug`, which decides on its own.
- `RolesGuard` / `@Resource("presentations", action)` work unchanged: a key carries its
  creator's role.
- **Token format**: `ei_` + 32 random bytes in base64url. Shown once at creation.

### 6.2 Visibility rules (service layer)

| Reader | `PUBLIC` | `PRIVATE` / `MEMBERS` | Trashed |
|---|---|---|---|
| Anonymous | readable, **without** `notes` (null) and **without** hidden slides | `401` | `401` |
| JWT or API key with `presentations:read` | full | full | full |
| Not found | `null` | — | — |

### 6.3 Contract

```graphql
scalar JSON

enum PresentationVisibility { PUBLIC PRIVATE MEMBERS }
enum ApiKeyExpiry { ONE_HOUR ONE_DAY SEVEN_DAYS }

type Slide {
  id: ID!
  order: Int!
  template: String!
  content: JSON!
  notes: String        # null for anonymous readers
  hidden: Boolean!
}

type Presentation {
  id: ID!
  slug: String!
  title: String!
  description: String
  visibility: PresentationVisibility!
  slideCount: Int!
  slides: [Slide!]!    # ordered; hidden slides omitted for anonymous readers
  deletedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type SlideTemplateInfo {
  key: String!
  label: String!
  description: String!
  jsonSchema: JSON!
  example: JSON!
}

input SlideInput { template: String!, content: JSON!, notes: String, hidden: Boolean }
input CreatePresentationInput {
  title: String!, slug: String, description: String,
  visibility: PresentationVisibility, slides: [SlideInput!]
}
input UpdatePresentationInput {
  title: String, slug: String, description: String, visibility: PresentationVisibility
}
input UpdateSlideInput { template: String, content: JSON, notes: String, hidden: Boolean }

type Query {
  presentations(trash: Boolean = false): [Presentation!]!   # JWT | key · presentations:read
  presentation(id: ID!): Presentation                        # JWT | key · presentations:read
  presentationBySlug(slug: String!): Presentation            # optional auth, §6.2
  slideTemplates: [SlideTemplateInfo!]!                      # public
  apiKeys: [ApiKey!]!                                        # JWT only · apiKeys:read
}

type Mutation {
  # JWT | API key
  createPresentation(input: CreatePresentationInput!): Presentation!      # presentations:create
  updatePresentation(id: ID!, input: UpdatePresentationInput!): Presentation!  # :update
  duplicatePresentation(id: ID!): Presentation!   # PRIVATE copy, title + " (cópia)"; :create
  deletePresentation(id: ID!): Boolean!           # soft delete; :delete
  restorePresentation(id: ID!): Presentation!     # :delete
  replaceSlides(presentationId: ID!, slides: [SlideInput!]!): Presentation!   # :update, atomic
  createSlide(presentationId: ID!, input: SlideInput!, position: Int): Slide! # :update
  updateSlide(id: ID!, input: UpdateSlideInput!): Slide!                      # :update
  deleteSlide(id: ID!): Boolean!                                              # :update
  reorderSlides(presentationId: ID!, ids: [ID!]!): [Slide!]!                  # :update

  # JWT only
  purgePresentation(id: ID!): Boolean!            # only from trash; presentations:delete
  createApiKey(name: String!, expiresIn: ApiKeyExpiry!): CreatedApiKey!   # apiKeys:create
  revokeApiKey(id: ID!): ApiKey!                                          # apiKeys:update
}

type ApiKey { id: ID!, name: String!, prefix: String!, expiresAt: DateTime!,
              lastUsedAt: DateTime, revokedAt: DateTime, createdAt: DateTime! }
type CreatedApiKey { apiKey: ApiKey!, token: String! }   # token returned only here
```

Notes:

- `createSlide` without `position` appends; with `position`, inserts and shifts.
- `reorderSlides` requires `ids` to be exactly the presentation's slide ids.
- `updateSlide` with a new `template` and no `content` keeps the fields whose names
  exist in the new template and fills the rest from `defaults`; the result is validated.
- Every mutation on a trashed presentation, except `restorePresentation` and
  `purgePresentation`, fails with `BAD_USER_INPUT "Apresentação na lixeira"`.

### 6.4 Validation errors

Every write validates **all** slides with `parseSlideContent` before opening the
transaction. On failure nothing is written and the error is:

```json
{
  "message": "Conteúdo de slide inválido",
  "extensions": {
    "code": "INVALID_SLIDE_CONTENT",
    "slideIndex": 3,
    "template": "code",
    "issues": [{ "path": "code", "message": "Máximo de 24 linhas" }]
  }
}
```

`slideIndex` is the position in the submitted list (or the slide's current position for
`updateSlide`). Other errors: `SLUG_TAKEN`, `INVALID_SLUG`, `UNKNOWN_TEMPLATE`.

### 6.5 Uploads

`POST /uploads` switches from `AuthGuard("jwt")` to the JWT-or-API-key guard. Limits
(5 MB; JPG/PNG/WebP/GIF/SVG) are unchanged.

### 6.6 Contract documentation

`docs/presentations-api.md` documents, for an external agent: how to get a key, the
`Authorization: Bearer ei_…` header, `slideTemplates`, a full `createPresentation`
example with one slide per template, `replaceSlides`, an image upload with `curl`,
publishing and the error shapes. It is the document Claude reads before building a
deck.

---

## 7. CMS

### 7.1 Library — `/dashboard/presentations`

- New menu item **"Apresentações"** (🎞️) between Conteúdo and Usuários, shown when the
  user's role has `presentations:read` (admins always).
- Card grid: thumbnail = first visible slide rendered by `SlideCanvas` at small scale,
  title, visibility badge, slide count, last edited.
- Tabs: **Todas · Públicas · Privadas · Lixeira**. Trash actions: *Restaurar*,
  *Excluir definitivamente* (confirm by typing the title).
- Card actions: Editar, Apresentar, Duplicar, Copiar link público (only `PUBLIC`),
  Mover para a lixeira.
- **"Nova apresentação"** asks for a title and creates the deck with **Capa + Agenda +
  Encerramento** filled from the registry `defaults`.

### 7.2 Editor — `/dashboard/presentations/[id]`

- **Header**: title, slug (editable, with a warning that changing it breaks shared
  links), visibility selector (Público / Privado; Membros disabled, "em breve"), save
  status (Salvo / Salvando… / Erro), buttons **Apresentar**, **PDF** (opens `/print`),
  **Copiar link público**.
- **Left column**: numbered thumbnails; reorder by native HTML5 drag and drop or ↑/↓
  buttons (as on the episodes page); per-slide menu: duplicate, hide/show, delete;
  **"+ Slide"** opens a gallery of the 11 templates with their thumbnails (rendered
  from `example`).
- **Center**: the selected slide in `SlideCanvas`, updated on every keystroke.
- **Right column**: the template's form, generated from the registry `fields`;
  **Anotações do apresentador** below; a template switcher (keeps same-name fields).
- **Image field**: upload through the existing `uploadFile` helper in `@repo/graphql`,
  or paste a URL.
- **Autosave**: ~800 ms debounce per slide via `updateSlide`. The same zod schema runs
  on the client first; invalid fields show their message and nothing is sent.
- **External changes**: the editor refetches on window focus. If
  `Presentation.updatedAt` moved and the change did not come from this tab, a banner
  says "Esta apresentação foi alterada pela API — recarregar". Local edits are never
  silently overwritten; last write wins per slide. No merging.

### 7.3 API keys — `/dashboard/settings/api-keys`

- New card on the settings page; guarded by `apiKeys:*` (admins by default).
- Table: name, prefix (`ei_ab12cd34…`), created, **expires** (relative, "em 23h"),
  last used, status (Ativa / Expirada / Revogada).
- **"Gerar chave"**: name + expiry (1 h / 24 h / 7 dias). The modal shows the token
  **once**, with a copy button and "não será exibido de novo".
- **Revogar**, with confirmation; effective on the next request.

---

## 8. Display

### 8.1 Renderers — `packages/ui/src/slides/`

- **`SlideCanvas`** — a fixed 1920×1080 surface scaled with `transform: scale()` to fit
  its container. Sizes are absolute, so thumbnail, editor preview, fullscreen and PDF
  are identical. Carries the identity: `background` with `technical-grid`, a footer bar
  with the small logo, the `pipeline-line` and the slide number (hidden on `cover` and
  `image`). Accepts an `overlay` slot (used by 3b for the pointer and reactions).
- **11 components** (`CoverSlide`, `AgendaSlide`, …) and **`SlideRenderer`**
  (`{ template, content, context }`), which dispatches by template. An unknown template
  or content failing `parseSlideContent` renders a warning slide
  ("Slide inválido: <template>") instead of crashing the deck.
- `context` carries data a slide cannot hold itself: `socialLinks` (for `closing`,
  fetched with the existing public social-links query) and `resolveUrl` (maps
  `/uploads/…` through `getUploadUrl`).
- **Code** highlighting with `prism-react-renderer` and a theme built from the tokens
  (orange, yellow, blue on `surface-container-lowest`); `highlightLines` get a
  `primary/15` band.
- **Assets**: `logo-mascot.png` and the logo SVG are copied from
  `apps/landing/public/images` to `apps/cms/public/images` (same paths); renderers use
  plain `<img src="/images/…">` in both apps.
- Fonts (Sora, JetBrains Mono, Hanken Grotesk) are already loaded by both apps'
  `globals.css`.

### 8.2 Player — `PresentationPlayer` in `@repo/ui`

- Keys: ←/→/space/PageUp/PageDown/Home/End; `F` fullscreen; `P` presenter view (only
  when the host passes a presenter route). Swipe on touch; click on the left/right
  halves.
- Current slide in the URL hash (`#7`, 1-based, counting visible slides); hidden slides
  skipped; a thin progress bar in the `pipeline-line` style.
- **Presenter view** — a second window: current slide, next slide, notes, a timer
  (start/pause/reset) and the clock. Both windows sync through
  `BroadcastChannel("presentation:<id>")`; navigation works from either.
- The player exposes `onSlideChange` and an `overlay` slot — the hooks 3b uses.

### 8.3 Routes

- **CMS** (outside `/dashboard`, so no sidebar, with the same login check):
  `/apresentar/[id]` (player), `/apresentar/[id]/apresentador` (presenter view),
  `/apresentar/[id]/print`.
- **Landing**: `/apresentacoes/[slug]` and `/apresentacoes/[slug]/print` — server
  components calling `presentationBySlug` with `cache: "no-store"`; `401` or `null` →
  `notFound()`. Metadata `title`/`description` from the presentation. No presenter view
  on the landing in 3a.

### 8.4 PDF — `/print`

All visible slides at 1920×1080, one per page:
`@page { size: 1920px 1080px; margin: 0 }`, `break-after: page`,
`print-color-adjust: exact` (the navy background prints without the "background
graphics" option). `window.print()` fires after `document.fonts.ready` and after every
`<img>` has loaded.

---

## 9. Build and environment impact

- **Dockerfile**: build `@repo/slides` in the `database-build` stage
  (`RUN pnpm --filter @repo/slides build`). `landing-build` currently starts `FROM
  source`; it must start from the stage that built `@repo/slides` (or build it itself).
  The backend runtime stage already copies `/app/packages` from `database-build`, which
  will include `packages/slides/dist`.
- **Dockerfile.dev / dev compose**: build `@repo/slides` in the image, and mount
  `packages/slides/src` on the three services. Each container has its own
  `packages/slides/dist` (never mount the whole package: it would hide the image's
  `node_modules`, per CLAUDE.md), so each service's command builds `@repo/slides`
  before starting, and a schema change in dev is picked up with
  `docker compose -f docker-compose.dev.yml exec <service> pnpm --filter @repo/slides build`
  (or a service restart). Schemas change far less often than renderers, which keep hot
  reload in `@repo/ui`.
- Next apps: no `transpilePackages` entry for `@repo/slides` (it is compiled).
- No new secret and no new environment variable.

---

## 10. Testing

Vitest is introduced as the single runner (`test` script per package, `turbo test`).

- **`@repo/slides`** (unit): each schema accepts its `example` and `defaults`; rejects
  over-limit lists, oversized code, bad URLs, unknown template; `slideTemplateJsonSchema`
  generates for every template; `parseSlideContent` issue paths are correct.
- **Backend** (Vitest + `unplugin-swc` for Nest decorators):
  - *Unit*: token generation and hashing, expiry and revocation; visibility table of
    §6.2 (notes and hidden slides stripped for anonymous); `INVALID_SLIDE_CONTENT`
    shape; slug generation and collisions; soft delete; purge requires JWT; reorder and
    insert never produce duplicate `order`.
  - *Integration*: resolvers over HTTP against an `ei_test` database in the dev
    compose Postgres (`migrate deploy` before the run): create with slides via API key,
    401 for keys on JWT-only operations, 401/null for `presentationBySlug`, upload with
    a key.
- **Front-end**: no automated runner in 3a. A manual checklist is run in the browser
  at the end of the plan: library tabs and trash; editor autosave, field errors,
  drag reorder, template switch, external-change banner; player keys, hash, fullscreen;
  presenter view sync; `/print` output; public page 200/404.
- **CI**: a `test` job in `.github/workflows/deploy.yml` runs `turbo test` (with a
  Postgres service for the integration tests) **before** `docker compose up`; a
  failing test blocks the deploy.

---

## 11. Risks

- **Full-CRUD keys (D4)**: a leaked key can publish or trash presentations until it
  expires (max 7 days) or is revoked. Mitigations: short expiries, the trash (D8), JWT-
  only purge, keys never allowed outside presentations/slides/uploads.
- **401 on private slugs** confirms that the slug exists. Accepted (explicit
  requirement); slugs are not secret.
- **Last write wins** between the CMS editor and API writes on the same slide; the
  external-change banner makes it visible.
