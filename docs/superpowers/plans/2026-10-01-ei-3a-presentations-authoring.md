# EI-3a Presentations — Authoring & Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Pedro build, store and present slide decks made from 11 Engenharia Inversa templates, created either in the CMS editor or by an external agent through the GraphQL API with temporary API keys.

**Architecture:** A compiled `@repo/slides` package owns the template schemas (zod 4), registry, field descriptors and validation; the NestJS backend stores `Presentation`/`Slide`/`ApiKey` with Prisma and validates every write with it; `@repo/ui/src/slides` holds the 1920×1080 canvas, the 11 renderers and the player used by the CMS (editor, `/apresentar`) and the landing (`/apresentacoes/[slug]`).

**Tech Stack:** pnpm + Turborepo, NestJS 11 + `@nestjs/graphql` 13 (code-first, Apollo), Prisma 5 + Postgres 16, Next.js 14 App Router, Tailwind 3, zod 4, Vitest, `prism-react-renderer`, `passport-custom`, `graphql-type-json`.

**Spec:** `docs/superpowers/specs/2026-10-01-ei-3a-presentations-authoring-design.md`

## Global Constraints

- Run every command from the repo root with `pnpm --filter <name> <script>`; never `cd apps/x && pnpm …` in scripts, Dockerfiles or CI.
- Check the Docker daemon (`docker info > /dev/null 2>&1`) before any `docker`/`docker compose` command; if it is down, stop and report.
- Commands that touch the database run **inside the running dev stack**: `docker compose -f docker-compose.dev.yml exec <service> <cmd>`, abbreviated below as `dcx <service> <cmd>`. Commands that need no database (unit tests, builds) may use a one-off container: `docker compose -f docker-compose.dev.yml run --rm --no-deps <service> <cmd>`, abbreviated `dcr <service> <cmd>`.
- **Adding a dependency**: edit the `package.json` by hand, then refresh the lockfile with the pnpm version the images use, without creating host `node_modules`:
  `docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:20-alpine npx -y pnpm@9.0.0 install --lockfile-only` (abbreviated `lockfile-refresh`), then rebuild the dev images: `docker compose -f docker-compose.dev.yml build`.
- **Never `prisma db push`.** Schema changes only through `pnpm --filter @repo/database db:migrate:dev --name <name>`.
- Commit messages in English, Conventional Commits style used by the repo (`feat(backend): …`, `feat(cms): …`), ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Ports stay fixed: backend 4050, CMS 4051, landing 4052.
- User-facing copy is Brazilian Portuguese; code, identifiers and comments are English.
- Template keys (exact): `cover`, `agenda`, `section`, `bullets`, `split`, `code`, `closing`, `quote`, `comparison`, `stats`, `image`.
- Visibility enum (exact): `PUBLIC`, `PRIVATE`, `MEMBERS`; `MEMBERS` behaves as `PRIVATE`.
- API key token format: `ei_` + 32 random bytes base64url; only the SHA-256 hex hash is stored; expiries `ONE_HOUR`, `ONE_DAY`, `SEVEN_DAYS` (max 7 days).
- Error codes (exact): `INVALID_SLIDE_CONTENT`, `SLUG_TAKEN`, `INVALID_SLUG`, `UNKNOWN_TEMPLATE`; error messages "Chave expirada", "Chave revogada", "Apresentação na lixeira".
- Canvas is fixed 1920×1080; slug pattern `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Anonymous readers never receive `notes` (null) or hidden slides.
- Do not add `@repo/slides` to `transpilePackages` (it is compiled). Do not mount whole packages over `/app` in dev compose (only `src` folders).

## Review Focus

1. **Expired or revoked key mid-session** — an agent using a key that expires between two calls must get `401 "Chave expirada"` on the next call, never a silent anonymous read of a private deck. (Task 5: test `rejects an expired key even when the route is optional`.)
2. **Template switch with incompatible fields** — switching templates must always yield valid content: a field is kept only if the new template has a field with that name **and** the value passes that field's schema (switching `bullets` → `code` keeps `title`; an 85-char title into `section`, max 80, or `bullets.items` (strings) into `stats.items` (objects) fall back to the new template's defaults). (Task 2 tests; Task 8 test for `updateSlide` with only `template`.)
3. **Concurrent appends** — two `createSlide` calls racing on the same deck must not produce duplicate `order` values. (Task 8: test `parallel appends get distinct orders`.)
4. **Slug edge cases** — titles made only of punctuation/emoji ("🚀!!!") must still produce a valid slug (`apresentacao`), and accented titles ("Introdução à Engenharia") must strip accents. (Task 1 tests.)
5. **Trashed deck reached by slug** — a trashed `PUBLIC` deck must behave as private (401 to anonymous), and its slug must remain reserved. (Task 7 tests.)

---

## File Structure

### New package `packages/slides` (`@repo/slides`, compiled CJS)

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | package setup; `build` = `tsc`, `test` = `vitest run` |
| `src/index.ts` | barrel |
| `src/common.ts` | shared zod pieces: `text(min,max)`, `optionalText(max)`, `assetUrl`, `linkUrl`, `imageRef`, `CODE_LANGUAGES` |
| `src/fields.ts` | `FieldDescriptor` / `FieldKind` types |
| `src/templates/<key>.ts` (11 files) | one template each: `schema`, `defaults`, `example`, `fields`, `label`, `description` |
| `src/registry.ts` | `SLIDE_TEMPLATES`, `SLIDE_TEMPLATE_KEYS`, `isSlideTemplateKey`, `SlideTemplateKey`, content types |
| `src/validate.ts` | `parseSlideContent`, `SlideIssue`, `slideTemplateJsonSchema` |
| `src/switch-template.ts` | `switchTemplate(content, to)` |
| `src/slug.ts` | `slugify`, `SLUG_PATTERN`, `isValidSlug` |
| `src/visibility.ts` | `PRESENTATION_VISIBILITIES`, `PresentationVisibility` |
| `src/*.test.ts` | Vitest unit tests |

### Backend (`apps/backend`)

| File | Responsibility |
|---|---|
| `vitest.config.ts`, `test/global-setup.ts`, `test/helpers.ts` | Vitest + SWC; creates/migrates the `ei_test` database; app bootstrap + `gql()` helper + fixtures |
| `src/api-keys/api-key-token.ts` | `generateToken(prefix)`, `hashToken(token)` |
| `src/api-keys/api-keys.service.ts` | create / list / revoke / `authenticate(token)` |
| `src/api-keys/api-keys.types.ts` | GraphQL `ApiKeyType`, `CreatedApiKeyType`, `ApiKeyExpiry` enum |
| `src/api-keys/api-keys.resolver.ts` | `apiKeys`, `createApiKey`, `revokeApiKey` (JWT only) |
| `src/api-keys/api-keys.module.ts` | module |
| `src/auth/api-key.strategy.ts` | passport strategy `"api-key"` |
| `src/auth/jwt-or-api-key.guard.ts` | `GqlJwtOrApiKeyGuard`, `HttpJwtOrApiKeyGuard`, `GqlOptionalAuthGuard` |
| `src/auth/auth-kind.ts` | `AuthenticatedUser` type, `authKindOf(user)` |
| `src/presentations/presentation-errors.ts` | `invalidSlideContent`, `slugTaken`, `invalidSlug`, `unknownTemplate`, `inTrash` |
| `src/presentations/slide-validation.ts` | `SlideInputData`, `ValidSlide`, `validateSlide`, `validateSlides` |
| `src/presentations/presentations.service.ts` | presentation CRUD, slug, trash, visibility-aware reads, `assertWritable` |
| `src/presentations/slides.service.ts` | slide operations + validation |
| `src/presentations/presentations.types.ts` | GraphQL object/input types, `JSON` scalar usage |
| `src/presentations/presentations.resolver.ts` | queries/mutations of spec §6.3 |
| `src/presentations/presentations.module.ts` | module |
| `src/**/*.test.ts` | unit + integration tests |

Modified: `src/app.module.ts`, `src/auth/auth.module.ts`, `src/upload/upload.controller.ts`, `src/permissions/permissions.service.ts` (`RESOURCES`), `package.json`.

### Database (`packages/database`)

Modified `prisma/schema.prisma`; new migration `prisma/migrations/<ts>_add_presentations/`.

### Shared front-end packages

| File | Responsibility |
|---|---|
| `packages/types/src/presentation.ts` | `Presentation`, `Slide`, `ApiKey`, `PresentationVisibility`, `SlideTemplateInfo` |
| `packages/graphql/src/queries/presentations.ts` | presentation + slide documents |
| `packages/graphql/src/queries/api-keys.ts` | API key documents |
| `packages/ui/src/slides/canvas.tsx` | `SlideCanvas` |
| `packages/ui/src/slides/slide-renderer.tsx` | `SlideRenderer`, `SlideContext` |
| `packages/ui/src/slides/templates/*.tsx` | 11 renderers |
| `packages/ui/src/slides/code-theme.ts` | prism theme from tokens |
| `packages/ui/src/slides/navigation.ts` | pure navigation reducer (tested) |
| `packages/ui/src/slides/use-deck-navigation.ts` | `useDeckNavigation`, `navActionForKey` (hash + cross-window sync) |
| `packages/ui/src/slides/player.tsx` | `PresentationPlayer` |
| `packages/ui/src/slides/presenter-view.tsx` | `PresenterView` |
| `packages/ui/src/slides/sync.ts` | `BroadcastChannel` sync helper |
| `packages/ui/src/slides/print-deck.tsx` | `PrintDeck` |
| `packages/ui/src/slides/index.ts` | barrel (re-exported from `packages/ui/src/index.ts`) |

### Apps

| File | Responsibility |
|---|---|
| `apps/cms/app/dashboard/presentations/page.tsx` | library |
| `apps/cms/app/dashboard/presentations/[id]/page.tsx` | editor |
| `apps/cms/components/presentations/*.tsx` | editor pieces: `SlideList`, `SlideForm`, field inputs, `TemplateGallery`, `PresentationHeader` |
| `apps/cms/app/dashboard/settings/api-keys/page.tsx` | API keys |
| `apps/cms/app/apresentar/[id]/{page,apresentador/page,print/page}.tsx` | player, presenter view, print |
| `apps/cms/app/apresentar/layout.tsx` | login check without sidebar |
| `apps/landing/app/apresentacoes/[slug]/{page,print/page}.tsx` | public player and print |
| `apps/landing/lib/fetch-presentation.ts` | server-side fetch via `API_INTERNAL_URL` |
| `docs/presentations-api.md` | external agent contract |

---

## Interface Catalogue

Every task below uses these names exactly.

### `@repo/slides`

```ts
// fields.ts
export type FieldKind =
  | "text" | "textarea" | "code" | "select" | "boolean"
  | "image" | "list" | "group" | "objectList";
export interface FieldDescriptor {
  name: string;                 // key in the content object
  label: string;                // pt-BR label
  kind: FieldKind;
  optional?: boolean;
  maxLength?: number;           // text / textarea / code
  options?: { value: string; label: string }[]; // select
  minItems?: number;            // list / objectList
  maxItems?: number;            // list / objectList
  fields?: FieldDescriptor[];   // group / objectList item shape
  help?: string;
}

// registry.ts
export const SLIDE_TEMPLATE_KEYS = ["cover","agenda","section","bullets","split","code",
  "closing","quote","comparison","stats","image"] as const;
export type SlideTemplateKey = (typeof SLIDE_TEMPLATE_KEYS)[number];
export interface SlideTemplateDefinition<S extends z.ZodType = z.ZodType> {
  key: SlideTemplateKey; label: string; description: string;
  schema: S; defaults: z.output<S>; example: z.output<S>; fields: FieldDescriptor[];
}
export const SLIDE_TEMPLATES: { [K in SlideTemplateKey]: SlideTemplateDefinition };
export function isSlideTemplateKey(value: string): value is SlideTemplateKey;
export type CoverContent = z.output<typeof coverSchema>; // …one per template
export type SlideContentByTemplate = { cover: CoverContent; agenda: AgendaContent; … };

// validate.ts
export interface SlideIssue { path: string; message: string }  // path "steps.2.title"; "" = root; "template" for unknown key
export type ParseSlideResult =
  | { ok: true; template: SlideTemplateKey; data: Record<string, unknown> }
  | { ok: false; issues: SlideIssue[] };
export function parseSlideContent(template: string, content: unknown): ParseSlideResult;
export function slideTemplateJsonSchema(template: SlideTemplateKey): Record<string, unknown>;

// switch-template.ts
export function switchTemplate(content: Record<string, unknown>, to: SlideTemplateKey): Record<string, unknown>;

// slug.ts
export const SLUG_PATTERN: RegExp;               // /^[a-z0-9]+(-[a-z0-9]+)*$/
export function slugify(title: string): string;  // never empty: falls back to "apresentacao"
export function isValidSlug(slug: string): boolean;

// visibility.ts
export const PRESENTATION_VISIBILITIES = ["PUBLIC","PRIVATE","MEMBERS"] as const;
export type PresentationVisibility = (typeof PRESENTATION_VISIBILITIES)[number];

// common.ts
export const CODE_LANGUAGES = ["ts","js","tsx","kotlin","swift","dart","bash","json","yaml","sql","diff"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
```

Content shapes (exact keys; see spec §4.1 for limits): image references are `{ url: string; alt: string }`; `agenda.steps: { title; description? }[]`; `comparison.left/right: { label; items: string[] }`; `stats.items: { value; label }[]`; `closing.cta?: { text; url }`.

### Backend

```ts
// auth/auth-kind.ts
export type AuthKind = "jwt" | "apiKey";
export type AuthenticatedUser = User & { role: Role; authKind?: AuthKind; apiKeyId?: string };
export function authKindOf(user: AuthenticatedUser | null | undefined): AuthKind | null;

// api-keys/api-key-token.ts
export function generateToken(prefix: "ei_"): { token: string; hash: string; displayPrefix: string };
export function hashToken(token: string): string; // sha256 hex

// api-keys/api-keys.service.ts
export const API_KEY_TTL_MS: Record<"ONE_HOUR" | "ONE_DAY" | "SEVEN_DAYS", number>;
class ApiKeysService {
  create(userId: string, name: string, expiresIn: keyof typeof API_KEY_TTL_MS): Promise<{ apiKey: ApiKey; token: string }>;
  list(): Promise<ApiKey[]>;                               // newest first
  revoke(id: string): Promise<ApiKey>;
  authenticate(token: string): Promise<AuthenticatedUser>; // throws UnauthorizedException("Chave expirada" | "Chave revogada" | "Chave inválida")
}

// presentations/presentations.service.ts
export type Viewer = { user: AuthenticatedUser; canRead: boolean } | null; // null = anonymous
class PresentationsService {
  list(trash: boolean): Promise<PresentationWithSlides[]>;
  getById(id: string): Promise<PresentationWithSlides | null>;
  getBySlug(slug: string, viewer: Viewer): Promise<PresentationWithSlides | null>; // throws UnauthorizedException for non-public when !viewer?.canRead
  create(input: CreatePresentationData, userId: string): Promise<PresentationWithSlides>;
  update(id: string, input: UpdatePresentationData): Promise<PresentationWithSlides>;
  duplicate(id: string, userId: string): Promise<PresentationWithSlides>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<PresentationWithSlides>;
  purge(id: string): Promise<boolean>;
  assertNotTrashed(id: string): Promise<void>;
}
export type SlideView = Omit<Slide, "notes"> & { notes: string | null };
export type PresentationWithSlides = Presentation & { slides: SlideView[] };
export function toAnonymousView(p: PresentationWithSlides): PresentationWithSlides; // notes → null, hidden slides removed
export function assertWritable(presentationId: string): Promise<Presentation>;        // NOT_FOUND / "Apresentação na lixeira"

// presentations/slide-validation.ts
export interface SlideInputData { template: string; content: unknown; notes?: string | null; hidden?: boolean | null }
export interface ValidSlide { template: SlideTemplateKey; content: Record<string, unknown>; notes: string; hidden: boolean }
export function validateSlide(input: SlideInputData, slideIndex: number): ValidSlide; // throws invalidSlideContent / unknownTemplate
export function validateSlides(inputs: SlideInputData[]): ValidSlide[];

// presentations/slides.service.ts
class SlidesService {
  replaceSlides(presentationId: string, slides: SlideInputData[]): Promise<void>;
  createSlide(presentationId: string, input: SlideInputData, position?: number | null): Promise<Slide>;
  updateSlide(id: string, input: Partial<SlideInputData>): Promise<Slide>;
  deleteSlide(id: string): Promise<boolean>;
  reorderSlides(presentationId: string, ids: string[]): Promise<Slide[]>;
}
```

### Front-end (`@repo/types`, `@repo/graphql`, `@repo/ui`)

```ts
// @repo/types — presentation.ts
export type PresentationVisibility = "PUBLIC" | "PRIVATE" | "MEMBERS";
export type Slide = { id: string; order: number; template: string; content: Record<string, unknown>; notes: string | null; hidden: boolean };
export type Presentation = { id: string; slug: string; title: string; description: string | null;
  visibility: PresentationVisibility; slideCount: number; slides: Slide[];
  deletedAt: string | null; createdAt: string; updatedAt: string };
export type ApiKey = { id: string; name: string; prefix: string; expiresAt: string;
  lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

// @repo/graphql — queries/presentations.ts (gql documents)
GET_PRESENTATIONS($trash: Boolean)         → { presentations: Presentation[] }
GET_PRESENTATION($id: ID!)                 → { presentation: Presentation | null }
GET_PRESENTATION_BY_SLUG($slug: String!)   → { presentationBySlug: Presentation | null }
CREATE_PRESENTATION($input) · UPDATE_PRESENTATION($id,$input) · DUPLICATE_PRESENTATION($id)
DELETE_PRESENTATION($id) · RESTORE_PRESENTATION($id) · PURGE_PRESENTATION($id)
CREATE_SLIDE($presentationId,$input,$position) · UPDATE_SLIDE($id,$input) · DELETE_SLIDE($id)
REORDER_SLIDES($presentationId,$ids) · REPLACE_SLIDES($presentationId,$slides)
// queries/api-keys.ts
GET_API_KEYS · CREATE_API_KEY($name,$expiresIn) → { createApiKey: { apiKey: ApiKey; token: string } } · REVOKE_API_KEY($id)

// @repo/ui — slides
export const SLIDE_WIDTH = 1920; export const SLIDE_HEIGHT = 1080;
export type SlideContext = { socialLinks?: { label: string; url: string }[]; resolveUrl?: (url: string) => string };
export function SlideCanvas(props: { children: ReactNode; showFooter?: boolean; slideNumber?: number; overlay?: ReactNode; className?: string }): JSX.Element;
export function SlideRenderer(props: { template: string; content: unknown; slideNumber?: number; context?: SlideContext; overlay?: ReactNode }): JSX.Element;
export type PlayerSlide = { id: string; template: string; content: Record<string, unknown>; notes: string | null; hidden: boolean };
export function visibleSlides(slides: PlayerSlide[]): PlayerSlide[];
export type NavState = { index: number; count: number };
export type NavAction = { type: "next" } | { type: "prev" } | { type: "first" } | { type: "last" } | { type: "goto"; index: number } | { type: "resize"; count: number };
export function navReducer(state: NavState, action: NavAction): NavState;
export function indexFromHash(hash: string, count: number): number; // "#7" → 6, clamped; invalid → 0
export function createSlideSync(presentationId: string): { post(index: number): void; subscribe(cb: (index: number) => void): () => void; close(): void };
export function PresentationPlayer(props: { presentationId: string; slides: PlayerSlide[]; context?: SlideContext;
  presenterHref?: string; onSlideChange?: (index: number, slide: PlayerSlide) => void; overlay?: ReactNode; toolbar?: ReactNode }): JSX.Element;
export function PresenterView(props: { presentationId: string; title: string; slides: PlayerSlide[]; context?: SlideContext }): JSX.Element;
export function PrintDeck(props: { slides: PlayerSlide[]; context?: SlideContext; autoPrint?: boolean }): JSX.Element;
```

---

## Tasks

| # | Task | Area |
|---|---|---|
| 1 | Vitest + `@repo/slides` foundation and first 4 templates | slides |
| 2 | Remaining 7 templates, `switchTemplate`, JSON Schema | slides |
| 3 | Build wiring for `@repo/slides` + backend test harness | infra |
| 4 | Prisma models and `add_presentations` migration | database |
| 5 | API key tokens, service, passport strategy and guards | backend |
| 6 | API keys GraphQL + uploads accept keys | backend |
| 7 | `PresentationsService` (CRUD, slug, trash, visibility) | backend |
| 8 | `SlidesService` (slide ops, validation errors) | backend |
| 9 | Presentations GraphQL resolver, `slideTemplates`, permissions | backend |
| 10 | `@repo/types`, `@repo/graphql` documents, `docs/presentations-api.md` | shared |
| 11 | `SlideCanvas`, `SlideRenderer`, 6 text renderers, assets | ui |
| 12 | `split`, `code`, `comparison`, `closing`, `image` renderers | ui |
| 13 | Navigation reducer, `PresentationPlayer`, `PresenterView`, `PrintDeck` | ui |
| 14 | CMS: API keys settings page | cms |
| 15 | CMS: presentations library and menu | cms |
| 16 | CMS: field-descriptor slide form | cms |
| 17 | CMS: editor page | cms |
| 18 | CMS: `/apresentar` player, presenter view and print | cms |
| 19 | Landing: `/apresentacoes/[slug]` and print | landing |
| 20 | CI test job and final verification | ci |

---

### Task 1: Vitest + `@repo/slides` foundation and first 4 templates

Creates the compiled `@repo/slides` package with shared zod helpers, slug utilities,
the template definition type, the registry, validation, and the `cover`, `agenda`,
`section` and `bullets` templates. Introduces Vitest and the `turbo test` pipeline.

**Files:**
- Create: `packages/slides/package.json`, `packages/slides/tsconfig.json`, `packages/slides/tsconfig.build.json`, `packages/slides/vitest.config.ts`
- Create: `packages/slides/src/{index,common,fields,definition,registry,validate,slug,visibility}.ts`
- Create: `packages/slides/src/templates/{cover,agenda,section,bullets}.ts`
- Create: `packages/slides/src/slug.test.ts`, `packages/slides/src/registry.test.ts`
- Modify: `turbo.json` (add `test` task), `package.json` (root `test` script), `docker-compose.dev.yml` (mount `packages/slides/src` on `backend`, `cms`, `landing`), `pnpm-lock.yaml` (via `lockfile-refresh`)

**Interfaces:**
- Consumes: nothing.
- Produces: `SLIDE_TEMPLATE_KEYS` (4 keys for now — Task 2 extends to 11), `SlideTemplateKey`, `SLIDE_TEMPLATES`, `isSlideTemplateKey`, `SlideTemplateDefinition<S, K>` (in `definition.ts`, re-exported), `FieldDescriptor`, `FieldKind`, `parseSlideContent`, `SlideIssue`, `ParseSlideResult`, `slideTemplateJsonSchema`, `slugify`, `SLUG_PATTERN`, `isValidSlug`, `PRESENTATION_VISIBILITIES`, `PresentationVisibility`, and from `common.ts`: `obj`, `requiredText`, `optionalText`, `textList`, `assetUrl`, `linkUrl`, `imageRef`, `CODE_LANGUAGES`, `CodeLanguage`.

- [ ] **Step 1: Check Docker and create the package skeleton**

Run: `docker info > /dev/null 2>&1 && echo up || echo down` — Expected: `up` (if `down`, stop and report).

`packages/slides/package.json`:
```json
{
  "name": "@repo/slides",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@types/node": "^20.12.7",
    "typescript": "^5.4.5",
    "vitest": "^3.2.0"
  }
}
```

`packages/slides/tsconfig.json`:
```json
{
  "extends": "@repo/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*", "vitest.config.ts"]
}
```

`packages/slides/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "./src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/slides/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

`turbo.json` — add inside `"tasks"`:
```json
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
```

Root `package.json` — add to `"scripts"`: `"test": "turbo run test",`

`docker-compose.dev.yml` — add `- ./packages/slides/src:/app/packages/slides/src` to the `volumes` of `backend`, `cms` and `landing` (next to the existing `packages/*/src` lines; for `backend`, below `./packages/database:/app/packages/database`).

- [ ] **Step 2: Refresh the lockfile and rebuild the dev images**

Run: `lockfile-refresh` (command in Global Constraints), then `docker compose -f docker-compose.dev.yml build`
Expected: `pnpm-lock.yaml` gains an `importers: packages/slides` entry with `zod` and `vitest`; images build.

- [ ] **Step 3: Write the failing slug tests**

`packages/slides/src/slug.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, SLUG_PATTERN } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Engenharia Reversa de Apps")).toBe("engenharia-reversa-de-apps");
  });

  it("strips accents", () => {
    expect(slugify("Introdução à Engenharia")).toBe("introducao-a-engenharia");
  });

  it("collapses punctuation and trims dashes", () => {
    expect(slugify("  Live #12 — Proxy & SSL!  ")).toBe("live-12-proxy-ssl");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("🚀!!!")).toBe("apresentacao");
    expect(slugify("")).toBe("apresentacao");
  });

  it("caps the length at 80 without a trailing dash", () => {
    const slug = slugify("a".repeat(79) + " bcd");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});

describe("isValidSlug", () => {
  it("accepts kebab-case", () => {
    expect(isValidSlug("live-12")).toBe(true);
  });

  it.each(["Live-12", "live--12", "-live", "live-", "live_12", "", "a".repeat(81)])(
    "rejects %s",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `dcr backend pnpm --filter @repo/slides test`
Expected: FAIL — `Failed to resolve import "./slug"`.

- [ ] **Step 5: Implement `slug.ts` and `visibility.ts`**

`packages/slides/src/slug.ts`:
```ts
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MAX_SLUG_LENGTH = 80;
const FALLBACK_SLUG = "apresentacao";

/** URL slug for a presentation title. Never empty. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug || FALLBACK_SLUG;
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}
```

`packages/slides/src/visibility.ts`:
```ts
export const PRESENTATION_VISIBILITIES = ["PUBLIC", "PRIVATE", "MEMBERS"] as const;
export type PresentationVisibility = (typeof PRESENTATION_VISIBILITIES)[number];
```

- [ ] **Step 6: Run the slug tests to verify they pass**

Run: `dcr backend pnpm --filter @repo/slides test`
Expected: PASS (slug.test.ts, 12 tests).

- [ ] **Step 7: Write the failing registry/validation tests**

`packages/slides/src/registry.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  SLIDE_TEMPLATES,
  SLIDE_TEMPLATE_KEYS,
  isSlideTemplateKey,
  parseSlideContent,
  slideTemplateJsonSchema,
} from "./index";

describe("registry", () => {
  it("has one definition per key, with matching key", () => {
    for (const key of SLIDE_TEMPLATE_KEYS) {
      expect(SLIDE_TEMPLATES[key].key).toBe(key);
    }
  });

  it.each(SLIDE_TEMPLATE_KEYS)("%s accepts its example and its defaults", (key) => {
    const def = SLIDE_TEMPLATES[key];
    expect(parseSlideContent(key, def.example)).toMatchObject({ ok: true });
    expect(parseSlideContent(key, def.defaults)).toMatchObject({ ok: true });
  });

  it.each(SLIDE_TEMPLATE_KEYS)("%s declares a field for every schema key", (key) => {
    const def = SLIDE_TEMPLATES[key];
    const shapeKeys = Object.keys((def.schema as unknown as { shape: object }).shape).sort();
    expect(def.fields.map((f) => f.name).sort()).toEqual(shapeKeys);
  });

  it.each(SLIDE_TEMPLATE_KEYS)("%s produces an object JSON Schema", (key) => {
    const schema = slideTemplateJsonSchema(key);
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeTypeOf("object");
  });

  it("knows its keys", () => {
    expect(isSlideTemplateKey("cover")).toBe(true);
    expect(isSlideTemplateKey("hero")).toBe(false);
  });
});

describe("parseSlideContent", () => {
  it("rejects an unknown template at path 'template'", () => {
    expect(parseSlideContent("hero", {})).toEqual({
      ok: false,
      issues: [{ path: "template", message: "Modelo desconhecido: hero" }],
    });
  });

  it("trims strings and applies defaults", () => {
    const result = parseSlideContent("cover", { title: "  Olá  " });
    expect(result).toEqual({
      ok: true,
      template: "cover",
      data: { title: "Olá", showMascot: true },
    });
  });

  it("reports a missing required field by path", () => {
    const result = parseSlideContent("cover", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "title", message: "Obrigatório" });
  });

  it("reports an over-limit string with the limit", () => {
    const result = parseSlideContent("cover", { title: "x".repeat(91) });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContainEqual({ path: "title", message: "Máximo de 90 caracteres" });
  });

  it("reports nested paths inside lists", () => {
    const result = parseSlideContent("agenda", {
      title: "Agenda",
      steps: [{ title: "Um" }, { title: "" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "steps.1.title", message: "Obrigatório" });
  });

  it("rejects lists above the maximum", () => {
    const result = parseSlideContent("bullets", { title: "T", items: Array(7).fill("item") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "items", message: "Máximo de 6 itens" });
  });

  it("rejects unknown fields so typos surface", () => {
    const result = parseSlideContent("section", { title: "T", tagLine: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContainEqual({ path: "", message: "Campo desconhecido: tagLine" });
  });

  it("rejects non-object content at the root", () => {
    const result = parseSlideContent("section", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].path).toBe("");
  });
});
```

- [ ] **Step 8: Run them to verify they fail**

Run: `dcr backend pnpm --filter @repo/slides test`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 9: Implement the shared pieces**

`packages/slides/src/common.ts`:
```ts
import { z } from "zod";

/** Strict object: unknown keys are errors, so a typo in an agent's payload surfaces. */
export const obj = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape, {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? `Campo desconhecido: ${issue.keys.join(", ")}`
        : issue.code === "invalid_type"
          ? "Esperado um objeto"
          : undefined,
  });

export const requiredText = (max: number) =>
  z
    .string({ error: "Obrigatório" })
    .trim()
    .min(1, { error: "Obrigatório" })
    .max(max, { error: `Máximo de ${max} caracteres` });

export const optionalText = (max: number) =>
  z
    .string({ error: "Esperado um texto" })
    .trim()
    .max(max, { error: `Máximo de ${max} caracteres` })
    .optional();

export const textList = (minItems: number, maxItems: number, maxLength: number) =>
  z
    .array(requiredText(maxLength), { error: "Esperada uma lista" })
    .min(minItems, { error: `Mínimo de ${minItems} ${minItems === 1 ? "item" : "itens"}` })
    .max(maxItems, { error: `Máximo de ${maxItems} itens` });

const HTTP_URL = /^https?:\/\/\S+$/;
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+$/;

/** An image: absolute http(s) URL or a file served by the backend's /uploads. */
export const assetUrl = z
  .string({ error: "Obrigatório" })
  .trim()
  .refine((v) => HTTP_URL.test(v) || UPLOAD_PATH.test(v), {
    error: "Use uma URL http(s) ou um caminho /uploads/…",
  });

/** A link target: like assetUrl, plus "#" for a placeholder. */
export const linkUrl = z
  .string({ error: "Obrigatório" })
  .trim()
  .refine((v) => v === "#" || HTTP_URL.test(v) || UPLOAD_PATH.test(v), {
    error: "Use uma URL http(s), um caminho /uploads/… ou #",
  });

export const imageRef = obj({
  url: assetUrl,
  alt: z.string().trim().max(140, { error: "Máximo de 140 caracteres" }).default(""),
});

export const CODE_LANGUAGES = [
  "ts", "js", "tsx", "kotlin", "swift", "dart", "bash", "json", "yaml", "sql", "diff",
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
```

`packages/slides/src/fields.ts`:
```ts
export type FieldKind =
  | "text"
  | "textarea"
  | "code"
  | "select"
  | "boolean"
  | "image"
  | "list"
  | "group"
  | "objectList";

/** Drives the CMS form for one content key. Declared by hand next to each schema. */
export interface FieldDescriptor {
  name: string;
  label: string;
  kind: FieldKind;
  optional?: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
  minItems?: number;
  maxItems?: number;
  fields?: FieldDescriptor[];
  help?: string;
}
```

`packages/slides/src/definition.ts`:
```ts
import type { z } from "zod";
import type { FieldDescriptor } from "./fields";

export interface SlideTemplateDefinition<
  S extends z.ZodType = z.ZodType,
  K extends string = string,
> {
  key: K;
  label: string;
  description: string;
  schema: S;
  defaults: z.output<S>;
  example: z.output<S>;
  fields: FieldDescriptor[];
}
```

- [ ] **Step 10: Implement the four templates**

`packages/slides/src/templates/cover.ts`:
```ts
import { z } from "zod";
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const coverSchema = obj({
  label: optionalText(40),
  title: requiredText(90),
  subtitle: optionalText(200),
  date: optionalText(40),
  showMascot: z.boolean().default(true),
});

export const cover = {
  key: "cover",
  label: "Capa",
  description: "Abertura: rótulo, título, subtítulo e data, com o mascote à direita.",
  schema: coverSchema,
  defaults: {
    label: "LIVE",
    title: "Título da apresentação",
    subtitle: "Uma frase sobre o que vamos ver",
    showMascot: true,
  },
  example: {
    label: "LIVE #12",
    title: "Engenharia reversa de um app de banco",
    subtitle: "Do proxy ao certificado: como o app conversa com a API",
    date: "1 de outubro de 2026",
    showMascot: true,
  },
  fields: [
    { name: "label", label: "Rótulo", kind: "text", optional: true, maxLength: 40, help: "Ex.: LIVE #12" },
    { name: "title", label: "Título", kind: "text", maxLength: 90 },
    { name: "subtitle", label: "Subtítulo", kind: "textarea", optional: true, maxLength: 200 },
    { name: "date", label: "Data", kind: "text", optional: true, maxLength: 40 },
    { name: "showMascot", label: "Mostrar mascote", kind: "boolean" },
  ],
} satisfies SlideTemplateDefinition<typeof coverSchema, "cover">;
```

`packages/slides/src/templates/agenda.ts`:
```ts
import { z } from "zod";
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const agendaSchema = obj({
  title: requiredText(80).default("Agenda"),
  steps: z
    .array(obj({ title: requiredText(60), description: optionalText(120) }), {
      error: "Esperada uma lista",
    })
    .min(2, { error: "Mínimo de 2 itens" })
    .max(7, { error: "Máximo de 7 itens" }),
});

export const agenda = {
  key: "agenda",
  label: "Introdução / Agenda",
  description: "Roteiro da apresentação, desenhado como um pipeline numerado.",
  schema: agendaSchema,
  defaults: {
    title: "Agenda",
    steps: [{ title: "Contexto" }, { title: "Mão na massa" }, { title: "Próximos passos" }],
  },
  example: {
    title: "O que vamos ver",
    steps: [
      { title: "Montando o ambiente", description: "Emulador, proxy e certificado" },
      { title: "Interceptando o tráfego", description: "Lendo as chamadas do app" },
      { title: "Contornando o pinning", description: "Frida na prática" },
      { title: "Conclusões" },
    ],
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    {
      name: "steps",
      label: "Etapas",
      kind: "objectList",
      minItems: 2,
      maxItems: 7,
      fields: [
        { name: "title", label: "Etapa", kind: "text", maxLength: 60 },
        { name: "description", label: "Descrição", kind: "text", optional: true, maxLength: 120 },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof agendaSchema, "agenda">;
```

`packages/slides/src/templates/section.ts`:
```ts
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const sectionSchema = obj({
  number: optionalText(4),
  title: requiredText(80),
  tagline: optionalText(160),
});

export const section = {
  key: "section",
  label: "Divisor de seção",
  description: "Abre um bloco da apresentação com número, título e frase de apoio.",
  schema: sectionSchema,
  defaults: { number: "01", title: "Nova seção" },
  example: { number: "02", title: "Interceptando o tráfego", tagline: "Tudo que o app manda, a gente lê" },
  fields: [
    { name: "number", label: "Número", kind: "text", optional: true, maxLength: 4, help: "Ex.: 01" },
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "tagline", label: "Frase de apoio", kind: "text", optional: true, maxLength: 160 },
  ],
} satisfies SlideTemplateDefinition<typeof sectionSchema, "section">;
```

`packages/slides/src/templates/bullets.ts`:
```ts
import { obj, requiredText, textList } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const bulletsSchema = obj({
  title: requiredText(80),
  items: textList(1, 6, 140),
});

export const bullets = {
  key: "bullets",
  label: "Tópicos",
  description: "Título e até 6 tópicos curtos.",
  schema: bulletsSchema,
  defaults: { title: "Tópicos", items: ["Primeiro ponto", "Segundo ponto", "Terceiro ponto"] },
  example: {
    title: "Por que o app confia no certificado",
    items: [
      "O Android só confia nas CAs do sistema por padrão",
      "O app pode fixar o certificado (pinning)",
      "Network Security Config decide o que vale",
    ],
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "items", label: "Tópicos", kind: "list", minItems: 1, maxItems: 6, maxLength: 140 },
  ],
} satisfies SlideTemplateDefinition<typeof bulletsSchema, "bullets">;
```

- [ ] **Step 11: Implement registry, validation and the barrel**

`packages/slides/src/registry.ts`:
```ts
import type { z } from "zod";
import { agenda } from "./templates/agenda";
import { bullets } from "./templates/bullets";
import { cover } from "./templates/cover";
import { section } from "./templates/section";

export type { SlideTemplateDefinition } from "./definition";

/** Display order of the template gallery. */
export const SLIDE_TEMPLATE_KEYS = ["cover", "agenda", "section", "bullets"] as const;
export type SlideTemplateKey = (typeof SLIDE_TEMPLATE_KEYS)[number];

export const SLIDE_TEMPLATES = { cover, agenda, section, bullets } as const;

export type SlideContentByTemplate = {
  [K in SlideTemplateKey]: z.output<(typeof SLIDE_TEMPLATES)[K]["schema"]>;
};
export type CoverContent = SlideContentByTemplate["cover"];
export type AgendaContent = SlideContentByTemplate["agenda"];
export type SectionContent = SlideContentByTemplate["section"];
export type BulletsContent = SlideContentByTemplate["bullets"];

export function isSlideTemplateKey(value: string): value is SlideTemplateKey {
  return (SLIDE_TEMPLATE_KEYS as readonly string[]).includes(value);
}
```

`packages/slides/src/validate.ts`:
```ts
import { z } from "zod";
import { SLIDE_TEMPLATES, isSlideTemplateKey, type SlideTemplateKey } from "./registry";

export interface SlideIssue {
  /** Dot path into the content ("steps.2.title"); "" = the content root; "template" = unknown key. */
  path: string;
  message: string;
}

export type ParseSlideResult =
  | { ok: true; template: SlideTemplateKey; data: Record<string, unknown> }
  | { ok: false; issues: SlideIssue[] };

export function parseSlideContent(template: string, content: unknown): ParseSlideResult {
  if (!isSlideTemplateKey(template)) {
    return { ok: false, issues: [{ path: "template", message: `Modelo desconhecido: ${template}` }] };
  }
  const result = (SLIDE_TEMPLATES[template].schema as z.ZodType).safeParse(content);
  if (result.success) {
    return { ok: true, template, data: result.data as Record<string, unknown> };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}

/** JSON Schema of the content an API client must send (input side: defaults are optional). */
export function slideTemplateJsonSchema(template: SlideTemplateKey): Record<string, unknown> {
  return z.toJSONSchema(SLIDE_TEMPLATES[template].schema as z.ZodType, {
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
}
```

`packages/slides/src/index.ts`:
```ts
export * from "./common";
export * from "./fields";
export * from "./registry";
export * from "./validate";
export * from "./slug";
export * from "./visibility";
```

- [ ] **Step 12: Run all tests to verify they pass, then build**

Run: `dcr backend pnpm --filter @repo/slides test`
Expected: PASS (slug.test.ts and registry.test.ts; 0 failures).

If the "Campo desconhecido" or "Esperado um objeto" assertions fail because zod 4 routes the root error through a different issue code, print `result.error.issues` in the test, adjust the `obj()` error map to that code, and re-run — do not loosen the test.

Run: `dcr backend pnpm --filter @repo/slides build`
Expected: exits 0; `packages/slides/dist/index.js` and `index.d.ts` exist inside the container; no `*.test.js` in `dist`.

- [ ] **Step 13: Commit**

```bash
git add packages/slides turbo.json package.json docker-compose.dev.yml pnpm-lock.yaml
git commit -m "feat(slides): add @repo/slides with the first four slide templates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Remaining 7 templates, `switchTemplate`, JSON Schema

**Files:**
- Create: `packages/slides/src/templates/{split,code,closing,quote,comparison,stats,image}.ts`
- Create: `packages/slides/src/switch-template.ts`, `packages/slides/src/templates.test.ts`, `packages/slides/src/switch-template.test.ts`
- Modify: `packages/slides/src/registry.ts`, `packages/slides/src/index.ts`

**Interfaces:**
- Consumes: Task 1 helpers (`obj`, `requiredText`, `optionalText`, `textList`, `imageRef`, `linkUrl`, `CODE_LANGUAGES`), `SlideTemplateDefinition`.
- Produces: `SLIDE_TEMPLATE_KEYS` with all 11 keys in the order `cover, agenda, section, bullets, split, code, closing, quote, comparison, stats, image`; content types `SplitContent`, `CodeContent`, `ClosingContent`, `QuoteContent`, `ComparisonContent`, `StatsContent`, `ImageContent`; `switchTemplate(content, to)`.

- [ ] **Step 1: Write the failing template tests**

`packages/slides/src/templates.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SLIDE_TEMPLATE_KEYS, parseSlideContent } from "./index";

const issuesOf = (template: string, content: unknown) => {
  const r = parseSlideContent(template, content);
  return r.ok ? [] : r.issues;
};

describe("template catalogue", () => {
  it("has the 11 templates in gallery order", () => {
    expect(SLIDE_TEMPLATE_KEYS).toEqual([
      "cover", "agenda", "section", "bullets", "split", "code",
      "closing", "quote", "comparison", "stats", "image",
    ]);
  });
});

describe("split", () => {
  const base = { title: "T", body: "Texto", image: { url: "/uploads/a.png" } };
  it("defaults imageSide to right and alt to empty", () => {
    expect(parseSlideContent("split", base)).toMatchObject({
      ok: true,
      data: { imageSide: "right", image: { url: "/uploads/a.png", alt: "" } },
    });
  });
  it("rejects a relative non-upload URL", () => {
    expect(issuesOf("split", { ...base, image: { url: "img/a.png" } })).toContainEqual({
      path: "image.url",
      message: "Use uma URL http(s) ou um caminho /uploads/…",
    });
  });
});

describe("code", () => {
  const base = { language: "kotlin", code: "fun main() {}" };
  it("keeps indentation (no trim) and accepts highlight lines", () => {
    const r = parseSlideContent("code", { ...base, code: "  val x = 1\n", highlightLines: [1] });
    expect(r).toMatchObject({ ok: true, data: { code: "  val x = 1\n" } });
  });
  it("rejects more than 24 lines", () => {
    expect(issuesOf("code", { ...base, code: Array(25).fill("x").join("\n") })).toContainEqual({
      path: "code",
      message: "Máximo de 24 linhas",
    });
  });
  it("rejects blank code", () => {
    expect(issuesOf("code", { ...base, code: "   \n " })).toContainEqual({ path: "code", message: "Obrigatório" });
  });
  it("rejects unknown languages", () => {
    expect(issuesOf("code", { ...base, language: "cobol" })[0].path).toBe("language");
  });
});

describe("closing", () => {
  it("defaults title and showSocialLinks", () => {
    expect(parseSlideContent("closing", {})).toMatchObject({
      ok: true,
      data: { title: "Obrigado!", showSocialLinks: true },
    });
  });
  it("accepts # as a CTA url", () => {
    expect(parseSlideContent("closing", { cta: { text: "Inscreva-se", url: "#" } })).toMatchObject({ ok: true });
  });
});

describe("comparison", () => {
  it("requires both columns and defaults highlight to none", () => {
    const col = { label: "Antes", items: ["a"] };
    expect(parseSlideContent("comparison", { title: "T", left: col, right: col })).toMatchObject({
      ok: true,
      data: { highlight: "none" },
    });
    expect(issuesOf("comparison", { title: "T", left: col })).toContainEqual({ path: "right", message: "Esperado um objeto" });
  });
});

describe("stats", () => {
  it("needs between 2 and 4 items", () => {
    const item = { value: "15k", label: "Devs" };
    expect(issuesOf("stats", { items: [item] })).toContainEqual({ path: "items", message: "Mínimo de 2 itens" });
    expect(issuesOf("stats", { items: Array(5).fill(item) })).toContainEqual({ path: "items", message: "Máximo de 4 itens" });
  });
});

describe("quote and image", () => {
  it("quote requires the quote text", () => {
    expect(issuesOf("quote", { author: "Linus" })).toContainEqual({ path: "quote", message: "Obrigatório" });
  });
  it("image defaults fit to contain", () => {
    expect(parseSlideContent("image", { image: { url: "https://x.dev/a.png", alt: "A" } })).toMatchObject({
      ok: true,
      data: { fit: "contain" },
    });
  });
});
```

`packages/slides/src/switch-template.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SLIDE_TEMPLATES, SLIDE_TEMPLATE_KEYS, parseSlideContent, switchTemplate } from "./index";

describe("switchTemplate", () => {
  it("keeps compatible same-name fields and fills the rest from defaults", () => {
    const next = switchTemplate({ title: "Meu título", items: ["a", "b"] }, "code");
    expect(next.title).toBe("Meu título");
    expect(next.code).toBe(SLIDE_TEMPLATES.code.defaults.code);
    expect(next).not.toHaveProperty("items");
  });

  it("drops a value that violates the new template's limit", () => {
    const next = switchTemplate({ title: "x".repeat(85) }, "section");
    expect(next.title).toBe(SLIDE_TEMPLATES.section.defaults.title);
  });

  it("drops a value of the wrong shape", () => {
    const next = switchTemplate({ title: "T", items: ["a", "b"] }, "stats");
    expect(next.items).toEqual(SLIDE_TEMPLATES.stats.defaults.items);
  });

  it("always produces valid content, for every pair of templates", () => {
    for (const from of SLIDE_TEMPLATE_KEYS) {
      for (const to of SLIDE_TEMPLATE_KEYS) {
        const next = switchTemplate(SLIDE_TEMPLATES[from].example as Record<string, unknown>, to);
        expect(parseSlideContent(to, next), `${from} → ${to}`).toMatchObject({ ok: true });
      }
    }
  });

  it("does not share references with the defaults", () => {
    const next = switchTemplate({}, "bullets");
    (next.items as string[]).push("mutated");
    expect(SLIDE_TEMPLATES.bullets.defaults.items).not.toContain("mutated");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `dcr backend pnpm --filter @repo/slides test`
Expected: FAIL — the catalogue test lists 4 keys; `switchTemplate` is not exported.

- [ ] **Step 3: Implement the seven templates**

`packages/slides/src/templates/split.ts`:
```ts
import { z } from "zod";
import { imageRef, obj, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const splitSchema = obj({
  title: requiredText(80),
  body: requiredText(600),
  image: imageRef,
  imageSide: z.enum(["left", "right"]).default("right"),
});

export const split = {
  key: "split",
  label: "Texto + imagem",
  description: "Título, texto corrido (linhas em branco separam parágrafos) e uma imagem ao lado.",
  schema: splitSchema,
  defaults: {
    title: "Título",
    body: "Escreva o texto aqui.",
    image: { url: "/uploads/placeholder.png", alt: "" },
    imageSide: "right",
  },
  example: {
    title: "O proxy no meio do caminho",
    body: "O mitmproxy recebe as chamadas do app e as repassa para a API.\n\nCom o certificado instalado, o tráfego HTTPS fica legível.",
    image: { url: "https://engenhariainversa.com.br/images/live-studio.png", alt: "Diagrama do proxy" },
    imageSide: "right",
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "body", label: "Texto", kind: "textarea", maxLength: 600, help: "Linhas em branco separam parágrafos" },
    { name: "image", label: "Imagem", kind: "image" },
    {
      name: "imageSide",
      label: "Lado da imagem",
      kind: "select",
      options: [
        { value: "left", label: "Esquerda" },
        { value: "right", label: "Direita" },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof splitSchema, "split">;
```

Note: `/uploads/placeholder.png` does not exist; the renderer shows a neutral placeholder box when an image fails to load (Task 12), so the default is still renderable and valid.

`packages/slides/src/templates/code.ts`:
```ts
import { z } from "zod";
import { CODE_LANGUAGES, obj, optionalText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

const MAX_LINES = 24;

export const codeSchema = obj({
  title: optionalText(80),
  language: z.enum(CODE_LANGUAGES, { error: `Use uma destas linguagens: ${CODE_LANGUAGES.join(", ")}` }),
  // Not trimmed: leading indentation is part of the code.
  code: z
    .string({ error: "Obrigatório" })
    .max(2000, { error: "Máximo de 2000 caracteres" })
    .refine((v) => v.trim().length > 0, { error: "Obrigatório" })
    .refine((v) => v.replace(/\n$/, "").split("\n").length <= MAX_LINES, {
      error: `Máximo de ${MAX_LINES} linhas`,
    }),
  highlightLines: z
    .array(z.int().min(1).max(MAX_LINES), { error: "Esperada uma lista de números de linha" })
    .max(MAX_LINES)
    .optional(),
  caption: optionalText(160),
});

export const code = {
  key: "code",
  label: "Código",
  description: "Trecho de código com destaque de sintaxe e linhas em evidência.",
  schema: codeSchema,
  defaults: { language: "ts", code: "console.log(\"Olá, Engenharia Inversa\");" },
  example: {
    title: "Desligando o pinning com Frida",
    language: "js",
    code: [
      "Java.perform(() => {",
      "  const Pinner = Java.use(\"okhttp3.CertificatePinner\");",
      "  Pinner.check.overload(\"java.lang.String\", \"java.util.List\")",
      "    .implementation = () => {};",
      "});",
    ].join("\n"),
    highlightLines: [4],
    caption: "Sobrescreve a checagem do OkHttp",
  },
  fields: [
    { name: "title", label: "Título", kind: "text", optional: true, maxLength: 80 },
    {
      name: "language",
      label: "Linguagem",
      kind: "select",
      options: CODE_LANGUAGES.map((l) => ({ value: l, label: l })),
    },
    { name: "code", label: "Código", kind: "code", maxLength: 2000, help: "Máximo de 24 linhas" },
    {
      name: "highlightLines",
      label: "Linhas em destaque",
      kind: "text",
      optional: true,
      help: "Números separados por vírgula, ex.: 2, 4",
    },
    { name: "caption", label: "Legenda", kind: "text", optional: true, maxLength: 160 },
  ],
} satisfies SlideTemplateDefinition<typeof codeSchema, "code">;
```

(The CMS form converts the `highlightLines` text field "2, 4" ↔ `[2, 4]`; Task 16 owns that conversion.)

`packages/slides/src/templates/closing.ts`:
```ts
import { z } from "zod";
import { linkUrl, obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const closingSchema = obj({
  title: requiredText(80).default("Obrigado!"),
  message: optionalText(240),
  cta: obj({ text: requiredText(40), url: linkUrl }).optional(),
  showSocialLinks: z.boolean().default(true),
});

export const closing = {
  key: "closing",
  label: "Encerramento",
  description: "Fechamento com mensagem, chamada para ação e os links sociais do rodapé.",
  schema: closingSchema,
  defaults: { title: "Obrigado!", showSocialLinks: true },
  example: {
    title: "Valeu, pessoal!",
    message: "Os links e o código desta live estão na descrição.",
    cta: { text: "Acompanhar no YouTube", url: "https://youtube.com/@engenhariainversa" },
    showSocialLinks: true,
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "message", label: "Mensagem", kind: "textarea", optional: true, maxLength: 240 },
    {
      name: "cta",
      label: "Chamada para ação",
      kind: "group",
      optional: true,
      fields: [
        { name: "text", label: "Texto do botão", kind: "text", maxLength: 40 },
        { name: "url", label: "Link", kind: "text" },
      ],
    },
    { name: "showSocialLinks", label: "Mostrar links sociais do rodapé", kind: "boolean" },
  ],
} satisfies SlideTemplateDefinition<typeof closingSchema, "closing">;
```

`packages/slides/src/templates/quote.ts`:
```ts
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const quoteSchema = obj({
  quote: requiredText(280),
  author: optionalText(80),
  role: optionalText(80),
});

export const quote = {
  key: "quote",
  label: "Citação",
  description: "Uma frase em destaque com autor e papel.",
  schema: quoteSchema,
  defaults: { quote: "Uma frase marcante." },
  example: {
    quote: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds",
    role: "Criador do Linux",
  },
  fields: [
    { name: "quote", label: "Citação", kind: "textarea", maxLength: 280 },
    { name: "author", label: "Autor", kind: "text", optional: true, maxLength: 80 },
    { name: "role", label: "Papel", kind: "text", optional: true, maxLength: 80 },
  ],
} satisfies SlideTemplateDefinition<typeof quoteSchema, "quote">;
```

`packages/slides/src/templates/comparison.ts`:
```ts
import { z } from "zod";
import { obj, requiredText, textList } from "../common";
import type { FieldDescriptor } from "../fields";
import type { SlideTemplateDefinition } from "../definition";

const column = obj({ label: requiredText(40), items: textList(1, 6, 120) });

export const comparisonSchema = obj({
  title: requiredText(80),
  left: column,
  right: column,
  highlight: z.enum(["left", "right", "none"]).default("none"),
});

const columnFields: FieldDescriptor[] = [
  { name: "label", label: "Rótulo", kind: "text", maxLength: 40 },
  { name: "items", label: "Itens", kind: "list", minItems: 1, maxItems: 6, maxLength: 120 },
];

export const comparison = {
  key: "comparison",
  label: "Comparação",
  description: "Duas colunas lado a lado (antes/depois, A vs B), com uma delas em destaque.",
  schema: comparisonSchema,
  defaults: {
    title: "Comparação",
    left: { label: "Antes", items: ["Item"] },
    right: { label: "Depois", items: ["Item"] },
    highlight: "none",
  },
  example: {
    title: "HTTP vs HTTPS com pinning",
    left: { label: "Sem pinning", items: ["Proxy lê tudo", "Basta instalar a CA"] },
    right: { label: "Com pinning", items: ["Conexão recusada", "Precisa de Frida/patch"] },
    highlight: "right",
  },
  fields: [
    { name: "title", label: "Título", kind: "text", maxLength: 80 },
    { name: "left", label: "Coluna da esquerda", kind: "group", fields: columnFields },
    { name: "right", label: "Coluna da direita", kind: "group", fields: columnFields },
    {
      name: "highlight",
      label: "Destaque",
      kind: "select",
      options: [
        { value: "none", label: "Nenhum" },
        { value: "left", label: "Esquerda" },
        { value: "right", label: "Direita" },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof comparisonSchema, "comparison">;
```

`packages/slides/src/templates/stats.ts`:
```ts
import { z } from "zod";
import { obj, optionalText, requiredText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const statsSchema = obj({
  title: optionalText(80),
  items: z
    .array(obj({ value: requiredText(12), label: requiredText(40) }), { error: "Esperada uma lista" })
    .min(2, { error: "Mínimo de 2 itens" })
    .max(4, { error: "Máximo de 4 itens" }),
});

export const stats = {
  key: "stats",
  label: "Números",
  description: "De 2 a 4 números grandes com rótulo, como os cards da seção Sobre.",
  schema: statsSchema,
  defaults: {
    items: [
      { value: "100+", label: "Horas de live" },
      { value: "15k", label: "Devs ativos" },
    ],
  },
  example: {
    title: "O canal até aqui",
    items: [
      { value: "42", label: "Lives" },
      { value: "15k", label: "Inscritos" },
      { value: "8", label: "Apps desmontados" },
    ],
  },
  fields: [
    { name: "title", label: "Título", kind: "text", optional: true, maxLength: 80 },
    {
      name: "items",
      label: "Números",
      kind: "objectList",
      minItems: 2,
      maxItems: 4,
      fields: [
        { name: "value", label: "Valor", kind: "text", maxLength: 12 },
        { name: "label", label: "Rótulo", kind: "text", maxLength: 40 },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof statsSchema, "stats">;
```

`packages/slides/src/templates/image.ts`:
```ts
import { z } from "zod";
import { imageRef, obj, optionalText } from "../common";
import type { SlideTemplateDefinition } from "../definition";

export const imageSchema = obj({
  image: imageRef,
  caption: optionalText(160),
  fit: z.enum(["cover", "contain"]).default("contain"),
});

export const image = {
  key: "image",
  label: "Imagem cheia",
  description: "Uma imagem ocupando o slide, com legenda opcional.",
  schema: imageSchema,
  defaults: { image: { url: "/uploads/placeholder.png", alt: "" }, fit: "contain" },
  example: {
    image: { url: "https://engenhariainversa.com.br/images/live-studio.png", alt: "Estúdio da live" },
    caption: "Bastidores da live #12",
    fit: "cover",
  },
  fields: [
    { name: "image", label: "Imagem", kind: "image" },
    { name: "caption", label: "Legenda", kind: "text", optional: true, maxLength: 160 },
    {
      name: "fit",
      label: "Enquadramento",
      kind: "select",
      options: [
        { value: "contain", label: "Mostrar inteira" },
        { value: "cover", label: "Preencher o slide" },
      ],
    },
  ],
} satisfies SlideTemplateDefinition<typeof imageSchema, "image">;
```

- [ ] **Step 4: Register them and add `switchTemplate`**

Replace `packages/slides/src/registry.ts` with:
```ts
import type { z } from "zod";
import { agenda } from "./templates/agenda";
import { bullets } from "./templates/bullets";
import { closing } from "./templates/closing";
import { code } from "./templates/code";
import { comparison } from "./templates/comparison";
import { cover } from "./templates/cover";
import { image } from "./templates/image";
import { quote } from "./templates/quote";
import { section } from "./templates/section";
import { split } from "./templates/split";
import { stats } from "./templates/stats";

export type { SlideTemplateDefinition } from "./definition";

/** Display order of the template gallery. */
export const SLIDE_TEMPLATE_KEYS = [
  "cover", "agenda", "section", "bullets", "split", "code",
  "closing", "quote", "comparison", "stats", "image",
] as const;
export type SlideTemplateKey = (typeof SLIDE_TEMPLATE_KEYS)[number];

export const SLIDE_TEMPLATES = {
  cover, agenda, section, bullets, split, code, closing, quote, comparison, stats, image,
} as const;

export type SlideContentByTemplate = {
  [K in SlideTemplateKey]: z.output<(typeof SLIDE_TEMPLATES)[K]["schema"]>;
};
export type CoverContent = SlideContentByTemplate["cover"];
export type AgendaContent = SlideContentByTemplate["agenda"];
export type SectionContent = SlideContentByTemplate["section"];
export type BulletsContent = SlideContentByTemplate["bullets"];
export type SplitContent = SlideContentByTemplate["split"];
export type CodeContent = SlideContentByTemplate["code"];
export type ClosingContent = SlideContentByTemplate["closing"];
export type QuoteContent = SlideContentByTemplate["quote"];
export type ComparisonContent = SlideContentByTemplate["comparison"];
export type StatsContent = SlideContentByTemplate["stats"];
export type ImageContent = SlideContentByTemplate["image"];

export function isSlideTemplateKey(value: string): value is SlideTemplateKey {
  return (SLIDE_TEMPLATE_KEYS as readonly string[]).includes(value);
}
```

`packages/slides/src/switch-template.ts`:
```ts
import type { z } from "zod";
import { SLIDE_TEMPLATES, type SlideTemplateKey } from "./registry";

/**
 * Content for `to`, built from its defaults plus every field of `content` that
 * `to` also has and whose value passes that field's schema. Always valid for `to`.
 */
export function switchTemplate(
  content: Record<string, unknown>,
  to: SlideTemplateKey,
): Record<string, unknown> {
  const def = SLIDE_TEMPLATES[to];
  const shape = (def.schema as unknown as z.ZodObject).shape as Record<string, z.ZodType>;
  const next: Record<string, unknown> = structuredClone(def.defaults) as Record<string, unknown>;

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const value = content[key];
    if (value === undefined) continue;
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) next[key] = structuredClone(value);
  }
  return next;
}
```

Add to `packages/slides/src/index.ts`: `export * from "./switch-template";`

- [ ] **Step 5: Run the tests to verify they pass, then build**

Run: `dcr backend pnpm --filter @repo/slides test`
Expected: PASS — registry.test.ts now iterates 11 templates; templates.test.ts and switch-template.test.ts pass.

Run: `dcr backend pnpm --filter @repo/slides build` — Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/slides
git commit -m "feat(slides): add the remaining seven templates and template switching

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Build wiring for `@repo/slides` + backend test harness

Makes `@repo/slides` build in every image and dev service, and gives the backend a
Vitest harness (SWC for decorators, a migrated `ei_test` database, app bootstrap and
GraphQL helpers) that Tasks 4–9 use.

**Files:**
- Modify: `Dockerfile` (`database-build`, `landing-build`, `cms` and `landing` runtime stages), `Dockerfile.dev`, `docker-compose.dev.yml` (service commands), `apps/backend/package.json`, `pnpm-lock.yaml`
- Create: `apps/backend/vitest.config.ts`, `apps/backend/test/test-db-url.ts`, `apps/backend/test/global-setup.ts`, `apps/backend/test/helpers.ts`, `apps/backend/src/app.smoke.test.ts`

**Interfaces:**
- Consumes: `@repo/slides` package (Task 1).
- Produces (in `apps/backend/test/helpers.ts`):
  ```ts
  export async function createTestApp(): Promise<INestApplication>;
  export async function resetDatabase(): Promise<void>;          // truncates every app table
  export async function createUser(opts?: { admin?: boolean; roleName?: "ADMIN" | "MANAGER" | "AUTHENTICATED" }): Promise<User & { role: Role }>;
  export function jwtFor(app: INestApplication, user: User & { role: Role }): string;
  export type GqlResponse<T = any> = { data?: T; errors?: { message: string; extensions?: Record<string, any> }[] };
  export async function gql<T = any>(app: INestApplication, query: string, variables?: Record<string, unknown>, token?: string): Promise<GqlResponse<T>>;
  export function errorCode(res: GqlResponse): string | undefined;   // errors[0].extensions.code
  ```
  Backend test command: `dcx backend pnpm --filter backend test` (needs `db` running).

- [ ] **Step 1: Build `@repo/slides` in the production Dockerfile**

In `Dockerfile`, stage `database-build`, add after `RUN pnpm --filter @repo/database build`:
```dockerfile
RUN pnpm --filter @repo/slides build
```
Change the landing build stage header from `FROM source AS landing-build` to:
```dockerfile
FROM database-build AS landing-build
```
In the `cms` runtime stage replace `COPY --from=deps /app/packages ./packages` with:
```dockerfile
COPY --from=cms-build /app/packages ./packages
```
In the `landing` runtime stage replace `COPY --from=deps /app/packages ./packages` with:
```dockerfile
COPY --from=landing-build /app/packages ./packages
```
(The runtime stages need `packages/slides/dist`, which only exists after the build stage. The backend runtime stage already copies `/app/packages` from `database-build`.)

- [ ] **Step 2: Build it in dev too**

`Dockerfile.dev` — after `RUN pnpm --filter @repo/database build` add:
```dockerfile
RUN pnpm --filter @repo/slides build
```
`docker-compose.dev.yml` service commands:
```yaml
  backend:
    command: sh -c "pnpm --filter @repo/slides build && pnpm --filter @repo/database build && pnpm --filter @repo/database db:migrate:deploy && pnpm --filter @repo/database db:seed && pnpm --filter backend dev"
  cms:
    command: sh -c "pnpm --filter @repo/slides build && pnpm --filter cms dev"
  landing:
    command: sh -c "pnpm --filter @repo/slides build && pnpm --filter landing dev"
```
(Only the `command:` lines change. `packages/slides/src` is already mounted since Task 1.)

- [ ] **Step 3: Add backend test dependencies**

`apps/backend/package.json`:
- `"scripts"`: add `"test": "vitest run"`.
- `"dependencies"`: add `"@repo/slides": "workspace:*"`.
- `"devDependencies"`: add `"@nestjs/testing": "^11"`, `"@swc/core": "^1.7.0"`, `"@types/supertest": "^6.0.2"`, `"supertest": "^7.0.0"`, `"unplugin-swc": "^1.5.1"`, `"vitest": "^3.2.0"`.

Run: `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build`
Expected: lockfile updated; images build (the build now runs `@repo/slides build`).

- [ ] **Step 4: Write the harness**

`apps/backend/test/test-db-url.ts`:
```ts
/**
 * Tests run against a sibling database of the dev one (same server, name
 * `ei_test`), so they never touch the data you use in the CMS.
 */
export function testDatabaseUrl(base = process.env.DATABASE_URL): string {
  if (!base) throw new Error("DATABASE_URL must be set to run the backend tests");
  const url = new URL(base);
  url.pathname = "/ei_test";
  return url.toString();
}

export function adminDatabaseUrl(base = process.env.DATABASE_URL): string {
  if (!base) throw new Error("DATABASE_URL must be set to run the backend tests");
  const url = new URL(base);
  url.pathname = "/postgres";
  return url.toString();
}
```

`apps/backend/vitest.config.ts`:
```ts
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/test-db-url";

export default defineConfig({
  // SWC instead of esbuild: Nest needs emitDecoratorMetadata.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globalSetup: ["test/global-setup.ts"],
    // One database for all files: run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: "test-secret",
      UPLOADS_DIR: "/tmp/ei-test-uploads",
      NODE_ENV: "test",
    },
  },
});
```

`apps/backend/test/global-setup.ts`:
```ts
import { execSync } from "child_process";
import { PrismaClient } from "@repo/database";
import { adminDatabaseUrl, testDatabaseUrl } from "./test-db-url";

/** Creates `ei_test` if needed and applies every migration to it. */
export default async function setup() {
  const admin = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl() } } });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ei_test') AS "exists"`;
    if (!rows[0]?.exists) await admin.$executeRawUnsafe(`CREATE DATABASE ei_test`);
  } finally {
    await admin.$disconnect();
  }

  execSync("pnpm --filter @repo/database db:migrate:deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
```

`apps/backend/test/helpers.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, type Role, type User } from "@repo/database";
import { AppModule } from "../src/app.module";

export type GqlResponse<T = any> = {
  data?: T;
  errors?: { message: string; extensions?: Record<string, any> }[];
};

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

const ROLE_FLAGS = {
  ADMIN: { label: "Administrador", isAdmin: true },
  MANAGER: { label: "Gerente", isAdmin: false },
  AUTHENTICATED: { label: "Autenticado", isAdmin: false },
} as const;

let userSeq = 0;

export async function createUser(
  opts: { admin?: boolean; roleName?: keyof typeof ROLE_FLAGS } = {},
): Promise<User & { role: Role }> {
  const roleName = opts.roleName ?? (opts.admin === false ? "AUTHENTICATED" : "ADMIN");
  const flags = ROLE_FLAGS[roleName];
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName, label: flags.label, isAdmin: flags.isAdmin, isSystem: true },
  });
  userSeq += 1;
  return prisma.user.create({
    data: {
      firstName: "Test",
      lastName: `User${userSeq}`,
      email: `user${userSeq}-${Date.now()}@test.dev`,
      username: `user${userSeq}-${Date.now()}`,
      password: "not-used",
      roleId: role.id,
    },
    include: { role: true },
  });
}

export function jwtFor(app: INestApplication, user: User & { role: Role }): string {
  return app
    .get(JwtService, { strict: false })
    .sign({ sub: user.id, email: user.email, role: user.role.name });
}

export async function gql<T = any>(
  app: INestApplication,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<GqlResponse<T>> {
  const req = request(app.getHttpServer()).post("/graphql");
  if (token) req.set("Authorization", `Bearer ${token}`);
  const res = await req.send({ query, variables });
  return res.body as GqlResponse<T>;
}

export function errorCode(res: GqlResponse): string | undefined {
  return res.errors?.[0]?.extensions?.code;
}
```

- [ ] **Step 5: Write the smoke test**

`apps/backend/src/app.smoke.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../test/helpers";

describe("test harness", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);

  it("serves GraphQL", async () => {
    const res = await gql(app, "{ hello }");
    expect(res.data?.hello).toContain("Engenhariainversa");
  });

  it("authenticates a JWT minted by the helper", async () => {
    const user = await createUser({ admin: true });
    const res = await gql(app, "{ me { id } }", undefined, jwtFor(app, user));
    expect(res.data?.me.id).toBe(user.id);
  });

  it("maps a missing token to UNAUTHENTICATED", async () => {
    const res = await gql(app, "{ me { id } }");
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `docker compose -f docker-compose.dev.yml up -d db backend`, then `dcx backend pnpm --filter backend test`
Expected: global setup prints the migrations applied to `ei_test`; 3 tests PASS.

If `me` returns a different error code than `UNAUTHENTICATED`, print `res.errors` and assert the code Nest actually emits for `UnauthorizedException` in this stack; every later task uses `errorCode(res)` and must use that same value.

- [ ] **Step 7: Verify the production images still build**

Run: `docker build --target backend -t ei-backend-check . && docker build --target cms --build-arg NEXT_PUBLIC_API_URL=http://localhost:4050 --build-arg NEXT_PUBLIC_GRAPHQL_PATH=/graphql -t ei-cms-check . && docker build --target landing --build-arg NEXT_PUBLIC_API_URL=http://localhost:4050 --build-arg NEXT_PUBLIC_GRAPHQL_PATH=/graphql -t ei-landing-check .`
Expected: all three builds succeed. Then `docker image rm ei-backend-check ei-cms-check ei-landing-check`.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile Dockerfile.dev docker-compose.dev.yml apps/backend/package.json apps/backend/vitest.config.ts apps/backend/test apps/backend/src/app.smoke.test.ts pnpm-lock.yaml
git commit -m "build: compile @repo/slides in every image and add the backend test harness

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Prisma models and `add_presentations` migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_add_presentations/migration.sql` (generated)
- Create: `apps/backend/src/presentations/schema.test.ts`

**Interfaces:**
- Consumes: test harness (Task 3).
- Produces: Prisma models `Presentation`, `Slide`, `ApiKey`, enum `PresentationVisibility`; `User.presentations`, `User.apiKeys` back-relations; client accessors `prisma.presentation`, `prisma.slide`, `prisma.apiKey`.

- [ ] **Step 1: Write the failing test**

`apps/backend/src/presentations/schema.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";

describe("presentation tables", () => {
  beforeEach(resetDatabase);

  it("stores a deck with ordered JSON slides, PRIVATE by default", async () => {
    const user = await createUser();
    const deck = await prisma.presentation.create({
      data: {
        slug: "minha-live",
        title: "Minha live",
        createdById: user.id,
        slides: {
          create: [
            { order: 0, template: "cover", content: { title: "Oi", showMascot: true } },
            { order: 1, template: "bullets", content: { title: "T", items: ["a"] }, notes: "fale devagar" },
          ],
        },
      },
      include: { slides: { orderBy: { order: "asc" } } },
    });
    expect(deck.visibility).toBe("PRIVATE");
    expect(deck.deletedAt).toBeNull();
    expect(deck.slides.map((s) => s.template)).toEqual(["cover", "bullets"]);
    expect(deck.slides[0].notes).toBe("");
    expect(deck.slides[0].hidden).toBe(false);
    expect(deck.slides[1].content).toEqual({ title: "T", items: ["a"] });
  });

  it("deletes slides with their presentation", async () => {
    const user = await createUser();
    const deck = await prisma.presentation.create({
      data: { slug: "x", title: "X", createdById: user.id, slides: { create: [{ template: "cover", content: {} }] } },
    });
    await prisma.presentation.delete({ where: { id: deck.id } });
    expect(await prisma.slide.count()).toBe(0);
  });

  it("enforces unique slugs and unique API key hashes", async () => {
    const user = await createUser();
    await prisma.presentation.create({ data: { slug: "dup", title: "A", createdById: user.id } });
    await expect(
      prisma.presentation.create({ data: { slug: "dup", title: "B", createdById: user.id } }),
    ).rejects.toMatchObject({ code: "P2002" });

    const key = { name: "k", prefix: "abcd1234", hash: "h", createdById: user.id, expiresAt: new Date() };
    await prisma.apiKey.create({ data: key });
    await expect(prisma.apiKey.create({ data: key })).rejects.toMatchObject({ code: "P2002" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations/schema.test.ts`
Expected: FAIL — TypeScript/runtime error: `prisma.presentation` is undefined.

- [ ] **Step 3: Add the models**

Append to `packages/database/prisma/schema.prisma`:
```prisma
// ── Presentations ────────────────────────────────────

enum PresentationVisibility {
  PUBLIC
  PRIVATE
  // Modelled only: behaves as PRIVATE until the members area exists.
  MEMBERS
}

// A slide deck. Slides are built from the templates in @repo/slides; the
// backend validates every slide write against them.
model Presentation {
  id          String                 @id @default(uuid())
  slug        String                 @unique
  title       String
  description String?
  visibility  PresentationVisibility @default(PRIVATE)
  createdById String                 @map("created_by_id")
  createdBy   User                   @relation(fields: [createdById], references: [id])
  // Soft delete: set by deletePresentation, which API keys can also call. Only
  // purgePresentation, which requires a logged-in user, removes the row.
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
  // Rewritten in a transaction on every reorder, like Episode and SocialLink.
  order          Int          @default(0)
  // Template key from @repo/slides. A string, not an enum, so adding a
  // template needs no migration; the registry rejects unknown keys on write.
  template       String
  content        Json
  notes          String       @default("")
  hidden         Boolean      @default(false)
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@index([presentationId, order])
  @@map("slides")
}

// Short-lived bearer token for external agents (e.g. Claude) to manage
// presentations. Only the SHA-256 of the token is stored.
model ApiKey {
  id          String    @id @default(uuid())
  name        String
  // First 8 characters after "ei_", shown in the CMS list.
  prefix      String
  hash        String    @unique
  createdById String    @map("created_by_id")
  createdBy   User      @relation(fields: [createdById], references: [id])
  expiresAt   DateTime  @map("expires_at")
  lastUsedAt  DateTime? @map("last_used_at")
  revokedAt   DateTime? @map("revoked_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("api_keys")
}
```
In `model User`, add after the `role` relation line:
```prisma
  presentations Presentation[]
  apiKeys       ApiKey[]
```

- [ ] **Step 4: Generate the migration**

Run: `dcx backend pnpm --filter @repo/database db:migrate:dev --name add_presentations`
Expected: `Applying migration ..._add_presentations`, `Your database is now in sync with your schema`, Prisma client regenerated.

Check the generated SQL creates `presentations`, `slides`, `api_keys`, the `PresentationVisibility` enum, the `slides_presentation_id_order_idx` index and the `ON DELETE CASCADE` foreign key from `slides`. The container writes as root: run `ls -l packages/database/prisma/migrations | tail -2`; if the new folder is owned by root, run `sudo chown -R "$(id -u):$(id -g)" packages/database/prisma/migrations`.

Rebuild the compiled client used by the backend: `dcx backend pnpm --filter @repo/database build`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations/schema.test.ts`
Expected: 3 tests PASS (global setup applied the new migration to `ei_test`).

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma apps/backend/src/presentations/schema.test.ts
git commit -m "feat(database): add presentations, slides and API keys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: API key tokens, service, passport strategy and guards

**Files:**
- Create: `apps/backend/src/auth/auth-kind.ts`, `apps/backend/src/api-keys/api-key-token.ts`, `apps/backend/src/api-keys/api-keys.service.ts`, `apps/backend/src/auth/api-key.strategy.ts`, `apps/backend/src/auth/jwt-or-api-key.guard.ts`
- Create: `apps/backend/src/api-keys/api-key-token.test.ts`, `apps/backend/src/api-keys/api-keys.service.test.ts`, `apps/backend/src/auth/jwt-or-api-key.guard.test.ts`
- Modify: `apps/backend/package.json` (add `passport-custom`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Prisma `ApiKey` (Task 4), test harness (Task 3).
- Produces: `AuthKind`, `AuthenticatedUser`, `authKindOf`; `generateToken`, `hashToken`; `API_KEY_TTL_MS`, `ApiKeyExpiryKey = keyof typeof API_KEY_TTL_MS`, `ApiKeysService` (`create`, `list`, `revoke`, `authenticate`); `ApiKeyStrategy` (passport name `"api-key"`); `GqlJwtOrApiKeyGuard`, `HttpJwtOrApiKeyGuard`, `GqlOptionalAuthGuard`. The strategy and service are registered in `ApiKeysModule` (Task 6).

- [ ] **Step 1: Add the dependency**

`apps/backend/package.json` `"dependencies"`: add `"passport-custom": "^1.1.1"`.
Run: `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build backend && docker compose -f docker-compose.dev.yml up -d backend`.

- [ ] **Step 2: Write the failing tests**

`apps/backend/src/api-keys/api-key-token.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./api-key-token";

describe("generateToken", () => {
  it("returns an ei_ token, its sha256 and an 8-char display prefix", () => {
    const { token, hash, displayPrefix } = generateToken("ei_");
    expect(token).toMatch(/^ei_[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(displayPrefix).toBe(token.slice(3, 11));
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken("ei_").token));
    expect(tokens.size).toBe(50);
  });
});
```

`apps/backend/src/api-keys/api-keys.service.test.ts`:
```ts
import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";
import { ApiKeysService } from "./api-keys.service";

describe("ApiKeysService", () => {
  const service = new ApiKeysService();
  beforeEach(resetDatabase);
  afterEach(() => vi.useRealTimers());

  it("creates a key, stores only the hash, and returns the token once", async () => {
    const user = await createUser();
    const { apiKey, token } = await service.create(user.id, "  Live #12 — Claude  ", "ONE_DAY");
    expect(apiKey.name).toBe("Live #12 — Claude");
    expect(token.startsWith("ei_")).toBe(true);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(row.hash).not.toContain(token);
    expect(row.prefix).toBe(token.slice(3, 11));
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime();
    expect(ttl).toBeGreaterThan(24 * 3600_000 - 5_000);
    expect(ttl).toBeLessThan(24 * 3600_000 + 5_000);
  });

  it("rejects an empty name", async () => {
    const user = await createUser();
    await expect(service.create(user.id, "   ", "ONE_HOUR")).rejects.toThrow("Nome obrigatório");
  });

  it("authenticates a valid key as its creator, marked apiKey", async () => {
    const user = await createUser();
    const { apiKey, token } = await service.create(user.id, "k", "ONE_HOUR");
    const authed = await service.authenticate(token);
    expect(authed.id).toBe(user.id);
    expect(authed.role.name).toBe("ADMIN");
    expect(authed.authKind).toBe("apiKey");
    expect(authed.apiKeyId).toBe(apiKey.id);
  });

  it("rejects unknown, expired and revoked keys with distinct messages", async () => {
    const user = await createUser();
    await expect(service.authenticate("ei_nope")).rejects.toThrow(new UnauthorizedException("Chave inválida"));

    const expired = await service.create(user.id, "old", "ONE_HOUR");
    await prisma.apiKey.update({ where: { id: expired.apiKey.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(service.authenticate(expired.token)).rejects.toThrow("Chave expirada");

    const revoked = await service.create(user.id, "rev", "ONE_HOUR");
    await service.revoke(revoked.apiKey.id);
    await expect(service.authenticate(revoked.token)).rejects.toThrow("Chave revogada");
  });

  it("writes lastUsedAt at most once a minute", async () => {
    const user = await createUser();
    const { apiKey, token } = await service.create(user.id, "k", "ONE_HOUR");
    await service.authenticate(token);
    const first = (await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })).lastUsedAt;
    expect(first).not.toBeNull();
    await service.authenticate(token);
    const second = (await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })).lastUsedAt;
    expect(second?.getTime()).toBe(first?.getTime());
  });

  it("lists newest first and revokes idempotently", async () => {
    const user = await createUser();
    const a = await service.create(user.id, "a", "ONE_HOUR");
    const b = await service.create(user.id, "b", "ONE_HOUR");
    expect((await service.list()).map((k) => k.id)).toEqual([b.apiKey.id, a.apiKey.id]);
    const once = await service.revoke(a.apiKey.id);
    const twice = await service.revoke(a.apiKey.id);
    expect(twice.revokedAt?.getTime()).toBe(once.revokedAt?.getTime());
  });
});
```

`apps/backend/src/auth/jwt-or-api-key.guard.test.ts`:
```ts
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { authKindOf } from "./auth-kind";
import { GqlOptionalAuthGuard } from "./jwt-or-api-key.guard";

describe("GqlOptionalAuthGuard.handleRequest", () => {
  const guard = new GqlOptionalAuthGuard();

  it("lets anonymous requests through as null", () => {
    expect(guard.handleRequest(null, false)).toBeNull();
  });

  it("rejects an expired key even when the route is optional", () => {
    const err = new UnauthorizedException("Chave expirada");
    expect(() => guard.handleRequest(err, false)).toThrow("Chave expirada");
  });

  it("passes the user through", () => {
    const user = { id: "u" } as any;
    expect(guard.handleRequest(null, user)).toBe(user);
  });
});

describe("authKindOf", () => {
  it("distinguishes keys from JWT sessions", () => {
    expect(authKindOf({ authKind: "apiKey" } as any)).toBe("apiKey");
    expect(authKindOf({ id: "u" } as any)).toBe("jwt");
    expect(authKindOf(null)).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `dcx backend pnpm --filter backend exec vitest run src/api-keys src/auth`
Expected: FAIL — modules `./api-key-token`, `./api-keys.service`, `./auth-kind`, `./jwt-or-api-key.guard` not found.

- [ ] **Step 4: Implement token helpers and auth kinds**

`apps/backend/src/api-keys/api-key-token.ts`:
```ts
import { createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A new bearer token. Only `hash` is stored; `token` is shown to the user once. */
export function generateToken(prefix: "ei_"): { token: string; hash: string; displayPrefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const token = `${prefix}${secret}`;
  return { token, hash: hashToken(token), displayPrefix: secret.slice(0, 8) };
}
```

`apps/backend/src/auth/auth-kind.ts`:
```ts
import type { Role, User } from "@repo/database";

export type AuthKind = "jwt" | "apiKey";

/** `req.user` for both JWT sessions and API keys (a key acts as its creator). */
export type AuthenticatedUser = User & { role: Role; authKind?: AuthKind; apiKeyId?: string };

export function authKindOf(user: AuthenticatedUser | null | undefined): AuthKind | null {
  if (!user) return null;
  return user.authKind ?? "jwt";
}
```

- [ ] **Step 5: Implement the service**

`apps/backend/src/api-keys/api-keys.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { prisma, type ApiKey } from "@repo/database";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { generateToken, hashToken } from "./api-key-token";

const HOUR = 3600_000;

export const API_KEY_TTL_MS = {
  ONE_HOUR: HOUR,
  ONE_DAY: 24 * HOUR,
  SEVEN_DAYS: 7 * 24 * HOUR,
} as const;
export type ApiKeyExpiryKey = keyof typeof API_KEY_TTL_MS;

const LAST_USED_RESOLUTION_MS = 60_000;

@Injectable()
export class ApiKeysService {
  async create(
    userId: string,
    name: string,
    expiresIn: ApiKeyExpiryKey,
  ): Promise<{ apiKey: ApiKey; token: string }> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException("Nome obrigatório");
    if (trimmed.length > 80) throw new BadRequestException("Nome com no máximo 80 caracteres");

    const { token, hash, displayPrefix } = generateToken("ei_");
    const apiKey = await prisma.apiKey.create({
      data: {
        name: trimmed,
        prefix: displayPrefix,
        hash,
        createdById: userId,
        expiresAt: new Date(Date.now() + API_KEY_TTL_MS[expiresIn]),
      },
    });
    return { apiKey, token };
  }

  list(): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  }

  async revoke(id: string): Promise<ApiKey> {
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException("Chave não encontrada");
    if (key.revokedAt) return key;
    return prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const key = await prisma.apiKey.findUnique({
      where: { hash: hashToken(token) },
      include: { createdBy: { include: { role: true } } },
    });
    if (!key) throw new UnauthorizedException("Chave inválida");
    if (key.revokedAt) throw new UnauthorizedException("Chave revogada");
    if (key.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException("Chave expirada");

    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    }

    return { ...key.createdBy, authKind: "apiKey", apiKeyId: key.id };
  }
}
```

- [ ] **Step 6: Implement the strategy and guards**

`apps/backend/src/auth/api-key.strategy.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-custom";
import { ApiKeysService } from "../api-keys/api-keys.service";
import type { AuthenticatedUser } from "./auth-kind";

/**
 * Bearer tokens starting with "ei_" are API keys. Anything else is left to the
 * JWT strategy (returning null = "not mine", so passport tries the next one).
 * A bad key throws, which stops the chain with that message.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, "api-key") {
  constructor(private readonly apiKeys: ApiKeysService) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser | null> {
    const header = req.headers?.authorization ?? "";
    const match = /^Bearer\s+(ei_\S+)$/i.exec(header);
    if (!match) return null;
    return this.apiKeys.authenticate(match[1]);
  }
}
```

`apps/backend/src/auth/jwt-or-api-key.guard.ts`:
```ts
import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

const STRATEGIES = ["api-key", "jwt"];

/** GraphQL operations that accept a CMS session or an API key. */
@Injectable()
export class GqlJwtOrApiKeyGuard extends AuthGuard(STRATEGIES) {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }
}

/** REST routes (uploads) that accept a CMS session or an API key. */
@Injectable()
export class HttpJwtOrApiKeyGuard extends AuthGuard(STRATEGIES) {}

/**
 * Never rejects a request without credentials (req.user = null), but a bad API
 * key still fails: an agent whose key expired must not be served as anonymous.
 */
@Injectable()
export class GqlOptionalAuthGuard extends AuthGuard(STRATEGIES) {
  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }

  handleRequest<TUser = any>(err: unknown, user: TUser | false): TUser | null {
    if (err) throw err;
    return user || null;
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend exec vitest run src/api-keys src/auth`
Expected: PASS (token: 2, service: 6, guard: 4).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/api-keys apps/backend/src/auth apps/backend/package.json pnpm-lock.yaml
git commit -m "feat(backend): authenticate temporary API keys alongside JWT

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: API keys GraphQL + uploads accept keys

**Files:**
- Create: `apps/backend/src/api-keys/api-keys.types.ts`, `apps/backend/src/api-keys/api-keys.resolver.ts`, `apps/backend/src/api-keys/api-keys.module.ts`, `apps/backend/src/api-keys/api-keys.resolver.test.ts`
- Modify: `apps/backend/src/app.module.ts` (import `ApiKeysModule`), `apps/backend/src/upload/upload.controller.ts` (guard), `apps/backend/src/permissions/permissions.service.ts` (`RESOURCES` += `"apiKeys"`), `apps/backend/src/schema.gql` (regenerated)

**Interfaces:**
- Consumes: `ApiKeysService`, `ApiKeyStrategy`, `HttpJwtOrApiKeyGuard` (Task 5); `GqlAuthGuard`, `RolesGuard`, `@Resource`, `@CurrentUser` (existing).
- Produces: GraphQL `ApiKey` type, `ApiKeyExpiry` enum, `CreatedApiKey`; `apiKeys`, `createApiKey(name, expiresIn)`, `revokeApiKey(id)`; `ApiKeysModule` (exports `ApiKeysService`, registers `ApiKeyStrategy` — Task 9 relies on the strategy being registered).

- [ ] **Step 1: Write the failing integration test**

`apps/backend/src/api-keys/api-keys.resolver.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";

const CREATE = `mutation ($name: String!, $expiresIn: ApiKeyExpiry!) {
  createApiKey(name: $name, expiresIn: $expiresIn) { token apiKey { id name prefix expiresAt revokedAt } }
}`;
const LIST = `{ apiKeys { id name prefix lastUsedAt revokedAt } }`;
const REVOKE = `mutation ($id: ID!) { revokeApiKey(id: $id) { id revokedAt } }`;

// 1×1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("API keys over GraphQL", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);

  it("creates, lists and revokes keys with a CMS session", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const created = await gql(app, CREATE, { name: "Live #12", expiresIn: "ONE_HOUR" }, jwt);
    const { token, apiKey } = created.data.createApiKey;
    expect(token).toMatch(/^ei_/);
    expect(apiKey.prefix).toBe(token.slice(3, 11));

    const listed = await gql(app, LIST, undefined, jwt);
    expect(listed.data.apiKeys).toHaveLength(1);
    expect(listed.data.apiKeys[0]).not.toHaveProperty("token");

    const revoked = await gql(app, REVOKE, { id: apiKey.id }, jwt);
    expect(revoked.data.revokeApiKey.revokedAt).not.toBeNull();
  });

  it("refuses key management and other JWT-only operations to an API key", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const { token } = (await gql(app, CREATE, { name: "k", expiresIn: "ONE_HOUR" }, jwt)).data.createApiKey;

    expect(errorCode(await gql(app, LIST, undefined, token))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, CREATE, { name: "x", expiresIn: "ONE_HOUR" }, token))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, "{ me { id } }", undefined, token))).toBe("UNAUTHENTICATED");
  });

  it("refuses key management to roles without the apiKeys permission", async () => {
    const jwt = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, LIST, undefined, jwt))).toBe("FORBIDDEN");
  });

  it("accepts an API key on POST /uploads, and rejects a revoked one", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const { token, apiKey } = (await gql(app, CREATE, { name: "k", expiresIn: "ONE_HOUR" }, jwt)).data.createApiKey;

    const ok = await request(app.getHttpServer())
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PNG, { filename: "dot.png", contentType: "image/png" });
    expect(ok.status).toBe(201);
    expect(ok.body.url).toMatch(/^\/uploads\/.+\.png$/);

    await gql(app, REVOKE, { id: apiKey.id }, jwt);
    const denied = await request(app.getHttpServer())
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PNG, { filename: "dot.png", contentType: "image/png" });
    expect(denied.status).toBe(401);
    expect(denied.body.message).toBe("Chave revogada");
  });
});
```

Note on `FORBIDDEN`: `RolesGuard` returning `false` makes Nest throw `ForbiddenException`, which Apollo reports as `FORBIDDEN`. If the stack reports a different code, assert the code it actually emits (print `res.errors`) and use that same value in Task 9.

- [ ] **Step 2: Run it to verify it fails**

Run: `dcx backend pnpm --filter backend exec vitest run src/api-keys/api-keys.resolver.test.ts`
Expected: FAIL — `Unknown type "ApiKeyExpiry"` / `Cannot query field "apiKeys"`.

- [ ] **Step 3: Implement types, resolver and module**

`apps/backend/src/api-keys/api-keys.types.ts`:
```ts
import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";

export enum ApiKeyExpiry {
  ONE_HOUR = "ONE_HOUR",
  ONE_DAY = "ONE_DAY",
  SEVEN_DAYS = "SEVEN_DAYS",
}
registerEnumType(ApiKeyExpiry, { name: "ApiKeyExpiry" });

@ObjectType("ApiKey")
export class ApiKeyType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: "First 8 characters after ei_, for identification" })
  prefix!: string;

  @Field()
  expiresAt!: Date;

  @Field({ nullable: true })
  lastUsedAt?: Date;

  @Field({ nullable: true })
  revokedAt?: Date;

  @Field()
  createdAt!: Date;
}

@ObjectType("CreatedApiKey")
export class CreatedApiKeyType {
  @Field(() => ApiKeyType)
  apiKey!: ApiKeyType;

  @Field({ description: "The full token. Returned only here; store it now." })
  token!: string;
}
```

`apps/backend/src/api-keys/api-keys.resolver.ts`:
```ts
import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GqlAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { CurrentUser } from "../common/current-user.decorator";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { ApiKeysService } from "./api-keys.service";
import { ApiKeyExpiry, ApiKeyType, CreatedApiKeyType } from "./api-keys.types";

// JWT only (GqlAuthGuard): an API key can never list, mint or revoke keys.
@Resolver()
export class ApiKeysResolver {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Query(() => [ApiKeyType])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("apiKeys", "read")
  apiKeys() {
    return this.apiKeys.list();
  }

  @Mutation(() => CreatedApiKeyType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("apiKeys", "create")
  createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Args("name") name: string,
    @Args("expiresIn", { type: () => ApiKeyExpiry }) expiresIn: ApiKeyExpiry,
  ) {
    return this.apiKeys.create(user.id, name, expiresIn);
  }

  @Mutation(() => ApiKeyType)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("apiKeys", "update")
  revokeApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.apiKeys.revoke(id);
  }
}
```

`apps/backend/src/api-keys/api-keys.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ApiKeyStrategy } from "../auth/api-key.strategy";
import { ApiKeysResolver } from "./api-keys.resolver";
import { ApiKeysService } from "./api-keys.service";

@Module({
  imports: [PassportModule],
  providers: [ApiKeysService, ApiKeysResolver, ApiKeyStrategy],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
```

`apps/backend/src/app.module.ts`: `import { ApiKeysModule } from "./api-keys/api-keys.module";` and add `ApiKeysModule,` to `imports` after `AuthModule,`.

`apps/backend/src/permissions/permissions.service.ts`:
```ts
const RESOURCES = ["hero", "about", "live", "episodes", "users", "pages", "apiKeys"];
```

- [ ] **Step 4: Let uploads accept keys**

`apps/backend/src/upload/upload.controller.ts`: remove `import { AuthGuard } from "@nestjs/passport";`, add `import { HttpJwtOrApiKeyGuard } from "../auth/jwt-or-api-key.guard";`, and change the decorator on `uploadFile` to:
```ts
  @UseGuards(HttpJwtOrApiKeyGuard)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend test`
Expected: all backend tests PASS (smoke, schema, api-keys, resolver). `src/schema.gql` now contains `type ApiKey`, `enum ApiKeyExpiry`, `type CreatedApiKey`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src
git commit -m "feat(backend): manage API keys over GraphQL and accept them on uploads

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `PresentationsService` (CRUD, slug, trash, visibility)

**Files:**
- Create: `apps/backend/src/presentations/presentation-errors.ts`, `apps/backend/src/presentations/slide-validation.ts`, `apps/backend/src/presentations/presentations.service.ts`, `apps/backend/src/presentations/presentations.service.test.ts`

**Interfaces:**
- Consumes: Prisma models (Task 4); `@repo/slides` (`parseSlideContent`, `isSlideTemplateKey`, `slugify`, `isValidSlug`, `SlideTemplateKey`); `AuthenticatedUser` (Task 5).
- Produces:
  ```ts
  // presentation-errors.ts — all return GraphQLError
  invalidSlideContent(slideIndex: number, template: string, issues: SlideIssue[])  // code INVALID_SLIDE_CONTENT
  unknownTemplate(slideIndex: number, template: string)                           // code UNKNOWN_TEMPLATE
  slugTaken(slug: string)                                                         // code SLUG_TAKEN
  invalidSlug(slug: string)                                                       // code INVALID_SLUG
  inTrash()                                                                       // code BAD_USER_INPUT, "Apresentação na lixeira"
  badInput(message: string)                                                       // code BAD_USER_INPUT
  notFound(message: string)                                                       // code NOT_FOUND
  // slide-validation.ts
  export interface SlideInputData { template: string; content: unknown; notes?: string | null; hidden?: boolean | null }
  export interface ValidSlide { template: SlideTemplateKey; content: Record<string, unknown>; notes: string; hidden: boolean }
  export function validateSlide(input: SlideInputData, slideIndex: number): ValidSlide;  // throws
  export function validateSlides(inputs: SlideInputData[]): ValidSlide[];               // index = position
  // presentations.service.ts
  export type SlideView = Omit<Slide, "notes"> & { notes: string | null };
  export type PresentationWithSlides = Presentation & { slides: SlideView[] };
  export type Viewer = { user: AuthenticatedUser; canRead: boolean } | null;
  export function toAnonymousView(p: PresentationWithSlides): PresentationWithSlides;
  export async function assertWritable(presentationId: string): Promise<Presentation>;  // NOT_FOUND / inTrash
  export interface CreatePresentationData { title: string; slug?: string | null; description?: string | null; visibility?: PresentationVisibility | null; slides?: SlideInputData[] | null }
  export interface UpdatePresentationData { title?: string | null; slug?: string | null; description?: string | null; visibility?: PresentationVisibility | null }
  class PresentationsService { list; getById; getBySlug; create; update; duplicate; softDelete; restore; purge; assertNotTrashed }
  ```
  (`validateSlides` is a free function; Task 8's `SlidesService` uses it.)

- [ ] **Step 1: Write the failing tests**

`apps/backend/src/presentations/presentations.service.test.ts`:
```ts
import { UnauthorizedException } from "@nestjs/common";
import { GraphQLError } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";
import { PresentationsService, type Viewer } from "./presentations.service";

const service = new PresentationsService();
const cover = { template: "cover", content: { title: "Capa" } };
const bullets = { template: "bullets", content: { title: "T", items: ["a"] }, notes: "segredo" };

const codeOf = (fn: () => Promise<unknown>) =>
  fn().then(
    () => undefined,
    (e: unknown) => (e instanceof GraphQLError ? e.extensions.code : (e as Error).constructor.name),
  );

describe("PresentationsService", () => {
  let userId: string;
  let reader: Viewer;
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    userId = user.id;
    reader = { user, canRead: true };
  });

  describe("create", () => {
    it("generates a slug, defaults to PRIVATE and stores validated, ordered slides", async () => {
      const p = await service.create({ title: "Introdução à Engenharia", slides: [cover, bullets] }, userId);
      expect(p.slug).toBe("introducao-a-engenharia");
      expect(p.visibility).toBe("PRIVATE");
      expect(p.slides.map((s) => [s.order, s.template])).toEqual([[0, "cover"], [1, "bullets"]]);
      expect(p.slides[0].content).toEqual({ title: "Capa", showMascot: true });
      expect(p.slides[1].notes).toBe("segredo");
    });

    it("suffixes generated slugs on collision", async () => {
      await service.create({ title: "Live" }, userId);
      await service.create({ title: "Live" }, userId);
      const third = await service.create({ title: "Live" }, userId);
      expect(third.slug).toBe("live-3");
    });

    it("rejects an explicit slug that is taken or malformed", async () => {
      await service.create({ title: "A", slug: "minha-live" }, userId);
      expect(await codeOf(() => service.create({ title: "B", slug: "minha-live" }, userId))).toBe("SLUG_TAKEN");
      expect(await codeOf(() => service.create({ title: "B", slug: "Minha Live" }, userId))).toBe("INVALID_SLUG");
    });

    it("writes nothing when one slide is invalid, and points at it", async () => {
      const err = await service
        .create({ title: "X", slides: [cover, { template: "code", content: { language: "ts", code: "" } }] }, userId)
        .catch((e) => e);
      expect(err).toBeInstanceOf(GraphQLError);
      expect(err.extensions).toMatchObject({
        code: "INVALID_SLIDE_CONTENT",
        slideIndex: 1,
        template: "code",
        issues: [{ path: "code", message: "Obrigatório" }],
      });
      expect(await prisma.presentation.count()).toBe(0);
    });

    it("rejects unknown templates with UNKNOWN_TEMPLATE", async () => {
      const err = await service.create({ title: "X", slides: [{ template: "hero", content: {} }] }, userId).catch((e) => e);
      expect(err.extensions).toMatchObject({ code: "UNKNOWN_TEMPLATE", slideIndex: 0, template: "hero" });
    });

    it("requires a non-empty title up to 120 characters", async () => {
      expect(await codeOf(() => service.create({ title: "  " }, userId))).toBe("BAD_USER_INPUT");
      expect(await codeOf(() => service.create({ title: "x".repeat(121) }, userId))).toBe("BAD_USER_INPUT");
    });
  });

  describe("reads and visibility", () => {
    it("serves PUBLIC decks to anonymous readers without notes or hidden slides", async () => {
      const p = await service.create(
        { title: "Pub", visibility: "PUBLIC", slides: [cover, { ...bullets, hidden: true }] },
        userId,
      );
      const anon = await service.getBySlug(p.slug, null);
      expect(anon?.slides).toHaveLength(1);
      expect(anon?.slides[0].notes).toBeNull();

      const full = await service.getBySlug(p.slug, reader);
      expect(full?.slides).toHaveLength(2);
      expect(full?.slides[1].notes).toBe("segredo");
    });

    it.each(["PRIVATE", "MEMBERS"] as const)("refuses %s decks to anonymous readers", async (visibility) => {
      const p = await service.create({ title: "Priv", visibility }, userId);
      await expect(service.getBySlug(p.slug, null)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.getBySlug(p.slug, { user: reader!.user, canRead: false })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect((await service.getBySlug(p.slug, reader))?.id).toBe(p.id);
    });

    it("returns null for an unknown slug", async () => {
      expect(await service.getBySlug("nada", null)).toBeNull();
    });

    it("treats a trashed PUBLIC deck as private and keeps its slug reserved", async () => {
      const p = await service.create({ title: "Lixo", visibility: "PUBLIC" }, userId);
      await service.softDelete(p.id);
      await expect(service.getBySlug(p.slug, null)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(await codeOf(() => service.create({ title: "Outro", slug: p.slug }, userId))).toBe("SLUG_TAKEN");
    });

    it("lists active and trashed decks separately, most recently updated first", async () => {
      const a = await service.create({ title: "A" }, userId);
      const b = await service.create({ title: "B" }, userId);
      await service.softDelete(a.id);
      expect((await service.list(false)).map((p) => p.id)).toEqual([b.id]);
      expect((await service.list(true)).map((p) => p.id)).toEqual([a.id]);
    });
  });

  describe("update, duplicate and trash", () => {
    it("updates fields and validates a new slug", async () => {
      const p = await service.create({ title: "A" }, userId);
      const u = await service.update(p.id, { title: "B", slug: "novo-slug", visibility: "PUBLIC", description: "d" });
      expect(u).toMatchObject({ title: "B", slug: "novo-slug", visibility: "PUBLIC", description: "d" });
      expect(await codeOf(() => service.update(p.id, { slug: "Bad Slug" }))).toBe("INVALID_SLUG");
    });

    it("duplicates as a PRIVATE copy with its slides", async () => {
      const p = await service.create({ title: "Base", visibility: "PUBLIC", slides: [cover, bullets] }, userId);
      const copy = await service.duplicate(p.id, userId);
      expect(copy.title).toBe("Base (cópia)");
      expect(copy.slug).toBe("base-copia");
      expect(copy.visibility).toBe("PRIVATE");
      expect(copy.slides.map((s) => s.template)).toEqual(["cover", "bullets"]);
      expect(copy.slides[1].notes).toBe("segredo");
    });

    it("blocks writes to trashed decks, restores, and purges only from the trash", async () => {
      const p = await service.create({ title: "A" }, userId);
      expect(await codeOf(() => service.purge(p.id))).toBe("BAD_USER_INPUT");
      expect(await service.softDelete(p.id)).toBe(true);
      expect(await service.softDelete(p.id)).toBe(true);
      expect(await codeOf(() => service.update(p.id, { title: "B" }))).toBe("BAD_USER_INPUT");
      expect(await codeOf(() => service.duplicate(p.id, userId))).toBe("BAD_USER_INPUT");
      expect((await service.restore(p.id)).deletedAt).toBeNull();
      await service.softDelete(p.id);
      expect(await service.purge(p.id)).toBe(true);
      expect(await prisma.presentation.count()).toBe(0);
    });

    it("reports NOT_FOUND for unknown ids", async () => {
      expect(await codeOf(() => service.update("00000000-0000-0000-0000-000000000000", { title: "x" }))).toBe(
        "NOT_FOUND",
      );
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations/presentations.service.test.ts`
Expected: FAIL — `Cannot find module './presentations.service'`.

- [ ] **Step 3: Implement errors and slide validation**

`apps/backend/src/presentations/presentation-errors.ts`:
```ts
import { GraphQLError } from "graphql";
import type { SlideIssue } from "@repo/slides";

const error = (message: string, extensions: Record<string, unknown>) =>
  new GraphQLError(message, { extensions });

export const invalidSlideContent = (slideIndex: number, template: string, issues: SlideIssue[]) =>
  error("Conteúdo de slide inválido", { code: "INVALID_SLIDE_CONTENT", slideIndex, template, issues });

export const unknownTemplate = (slideIndex: number, template: string) =>
  error(`Modelo desconhecido: ${template}`, { code: "UNKNOWN_TEMPLATE", slideIndex, template });

export const slugTaken = (slug: string) => error(`Slug já em uso: ${slug}`, { code: "SLUG_TAKEN", slug });

export const invalidSlug = (slug: string) =>
  error("Slug inválido: use letras minúsculas, números e hífens (até 80 caracteres)", {
    code: "INVALID_SLUG",
    slug,
  });

export const inTrash = () => error("Apresentação na lixeira", { code: "BAD_USER_INPUT" });

export const badInput = (message: string) => error(message, { code: "BAD_USER_INPUT" });

export const notFound = (message: string) => error(message, { code: "NOT_FOUND" });
```

`apps/backend/src/presentations/slide-validation.ts`:
```ts
import { isSlideTemplateKey, parseSlideContent, type SlideTemplateKey } from "@repo/slides";
import { invalidSlideContent, unknownTemplate } from "./presentation-errors";

export interface SlideInputData {
  template: string;
  content: unknown;
  notes?: string | null;
  hidden?: boolean | null;
}

export interface ValidSlide {
  template: SlideTemplateKey;
  content: Record<string, unknown>;
  notes: string;
  hidden: boolean;
}

export function validateSlide(input: SlideInputData, slideIndex: number): ValidSlide {
  if (!isSlideTemplateKey(input.template)) throw unknownTemplate(slideIndex, input.template);
  const parsed = parseSlideContent(input.template, input.content);
  if (!parsed.ok) throw invalidSlideContent(slideIndex, input.template, parsed.issues);
  return {
    template: parsed.template,
    content: parsed.data,
    notes: input.notes ?? "",
    hidden: input.hidden ?? false,
  };
}

/** Validates every slide before anything is written; the first failure wins. */
export function validateSlides(inputs: SlideInputData[]): ValidSlide[] {
  return inputs.map((input, index) => validateSlide(input, index));
}
```

- [ ] **Step 4: Implement the service**

`apps/backend/src/presentations/presentations.service.ts`:
```ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, prisma, type Presentation, type Slide } from "@repo/database";
import { isValidSlug, slugify, type PresentationVisibility } from "@repo/slides";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { badInput, inTrash, invalidSlug, notFound, slugTaken } from "./presentation-errors";
import { validateSlides, type SlideInputData } from "./slide-validation";

export type SlideView = Omit<Slide, "notes"> & { notes: string | null };
export type PresentationWithSlides = Presentation & { slides: SlideView[] };
/** null = anonymous. `canRead` = the user's role has presentations:read. */
export type Viewer = { user: AuthenticatedUser; canRead: boolean } | null;

export interface CreatePresentationData {
  title: string;
  slug?: string | null;
  description?: string | null;
  visibility?: PresentationVisibility | null;
  slides?: SlideInputData[] | null;
}

export interface UpdatePresentationData {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  visibility?: PresentationVisibility | null;
}

const WITH_SLIDES = { slides: { orderBy: { order: "asc" as const } } };
const MAX_TITLE = 120;

/** What an anonymous reader may see: no speaker notes, no hidden slides. */
export function toAnonymousView(p: PresentationWithSlides): PresentationWithSlides {
  return { ...p, slides: p.slides.filter((s) => !s.hidden).map((s) => ({ ...s, notes: null })) };
}

export async function assertWritable(presentationId: string): Promise<Presentation> {
  const p = await prisma.presentation.findUnique({ where: { id: presentationId } });
  if (!p) throw notFound("Apresentação não encontrada");
  if (p.deletedAt) throw inTrash();
  return p;
}

function cleanTitle(title: string): string {
  const t = title.trim();
  if (!t) throw badInput("Título obrigatório");
  if (t.length > MAX_TITLE) throw badInput(`Título com no máximo ${MAX_TITLE} caracteres`);
  return t;
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

@Injectable()
export class PresentationsService {
  list(trash: boolean): Promise<PresentationWithSlides[]> {
    return prisma.presentation.findMany({
      where: { deletedAt: trash ? { not: null } : null },
      include: WITH_SLIDES,
      orderBy: { updatedAt: "desc" },
    });
  }

  getById(id: string): Promise<PresentationWithSlides | null> {
    return prisma.presentation.findUnique({ where: { id }, include: WITH_SLIDES });
  }

  async getBySlug(slug: string, viewer: Viewer): Promise<PresentationWithSlides | null> {
    const p = await prisma.presentation.findUnique({ where: { slug }, include: WITH_SLIDES });
    if (!p) return null;
    if (viewer?.canRead) return p;
    if (p.visibility !== "PUBLIC" || p.deletedAt) {
      throw new UnauthorizedException("Apresentação privada");
    }
    return toAnonymousView(p);
  }

  async create(input: CreatePresentationData, userId: string): Promise<PresentationWithSlides> {
    const title = cleanTitle(input.title);
    const slides = validateSlides(input.slides ?? []);
    const slug = await this.resolveSlug(input.slug, title);
    try {
      return await prisma.presentation.create({
        data: {
          title,
          slug,
          description: input.description?.trim() || null,
          visibility: input.visibility ?? "PRIVATE",
          createdById: userId,
          slides: {
            create: slides.map((s, order) => ({
              order,
              template: s.template,
              content: s.content as Prisma.InputJsonValue,
              notes: s.notes,
              hidden: s.hidden,
            })),
          },
        },
        include: WITH_SLIDES,
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw slugTaken(slug);
      throw e;
    }
  }

  async update(id: string, input: UpdatePresentationData): Promise<PresentationWithSlides> {
    const current = await assertWritable(id);
    const data: Prisma.PresentationUpdateInput = {};
    if (input.title != null) data.title = cleanTitle(input.title);
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.visibility != null) data.visibility = input.visibility;
    if (input.slug != null && input.slug !== current.slug) {
      if (!isValidSlug(input.slug)) throw invalidSlug(input.slug);
      data.slug = input.slug;
    }
    try {
      return await prisma.presentation.update({ where: { id }, data, include: WITH_SLIDES });
    } catch (e) {
      if (isUniqueViolation(e)) throw slugTaken(input.slug as string);
      throw e;
    }
  }

  async duplicate(id: string, userId: string): Promise<PresentationWithSlides> {
    await assertWritable(id);
    const source = (await this.getById(id)) as PresentationWithSlides;
    const title = `${source.title} (cópia)`.slice(0, MAX_TITLE);
    return this.create(
      {
        title,
        description: source.description,
        visibility: "PRIVATE",
        slides: source.slides.map((s) => ({
          template: s.template,
          content: s.content,
          notes: s.notes,
          hidden: s.hidden,
        })),
      },
      userId,
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const p = await prisma.presentation.findUnique({ where: { id } });
    if (!p) throw notFound("Apresentação não encontrada");
    if (!p.deletedAt) await prisma.presentation.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  }

  async restore(id: string): Promise<PresentationWithSlides> {
    const p = await prisma.presentation.findUnique({ where: { id } });
    if (!p) throw notFound("Apresentação não encontrada");
    return prisma.presentation.update({ where: { id }, data: { deletedAt: null }, include: WITH_SLIDES });
  }

  async purge(id: string): Promise<boolean> {
    const p = await prisma.presentation.findUnique({ where: { id } });
    if (!p) throw notFound("Apresentação não encontrada");
    if (!p.deletedAt) throw badInput("Mova para a lixeira antes de excluir definitivamente");
    await prisma.presentation.delete({ where: { id } });
    return true;
  }

  async assertNotTrashed(id: string): Promise<void> {
    await assertWritable(id);
  }

  /** Explicit slugs must be valid and free; generated ones get -2, -3… */
  private async resolveSlug(explicit: string | null | undefined, title: string): Promise<string> {
    if (explicit) {
      if (!isValidSlug(explicit)) throw invalidSlug(explicit);
      const taken = await prisma.presentation.findUnique({ where: { slug: explicit } });
      if (taken) throw slugTaken(explicit);
      return explicit;
    }
    const base = slugify(title);
    const existing = await prisma.presentation.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const used = new Set(existing.map((e) => e.slug));
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations/presentations.service.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/presentations
git commit -m "feat(backend): add the presentations service with slugs, trash and visibility

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `SlidesService` (slide ops, validation errors)

**Files:**
- Create: `apps/backend/src/presentations/slides.service.ts`, `apps/backend/src/presentations/slides.service.test.ts`

**Interfaces:**
- Consumes: `validateSlide`, `validateSlides`, `SlideInputData` (Task 7), `assertWritable`, error helpers (Task 7), `switchTemplate`, `isSlideTemplateKey` (`@repo/slides`).
- Produces:
  ```ts
  class SlidesService {
    replaceSlides(presentationId: string, slides: SlideInputData[]): Promise<void>;
    createSlide(presentationId: string, input: SlideInputData, position?: number | null): Promise<Slide>;
    updateSlide(id: string, input: Partial<SlideInputData>): Promise<Slide>;
    deleteSlide(id: string): Promise<boolean>;
    reorderSlides(presentationId: string, ids: string[]): Promise<Slide[]>;
  }
  ```
  Every write also bumps `Presentation.updatedAt` (the editor's external-change detection depends on it).

- [ ] **Step 1: Write the failing tests**

`apps/backend/src/presentations/slides.service.test.ts`:
```ts
import { GraphQLError } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { SLIDE_TEMPLATES } from "@repo/slides";
import { createUser, resetDatabase } from "../../test/helpers";
import { PresentationsService } from "./presentations.service";
import { SlidesService } from "./slides.service";

const presentations = new PresentationsService();
const slides = new SlidesService();
const bullets = (title: string) => ({ template: "bullets", content: { title, items: ["a"] } });

const orderedTitles = async (presentationId: string) =>
  (await prisma.slide.findMany({ where: { presentationId }, orderBy: { order: "asc" } })).map(
    (s) => (s.content as { title: string }).title,
  );

describe("SlidesService", () => {
  let deckId: string;
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    deckId = (await presentations.create({ title: "Deck", slides: [bullets("A"), bullets("B")] }, user.id)).id;
  });

  it("appends by default and inserts at a position, keeping orders contiguous", async () => {
    await slides.createSlide(deckId, bullets("C"));
    await slides.createSlide(deckId, bullets("X"), 1);
    expect(await orderedTitles(deckId)).toEqual(["A", "X", "B", "C"]);
    const orders = (await prisma.slide.findMany({ where: { presentationId: deckId }, orderBy: { order: "asc" } })).map(
      (s) => s.order,
    );
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("parallel appends get distinct orders", async () => {
    await Promise.all(["C", "D", "E", "F", "G"].map((t) => slides.createSlide(deckId, bullets(t))));
    const orders = (await prisma.slide.findMany({ where: { presentationId: deckId } })).map((s) => s.order).sort();
    expect(new Set(orders).size).toBe(7);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("reports the slide's position in INVALID_SLIDE_CONTENT on update", async () => {
    const second = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 1 } })).id;
    const err = await slides.updateSlide(second, { content: { title: "", items: ["a"] } }).catch((e) => e);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions).toMatchObject({ code: "INVALID_SLIDE_CONTENT", slideIndex: 1, template: "bullets" });
  });

  it("switching only the template keeps compatible fields and stays valid", async () => {
    const first = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 0 } })).id;
    const updated = await slides.updateSlide(first, { template: "code" });
    expect(updated.template).toBe("code");
    expect(updated.content).toMatchObject({ title: "A", code: SLIDE_TEMPLATES.code.defaults.code });
  });

  it("updates notes and hidden without touching content", async () => {
    const first = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 0 } })).id;
    const updated = await slides.updateSlide(first, { notes: "respira", hidden: true });
    expect(updated).toMatchObject({ notes: "respira", hidden: true, content: { title: "A", items: ["a"] } });
  });

  it("replaces the whole deck atomically", async () => {
    await slides.replaceSlides(deckId, [bullets("Z")]);
    expect(await orderedTitles(deckId)).toEqual(["Z"]);
    await expect(slides.replaceSlides(deckId, [bullets("ok"), { template: "bullets", content: {} }])).rejects.toBeInstanceOf(
      GraphQLError,
    );
    expect(await orderedTitles(deckId)).toEqual(["Z"]);
  });

  it("deletes and renumbers", async () => {
    await slides.createSlide(deckId, bullets("C"));
    const first = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 0 } })).id;
    expect(await slides.deleteSlide(first)).toBe(true);
    const rows = await prisma.slide.findMany({ where: { presentationId: deckId }, orderBy: { order: "asc" } });
    expect(rows.map((s) => s.order)).toEqual([0, 1]);
  });

  it("reorders only with exactly the deck's slide ids", async () => {
    const ids = (await prisma.slide.findMany({ where: { presentationId: deckId }, orderBy: { order: "asc" } })).map((s) => s.id);
    const result = await slides.reorderSlides(deckId, [ids[1], ids[0]]);
    expect(result.map((s) => s.id)).toEqual([ids[1], ids[0]]);
    const err = await slides.reorderSlides(deckId, [ids[0]]).catch((e) => e);
    expect(err.extensions.code).toBe("BAD_USER_INPUT");
    const dup = await slides.reorderSlides(deckId, [ids[0], ids[0]]).catch((e) => e);
    expect(dup.extensions.code).toBe("BAD_USER_INPUT");
  });

  it("bumps the presentation's updatedAt on every slide write", async () => {
    const before = (await prisma.presentation.findUniqueOrThrow({ where: { id: deckId } })).updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    await slides.createSlide(deckId, bullets("C"));
    const after = (await prisma.presentation.findUniqueOrThrow({ where: { id: deckId } })).updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("refuses writes to a trashed deck", async () => {
    await presentations.softDelete(deckId);
    const err = await slides.createSlide(deckId, bullets("C")).catch((e) => e);
    expect(err.message).toBe("Apresentação na lixeira");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations/slides.service.test.ts`
Expected: FAIL — `Cannot find module './slides.service'`.

- [ ] **Step 3: Implement the service**

`apps/backend/src/presentations/slides.service.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { Prisma, prisma, type Slide } from "@repo/database";
import { isSlideTemplateKey, switchTemplate } from "@repo/slides";
import { badInput, notFound, unknownTemplate } from "./presentation-errors";
import { assertWritable } from "./presentations.service";
import { validateSlide, validateSlides, type SlideInputData } from "./slide-validation";

type Tx = Prisma.TransactionClient;

/** Serializes concurrent writes to one deck's slides (row lock on the presentation). */
async function lockDeck(tx: Tx, presentationId: string) {
  await tx.$queryRaw`SELECT id FROM presentations WHERE id = ${presentationId} FOR UPDATE`;
}

async function touch(tx: Tx, presentationId: string) {
  await tx.presentation.update({ where: { id: presentationId }, data: { updatedAt: new Date() } });
}

async function rewriteOrder(tx: Tx, ids: string[]) {
  await Promise.all(ids.map((id, order) => tx.slide.update({ where: { id }, data: { order } })));
}

const orderedIds = async (tx: Tx, presentationId: string) =>
  (
    await tx.slide.findMany({
      where: { presentationId },
      orderBy: { order: "asc" },
      select: { id: true },
    })
  ).map((s) => s.id);

@Injectable()
export class SlidesService {
  async replaceSlides(presentationId: string, slides: SlideInputData[]): Promise<void> {
    await assertWritable(presentationId);
    const valid = validateSlides(slides);
    await prisma.$transaction(async (tx) => {
      await lockDeck(tx, presentationId);
      await tx.slide.deleteMany({ where: { presentationId } });
      await tx.slide.createMany({
        data: valid.map((s, order) => ({
          presentationId,
          order,
          template: s.template,
          content: s.content as Prisma.InputJsonValue,
          notes: s.notes,
          hidden: s.hidden,
        })),
      });
      await touch(tx, presentationId);
    });
  }

  async createSlide(presentationId: string, input: SlideInputData, position?: number | null): Promise<Slide> {
    await assertWritable(presentationId);
    return prisma.$transaction(async (tx) => {
      await lockDeck(tx, presentationId);
      const ids = await orderedIds(tx, presentationId);
      const at = position == null ? ids.length : Math.max(0, Math.min(position, ids.length));
      const valid = validateSlide(input, at);
      const slide = await tx.slide.create({
        data: {
          presentationId,
          order: ids.length,
          template: valid.template,
          content: valid.content as Prisma.InputJsonValue,
          notes: valid.notes,
          hidden: valid.hidden,
        },
      });
      if (at !== ids.length) {
        ids.splice(at, 0, slide.id);
        await rewriteOrder(tx, ids);
      }
      await touch(tx, presentationId);
      return tx.slide.findUniqueOrThrow({ where: { id: slide.id } });
    });
  }

  async updateSlide(id: string, input: Partial<SlideInputData>): Promise<Slide> {
    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) throw notFound("Slide não encontrado");
    await assertWritable(slide.presentationId);

    const ids = await orderedIds(prisma as unknown as Tx, slide.presentationId);
    const index = ids.indexOf(id);
    const template = input.template ?? slide.template;
    let content: unknown = slide.content;
    if (input.content !== undefined) {
      content = input.content;
    } else if (input.template && input.template !== slide.template) {
      if (!isSlideTemplateKey(input.template)) throw unknownTemplate(index, input.template);
      content = switchTemplate(slide.content as Record<string, unknown>, input.template);
    }
    const valid = validateSlide(
      { template, content, notes: input.notes ?? slide.notes, hidden: input.hidden ?? slide.hidden },
      index,
    );

    return prisma.$transaction(async (tx) => {
      const updated = await tx.slide.update({
        where: { id },
        data: {
          template: valid.template,
          content: valid.content as Prisma.InputJsonValue,
          notes: valid.notes,
          hidden: valid.hidden,
        },
      });
      await touch(tx, slide.presentationId);
      return updated;
    });
  }

  async deleteSlide(id: string): Promise<boolean> {
    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) throw notFound("Slide não encontrado");
    await assertWritable(slide.presentationId);
    await prisma.$transaction(async (tx) => {
      await lockDeck(tx, slide.presentationId);
      await tx.slide.delete({ where: { id } });
      await rewriteOrder(tx, await orderedIds(tx, slide.presentationId));
      await touch(tx, slide.presentationId);
    });
    return true;
  }

  async reorderSlides(presentationId: string, ids: string[]): Promise<Slide[]> {
    await assertWritable(presentationId);
    return prisma.$transaction(async (tx) => {
      await lockDeck(tx, presentationId);
      const current = await orderedIds(tx, presentationId);
      const sameSet =
        ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
      if (!sameSet) throw badInput("A lista deve conter exatamente os slides da apresentação");
      await rewriteOrder(tx, ids);
      await touch(tx, presentationId);
      return tx.slide.findMany({ where: { presentationId }, orderBy: { order: "asc" } });
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations`
Expected: PASS — `slides.service.test.ts` and the Task 7 tests.

If "parallel appends get distinct orders" fails with a transaction timeout, raise the interactive transaction timeout for `createSlide` (`prisma.$transaction(fn, { timeout: 10_000 })`) rather than dropping the row lock.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/presentations
git commit -m "feat(backend): add slide operations with ordering locks and validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Presentations GraphQL resolver, `slideTemplates`, permissions

**Files:**
- Create: `apps/backend/src/presentations/presentations.types.ts`, `apps/backend/src/presentations/presentations.resolver.ts`, `apps/backend/src/presentations/presentations.module.ts`, `apps/backend/src/presentations/presentations.resolver.test.ts`
- Modify: `apps/backend/package.json` (add `graphql-type-json`), `pnpm-lock.yaml`, `apps/backend/src/app.module.ts`, `apps/backend/src/permissions/permissions.service.ts` (`RESOURCES` += `"presentations"`), `apps/backend/src/schema.gql` (regenerated)

**Interfaces:**
- Consumes: `PresentationsService`, `Viewer` (Task 7); `SlidesService` (Task 8); `GqlJwtOrApiKeyGuard`, `GqlOptionalAuthGuard` (Task 5); `ApiKeysModule` registered (Task 6); `PermissionsService.canAccess` (existing, global); `SLIDE_TEMPLATES`, `SLIDE_TEMPLATE_KEYS`, `slideTemplateJsonSchema` (`@repo/slides`).
- Produces: the GraphQL contract of spec §6.3 exactly (type names `Presentation`, `Slide`, `SlideTemplateInfo`, `PresentationVisibility`; inputs `SlideInput`, `CreatePresentationInput`, `UpdatePresentationInput`, `UpdateSlideInput`; scalar `JSON`).

- [ ] **Step 1: Add the dependency**

`apps/backend/package.json` `"dependencies"`: add `"graphql-type-json": "^0.3.2"`.
Run: `lockfile-refresh`, `docker compose -f docker-compose.dev.yml build backend && docker compose -f docker-compose.dev.yml up -d backend`.

- [ ] **Step 2: Write the failing integration tests**

`apps/backend/src/presentations/presentations.resolver.test.ts`:
```ts
import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";

const FIELDS = `id slug title description visibility slideCount deletedAt updatedAt
  slides { id order template content notes hidden }`;
const CREATE = `mutation ($input: CreatePresentationInput!) { createPresentation(input: $input) { ${FIELDS} } }`;
const BY_SLUG = `query ($slug: String!) { presentationBySlug(slug: $slug) { ${FIELDS} } }`;
const LIST = `query ($trash: Boolean) { presentations(trash: $trash) { id title } }`;
const UPDATE = `mutation ($id: ID!, $input: UpdatePresentationInput!) { updatePresentation(id: $id, input: $input) { id visibility } }`;
const DELETE = `mutation ($id: ID!) { deletePresentation(id: $id) }`;
const PURGE = `mutation ($id: ID!) { purgePresentation(id: $id) }`;
const CREATE_KEY = `mutation { createApiKey(name: "claude", expiresIn: ONE_HOUR) { token apiKey { id } } }`;

const deckInput = {
  title: "Live #12",
  slides: [
    { template: "cover", content: { title: "Live #12" } },
    { template: "bullets", content: { title: "T", items: ["a"] }, notes: "lembrar do proxy", hidden: true },
  ],
};

describe("presentations over GraphQL", () => {
  let app: INestApplication;
  let jwt: string;
  let key: string;
  let keyId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase();
    jwt = jwtFor(app, await createUser({ admin: true }));
    const k = (await gql(app, CREATE_KEY, undefined, jwt)).data.createApiKey;
    key = k.token;
    keyId = k.apiKey.id;
  });

  it("lets an API key create a full deck in one call", async () => {
    const res = await gql(app, CREATE, { input: deckInput }, key);
    expect(res.errors).toBeUndefined();
    const deck = res.data.createPresentation;
    expect(deck).toMatchObject({ slug: "live-12", visibility: "PRIVATE", slideCount: 2 });
    expect(deck.slides[0].content).toEqual({ title: "Live #12", showMascot: true });
  });

  it("returns INVALID_SLIDE_CONTENT with index, template and issues", async () => {
    const res = await gql(
      app,
      CREATE,
      { input: { title: "X", slides: [{ template: "stats", content: { items: [] } }] } },
      key,
    );
    expect(res.errors?.[0].extensions).toMatchObject({
      code: "INVALID_SLIDE_CONTENT",
      slideIndex: 0,
      template: "stats",
      issues: [{ path: "items", message: "Mínimo de 2 itens" }],
    });
  });

  it("lets an API key publish and trash, but not purge", async () => {
    const deck = (await gql(app, CREATE, { input: deckInput }, key)).data.createPresentation;
    expect((await gql(app, UPDATE, { id: deck.id, input: { visibility: "PUBLIC" } }, key)).data.updatePresentation.visibility).toBe("PUBLIC");
    expect((await gql(app, DELETE, { id: deck.id }, key)).data.deletePresentation).toBe(true);
    expect(errorCode(await gql(app, PURGE, { id: deck.id }, key))).toBe("UNAUTHENTICATED");
    expect((await gql(app, PURGE, { id: deck.id }, jwt)).data.purgePresentation).toBe(true);
  });

  it("hides private decks from anonymous slug reads and strips notes/hidden on public ones", async () => {
    const deck = (await gql(app, CREATE, { input: deckInput }, jwt)).data.createPresentation;
    expect(errorCode(await gql(app, BY_SLUG, { slug: deck.slug }))).toBe("UNAUTHENTICATED");

    await gql(app, UPDATE, { id: deck.id, input: { visibility: "PUBLIC" } }, jwt);
    const anon = (await gql(app, BY_SLUG, { slug: deck.slug })).data.presentationBySlug;
    expect(anon.slides).toHaveLength(1);
    expect(anon.slides[0].notes).toBeNull();
    expect(anon.slideCount).toBe(1);

    const authed = (await gql(app, BY_SLUG, { slug: deck.slug }, key)).data.presentationBySlug;
    expect(authed.slides).toHaveLength(2);
    expect(authed.slides[1].notes).toBe("lembrar do proxy");
  });

  it("returns null for an unknown slug", async () => {
    expect((await gql(app, BY_SLUG, { slug: "nao-existe" })).data.presentationBySlug).toBeNull();
  });

  it("rejects an expired key even on the optional slug query", async () => {
    await prisma.apiKey.update({ where: { id: keyId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await gql(app, BY_SLUG, { slug: "qualquer" }, key);
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
    expect(res.errors?.[0].message).toBe("Chave expirada");
  });

  it("requires credentials for the library and enforces role permissions", async () => {
    expect(errorCode(await gql(app, LIST, {}))).toBe("UNAUTHENTICATED");
    const plain = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, LIST, {}, plain))).toBe("FORBIDDEN");
    expect((await gql(app, LIST, { trash: false }, jwt)).data.presentations).toEqual([]);
  });

  it("serves the template catalogue publicly with JSON Schemas and examples", async () => {
    const res = await gql(app, `{ slideTemplates { key label description jsonSchema example } }`);
    expect(res.data.slideTemplates.map((t: { key: string }) => t.key)).toEqual([
      "cover", "agenda", "section", "bullets", "split", "code",
      "closing", "quote", "comparison", "stats", "image",
    ]);
    expect(res.data.slideTemplates[0].jsonSchema.type).toBe("object");
  });

  it("runs the slide operations end to end", async () => {
    const deck = (await gql(app, CREATE, { input: deckInput }, key)).data.createPresentation;
    const created = await gql(
      app,
      `mutation ($p: ID!, $i: SlideInput!) { createSlide(presentationId: $p, input: $i, position: 0) { id order } }`,
      { p: deck.id, i: { template: "section", content: { title: "Abertura" } } },
      key,
    );
    expect(created.data.createSlide.order).toBe(0);

    const upd = await gql(
      app,
      `mutation ($id: ID!, $i: UpdateSlideInput!) { updateSlide(id: $id, input: $i) { template content } }`,
      { id: created.data.createSlide.id, i: { template: "quote" } },
      key,
    );
    expect(upd.data.updateSlide.template).toBe("quote");

    const replaced = await gql(
      app,
      `mutation ($p: ID!, $s: [SlideInput!]!) { replaceSlides(presentationId: $p, slides: $s) { slideCount } }`,
      { p: deck.id, s: [{ template: "cover", content: { title: "Só capa" } }] },
      key,
    );
    expect(replaced.data.replaceSlides.slideCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `dcx backend pnpm --filter backend exec vitest run src/presentations/presentations.resolver.test.ts`
Expected: FAIL — `Unknown type "CreatePresentationInput"`.

- [ ] **Step 4: Implement GraphQL types**

`apps/backend/src/presentations/presentations.types.ts`:
```ts
import { Field, ID, InputType, Int, ObjectType, registerEnumType } from "@nestjs/graphql";
import GraphQLJSON from "graphql-type-json";

export enum PresentationVisibilityEnum {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
  MEMBERS = "MEMBERS",
}
registerEnumType(PresentationVisibilityEnum, { name: "PresentationVisibility" });

@ObjectType("Slide")
export class SlideType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  order!: number;

  @Field()
  template!: string;

  @Field(() => GraphQLJSON)
  content!: Record<string, unknown>;

  @Field(() => String, { nullable: true, description: "null for anonymous readers" })
  notes!: string | null;

  @Field()
  hidden!: boolean;
}

@ObjectType("Presentation")
export class PresentationType {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => PresentationVisibilityEnum)
  visibility!: PresentationVisibilityEnum;

  @Field(() => [SlideType], { description: "Ordered; hidden slides omitted for anonymous readers" })
  slides!: SlideType[];

  @Field(() => Date, { nullable: true })
  deletedAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType("SlideTemplateInfo")
export class SlideTemplateInfoType {
  @Field()
  key!: string;

  @Field()
  label!: string;

  @Field()
  description!: string;

  @Field(() => GraphQLJSON)
  jsonSchema!: Record<string, unknown>;

  @Field(() => GraphQLJSON)
  example!: Record<string, unknown>;
}

@InputType()
export class SlideInput {
  @Field()
  template!: string;

  @Field(() => GraphQLJSON)
  content!: unknown;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Boolean, { nullable: true })
  hidden?: boolean | null;
}

@InputType()
export class CreatePresentationInput {
  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => PresentationVisibilityEnum, { nullable: true })
  visibility?: PresentationVisibilityEnum | null;

  @Field(() => [SlideInput], { nullable: true })
  slides?: SlideInput[] | null;
}

@InputType()
export class UpdatePresentationInput {
  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => PresentationVisibilityEnum, { nullable: true })
  visibility?: PresentationVisibilityEnum | null;
}

@InputType()
export class UpdateSlideInput {
  @Field(() => String, { nullable: true })
  template?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: unknown;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Boolean, { nullable: true })
  hidden?: boolean | null;
}
```

- [ ] **Step 5: Implement the resolver and module**

`apps/backend/src/presentations/presentations.resolver.ts`:
```ts
import { UseGuards } from "@nestjs/common";
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import { SLIDE_TEMPLATES, SLIDE_TEMPLATE_KEYS, slideTemplateJsonSchema } from "@repo/slides";
import { GqlAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { GqlJwtOrApiKeyGuard, GqlOptionalAuthGuard } from "../auth/jwt-or-api-key.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { Resource } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { PermissionsService } from "../permissions/permissions.service";
import {
  PresentationsService,
  type CreatePresentationData,
  type PresentationWithSlides,
  type UpdatePresentationData,
} from "./presentations.service";
import {
  CreatePresentationInput,
  PresentationType,
  SlideInput,
  SlideTemplateInfoType,
  SlideType,
  UpdatePresentationInput,
  UpdateSlideInput,
} from "./presentations.types";
import { SlidesService } from "./slides.service";

@Resolver(() => PresentationType)
export class PresentationsResolver {
  constructor(
    private readonly presentations: PresentationsService,
    private readonly slides: SlidesService,
    private readonly permissions: PermissionsService,
  ) {}

  @ResolveField(() => Int)
  slideCount(@Parent() p: PresentationWithSlides): number {
    return p.slides.length;
  }

  // ── Reads ─────────────────────────────────────────

  @Query(() => [PresentationType])
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "read")
  presentations(@Args("trash", { type: () => Boolean, nullable: true, defaultValue: false }) trash: boolean) {
    return this.presentations.list(trash);
  }

  @Query(() => PresentationType, { nullable: true })
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "read")
  presentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentations.getById(id);
  }

  /** Public for PUBLIC decks; everything else needs a session or key with presentations:read. */
  @Query(() => PresentationType, { nullable: true })
  @UseGuards(GqlOptionalAuthGuard)
  async presentationBySlug(
    @Args("slug") slug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const canRead = user
      ? await this.permissions.canAccess("presentations", "read", { id: user.role.id, isAdmin: user.role.isAdmin })
      : false;
    return this.presentations.getBySlug(slug, user ? { user, canRead } : null);
  }

  @Query(() => [SlideTemplateInfoType])
  slideTemplates(): SlideTemplateInfoType[] {
    return SLIDE_TEMPLATE_KEYS.map((key) => {
      const def = SLIDE_TEMPLATES[key];
      return {
        key,
        label: def.label,
        description: def.description,
        jsonSchema: slideTemplateJsonSchema(key),
        example: def.example as Record<string, unknown>,
      };
    });
  }

  // ── Presentation writes (session or API key) ─────

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "create")
  createPresentation(@Args("input") input: CreatePresentationInput, @CurrentUser() user: AuthenticatedUser) {
    // The GraphQL enum and @repo/slides' string union carry the same values.
    return this.presentations.create(input as CreatePresentationData, user.id);
  }

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  updatePresentation(@Args("id", { type: () => ID }) id: string, @Args("input") input: UpdatePresentationInput) {
    return this.presentations.update(id, input as UpdatePresentationData);
  }

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "create")
  duplicatePresentation(@Args("id", { type: () => ID }) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.presentations.duplicate(id, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "delete")
  deletePresentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentations.softDelete(id);
  }

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "delete")
  restorePresentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentations.restore(id);
  }

  /** JWT only: an API key can trash, never destroy. */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Resource("presentations", "delete")
  purgePresentation(@Args("id", { type: () => ID }) id: string) {
    return this.presentations.purge(id);
  }

  // ── Slide writes ──────────────────────────────────

  @Mutation(() => PresentationType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  async replaceSlides(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("slides", { type: () => [SlideInput] }) slides: SlideInput[],
  ) {
    await this.slides.replaceSlides(presentationId, slides);
    return this.presentations.getById(presentationId);
  }

  @Mutation(() => SlideType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  createSlide(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("input") input: SlideInput,
    @Args("position", { type: () => Int, nullable: true }) position?: number | null,
  ) {
    return this.slides.createSlide(presentationId, input, position);
  }

  @Mutation(() => SlideType)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  updateSlide(@Args("id", { type: () => ID }) id: string, @Args("input") input: UpdateSlideInput) {
    return this.slides.updateSlide(id, {
      template: input.template ?? undefined,
      content: input.content,
      notes: input.notes ?? undefined,
      hidden: input.hidden ?? undefined,
    });
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  deleteSlide(@Args("id", { type: () => ID }) id: string) {
    return this.slides.deleteSlide(id);
  }

  @Mutation(() => [SlideType])
  @UseGuards(GqlJwtOrApiKeyGuard, RolesGuard)
  @Resource("presentations", "update")
  reorderSlides(
    @Args("presentationId", { type: () => ID }) presentationId: string,
    @Args("ids", { type: () => [ID] }) ids: string[],
  ) {
    return this.slides.reorderSlides(presentationId, ids);
  }
}
```

Note: `GqlOptionalAuthGuard` puts `null` in `req.user`; `@CurrentUser()` returns it as-is.

`apps/backend/src/presentations/presentations.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { PresentationsResolver } from "./presentations.resolver";
import { PresentationsService } from "./presentations.service";
import { SlidesService } from "./slides.service";

@Module({
  providers: [PresentationsService, SlidesService, PresentationsResolver],
  exports: [PresentationsService, SlidesService],
})
export class PresentationsModule {}
```

`apps/backend/src/app.module.ts`: import `PresentationsModule` and add it to `imports` after `ApiKeysModule,`.

`apps/backend/src/permissions/permissions.service.ts`:
```ts
const RESOURCES = ["hero", "about", "live", "episodes", "users", "pages", "apiKeys", "presentations"];
```

Do **not** add `presentations` to the seed's `DEFAULT_PUBLIC_RESOURCES`: public access is decided per deck by `presentationBySlug`, and a public `presentations:read` would expose the whole library.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `dcx backend pnpm --filter backend test`
Expected: every backend test file PASSES. `src/schema.gql` now contains `scalar JSON`, `type Presentation`, `type Slide`, `type SlideTemplateInfo`, `enum PresentationVisibility` and the mutations.

- [ ] **Step 7: Commit**

```bash
git add apps/backend package.json pnpm-lock.yaml
git commit -m "feat(backend): expose presentations and slide templates over GraphQL

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: `@repo/types`, `@repo/graphql` documents, `docs/presentations-api.md`

**Files:**
- Create: `packages/types/src/presentation.ts`, `packages/graphql/src/queries/presentations.ts`, `packages/graphql/src/queries/api-keys.ts`, `docs/presentations-api.md`, `scripts/check-presentations-api-doc.sh`
- Modify: `packages/types/src/index.ts`, `packages/graphql/src/queries/index.ts`, `packages/ui/package.json`, `apps/cms/package.json`, `apps/landing/package.json` (add `"@repo/slides": "workspace:*"`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the GraphQL contract (Task 9).
- Produces: `@repo/types` — `PresentationVisibility`, `Slide`, `Presentation`, `ApiKey`, `SlideTemplateInfo`, `ApiKeyExpiry`; `@repo/graphql` — `PRESENTATION_FIELDS` fragment string, `GET_PRESENTATIONS`, `GET_PRESENTATION`, `GET_PRESENTATION_BY_SLUG`, `CREATE_PRESENTATION`, `UPDATE_PRESENTATION`, `DUPLICATE_PRESENTATION`, `DELETE_PRESENTATION`, `RESTORE_PRESENTATION`, `PURGE_PRESENTATION`, `REPLACE_SLIDES`, `CREATE_SLIDE`, `UPDATE_SLIDE`, `DELETE_SLIDE`, `REORDER_SLIDES`, `GET_API_KEYS`, `CREATE_API_KEY`, `REVOKE_API_KEY`. `@repo/ui`, `cms` and `landing` depend on `@repo/slides` from here on.

- [ ] **Step 1: Add the types**

`packages/types/src/presentation.ts`:
```ts
// Slide decks built from the @repo/slides templates. Mirrors the backend's
// Presentation/Slide GraphQL types; dates arrive as ISO strings.
export type PresentationVisibility = "PUBLIC" | "PRIVATE" | "MEMBERS";

export type Slide = {
  id: string;
  order: number;
  template: string;
  content: Record<string, unknown>;
  /** null when read anonymously */
  notes: string | null;
  hidden: boolean;
};

export type Presentation = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: PresentationVisibility;
  slideCount: number;
  slides: Slide[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SlideTemplateInfo = {
  key: string;
  label: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  example: Record<string, unknown>;
};

export type ApiKeyExpiry = "ONE_HOUR" | "ONE_DAY" | "SEVEN_DAYS";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
```
`packages/types/src/index.ts`: add `export * from "./presentation";`

- [ ] **Step 2: Add the GraphQL documents**

`packages/graphql/src/queries/presentations.ts`:
```ts
import { gql } from "@apollo/client";

const SLIDE_FIELDS = `
  id
  order
  template
  content
  notes
  hidden
`;

export const PRESENTATION_FIELDS = `
  id
  slug
  title
  description
  visibility
  slideCount
  deletedAt
  createdAt
  updatedAt
  slides { ${SLIDE_FIELDS} }
`;

export const GET_PRESENTATIONS = gql`
  query GetPresentations($trash: Boolean) {
    presentations(trash: $trash) { ${PRESENTATION_FIELDS} }
  }
`;

export const GET_PRESENTATION = gql`
  query GetPresentation($id: ID!) {
    presentation(id: $id) { ${PRESENTATION_FIELDS} }
  }
`;

export const GET_PRESENTATION_BY_SLUG = gql`
  query GetPresentationBySlug($slug: String!) {
    presentationBySlug(slug: $slug) { ${PRESENTATION_FIELDS} }
  }
`;

export const CREATE_PRESENTATION = gql`
  mutation CreatePresentation($input: CreatePresentationInput!) {
    createPresentation(input: $input) { ${PRESENTATION_FIELDS} }
  }
`;

export const UPDATE_PRESENTATION = gql`
  mutation UpdatePresentation($id: ID!, $input: UpdatePresentationInput!) {
    updatePresentation(id: $id, input: $input) { ${PRESENTATION_FIELDS} }
  }
`;

export const DUPLICATE_PRESENTATION = gql`
  mutation DuplicatePresentation($id: ID!) {
    duplicatePresentation(id: $id) { ${PRESENTATION_FIELDS} }
  }
`;

export const DELETE_PRESENTATION = gql`
  mutation DeletePresentation($id: ID!) {
    deletePresentation(id: $id)
  }
`;

export const RESTORE_PRESENTATION = gql`
  mutation RestorePresentation($id: ID!) {
    restorePresentation(id: $id) { ${PRESENTATION_FIELDS} }
  }
`;

export const PURGE_PRESENTATION = gql`
  mutation PurgePresentation($id: ID!) {
    purgePresentation(id: $id)
  }
`;

export const REPLACE_SLIDES = gql`
  mutation ReplaceSlides($presentationId: ID!, $slides: [SlideInput!]!) {
    replaceSlides(presentationId: $presentationId, slides: $slides) { ${PRESENTATION_FIELDS} }
  }
`;

export const CREATE_SLIDE = gql`
  mutation CreateSlide($presentationId: ID!, $input: SlideInput!, $position: Int) {
    createSlide(presentationId: $presentationId, input: $input, position: $position) { ${SLIDE_FIELDS} }
  }
`;

export const UPDATE_SLIDE = gql`
  mutation UpdateSlide($id: ID!, $input: UpdateSlideInput!) {
    updateSlide(id: $id, input: $input) { ${SLIDE_FIELDS} }
  }
`;

export const DELETE_SLIDE = gql`
  mutation DeleteSlide($id: ID!) {
    deleteSlide(id: $id)
  }
`;

export const REORDER_SLIDES = gql`
  mutation ReorderSlides($presentationId: ID!, $ids: [ID!]!) {
    reorderSlides(presentationId: $presentationId, ids: $ids) { id order }
  }
`;
```

`packages/graphql/src/queries/api-keys.ts`:
```ts
import { gql } from "@apollo/client";

const API_KEY_FIELDS = `
  id
  name
  prefix
  expiresAt
  lastUsedAt
  revokedAt
  createdAt
`;

export const GET_API_KEYS = gql`
  query GetApiKeys {
    apiKeys { ${API_KEY_FIELDS} }
  }
`;

export const CREATE_API_KEY = gql`
  mutation CreateApiKey($name: String!, $expiresIn: ApiKeyExpiry!) {
    createApiKey(name: $name, expiresIn: $expiresIn) {
      token
      apiKey { ${API_KEY_FIELDS} }
    }
  }
`;

export const REVOKE_API_KEY = gql`
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id) { ${API_KEY_FIELDS} }
  }
`;
```

`packages/graphql/src/queries/index.ts`: add `export * from "./presentations";` and `export * from "./api-keys";`

- [ ] **Step 3: Wire `@repo/slides` into the front-end packages**

Add `"@repo/slides": "workspace:*"` to `"dependencies"` in `packages/ui/package.json`, `apps/cms/package.json` and `apps/landing/package.json`. Run `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build`.

- [ ] **Step 4: Write the API doc**

`docs/presentations-api.md` — contents (write it in full; it is the document an external agent reads first):

````markdown
# Presentations API (for external agents)

Everything goes through the CMS's GraphQL endpoint: `POST https://<api-host>/graphql`
(dev: `http://localhost:4050/graphql`), JSON body `{ "query": "...", "variables": { ... } }`.

## 1. Get a key

In the CMS: **Configurações → Chaves de API → Gerar chave**. Pick a name ("Live #12 —
Claude") and an expiry (1 h, 24 h or 7 days). Copy the `ei_…` token — it is shown once.
Send it on every request:

```
Authorization: Bearer ei_…
```

A key can create, read, update, publish and trash presentations and upload images. It
cannot permanently delete, manage keys, users or landing content. Expired or revoked
keys get `UNAUTHENTICATED` with the message `Chave expirada` / `Chave revogada`.

## 2. Discover the templates

```graphql
{ slideTemplates { key label description jsonSchema example } }
```

`jsonSchema` is the exact content shape for each template; `example` is a valid
content object. Keys: `cover`, `agenda`, `section`, `bullets`, `split`, `code`,
`closing`, `quote`, `comparison`, `stats`, `image`. Unknown fields are rejected.

## 3. Create a deck in one call

```graphql
mutation ($input: CreatePresentationInput!) {
  createPresentation(input: $input) { id slug visibility slideCount }
}
```

```json
{
  "input": {
    "title": "Live #12 — Engenharia reversa de um app de banco",
    "description": "Proxy, certificado e pinning",
    "slides": [
      { "template": "cover", "content": { "label": "LIVE #12", "title": "Engenharia reversa de um app de banco", "subtitle": "Do proxy ao certificado", "date": "1 de outubro de 2026" } },
      { "template": "agenda", "content": { "title": "O que vamos ver", "steps": [{ "title": "Ambiente" }, { "title": "Tráfego" }, { "title": "Pinning" }] } },
      { "template": "section", "content": { "number": "01", "title": "Montando o ambiente" } },
      { "template": "bullets", "content": { "title": "Ferramentas", "items": ["Emulador Android", "mitmproxy", "Frida"] }, "notes": "Mostrar a versão de cada uma" },
      { "template": "split", "content": { "title": "O proxy", "body": "O mitmproxy fica entre o app e a API.", "image": { "url": "/uploads/<file>.png", "alt": "Diagrama" } } },
      { "template": "code", "content": { "language": "js", "code": "Java.perform(() => {\n  // ...\n});", "highlightLines": [2] } },
      { "template": "comparison", "content": { "title": "Com e sem pinning", "left": { "label": "Sem", "items": ["Proxy lê tudo"] }, "right": { "label": "Com", "items": ["Conexão recusada"] }, "highlight": "right" } },
      { "template": "stats", "content": { "items": [{ "value": "3", "label": "Ferramentas" }, { "value": "1h", "label": "De live" }] } },
      { "template": "quote", "content": { "quote": "Talk is cheap. Show me the code.", "author": "Linus Torvalds" } },
      { "template": "image", "content": { "image": { "url": "https://…/print.png", "alt": "Resultado" }, "caption": "O tráfego decifrado" } },
      { "template": "closing", "content": { "title": "Valeu!", "cta": { "text": "Inscreva-se", "url": "https://youtube.com/@engenhariainversa" } } }
    ]
  }
}
```

New decks are `PRIVATE`. `slug` is generated from the title unless given
(`^[a-z0-9]+(-[a-z0-9]+)*$`, max 80).

## 4. Revise

- Replace every slide at once: `replaceSlides(presentationId, slides: [SlideInput!]!)`.
- One slide: `createSlide(presentationId, input, position)`, `updateSlide(id, input)`,
  `deleteSlide(id)`, `reorderSlides(presentationId, ids)`.
- Metadata and publishing: `updatePresentation(id, input: { title, slug, description, visibility })`
  with `visibility: PUBLIC | PRIVATE`.
- Read back: `presentation(id)` or `presentations(trash: false)`.
- Trash: `deletePresentation(id)`; undo with `restorePresentation(id)`.

## 5. Images

```bash
curl -s -X POST https://<api-host>/uploads \
  -H "Authorization: Bearer ei_…" \
  -F "file=@diagram.png"
# → {"url":"/uploads/<uuid>.png", ...}
```

Use the returned `url` (or any absolute `https://` URL) in `image.url`. JPG, PNG,
WebP, GIF or SVG, up to 5 MB.

## 6. Errors

| `extensions.code` | Meaning |
|---|---|
| `INVALID_SLIDE_CONTENT` | `slideIndex`, `template` and `issues: [{ path, message }]` point at the problem. Nothing was written. |
| `UNKNOWN_TEMPLATE` | `template` is not one of the 11 keys. |
| `SLUG_TAKEN` / `INVALID_SLUG` | Pick another slug / fix its format. |
| `BAD_USER_INPUT` | e.g. `Apresentação na lixeira`, empty title, wrong id list in `reorderSlides`. |
| `NOT_FOUND` | Unknown id. |
| `UNAUTHENTICATED` | Missing, expired or revoked key. |
| `FORBIDDEN` | The key's owner lacks the `presentations` permission. |
````

`scripts/check-presentations-api-doc.sh` — validates every slide in the doc's example against the real backend (run against the dev stack):
```bash
#!/usr/bin/env sh
# Usage: EI_API_KEY=ei_… scripts/check-presentations-api-doc.sh
# Sends the createPresentation example from docs/presentations-api.md to the dev
# API and fails unless it is accepted. Deletes the deck afterwards.
set -eu
API="${API_URL:-http://localhost:4050/graphql}"
INPUT=$(awk '/^```json$/{f=1;next} /^```$/{if(f){exit}} f' docs/presentations-api.md | sed 's#/uploads/<file>.png#https://engenhariainversa.com.br/images/live-studio.png#; s#https://…/print.png#https://engenhariainversa.com.br/images/ep-01.png#')
BODY=$(printf '{"query":"mutation($input: CreatePresentationInput!){ createPresentation(input:$input){ id slideCount } }","variables":%s}' "$INPUT")
RES=$(curl -s -X POST "$API" -H "Content-Type: application/json" -H "Authorization: Bearer $EI_API_KEY" -d "$BODY")
echo "$RES"
echo "$RES" | grep -q '"slideCount":11' || { echo "doc example rejected"; exit 1; }
ID=$(echo "$RES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -s -X POST "$API" -H "Content-Type: application/json" -H "Authorization: Bearer $EI_API_KEY" \
  -d "{\"query\":\"mutation{ deletePresentation(id:\\\"$ID\\\") }\"}" > /dev/null
echo "ok"
```

- [ ] **Step 5: Verify the documents and the doc example against the live API**

Run: `docker compose -f docker-compose.dev.yml up -d db backend`. Get a key: log in to the CMS once the stack is up (`docker compose -f docker-compose.dev.yml up -d`, then http://localhost:4051 → Configurações → Chaves de API only exists after Task 14, so for now create one through GraphQL with your admin JWT):
```bash
TOKEN=$(curl -s -X POST http://localhost:4050/graphql -H "Content-Type: application/json" \
  -d '{"query":"mutation($i: LoginInput!){ login(input:$i){ token } }","variables":{"i":{"identifier":"<admin-email>","password":"<admin-password>"}}}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
EI_API_KEY=$(curl -s -X POST http://localhost:4050/graphql -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation{ createApiKey(name:\"doc check\", expiresIn: ONE_HOUR){ token } }"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
chmod +x scripts/check-presentations-api-doc.sh
EI_API_KEY="$EI_API_KEY" scripts/check-presentations-api-doc.sh
```
Expected: last line `ok` (the 11-slide example is accepted).

Run: `dcr cms pnpm --filter @repo/graphql build` — Expected: exit 0 (type-checks the new documents).

- [ ] **Step 6: Commit**

```bash
git add packages/types packages/graphql packages/ui/package.json apps/cms/package.json apps/landing/package.json pnpm-lock.yaml docs/presentations-api.md scripts/check-presentations-api-doc.sh
git commit -m "feat(types,graphql): expose presentations and API keys to the front-ends

Document the presentations API for external agents.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: `SlideCanvas`, `SlideRenderer`, 6 text renderers, assets

Renders `cover`, `agenda`, `section`, `bullets`, `quote` and `stats` on a fixed 1920×1080 canvas. The other 5 templates render the "Slide inválido" warning until Task 12 adds them.

**Files:**
- Modify: `packages/ui/package.json` (deps `@repo/slides`, devDep `vitest`, script `test`)
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/slides/canvas.tsx`
- Create: `packages/ui/src/slides/invalid-slide.tsx`
- Create: `packages/ui/src/slides/slide-renderer.tsx`
- Create: `packages/ui/src/slides/templates/cover.tsx`, `agenda.tsx`, `section.tsx`, `bullets.tsx`, `quote.tsx`, `stats.tsx`
- Create: `packages/ui/src/slides/index.ts`
- Modify: `packages/ui/src/index.ts` (re-export `./slides`)
- Create: `apps/cms/public/images/logo-mascot.png`, `apps/cms/public/images/engenharia-inversa-logo.svg` (copies)
- Test: `packages/ui/src/slides/slide-renderer.test.tsx`

**Interfaces:**
- Consumes: `parseSlideContent`, `SLIDE_TEMPLATES`, `SlideTemplateKey`, `CoverContent`, `AgendaContent`, `SectionContent`, `BulletsContent`, `QuoteContent`, `StatsContent` from `@repo/slides` (Tasks 1–2).
- Produces: `SLIDE_WIDTH`, `SLIDE_HEIGHT`, `PIPELINE_GRADIENT`, `SLIDE_PADDING`, `SlideCanvas`, `SlideRenderer`, `SlideContext` (exported from `@repo/ui`). Later tasks register renderers in the `RENDERERS` map in `slide-renderer.tsx`.

Notes for the implementer:
- The CMS `globals.css` does not define `.technical-grid` or `.pipeline-line` (only the landing's does), so the canvas inlines both backgrounds as styles. Do not rely on those utility classes inside `packages/ui/src/slides`.
- Every size inside the canvas is in absolute pixels of the 1920×1080 surface (Tailwind arbitrary values such as `text-[96px]`). Both apps' Tailwind `content` already scans `../../packages/ui/src/**`.
- `@repo/slides` is compiled: it must be built (`dist/`) before `@repo/ui` tests run. The dev images build it (Task 3).

- [ ] **Step 1: Add dependencies and the test runner to `@repo/ui`**

Edit `packages/ui/package.json`: add to `dependencies` `"@repo/slides": "workspace:*"`; add to `devDependencies` `"vitest"` with **the exact same version string** as in `packages/slides/package.json` (Task 1); add the script `"test": "vitest run"`. The file becomes:

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tailwind.config": "./tailwind.config.ts",
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/slides": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@repo/tsconfig": "workspace:*",
    "vitest": "<same version string as packages/slides/package.json>"
  }
}
```

(Replace the `vitest` value with the literal string copied from `packages/slides/package.json`, e.g. `"^3.2.4"` — do not leave the angle-bracket text.)

Create `packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

// Renderer smoke tests use react-dom/server, so a DOM environment is not
// needed; the automatic JSX runtime matches tsconfig's "react-jsx".
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Run `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build cms landing`.
Expected: build succeeds; `git diff --stat pnpm-lock.yaml` shows the new links.

- [ ] **Step 2: Copy the brand assets into the CMS**

```bash
mkdir -p apps/cms/public/images
cp apps/landing/public/images/logo-mascot.png apps/landing/public/images/engenharia-inversa-logo.svg apps/cms/public/images/
```

The renderers reference `/images/logo-mascot.png` and `/images/engenharia-inversa-logo.svg`; both apps now serve them at the same path. (`apps/cms/public` is not a dev volume, so the `build` in Step 1 must run after this copy if you reorder steps.)

- [ ] **Step 3: Write the failing smoke test**

Create `packages/ui/src/slides/slide-renderer.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SLIDE_TEMPLATES } from "@repo/slides";
import { SlideRenderer } from "./slide-renderer";

const TEXT_TEMPLATES = ["cover", "agenda", "section", "bullets", "quote", "stats"] as const;

describe("SlideRenderer", () => {
  it.each(TEXT_TEMPLATES)("renders the %s example without the warning", (key) => {
    const html = renderToStaticMarkup(
      <SlideRenderer template={key} content={SLIDE_TEMPLATES[key].example} slideNumber={3} />,
    );
    expect(html).not.toContain("Slide inválido");
  });

  it("renders the cover title", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="cover"
        content={{ ...SLIDE_TEMPLATES.cover.defaults, title: "Engenharia reversa de apps" }}
      />,
    );
    expect(html).toContain("Engenharia reversa de apps");
  });

  it("renders every bullet item", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer template="bullets" content={{ title: "Pauta", items: ["Primeiro", "Segundo"] }} />,
    );
    expect(html).toContain("Primeiro");
    expect(html).toContain("Segundo");
  });

  it("shows the slide number in the footer and hides the footer on the cover", () => {
    const section = renderToStaticMarkup(
      <SlideRenderer template="section" content={SLIDE_TEMPLATES.section.example} slideNumber={7} />,
    );
    expect(section).toContain(">07<");
    const cover = renderToStaticMarkup(
      <SlideRenderer template="cover" content={SLIDE_TEMPLATES.cover.example} slideNumber={7} />,
    );
    expect(cover).not.toContain(">07<");
  });

  it("renders a warning for an unknown template", () => {
    const html = renderToStaticMarkup(<SlideRenderer template="nope" content={{}} />);
    expect(html).toContain("Slide inválido: nope");
  });

  it("renders a warning for invalid content instead of throwing", () => {
    const html = renderToStaticMarkup(<SlideRenderer template="cover" content={{ title: "" }} />);
    expect(html).toContain("Slide inválido: cover");
  });

  it("renders the overlay slot", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="quote"
        content={SLIDE_TEMPLATES.quote.example}
        overlay={<span data-testid="pointer">•</span>}
      />,
    );
    expect(html).toContain('data-testid="pointer"');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: FAIL — `Failed to resolve import "./slide-renderer"`.

- [ ] **Step 5: Implement the canvas**

Create `packages/ui/src/slides/canvas.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils";

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

// Inlined on purpose: the CMS stylesheet does not define the landing's
// `.technical-grid` / `.pipeline-line` utilities, and the canvas must look the
// same in both apps and in print.
const TECHNICAL_GRID = "radial-gradient(rgba(164, 140, 125, 0.1) 1px, transparent 1px)";
export const PIPELINE_GRADIENT =
  "linear-gradient(90deg, #ffb783 0%, #ebbf01 50%, #243648 100%)";

/** Content padding for templates that sit above the footer bar. */
export const SLIDE_PADDING = "px-[120px] pt-[96px] pb-[160px]";

export type SlideCanvasProps = {
  children: ReactNode;
  showFooter?: boolean;
  slideNumber?: number;
  overlay?: ReactNode;
  className?: string;
};

/**
 * A fixed 1920×1080 surface scaled to the width of its container. Every size
 * inside is absolute, so a thumbnail, the editor preview, fullscreen and the
 * printed page are pixel-identical apart from the scale factor.
 */
export function SlideCanvas({
  children,
  showFooter = true,
  slideNumber,
  overlay,
  className,
}: SlideCanvasProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  // null until measured: the surface stays hidden for that first frame instead
  // of flashing at full size.
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SLIDE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className={cn("relative w-full overflow-hidden bg-background", className)}
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left bg-background text-on-surface font-body"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : "visible",
          backgroundImage: TECHNICAL_GRID,
          backgroundSize: "32px 32px",
        }}
      >
        <div className="absolute inset-0">{children}</div>
        {showFooter && <SlideFooter slideNumber={slideNumber} />}
        {overlay && <div className="absolute inset-0">{overlay}</div>}
      </div>
    </div>
  );
}

function SlideFooter({ slideNumber }: { slideNumber?: number }) {
  return (
    <div className="absolute left-[120px] right-[120px] bottom-[48px] flex items-center gap-[32px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/engenharia-inversa-logo.svg" alt="" className="h-[44px] w-auto" />
      <div className="h-[4px] flex-1 rounded-full" style={{ background: PIPELINE_GRADIENT }} />
      {slideNumber !== undefined && (
        <span className="font-code text-[24px] text-on-surface-variant tabular-nums">
          {String(slideNumber).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
```

Create `packages/ui/src/slides/invalid-slide.tsx`:

```tsx
/** Shown in place of a slide whose template or content does not validate. */
export function InvalidSlide({ template }: { template: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="rounded-xl border-[3px] border-dashed border-error px-[80px] py-[56px] text-center">
        <p className="font-headline font-bold text-[56px] text-error">
          Slide inválido: {template}
        </p>
        <p className="mt-[16px] text-[28px] text-on-surface-variant">
          Corrija o conteúdo no editor do CMS.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement the six text renderers**

Create `packages/ui/src/slides/templates/cover.tsx`:

```tsx
import type { CoverContent } from "@repo/slides";
import { PIPELINE_GRADIENT } from "../canvas";

export function CoverSlide({ content }: { content: CoverContent }) {
  return (
    <div className="absolute inset-0 flex items-center gap-[64px] px-[120px]">
      <div className="absolute right-[-160px] top-1/2 h-[900px] w-[900px] -translate-y-1/2 rounded-full bg-primary/10 blur-[160px]" />
      <div className="relative flex-1 space-y-[40px]">
        {content.label && (
          <span className="block font-label font-semibold uppercase tracking-[0.2em] text-[28px] text-secondary-container">
            {content.label}
          </span>
        )}
        <h1 className="font-headline font-extrabold text-[104px] leading-[1.05] tracking-[-0.02em] text-on-surface">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="max-w-[1000px] text-[36px] leading-[1.4] text-on-surface-variant">
            {content.subtitle}
          </p>
        )}
        <div className="h-[6px] w-[360px] rounded-full" style={{ background: PIPELINE_GRADIENT }} />
        {content.date && (
          <p className="font-code text-[28px] text-on-surface-variant">{content.date}</p>
        )}
      </div>
      {content.showMascot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/logo-mascot.png"
          alt=""
          className="relative w-[600px] shrink-0 drop-shadow-[0_20px_50px_rgba(230,126,34,0.3)]"
        />
      )}
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/agenda.tsx`:

```tsx
import type { AgendaContent } from "@repo/slides";
import { PIPELINE_GRADIENT, SLIDE_PADDING } from "../canvas";

/** The steps drawn as a numbered pipeline: nodes joined by the brand gradient. */
export function AgendaSlide({ content }: { content: AgendaContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      <h2 className="font-headline font-bold text-[72px] leading-[1.1] text-on-surface">
        {content.title}
      </h2>
      <div className="relative mt-auto mb-auto">
        <div
          className="absolute left-[48px] right-[48px] top-[47px] h-[6px] rounded-full"
          style={{ background: PIPELINE_GRADIENT }}
        />
        <ol className="relative flex justify-between gap-[24px]">
          {content.steps.map((step, i) => (
            <li key={i} className="flex flex-1 flex-col items-start gap-[24px]">
              <span className="flex h-[100px] w-[100px] items-center justify-center rounded-full border-[4px] border-primary bg-surface-container-lowest font-code font-medium text-[36px] text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-headline font-semibold text-[32px] leading-[1.2] text-on-surface">
                {step.title}
              </span>
              {step.description && (
                <span className="text-[22px] leading-[1.4] text-on-surface-variant">
                  {step.description}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/section.tsx`:

```tsx
import type { SectionContent } from "@repo/slides";
import { PIPELINE_GRADIENT, SLIDE_PADDING } from "../canvas";

export function SectionSlide({ content }: { content: SectionContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${SLIDE_PADDING}`}>
      {content.number && (
        <span className="font-code font-medium text-[160px] leading-none text-primary/40">
          {content.number}
        </span>
      )}
      <h2 className="mt-[24px] font-headline font-extrabold text-[112px] leading-[1.05] tracking-[-0.02em] text-on-surface">
        {content.title}
      </h2>
      <div className="mt-[40px] h-[6px] w-[280px] rounded-full" style={{ background: PIPELINE_GRADIENT }} />
      {content.tagline && (
        <p className="mt-[40px] max-w-[1300px] text-[36px] leading-[1.4] text-on-surface-variant">
          {content.tagline}
        </p>
      )}
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/bullets.tsx`:

```tsx
import type { BulletsContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

export function BulletsSlide({ content }: { content: BulletsContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      <h2 className="font-headline font-bold text-[72px] leading-[1.1] text-on-surface">
        {content.title}
      </h2>
      <ul className="mt-[64px] space-y-[32px]">
        {content.items.map((item, i) => (
          <li key={i} className="flex items-start gap-[32px]">
            <span className="mt-[18px] h-[16px] w-[16px] shrink-0 rounded-[3px] bg-primary-container" />
            <span className="text-[40px] leading-[1.35] text-on-surface">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/quote.tsx`:

```tsx
import type { QuoteContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

export function QuoteSlide({ content }: { content: QuoteContent }) {
  const attribution = [content.author, content.role].filter(Boolean).join(" — ");
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${SLIDE_PADDING}`}>
      <span className="font-headline font-extrabold text-[240px] leading-[0.6] text-primary/30">“</span>
      <blockquote className="mt-[24px] max-w-[1500px] font-headline font-semibold text-[64px] leading-[1.25] text-on-surface">
        {content.quote}
      </blockquote>
      {attribution && (
        <p className="mt-[56px] font-label font-semibold text-[32px] text-secondary-container">
          {attribution}
        </p>
      )}
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/stats.tsx`:

```tsx
import type { StatsContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

export function StatsSlide({ content }: { content: StatsContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      {content.title && (
        <h2 className="font-headline font-bold text-[72px] leading-[1.1] text-on-surface">
          {content.title}
        </h2>
      )}
      <div className="my-auto grid gap-[40px]" style={{ gridTemplateColumns: `repeat(${content.items.length}, minmax(0, 1fr))` }}>
        {content.items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border-[2px] border-outline-variant bg-surface-container px-[48px] py-[56px]"
          >
            <p className="font-headline font-extrabold text-[120px] leading-none text-secondary-container">
              {item.value}
            </p>
            <p className="mt-[24px] font-label font-semibold uppercase tracking-[0.12em] text-[28px] text-on-surface-variant">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implement `SlideRenderer` and the barrel**

Create `packages/ui/src/slides/slide-renderer.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import {
  parseSlideContent,
  type SlideContentByTemplate,
  type SlideTemplateKey,
} from "@repo/slides";
import { SlideCanvas } from "./canvas";
import { InvalidSlide } from "./invalid-slide";
import { CoverSlide } from "./templates/cover";
import { AgendaSlide } from "./templates/agenda";
import { SectionSlide } from "./templates/section";
import { BulletsSlide } from "./templates/bullets";
import { QuoteSlide } from "./templates/quote";
import { StatsSlide } from "./templates/stats";

/** Data a slide cannot hold itself, supplied by the hosting app. */
export type SlideContext = {
  socialLinks?: { label: string; url: string }[];
  /** Maps stored URLs (e.g. `/uploads/x.png`) to fetchable ones. Defaults to identity. */
  resolveUrl?: (url: string) => string;
};

type RendererProps<K extends SlideTemplateKey> = {
  content: SlideContentByTemplate[K];
  context: Required<SlideContext>;
};

const RENDERERS: { [K in SlideTemplateKey]?: (props: RendererProps<K>) => JSX.Element } = {
  cover: CoverSlide,
  agenda: AgendaSlide,
  section: SectionSlide,
  bullets: BulletsSlide,
  quote: QuoteSlide,
  stats: StatsSlide,
};

// Full-bleed templates draw edge to edge and carry no footer bar.
const NO_FOOTER = new Set<SlideTemplateKey>(["cover", "image"]);

export type SlideRendererProps = {
  template: string;
  content: unknown;
  slideNumber?: number;
  context?: SlideContext;
  overlay?: ReactNode;
};

/**
 * Validates the content against its template and draws it. Anything that does
 * not validate becomes a warning slide: one bad slide never takes the deck down.
 */
export function SlideRenderer({ template, content, slideNumber, context, overlay }: SlideRendererProps) {
  const parsed = parseSlideContent(template, content);
  const Renderer = parsed.ok
    ? (RENDERERS[parsed.template] as ((props: RendererProps<SlideTemplateKey>) => JSX.Element) | undefined)
    : undefined;

  if (!parsed.ok || !Renderer) {
    return (
      <SlideCanvas slideNumber={slideNumber} overlay={overlay}>
        <InvalidSlide template={template} />
      </SlideCanvas>
    );
  }

  const fullContext: Required<SlideContext> = {
    socialLinks: context?.socialLinks ?? [],
    resolveUrl: context?.resolveUrl ?? ((url) => url),
  };

  return (
    <SlideCanvas
      showFooter={!NO_FOOTER.has(parsed.template)}
      slideNumber={slideNumber}
      overlay={overlay}
    >
      <Renderer content={parsed.data as never} context={fullContext} />
    </SlideCanvas>
  );
}
```

Create `packages/ui/src/slides/index.ts`:

```ts
export * from "./canvas";
export * from "./slide-renderer";
```

Modify `packages/ui/src/index.ts` — append:

```ts
export * from "./slides";
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: PASS — 12 tests (6 `it.each` cases + 6 single tests).

- [ ] **Step 9: Type-check both apps**

Run: `dcr cms pnpm --filter cms exec tsc --noEmit` and `dcr landing pnpm --filter landing exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/package.json packages/ui/vitest.config.ts packages/ui/src/index.ts packages/ui/src/slides apps/cms/public/images pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(ui): add the slide canvas and the text slide renderers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `split`, `code`, `comparison`, `closing`, `image` renderers

**Files:**
- Modify: `packages/ui/package.json` (deps `prism-react-renderer`, `prismjs`; devDep `@types/prismjs`)
- Create: `packages/ui/src/slides/prism-setup.ts`, `packages/ui/src/slides/prism-languages.ts`, `packages/ui/src/slides/code-theme.ts`
- Create: `packages/ui/src/slides/templates/split.tsx`, `code.tsx`, `comparison.tsx`, `closing.tsx`, `image.tsx`
- Modify: `packages/ui/src/slides/slide-renderer.tsx` (register the five renderers; map becomes total)
- Test: `packages/ui/src/slides/slide-renderer.test.tsx` (extend)

**Interfaces:**
- Consumes: `SlideCanvas`, `SLIDE_PADDING`, `PIPELINE_GRADIENT`, `SlideContext` (Task 11); `SplitContent`, `CodeContent`, `ComparisonContent`, `ClosingContent`, `ImageContent`, `CodeLanguage`, `SLIDE_TEMPLATE_KEYS` from `@repo/slides`.
- Produces: `PRISM_LANGUAGE: Record<CodeLanguage, string>`, `codeTheme: PrismTheme`. `RENDERERS` now covers all 11 keys.

Notes:
- `prism-react-renderer` v2 bundles TypeScript, TSX, JS, Kotlin, Swift, JSON and YAML but **not** Bash, SQL, Dart or Diff. Those are loaded from `prismjs/components/*`, which expect a global `Prism`. ES modules evaluate imports in order, so `prism-languages.ts` imports `./prism-setup` (which assigns the global) before the component files.

- [ ] **Step 1: Add the dependencies**

Edit `packages/ui/package.json`: add to `dependencies` `"prism-react-renderer": "^2.4.1"` and `"prismjs": "^1.30.0"`; add to `devDependencies` `"@types/prismjs": "^1.26.5"`. Run `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build cms landing`.

- [ ] **Step 2: Extend the failing tests**

Append to `packages/ui/src/slides/slide-renderer.test.tsx`:

```tsx
import { SLIDE_TEMPLATE_KEYS } from "@repo/slides";

describe("SlideRenderer — all templates", () => {
  it.each(SLIDE_TEMPLATE_KEYS)("renders the %s example without the warning", (key) => {
    const html = renderToStaticMarkup(
      <SlideRenderer template={key} content={SLIDE_TEMPLATES[key].example} slideNumber={1} />,
    );
    expect(html).not.toContain("Slide inválido");
  });

  it("highlights code tokens for a language prism-react-renderer does not bundle", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="code"
        content={{ language: "bash", code: 'echo "oi"\nadb shell pm list packages' }}
      />,
    );
    expect(html).toContain("token");
    expect(html).toContain("adb shell pm list packages");
  });

  it("marks highlighted code lines", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="code"
        content={{ language: "ts", code: "const a = 1;\nconst b = 2;", highlightLines: [2] }}
      />,
    );
    expect(html.match(/data-highlighted="true"/g)).toHaveLength(1);
  });

  it("resolves image URLs through the context", () => {
    const html = renderToStaticMarkup(
      <SlideRenderer
        template="image"
        content={{ image: { url: "/uploads/a.png", alt: "Diagrama" }, fit: "contain" }}
        context={{ resolveUrl: (url) => `https://api.example.com${url}` }}
      />,
    );
    expect(html).toContain('src="https://api.example.com/uploads/a.png"');
    expect(html).toContain('alt="Diagrama"');
  });

  it("lists social links on the closing slide only when enabled", () => {
    const context = { socialLinks: [{ label: "YouTube", url: "https://youtube.com/@ei" }] };
    const on = renderToStaticMarkup(
      <SlideRenderer template="closing" content={{ title: "Obrigado!", showSocialLinks: true }} context={context} />,
    );
    expect(on).toContain("YouTube");
    const off = renderToStaticMarkup(
      <SlideRenderer template="closing" content={{ title: "Obrigado!", showSocialLinks: false }} context={context} />,
    );
    expect(off).not.toContain("YouTube");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: FAIL — the `split`, `code`, `closing`, `comparison` and `image` cases render "Slide inválido".

- [ ] **Step 4: Implement prism setup and the theme**

Create `packages/ui/src/slides/prism-setup.ts`:

```ts
import { Prism } from "prism-react-renderer";

// prismjs language components register themselves on a global `Prism`.
// This module must be imported before any of them (see prism-languages.ts).
(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
```

Create `packages/ui/src/slides/prism-languages.ts`:

```ts
import type { CodeLanguage } from "@repo/slides";
import "./prism-setup";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-dart";
import "prismjs/components/prism-diff";

/** Template language key → Prism grammar name. */
export const PRISM_LANGUAGE: Record<CodeLanguage, string> = {
  ts: "typescript",
  js: "javascript",
  tsx: "tsx",
  kotlin: "kotlin",
  swift: "swift",
  dart: "dart",
  bash: "bash",
  json: "json",
  yaml: "yaml",
  sql: "sql",
  diff: "diff",
};
```

Create `packages/ui/src/slides/code-theme.ts`:

```ts
import type { PrismTheme } from "prism-react-renderer";

// Built from the design tokens: orange (primary), yellow (secondary), blue
// (tertiary) on surface-container-lowest.
export const codeTheme: PrismTheme = {
  plain: { color: "#d1e4fb", backgroundColor: "#000f1e" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#a48c7d", fontStyle: "italic" } },
    { types: ["keyword", "boolean", "important", "atrule"], style: { color: "#ffb783" } },
    { types: ["string", "char", "attr-value", "inserted"], style: { color: "#ffdd74" } },
    { types: ["function", "class-name", "builtin"], style: { color: "#92ccff" } },
    { types: ["number", "constant", "symbol"], style: { color: "#eec209" } },
    { types: ["tag", "selector", "property", "attr-name"], style: { color: "#cce5ff" } },
    { types: ["operator", "punctuation"], style: { color: "#dcc1b1" } },
    { types: ["deleted"], style: { color: "#ffb4ab" } },
    { types: ["variable", "parameter"], style: { color: "#d1e4fb" } },
  ],
};
```

- [ ] **Step 5: Implement the five renderers**

Create `packages/ui/src/slides/templates/split.tsx`:

```tsx
import type { SplitContent } from "@repo/slides";
import type { SlideContext } from "../slide-renderer";
import { SLIDE_PADDING } from "../canvas";

export function SplitSlide({ content, context }: { content: SplitContent; context: Required<SlideContext> }) {
  const paragraphs = content.body.split(/\n\s*\n/).filter((p) => p.trim() !== "");
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={context.resolveUrl(content.image.url)}
      alt={content.image.alt}
      className="h-full w-full rounded-xl border-[2px] border-outline-variant object-cover"
    />
  );
  return (
    <div className={`absolute inset-0 grid grid-cols-2 gap-[80px] ${SLIDE_PADDING}`}>
      {content.imageSide === "left" && <div className="min-h-0">{image}</div>}
      <div className="flex min-h-0 flex-col justify-center">
        <h2 className="font-headline font-bold text-[64px] leading-[1.1] text-on-surface">
          {content.title}
        </h2>
        <div className="mt-[40px] space-y-[24px]">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[30px] leading-[1.5] text-on-surface-variant">
              {p}
            </p>
          ))}
        </div>
      </div>
      {content.imageSide === "right" && <div className="min-h-0">{image}</div>}
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/code.tsx`:

```tsx
import { Highlight, Prism } from "prism-react-renderer";
import type { CodeContent } from "@repo/slides";
import { PRISM_LANGUAGE } from "../prism-languages";
import { codeTheme } from "../code-theme";
import { SLIDE_PADDING } from "../canvas";

export function CodeSlide({ content }: { content: CodeContent }) {
  const highlighted = new Set(content.highlightLines ?? []);
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      {content.title && (
        <h2 className="font-headline font-bold text-[56px] leading-[1.1] text-on-surface">
          {content.title}
        </h2>
      )}
      <div className="mt-[32px] min-h-0 flex-1 overflow-hidden rounded-xl border-[2px] border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b-[2px] border-outline-variant px-[32px] py-[12px]">
          <span className="font-code text-[20px] uppercase tracking-[0.15em] text-on-surface-variant">
            {content.language}
          </span>
        </div>
        <Highlight prism={Prism} theme={codeTheme} code={content.code.replace(/\n$/, "")} language={PRISM_LANGUAGE[content.language]}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="py-[20px] font-code text-[22px] leading-[29px]" style={{ fontVariantLigatures: "none" }}>
              {tokens.map((line, i) => {
                const isHighlighted = highlighted.has(i + 1);
                const { key: _lineKey, ...lineProps } = getLineProps({ line });
                return (
                  <div
                    key={i}
                    {...lineProps}
                    data-highlighted={isHighlighted ? "true" : undefined}
                    className={`flex px-[32px] ${isHighlighted ? "bg-primary/15" : ""}`}
                  >
                    <span className="w-[56px] shrink-0 select-none text-right pr-[24px] text-outline">
                      {i + 1}
                    </span>
                    <span>
                      {line.map((token, j) => {
                        const { key: _tokenKey, ...tokenProps } = getTokenProps({ token });
                        return <span key={j} {...tokenProps} />;
                      })}
                    </span>
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
      {content.caption && (
        <p className="mt-[24px] text-[26px] text-on-surface-variant">{content.caption}</p>
      )}
    </div>
  );
}
```

(If `getLineProps` in the installed version does not return a `key`, the destructuring yields `undefined` and is harmless.)

Create `packages/ui/src/slides/templates/comparison.tsx`:

```tsx
import type { ComparisonContent } from "@repo/slides";
import { SLIDE_PADDING } from "../canvas";

type Side = ComparisonContent["left"];

function Column({ side, highlighted }: { side: Side; highlighted: boolean }) {
  return (
    <div
      className={`rounded-xl border-[3px] px-[48px] py-[40px] ${
        highlighted ? "border-primary bg-primary/10" : "border-outline-variant bg-surface-container"
      }`}
    >
      <p
        className={`font-label font-semibold uppercase tracking-[0.15em] text-[28px] ${
          highlighted ? "text-primary" : "text-on-surface-variant"
        }`}
      >
        {side.label}
      </p>
      <ul className="mt-[32px] space-y-[24px]">
        {side.items.map((item, i) => (
          <li key={i} className="flex items-start gap-[20px] text-[32px] leading-[1.35] text-on-surface">
            <span className="mt-[14px] h-[12px] w-[12px] shrink-0 rounded-[2px] bg-secondary-container" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonSlide({ content }: { content: ComparisonContent }) {
  return (
    <div className={`absolute inset-0 flex flex-col ${SLIDE_PADDING}`}>
      <h2 className="font-headline font-bold text-[64px] leading-[1.1] text-on-surface">
        {content.title}
      </h2>
      <div className="mt-[56px] grid flex-1 grid-cols-2 items-start gap-[48px]">
        <Column side={content.left} highlighted={content.highlight === "left"} />
        <Column side={content.right} highlighted={content.highlight === "right"} />
      </div>
    </div>
  );
}
```

Create `packages/ui/src/slides/templates/closing.tsx`:

```tsx
import type { ClosingContent } from "@repo/slides";
import type { SlideContext } from "../slide-renderer";
import { PIPELINE_GRADIENT, SLIDE_PADDING } from "../canvas";

export function ClosingSlide({ content, context }: { content: ClosingContent; context: Required<SlideContext> }) {
  const links = content.showSocialLinks
    ? context.socialLinks.filter((link) => link.url.trim() !== "")
    : [];
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${SLIDE_PADDING}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-mascot.png" alt="" className="h-[260px] w-auto drop-shadow-[0_20px_50px_rgba(230,126,34,0.3)]" />
      <h2 className="mt-[32px] font-headline font-extrabold text-[104px] leading-[1.05] text-on-surface">
        {content.title}
      </h2>
      <div className="mt-[32px] h-[6px] w-[280px] rounded-full" style={{ background: PIPELINE_GRADIENT }} />
      {content.message && (
        <p className="mt-[32px] max-w-[1300px] text-[34px] leading-[1.4] text-on-surface-variant">
          {content.message}
        </p>
      )}
      {content.cta && (
        <span className="mt-[40px] inline-block rounded-lg bg-primary px-[56px] py-[24px] font-bold uppercase text-[30px] text-on-primary">
          {content.cta.text}
          <span className="ml-[16px] font-code font-normal normal-case text-[22px] opacity-80">
            {content.cta.url}
          </span>
        </span>
      )}
      {links.length > 0 && (
        <ul className="mt-[40px] flex flex-wrap justify-center gap-[40px]">
          {links.map((link) => (
            <li key={link.url} className="font-label font-semibold text-[28px] text-tertiary">
              {link.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

(The CTA is drawn, not a link: inside a deck a click navigates slides. The URL is printed next to the label so it can be read off the screen or the PDF.)

Create `packages/ui/src/slides/templates/image.tsx`:

```tsx
import type { ImageContent } from "@repo/slides";
import type { SlideContext } from "../slide-renderer";

export function ImageSlide({ content, context }: { content: ImageContent; context: Required<SlideContext> }) {
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={context.resolveUrl(content.image.url)}
        alt={content.image.alt}
        className={`h-full w-full ${content.fit === "cover" ? "object-cover" : "object-contain"}`}
      />
      {content.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent px-[120px] pb-[56px] pt-[120px]">
          <p className="text-[32px] text-on-surface">{content.caption}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Register the renderers (map becomes total)**

In `packages/ui/src/slides/slide-renderer.tsx` add the imports:

```tsx
import { SplitSlide } from "./templates/split";
import { CodeSlide } from "./templates/code";
import { ClosingSlide } from "./templates/closing";
import { ComparisonSlide } from "./templates/comparison";
import { ImageSlide } from "./templates/image";
```

and replace the `RENDERERS` declaration with the total map (dropping the `?`, so a 12th template without a renderer is a type error):

```tsx
const RENDERERS: { [K in SlideTemplateKey]: (props: RendererProps<K>) => JSX.Element } = {
  cover: CoverSlide,
  agenda: AgendaSlide,
  section: SectionSlide,
  bullets: BulletsSlide,
  split: SplitSlide,
  code: CodeSlide,
  closing: ClosingSlide,
  quote: QuoteSlide,
  comparison: ComparisonSlide,
  stats: StatsSlide,
  image: ImageSlide,
};
```

The renderers that ignore `context` (`CoverSlide`, `CodeSlide`, …) still satisfy the signature because their props type is a subset.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: PASS — 28 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/package.json packages/ui/src/slides pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(ui): render split, code, comparison, closing and image slides

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Navigation reducer, `PresentationPlayer`, `PresenterView`, `PrintDeck`

**Files:**
- Create: `packages/ui/src/slides/navigation.ts`
- Create: `packages/ui/src/slides/sync.ts`
- Create: `packages/ui/src/slides/use-deck-navigation.ts`
- Create: `packages/ui/src/slides/player.tsx`
- Create: `packages/ui/src/slides/presenter-view.tsx`
- Create: `packages/ui/src/slides/print-deck.tsx`
- Modify: `packages/ui/src/slides/index.ts`
- Test: `packages/ui/src/slides/navigation.test.ts`, `packages/ui/src/slides/sync.test.ts`

**Interfaces:**
- Consumes: `SlideRenderer`, `SlideContext`, `PIPELINE_GRADIENT`, `SLIDE_WIDTH`, `SLIDE_HEIGHT` (Tasks 11–12).
- Produces (exact, from the catalogue): `PlayerSlide`, `visibleSlides`, `NavState`, `NavAction`, `navReducer`, `indexFromHash`, `createSlideSync`, `PresentationPlayer`, `PresenterView`, `PrintDeck`; plus `formatElapsed(ms: number): string` (used by `PresenterView`, tested here). `PresentationPlayer` exposes `onSlideChange(index, slide)`, `overlay` and `toolbar` — the hooks 3b uses.

- [ ] **Step 1: Write the failing navigation tests**

Create `packages/ui/src/slides/navigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatElapsed, indexFromHash, navReducer, visibleSlides, type PlayerSlide } from "./navigation";

const slide = (id: string, hidden = false): PlayerSlide => ({
  id, template: "bullets", content: {}, notes: null, hidden,
});

describe("visibleSlides", () => {
  it("drops hidden slides and keeps order", () => {
    expect(visibleSlides([slide("a"), slide("b", true), slide("c")]).map((s) => s.id)).toEqual(["a", "c"]);
  });
});

describe("navReducer", () => {
  const at = (index: number, count = 5) => ({ index, count });

  it("moves forward and back within bounds", () => {
    expect(navReducer(at(0), { type: "next" })).toEqual(at(1));
    expect(navReducer(at(4), { type: "next" })).toEqual(at(4));
    expect(navReducer(at(0), { type: "prev" })).toEqual(at(0));
    expect(navReducer(at(3), { type: "prev" })).toEqual(at(2));
  });

  it("jumps to first, last and an arbitrary slide (clamped)", () => {
    expect(navReducer(at(3), { type: "first" })).toEqual(at(0));
    expect(navReducer(at(0), { type: "last" })).toEqual(at(4));
    expect(navReducer(at(0), { type: "goto", index: 2 })).toEqual(at(2));
    expect(navReducer(at(0), { type: "goto", index: 99 })).toEqual(at(4));
    expect(navReducer(at(2), { type: "goto", index: -3 })).toEqual(at(0));
  });

  it("returns the same object when nothing changes", () => {
    const state = at(4);
    expect(navReducer(state, { type: "next" })).toBe(state);
    expect(navReducer(state, { type: "goto", index: 4 })).toBe(state);
  });

  it("clamps the index when the deck shrinks", () => {
    expect(navReducer(at(4, 5), { type: "resize", count: 3 })).toEqual(at(2, 3));
    expect(navReducer(at(1, 5), { type: "resize", count: 0 })).toEqual(at(0, 0));
  });

  it("stays at 0 on an empty deck", () => {
    expect(navReducer(at(0, 0), { type: "next" })).toEqual(at(0, 0));
    expect(navReducer(at(0, 0), { type: "last" })).toEqual(at(0, 0));
  });
});

describe("indexFromHash", () => {
  it("reads a 1-based slide number", () => {
    expect(indexFromHash("#7", 10)).toBe(6);
  });
  it("clamps out-of-range numbers", () => {
    expect(indexFromHash("#99", 10)).toBe(9);
    expect(indexFromHash("#0", 10)).toBe(0);
  });
  it("falls back to the first slide on anything else", () => {
    expect(indexFromHash("", 10)).toBe(0);
    expect(indexFromHash("#abc", 10)).toBe(0);
    expect(indexFromHash("#t=eip_x", 10)).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("formats minutes and seconds, adding hours past 60 minutes", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65_400)).toBe("01:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });
});
```

Create `packages/ui/src/slides/sync.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSlideSync } from "./sync";

// Node 20 ships a global BroadcastChannel, so two instances in one process
// talk to each other like two browser windows do.
describe("createSlideSync", () => {
  it("delivers the index posted by another instance on the same deck", async () => {
    const a = createSlideSync("deck-1");
    const b = createSlideSync("deck-1");
    const received = new Promise<number>((resolve) => b.subscribe(resolve));
    a.post(4);
    await expect(received).resolves.toBe(4);
    a.close();
    b.close();
  });

  it("does not deliver to another deck", async () => {
    const a = createSlideSync("deck-1");
    const other = createSlideSync("deck-2");
    let got: number | null = null;
    other.subscribe((i) => (got = i));
    a.post(2);
    await new Promise((r) => setTimeout(r, 50));
    expect(got).toBeNull();
    a.close();
    other.close();
  });

  it("is a no-op without BroadcastChannel", () => {
    const original = globalThis.BroadcastChannel;
    // @ts-expect-error simulating an environment without the API
    delete globalThis.BroadcastChannel;
    try {
      const sync = createSlideSync("deck-1");
      expect(() => sync.post(1)).not.toThrow();
      expect(typeof sync.subscribe(() => {})).toBe("function");
      sync.close();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: FAIL — cannot resolve `./navigation` and `./sync`.

- [ ] **Step 3: Implement `navigation.ts` and `sync.ts`**

Create `packages/ui/src/slides/navigation.ts`:

```ts
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
```

Create `packages/ui/src/slides/sync.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter @repo/ui test`
Expected: PASS (navigation + sync + renderer suites).

- [ ] **Step 5: Implement the shared navigation hook**

Create `packages/ui/src/slides/use-deck-navigation.ts`:

```ts
"use client";

import { useEffect, useReducer, useRef } from "react";
import { createSlideSync } from "./sync";
import { indexFromHash, navReducer, type NavAction } from "./navigation";

/**
 * Slide index shared by the player and the presenter view: initialised from and
 * written back to the URL hash (`#7`), and mirrored across windows of the same
 * deck through BroadcastChannel.
 */
export function useDeckNavigation(presentationId: string, count: number) {
  const [state, dispatch] = useReducer(navReducer, { index: 0, count });
  const syncRef = useRef<ReturnType<typeof createSlideSync> | null>(null);
  // Index last received from the other window; not echoed back.
  const remoteIndex = useRef<number | null>(null);

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
      remoteIndex.current = index;
      dispatch({ type: "goto", index });
    });
    return () => {
      unsubscribe();
      sync.close();
      syncRef.current = null;
    };
  }, [presentationId]);

  useEffect(() => {
    if (remoteIndex.current === state.index) {
      remoteIndex.current = null;
      return;
    }
    syncRef.current?.post(state.index);
  }, [state.index]);

  return { index: state.index, count: state.count, dispatch };
}

/** Arrow/space/PageUp/PageDown/Home/End, ignored while typing in a field. */
export function navActionForKey(event: KeyboardEvent): NavAction | null {
  const target = event.target as HTMLElement | null;
  if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
    return null;
  }
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
```

- [ ] **Step 6: Implement `PresentationPlayer`**

Create `packages/ui/src/slides/player.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { SlideRenderer, type SlideContext } from "./slide-renderer";
import { PIPELINE_GRADIENT } from "./canvas";
import { visibleSlides, type PlayerSlide } from "./navigation";
import { navActionForKey, useDeckNavigation } from "./use-deck-navigation";

export type PresentationPlayerProps = {
  presentationId: string;
  slides: PlayerSlide[];
  context?: SlideContext;
  /** When set, `P` opens this route in a second window (presenter view). */
  presenterHref?: string;
  onSlideChange?: (index: number, slide: PlayerSlide) => void;
  overlay?: ReactNode;
  toolbar?: ReactNode;
};

const SWIPE_THRESHOLD = 50;

export function PresentationPlayer({
  presentationId,
  slides,
  context,
  presenterHref,
  onSlideChange,
  overlay,
  toolbar,
}: PresentationPlayerProps) {
  const shown = useMemo(() => visibleSlides(slides), [slides]);
  const { index, count, dispatch } = useDeckNavigation(presentationId, shown.length);
  const rootRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const onSlideChangeRef = useRef(onSlideChange);
  onSlideChangeRef.current = onSlideChange;
  const touchStartX = useRef<number | null>(null);

  const current = shown[index];

  useEffect(() => {
    if (current) onSlideChangeRef.current?.(index, current);
  }, [index, current]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  };

  const openPresenter = () => {
    if (!presenterHref) return;
    window.open(
      `${presenterHref}#${indexRef.current + 1}`,
      `presenter-${presentationId}`,
      "popup,width=1280,height=800",
    );
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = navActionForKey(event);
      if (action) {
        event.preventDefault();
        dispatch(action);
        return;
      }
      if (event.key === "f" || event.key === "F") toggleFullscreen();
      if ((event.key === "p" || event.key === "P") && presenterHref) openPresenter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenterHref, presentationId]);

  if (!current) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-container-lowest text-on-surface-variant">
        Esta apresentação não tem slides visíveis.
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="group relative flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-container-lowest"
    >
      {/* Letterboxed 16:9 stage: as wide as the viewport allows. */}
      <div
        className="relative cursor-pointer select-none"
        style={{ width: "min(100vw, calc(100vh * 16 / 9))" }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          dispatch({ type: event.clientX - rect.left < rect.width / 2 ? "prev" : "next" });
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start === null || end === undefined) return;
          if (end - start > SWIPE_THRESHOLD) dispatch({ type: "prev" });
          else if (start - end > SWIPE_THRESHOLD) dispatch({ type: "next" });
        }}
      >
        <SlideRenderer
          template={current.template}
          content={current.content}
          slideNumber={index + 1}
          context={context}
          overlay={overlay}
        />
      </div>

      {/* Toolbar: visible on hover, never part of the click-to-navigate area. */}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-surface-container/90 px-3 py-2 text-sm text-on-surface opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <span className="font-code tabular-nums text-on-surface-variant">
          {index + 1} / {count}
        </span>
        {toolbar}
        {presenterHref && (
          <button type="button" onClick={openPresenter} className="rounded px-2 py-1 hover:bg-surface-container-high" title="Visão do apresentador (P)">
            Apresentador
          </button>
        )}
        <button type="button" onClick={toggleFullscreen} className="rounded px-2 py-1 hover:bg-surface-container-high" title="Tela cheia (F)">
          Tela cheia
        </button>
      </div>

      {/* Progress */}
      <div className="absolute bottom-0 left-0 h-[3px] transition-[width] duration-300" style={{ width: `${((index + 1) / count) * 100}%`, background: PIPELINE_GRADIENT }} />
    </div>
  );
}
```

- [ ] **Step 7: Implement `PresenterView`**

Create `packages/ui/src/slides/presenter-view.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SlideRenderer, type SlideContext } from "./slide-renderer";
import { formatElapsed, visibleSlides, type PlayerSlide } from "./navigation";
import { navActionForKey, useDeckNavigation } from "./use-deck-navigation";

export type PresenterViewProps = {
  presentationId: string;
  title: string;
  slides: PlayerSlide[];
  context?: SlideContext;
};

export function PresenterView({ presentationId, title, slides, context }: PresenterViewProps) {
  const shown = useMemo(() => visibleSlides(slides), [slides]);
  const { index, count, dispatch } = useDeckNavigation(presentationId, shown.length);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = navActionForKey(event);
      if (action) {
        event.preventDefault();
        dispatch(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const elapsed = accumulated + (startedAt !== null ? now - startedAt : 0);
  const current = shown[index];
  const next = shown[index + 1];

  const start = () => {
    if (startedAt === null) setStartedAt(Date.now());
  };
  const pause = () => {
    if (startedAt === null) return;
    setAccumulated((total) => total + Date.now() - startedAt);
    setStartedAt(null);
  };
  const reset = () => {
    setStartedAt(null);
    setAccumulated(0);
  };

  return (
    <div className="flex h-screen flex-col gap-4 bg-surface-container-lowest p-6 text-on-surface">
      <header className="flex items-center justify-between">
        <h1 className="font-headline text-lg font-bold">{title}</h1>
        <div className="flex items-center gap-6 font-code tabular-nums">
          <span className="text-on-surface-variant">
            Slide {count === 0 ? 0 : index + 1} / {count}
          </span>
          <span className="text-2xl text-secondary">{formatElapsed(elapsed)}</span>
          <span className="text-on-surface-variant">
            {new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] gap-6">
        <section className="flex flex-col gap-2">
          <p className="font-label text-xs uppercase tracking-wider text-on-surface-variant">Atual</p>
          {current ? (
            <SlideRenderer template={current.template} content={current.content} slideNumber={index + 1} context={context} />
          ) : (
            <p className="text-on-surface-variant">Sem slides visíveis.</p>
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => dispatch({ type: "prev" })} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm">← Anterior</button>
            <button type="button" onClick={() => dispatch({ type: "next" })} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary">Próximo →</button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <div>
            <p className="mb-2 font-label text-xs uppercase tracking-wider text-on-surface-variant">Próximo</p>
            {next ? (
              <SlideRenderer template={next.template} content={next.content} slideNumber={index + 2} context={context} />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-outline-variant text-sm text-on-surface-variant">
                Fim da apresentação
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 font-label text-xs uppercase tracking-wider text-on-surface-variant">Anotações</p>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container p-4 text-lg leading-relaxed">
              {current?.notes?.trim() ? current.notes : <span className="text-on-surface-variant">Sem anotações neste slide.</span>}
            </div>
          </div>

          <div className="flex gap-2">
            {startedAt === null ? (
              <button type="button" onClick={start} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm">Iniciar cronômetro</button>
            ) : (
              <button type="button" onClick={pause} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm">Pausar</button>
            )}
            <button type="button" onClick={reset} className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high">Zerar</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Implement `PrintDeck`**

Create `packages/ui/src/slides/print-deck.tsx`:

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { SlideRenderer, type SlideContext } from "./slide-renderer";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./canvas";
import { visibleSlides, type PlayerSlide } from "./navigation";

export type PrintDeckProps = {
  slides: PlayerSlide[];
  context?: SlideContext;
  autoPrint?: boolean;
};

function waitForImages(): Promise<unknown> {
  return Promise.all(
    Array.from(document.images).map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
    ),
  );
}

/**
 * Every visible slide at 1920×1080, one per page. The canvases measure a
 * 1920px-wide container, so they render at scale 1.
 */
export function PrintDeck({ slides, context, autoPrint = true }: PrintDeckProps) {
  const shown = useMemo(() => visibleSlides(slides), [slides]);

  useEffect(() => {
    if (!autoPrint) return;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      await waitForImages();
      // Two frames: let the canvases apply their measured scale first.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!cancelled) window.print();
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPrint]);

  return (
    <>
      <style>{`
        @page { size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px; margin: 0; }
        html, body { margin: 0; padding: 0; background: #021525; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <div style={{ width: SLIDE_WIDTH }}>
        {shown.map((slide, i) => (
          <div
            key={slide.id}
            style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, breakAfter: "page", pageBreakAfter: "always", overflow: "hidden" }}
          >
            <SlideRenderer template={slide.template} content={slide.content} slideNumber={i + 1} context={context} />
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 9: Export from the barrel**

Replace `packages/ui/src/slides/index.ts` with:

```ts
export * from "./canvas";
export * from "./slide-renderer";
export * from "./navigation";
export * from "./sync";
export * from "./player";
export * from "./presenter-view";
export * from "./print-deck";
```

- [ ] **Step 10: Run tests and type-check**

Run: `dcr cms pnpm --filter @repo/ui test` — Expected: PASS.
Run: `dcr cms pnpm --filter cms exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/ui/src/slides
git commit -m "$(cat <<'EOF'
feat(ui): add the presentation player, presenter view and print deck

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: CMS — API keys settings page

**Files:**
- Modify: `apps/cms/package.json` (devDep `vitest`, script `test`)
- Create: `apps/cms/vitest.config.ts`
- Modify: `docker-compose.dev.yml` (cms volume `./apps/cms/lib:/app/apps/cms/lib`)
- Create: `apps/cms/lib/relative-time.ts`, `apps/cms/lib/api-key-status.ts`
- Create: `apps/cms/app/dashboard/settings/api-keys/page.tsx`
- Modify: `apps/cms/app/dashboard/settings/page.tsx` (new card)
- Test: `apps/cms/lib/relative-time.test.ts`, `apps/cms/lib/api-key-status.test.ts`

**Interfaces:**
- Consumes: `GET_API_KEYS`, `CREATE_API_KEY`, `REVOKE_API_KEY` from `@repo/graphql`; `ApiKey` from `@repo/types` (Task 10). Backend `ApiKeyExpiry` values `ONE_HOUR | ONE_DAY | SEVEN_DAYS`.
- Produces: `relativeTime(iso: string, now?: number): string`; `apiKeyStatus(key: Pick<ApiKey, "expiresAt" | "revokedAt">, now?: number): "active" | "expired" | "revoked"`; `API_KEY_STATUS_LABEL`. The CMS gets a Vitest runner for its pure helpers (`apps/cms/{lib,components}/**/*.test.ts`), reused by Task 16.

- [ ] **Step 1: Add the CMS test runner and mount `lib/` in dev**

Edit `apps/cms/package.json`: add script `"test": "vitest run"` and devDependency `"vitest"` with the exact version string from `packages/slides/package.json`.

Create `apps/cms/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

// Only pure helpers are unit-tested in the CMS; pages are verified in the browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
```

In `docker-compose.dev.yml`, `cms.volumes`, add after the `components` line:

```yaml
      - ./apps/cms/lib:/app/apps/cms/lib
```

Run `lockfile-refresh`, then `docker compose -f docker-compose.dev.yml build cms` and `docker compose -f docker-compose.dev.yml up -d cms`.

- [ ] **Step 2: Write the failing tests**

Create `apps/cms/lib/relative-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it("describes future instants", () => {
    expect(relativeTime(at(23 * HOUR), NOW)).toBe("em 23 horas");
    expect(relativeTime(at(5 * DAY), NOW)).toBe("em 5 dias");
    expect(relativeTime(at(10 * MIN), NOW)).toBe("em 10 minutos");
  });

  it("describes past instants", () => {
    expect(relativeTime(at(-5 * MIN), NOW)).toBe("há 5 minutos");
    expect(relativeTime(at(-3 * HOUR), NOW)).toBe("há 3 horas");
  });

  it("says agora for the current instant", () => {
    expect(relativeTime(at(0), NOW)).toBe("agora");
  });
});
```

Create `apps/cms/lib/api-key-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { apiKeyStatus } from "./api-key-status";

const NOW = Date.parse("2026-10-01T12:00:00Z");

describe("apiKeyStatus", () => {
  it("is active before expiry", () => {
    expect(apiKeyStatus({ expiresAt: "2026-10-01T13:00:00Z", revokedAt: null }, NOW)).toBe("active");
  });
  it("is expired at or after expiry", () => {
    expect(apiKeyStatus({ expiresAt: "2026-10-01T12:00:00Z", revokedAt: null }, NOW)).toBe("expired");
  });
  it("revoked wins over expired", () => {
    expect(apiKeyStatus({ expiresAt: "2026-09-01T00:00:00Z", revokedAt: "2026-08-31T00:00:00Z" }, NOW)).toBe("revoked");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `dcr cms pnpm --filter cms test`
Expected: FAIL — cannot resolve `./relative-time` and `./api-key-status`.

- [ ] **Step 4: Implement the helpers**

Create `apps/cms/lib/relative-time.ts`:

```ts
const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "em 23 horas", "há 5 minutos", "agora". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return formatter.format(Math.round(diff / 1000), "second");
  if (abs < HOUR) return formatter.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return formatter.format(Math.round(diff / HOUR), "hour");
  return formatter.format(Math.round(diff / DAY), "day");
}
```

Create `apps/cms/lib/api-key-status.ts`:

```ts
import type { ApiKey } from "@repo/types";

export type ApiKeyStatus = "active" | "expired" | "revoked";

export const API_KEY_STATUS_LABEL: Record<ApiKeyStatus, string> = {
  active: "Ativa",
  expired: "Expirada",
  revoked: "Revogada",
};

export function apiKeyStatus(
  key: Pick<ApiKey, "expiresAt" | "revokedAt">,
  now: number = Date.now(),
): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  return Date.parse(key.expiresAt) <= now ? "expired" : "active";
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter cms test`
Expected: PASS — 6 tests.

- [ ] **Step 6: Build the page**

Create `apps/cms/app/dashboard/settings/api-keys/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@repo/graphql/react";
import { CREATE_API_KEY, GET_API_KEYS, REVOKE_API_KEY } from "@repo/graphql";
import type { ApiKey } from "@repo/types";
import { relativeTime } from "../../../../lib/relative-time";
import { API_KEY_STATUS_LABEL, apiKeyStatus } from "../../../../lib/api-key-status";

const EXPIRY_OPTIONS = [
  { value: "ONE_HOUR", label: "1 hora" },
  { value: "ONE_DAY", label: "24 horas" },
  { value: "SEVEN_DAYS", label: "7 dias" },
] as const;

const STATUS_CLASS = {
  active: "bg-primary/15 text-primary",
  expired: "bg-surface-container-high text-on-surface-variant",
  revoked: "bg-error-container/30 text-error",
} as const;

const inputClass =
  "w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm";

export default function ApiKeysPage() {
  const { data, loading } = useQuery<{ apiKeys: ApiKey[] }>(GET_API_KEYS, {
    fetchPolicy: "cache-and-network",
  });
  const [revokeApiKey] = useMutation(REVOKE_API_KEY, { refetchQueries: [GET_API_KEYS] });
  const [creating, setCreating] = useState(false);

  const keys = data?.apiKeys ?? [];

  const handleRevoke = async (key: ApiKey) => {
    if (!confirm(`Revogar a chave "${key.name}"? Quem estiver usando perde o acesso na próxima requisição.`)) return;
    try {
      await revokeApiKey({ variables: { id: key.id } });
    } catch (err) {
      console.error("Failed to revoke", err);
      alert("Não foi possível revogar a chave.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="text-on-surface-variant hover:text-on-surface transition-colors">
            ← Configurações
          </Link>
          <span className="text-outline-variant">/</span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Chaves de API</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90"
        >
          Gerar chave
        </button>
      </div>

      <p className="text-on-surface-variant text-sm max-w-2xl">
        Chaves temporárias para criar e editar apresentações pela API (por exemplo, pelo
        Claude). Cada chave age em seu nome, expira sozinha e pode ser revogada a qualquer
        momento.
      </p>

      {loading && keys.length === 0 ? (
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      ) : keys.length === 0 ? (
        <p className="text-on-surface-variant text-sm">Nenhuma chave gerada ainda.</p>
      ) : (
        <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high text-on-surface-variant text-left">
              <tr>
                <th className="px-4 py-3 font-label">Nome</th>
                <th className="px-4 py-3 font-label">Chave</th>
                <th className="px-4 py-3 font-label">Criada</th>
                <th className="px-4 py-3 font-label">Expira</th>
                <th className="px-4 py-3 font-label">Último uso</th>
                <th className="px-4 py-3 font-label">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const status = apiKeyStatus(key);
                return (
                  <tr key={key.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3 text-on-surface">{key.name}</td>
                    <td className="px-4 py-3 font-code text-on-surface-variant">ei_{key.prefix}…</td>
                    <td className="px-4 py-3 text-on-surface-variant">{relativeTime(key.createdAt)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{relativeTime(key.expiresAt)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {key.lastUsedAt ? relativeTime(key.lastUsedAt) : "nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${STATUS_CLASS[status]}`}>
                        {API_KEY_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "active" && (
                        <button onClick={() => handleRevoke(key)} className="text-error hover:underline text-sm">
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateKeyModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateKeyModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<(typeof EXPIRY_OPTIONS)[number]["value"]>("ONE_DAY");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [createApiKey, { loading }] = useMutation<{ createApiKey: { apiKey: ApiKey; token: string } }>(
    CREATE_API_KEY,
    { refetchQueries: [GET_API_KEYS] },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await createApiKey({ variables: { name: name.trim(), expiresIn } });
      if (data?.createApiKey) setToken(data.createApiKey.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a chave");
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg bg-surface-container rounded-xl border border-outline-variant p-6 space-y-5">
        {token ? (
          <>
            <h2 className="font-headline text-lg font-bold text-on-surface">Chave gerada</h2>
            <p className="text-sm text-secondary">
              Copie agora: esta chave não será exibida de novo.
            </p>
            <div className="flex gap-2">
              <input readOnly value={token} className={`${inputClass} font-code`} onFocus={(e) => e.currentTarget.select()} />
              <button onClick={handleCopy} className="bg-surface-container-high text-on-surface py-2 px-4 rounded-lg text-sm whitespace-nowrap">
                {copied ? "Copiada!" : "Copiar"}
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm">
                Concluir
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="font-headline text-lg font-bold text-on-surface">Gerar chave de API</h2>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">Nome</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Live #12 — Claude"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">Expira em</label>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)} className={inputClass}>
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || name.trim() === ""}
                className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
              >
                {loading ? "Gerando..." : "Gerar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

(`prefix` holds the 8 characters after `ei_`, per spec §5, so the table prints `ei_` + prefix.)

- [ ] **Step 7: Add the settings card**

In `apps/cms/app/dashboard/settings/page.tsx`, append to `settingsItems`:

```tsx
  {
    label: "Chaves de API",
    href: "/dashboard/settings/api-keys",
    icon: "🔑",
    description: "Gere chaves temporárias para criar apresentações pela API",
  },
```

- [ ] **Step 8: Verify in the browser**

Check the Docker daemon, then with the dev stack up open `http://localhost:4051/dashboard/settings`, click **Chaves de API**, generate "Teste" for 1 hora. Expected: token `ei_…` shown once with Copiar; after Concluir the row shows "Ativa", expiry "em 60 minutos" (or "em 1 hora"); Revogar → status "Revogada" and the button disappears. Run `dcr cms pnpm --filter cms exec tsc --noEmit` — no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/cms/package.json apps/cms/vitest.config.ts apps/cms/lib apps/cms/app/dashboard/settings docker-compose.dev.yml pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(cms): manage temporary API keys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: CMS — presentations library and menu

**Files:**
- Modify: `apps/cms/package.json` (dep `@repo/slides`)
- Modify: `docker-compose.dev.yml` (cms env `NEXT_PUBLIC_LANDING_URL=http://localhost:4052`)
- Create: `apps/cms/lib/landing-url.ts`
- Create: `apps/cms/lib/new-presentation.ts`
- Create: `apps/cms/app/dashboard/presentations/page.tsx`
- Create: `apps/cms/components/presentations/presentation-card.tsx`
- Create: `apps/cms/components/presentations/purge-dialog.tsx`
- Modify: `apps/cms/app/dashboard/layout.tsx` (menu item)
- Test: `apps/cms/lib/new-presentation.test.ts`, `apps/cms/lib/landing-url.test.ts`

**Interfaces:**
- Consumes: `GET_PRESENTATIONS`, `CREATE_PRESENTATION`, `DUPLICATE_PRESENTATION`, `DELETE_PRESENTATION`, `RESTORE_PRESENTATION`, `PURGE_PRESENTATION` (Task 10); `Presentation` (`@repo/types`); `SLIDE_TEMPLATES` (`@repo/slides`); `SlideRenderer`, `visibleSlides` (`@repo/ui`); `relativeTime` (Task 14).
- Produces: `LANDING_URL`, `publicPresentationUrl(slug: string): string`; `starterSlides(title: string): { template: string; content: Record<string, unknown> }[]`. Task 17 reuses `publicPresentationUrl`.

Note on the landing URL: the CMS has no landing URL today. `NEXT_PUBLIC_LANDING_URL` is optional — set only in `docker-compose.dev.yml` (`http://localhost:4052`); production uses the fallback `https://engenhariainversa.com.br`, so no secret, `.env` entry or production compose change is needed.

- [ ] **Step 1: Wire the dependency and the env var**

Edit `apps/cms/package.json` → `dependencies` add `"@repo/slides": "workspace:*"`. In `docker-compose.dev.yml`, `cms.environment`, add `- NEXT_PUBLIC_LANDING_URL=http://localhost:4052`. Run `lockfile-refresh`, `docker compose -f docker-compose.dev.yml build cms`, `docker compose -f docker-compose.dev.yml up -d cms`.

- [ ] **Step 2: Write the failing tests**

Create `apps/cms/lib/new-presentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseSlideContent } from "@repo/slides";
import { starterSlides } from "./new-presentation";

describe("starterSlides", () => {
  it("creates cover, agenda and closing, in that order", () => {
    expect(starterSlides("Minha live").map((s) => s.template)).toEqual(["cover", "agenda", "closing"]);
  });

  it("puts the presentation title on the cover", () => {
    expect(starterSlides("Minha live")[0].content.title).toBe("Minha live");
  });

  it("produces valid content even for a title longer than the cover allows", () => {
    for (const slide of starterSlides("x".repeat(200))) {
      expect(parseSlideContent(slide.template, slide.content).ok).toBe(true);
    }
  });
});
```

Create `apps/cms/lib/landing-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { publicPresentationUrl } from "./landing-url";

describe("publicPresentationUrl", () => {
  it("builds the landing deck URL without a double slash", () => {
    expect(publicPresentationUrl("minha-live", "https://engenhariainversa.com.br/")).toBe(
      "https://engenhariainversa.com.br/apresentacoes/minha-live",
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `dcr cms pnpm --filter cms test` — Expected: FAIL (modules missing).

- [ ] **Step 4: Implement the helpers**

Create `apps/cms/lib/landing-url.ts`:

```ts
// Optional: only the dev compose sets it. Production falls back to the public
// domain, so no secret is needed.
export const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "https://engenhariainversa.com.br";

export function publicPresentationUrl(slug: string, base: string = LANDING_URL): string {
  return `${base.replace(/\/+$/, "")}/apresentacoes/${slug}`;
}
```

Create `apps/cms/lib/new-presentation.ts`:

```ts
import { SLIDE_TEMPLATES } from "@repo/slides";

const COVER_TITLE_MAX = 90;

/** The deck a new presentation starts with: Capa + Agenda + Encerramento. */
export function starterSlides(title: string) {
  return [
    {
      template: "cover",
      content: { ...SLIDE_TEMPLATES.cover.defaults, title: title.trim().slice(0, COVER_TITLE_MAX) },
    },
    { template: "agenda", content: { ...SLIDE_TEMPLATES.agenda.defaults } },
    { template: "closing", content: { ...SLIDE_TEMPLATES.closing.defaults } },
  ] as { template: string; content: Record<string, unknown> }[];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter cms test` — Expected: PASS.

- [ ] **Step 6: Add the menu item**

In `apps/cms/app/dashboard/layout.tsx`, replace `menuItems` with:

```tsx
const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", exact: true },
  { label: "Conteúdo", href: "/dashboard/content", icon: "🎬" },
  { label: "Apresentações", href: "/dashboard/presentations", icon: "🎞️", roles: ["ADMIN", "MANAGER"] },
  { label: "Usuários", href: "/dashboard/users", icon: "👥", roles: ["ADMIN", "MANAGER"] },
  { label: "Configurações", href: "/dashboard/settings", icon: "⚙️", roles: ["ADMIN"] },
];
```

(The menu filter is cosmetic, as for Usuários; the backend's `presentations:*` permissions are what actually gate access.)

- [ ] **Step 7: Build the card and the purge dialog**

Create `apps/cms/components/presentations/presentation-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { SlideRenderer, visibleSlides } from "@repo/ui";
import { getUploadUrl } from "@repo/graphql";
import type { Presentation } from "@repo/types";
import { relativeTime } from "../../lib/relative-time";

const VISIBILITY_LABEL = { PUBLIC: "Pública", PRIVATE: "Privada", MEMBERS: "Membros" } as const;
const VISIBILITY_CLASS = {
  PUBLIC: "bg-primary/15 text-primary",
  PRIVATE: "bg-surface-container-high text-on-surface-variant",
  MEMBERS: "bg-tertiary/15 text-tertiary",
} as const;

export type PresentationCardActions = {
  onDuplicate: () => void;
  onCopyLink: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPurge: () => void;
};

export function PresentationCard({ presentation, inTrash, actions }: {
  presentation: Presentation;
  inTrash: boolean;
  actions: PresentationCardActions;
}) {
  const first = visibleSlides(presentation.slides)[0];
  const button = "text-xs px-2 py-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface";

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden flex flex-col">
      <div className="pointer-events-none">
        {first ? (
          <SlideRenderer template={first.template} content={first.content} context={{ resolveUrl: (u) => getUploadUrl(u) }} />
        ) : (
          <div className="aspect-video flex items-center justify-center text-sm text-on-surface-variant">Sem slides</div>
        )}
      </div>
      <div className="p-4 space-y-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-headline font-bold text-on-surface leading-tight">{presentation.title}</h2>
          <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${VISIBILITY_CLASS[presentation.visibility]}`}>
            {VISIBILITY_LABEL[presentation.visibility]}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant">
          {presentation.slideCount} slides · editada {relativeTime(presentation.updatedAt)}
        </p>
      </div>
      <div className="border-t border-outline-variant px-2 py-2 flex flex-wrap gap-1">
        {inTrash ? (
          <>
            <button onClick={actions.onRestore} className={button}>Restaurar</button>
            <button onClick={actions.onPurge} className={`${button} text-error hover:text-error`}>Excluir definitivamente</button>
          </>
        ) : (
          <>
            <Link href={`/dashboard/presentations/${presentation.id}`} className={button}>Editar</Link>
            <a href={`/apresentar/${presentation.id}`} target="_blank" rel="noreferrer" className={button}>Apresentar</a>
            <button onClick={actions.onDuplicate} className={button}>Duplicar</button>
            {presentation.visibility === "PUBLIC" && (
              <button onClick={actions.onCopyLink} className={button}>Copiar link público</button>
            )}
            <button onClick={actions.onTrash} className={`${button} hover:text-error`}>Mover para a lixeira</button>
          </>
        )}
      </div>
    </div>
  );
}
```

Create `apps/cms/components/presentations/purge-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";

/** Permanent delete, confirmed by typing the exact title. */
export function PurgeDialog({ title, onConfirm, onCancel }: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-6 space-y-4">
        <h2 className="font-headline text-lg font-bold text-error">Excluir definitivamente</h2>
        <p className="text-sm text-on-surface-variant">
          Esta ação não pode ser desfeita. Digite <strong className="text-on-surface">{title}</strong> para confirmar.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-error focus:outline-none text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="py-2 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={typed !== title}
            className="bg-error text-on-error font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-40"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Build the library page**

Create `apps/cms/app/dashboard/presentations/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  CREATE_PRESENTATION,
  DELETE_PRESENTATION,
  DUPLICATE_PRESENTATION,
  GET_PRESENTATIONS,
  PURGE_PRESENTATION,
  RESTORE_PRESENTATION,
} from "@repo/graphql";
import type { Presentation } from "@repo/types";
import { PresentationCard } from "../../../components/presentations/presentation-card";
import { PurgeDialog } from "../../../components/presentations/purge-dialog";
import { starterSlides } from "../../../lib/new-presentation";
import { publicPresentationUrl } from "../../../lib/landing-url";

type Tab = "all" | "public" | "private" | "trash";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "public", label: "Públicas" },
  { key: "private", label: "Privadas" },
  { key: "trash", label: "Lixeira" },
];

export default function PresentationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [newTitle, setNewTitle] = useState<string | null>(null);
  const [purging, setPurging] = useState<Presentation | null>(null);

  const { data, loading, refetch } = useQuery<{ presentations: Presentation[] }>(GET_PRESENTATIONS, {
    variables: { trash: tab === "trash" },
    fetchPolicy: "cache-and-network",
  });
  const refresh = { refetchQueries: [GET_PRESENTATIONS] };
  const [createPresentation, { loading: creating }] = useMutation<{ createPresentation: Presentation }>(CREATE_PRESENTATION);
  const [duplicatePresentation] = useMutation(DUPLICATE_PRESENTATION, refresh);
  const [deletePresentation] = useMutation(DELETE_PRESENTATION, refresh);
  const [restorePresentation] = useMutation(RESTORE_PRESENTATION, refresh);
  const [purgePresentation] = useMutation(PURGE_PRESENTATION, refresh);

  const all = data?.presentations ?? [];
  const shown =
    tab === "public" ? all.filter((p) => p.visibility === "PUBLIC")
    : tab === "private" ? all.filter((p) => p.visibility !== "PUBLIC")
    : all;

  const run = async (action: () => Promise<unknown>, failure: string) => {
    try {
      await action();
      await refetch();
    } catch (err) {
      console.error(failure, err);
      alert(err instanceof Error ? err.message : failure);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = (newTitle ?? "").trim();
    if (!title) return;
    try {
      const { data: result } = await createPresentation({
        variables: { input: { title, slides: starterSlides(title) } },
      });
      if (result?.createPresentation) router.push(`/dashboard/presentations/${result.createPresentation.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar a apresentação");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Apresentações</h1>
          <p className="text-on-surface-variant text-sm mt-1">Seu acervo de apresentações</p>
        </div>
        <button onClick={() => setNewTitle("")} className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90">
          Nova apresentação
        </button>
      </div>

      <div className="flex gap-1 border-b border-outline-variant">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary font-bold" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && all.length === 0 ? (
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      ) : shown.length === 0 ? (
        <p className="text-on-surface-variant text-sm">
          {tab === "trash" ? "A lixeira está vazia." : "Nenhuma apresentação aqui ainda."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {shown.map((p) => (
            <PresentationCard
              key={p.id}
              presentation={p}
              inTrash={tab === "trash"}
              actions={{
                onDuplicate: () => run(() => duplicatePresentation({ variables: { id: p.id } }), "Erro ao duplicar"),
                onCopyLink: () => void navigator.clipboard.writeText(publicPresentationUrl(p.slug)),
                onTrash: () => {
                  if (confirm(`Mover "${p.title}" para a lixeira?`)) {
                    void run(() => deletePresentation({ variables: { id: p.id } }), "Erro ao mover para a lixeira");
                  }
                },
                onRestore: () => run(() => restorePresentation({ variables: { id: p.id } }), "Erro ao restaurar"),
                onPurge: () => setPurging(p),
              }}
            />
          ))}
        </div>
      )}

      {newTitle !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleCreate} className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-6 space-y-4">
            <h2 className="font-headline text-lg font-bold text-on-surface">Nova apresentação</h2>
            <input
              autoFocus
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título"
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <p className="text-xs text-on-surface-variant">Começa com Capa, Agenda e Encerramento.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNewTitle(null)} className="py-2 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high">Cancelar</button>
              <button type="submit" disabled={creating || newTitle.trim() === ""} className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                {creating ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {purging && (
        <PurgeDialog
          title={purging.title}
          onCancel={() => setPurging(null)}
          onConfirm={() => {
            const target = purging;
            setPurging(null);
            void run(() => purgePresentation({ variables: { id: target.id } }), "Erro ao excluir");
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 9: Verify in the browser**

Open `http://localhost:4051/dashboard/presentations`. Expected: menu shows **Apresentações** between Conteúdo and Usuários; "Nova apresentação" → "Teste" opens `/dashboard/presentations/<id>` (404-ish until Task 17 — acceptable); back on the library the card shows the cover thumbnail with "Teste", badge "Privada", "3 slides". Duplicar adds "Teste (cópia)". Mover para a lixeira → the card moves to the Lixeira tab; Restaurar brings it back; Excluir definitivamente stays disabled until the exact title is typed. `dcr cms pnpm --filter cms exec tsc --noEmit` — no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/cms/package.json apps/cms/lib apps/cms/components/presentations apps/cms/app/dashboard/presentations/page.tsx apps/cms/app/dashboard/layout.tsx docker-compose.dev.yml pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(cms): add the presentations library

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: CMS — field-descriptor slide form

Decision: the form's pure helpers live in `apps/cms/components/presentations/form-state.ts` and are tested with the CMS Vitest runner added in Task 14. They are CMS-only (no other app edits slides), so they do not belong in `@repo/slides` or `@repo/ui`.

**Files:**
- Create: `apps/cms/components/presentations/form-state.ts`
- Create: `apps/cms/components/presentations/field-input.tsx`
- Create: `apps/cms/components/presentations/slide-form.tsx`
- Test: `apps/cms/components/presentations/form-state.test.ts`

**Interfaces:**
- Consumes: `FieldDescriptor`, `SLIDE_TEMPLATES`, `SlideTemplateKey`, `SlideIssue` (`@repo/slides`); `uploadFile`, `getUploadUrl` (`@repo/graphql`).
- Produces:
  - `type Path = (string | number)[]`
  - `pathKey(path: Path): string` — `["steps", 2, "title"]` → `"steps.2.title"`
  - `getAt(obj: unknown, path: Path): unknown`
  - `setAt<T>(obj: T, path: Path, value: unknown): T` — immutable; `value === undefined` deletes the key
  - `issuesByPath(issues: SlideIssue[]): Record<string, string>` — first message per path
  - `emptyValueFor(field: FieldDescriptor): unknown`
  - `SlideForm(props: { template: SlideTemplateKey; value: Record<string, unknown>; issues: Record<string, string>; onChange: (next: Record<string, unknown>) => void })`

- [ ] **Step 1: Write the failing tests**

Create `apps/cms/components/presentations/form-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FieldDescriptor } from "@repo/slides";
import { emptyValueFor, getAt, issuesByPath, pathKey, setAt } from "./form-state";

describe("pathKey", () => {
  it("joins with dots", () => {
    expect(pathKey(["steps", 2, "title"])).toBe("steps.2.title");
    expect(pathKey([])).toBe("");
  });
});

describe("getAt / setAt", () => {
  const value = { title: "A", steps: [{ title: "x" }, { title: "y" }] };

  it("reads nested values", () => {
    expect(getAt(value, ["steps", 1, "title"])).toBe("y");
    expect(getAt(value, ["missing", 0])).toBeUndefined();
  });

  it("writes immutably", () => {
    const next = setAt(value, ["steps", 1, "title"], "z");
    expect(getAt(next, ["steps", 1, "title"])).toBe("z");
    expect(value.steps[1].title).toBe("y");
    expect(next.steps[0]).toBe(value.steps[0]);
  });

  it("creates missing containers, arrays for numeric keys", () => {
    expect(setAt({}, ["cta", "text"], "Ver")).toEqual({ cta: { text: "Ver" } });
    expect(setAt({}, ["items", 0], "a")).toEqual({ items: ["a"] });
  });

  it("deletes the key when the value is undefined", () => {
    expect(setAt({ cta: { text: "a", url: "#" }, title: "t" }, ["cta"], undefined)).toEqual({ title: "t" });
  });
});

describe("issuesByPath", () => {
  it("keeps the first message per path", () => {
    expect(
      issuesByPath([
        { path: "title", message: "Obrigatório" },
        { path: "title", message: "Outro" },
        { path: "steps.0.title", message: "Máximo de 60 caracteres" },
      ]),
    ).toEqual({ title: "Obrigatório", "steps.0.title": "Máximo de 60 caracteres" });
  });
});

describe("emptyValueFor", () => {
  it("returns a sensible blank per kind", () => {
    const f = (field: Partial<FieldDescriptor>) => ({ name: "x", label: "X", kind: "text", ...field }) as FieldDescriptor;
    expect(emptyValueFor(f({ kind: "text" }))).toBe("");
    expect(emptyValueFor(f({ kind: "boolean" }))).toBe(false);
    expect(emptyValueFor(f({ kind: "select", options: [{ value: "left", label: "Esquerda" }] }))).toBe("left");
    expect(emptyValueFor(f({ kind: "image" }))).toEqual({ url: "", alt: "" });
    expect(emptyValueFor(f({ kind: "list" }))).toEqual([]);
    expect(
      emptyValueFor(f({ kind: "group", fields: [f({ name: "label" }), f({ name: "items", kind: "list" })] })),
    ).toEqual({ label: "", items: [] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dcr cms pnpm --filter cms test` — Expected: FAIL (`./form-state` missing).

- [ ] **Step 3: Implement `form-state.ts`**

Create `apps/cms/components/presentations/form-state.ts`:

```ts
import type { FieldDescriptor, SlideIssue } from "@repo/slides";

export type Path = (string | number)[];

export function pathKey(path: Path): string {
  return path.join(".");
}

export function getAt(obj: unknown, path: Path): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Immutable set; `undefined` removes the key (used for optional groups). */
export function setAt<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const container: Record<string | number, unknown> | unknown[] =
    Array.isArray(obj) ? [...obj]
    : obj !== null && typeof obj === "object" ? { ...(obj as Record<string, unknown>) }
    : typeof head === "number" ? [] : {};
  const child = (container as Record<string | number, unknown>)[head];
  const nextChild = rest.length === 0 ? value : setAt(child, rest, value);
  if (nextChild === undefined && !Array.isArray(container)) {
    delete (container as Record<string, unknown>)[head];
  } else {
    (container as Record<string | number, unknown>)[head] = nextChild;
  }
  return container as T;
}

export function issuesByPath(issues: SlideIssue[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.path in result)) result[issue.path] = issue.message;
  }
  return result;
}

export function emptyValueFor(field: FieldDescriptor): unknown {
  switch (field.kind) {
    case "boolean":
      return false;
    case "select":
      return field.options?.[0]?.value ?? "";
    case "image":
      return { url: "", alt: "" };
    case "list":
    case "objectList":
      return [];
    case "group":
      return Object.fromEntries((field.fields ?? []).map((f) => [f.name, emptyValueFor(f)]));
    default:
      return "";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter cms test` — Expected: PASS.

- [ ] **Step 5: Implement the field inputs**

Create `apps/cms/components/presentations/field-input.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { FieldDescriptor } from "@repo/slides";
import { getUploadUrl, uploadFile } from "@repo/graphql";
import { emptyValueFor, pathKey, type Path } from "./form-state";

export const inputClass =
  "w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm";

type FieldInputProps = {
  field: FieldDescriptor;
  path: Path;
  value: unknown;
  issues: Record<string, string>;
  onChange: (path: Path, value: unknown) => void;
};

function Issue({ message }: { message?: string }) {
  return message ? <p className="text-xs text-error mt-1">{message}</p> : null;
}

function Counter({ value, max }: { value: string; max?: number }) {
  if (!max) return null;
  return (
    <span className={`text-[10px] ${value.length > max ? "text-error" : "text-on-surface-variant"}`}>
      {value.length}/{max}
    </span>
  );
}

function Label({ field, value }: { field: FieldDescriptor; value?: string }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs text-on-surface-variant font-label">
        {field.label}
        {field.optional && <span className="opacity-60"> (opcional)</span>}
      </label>
      {value !== undefined && <Counter value={value} max={field.maxLength} />}
    </div>
  );
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function FieldInput({ field, path, value, issues, onChange }: FieldInputProps) {
  const key = pathKey(path);
  const message = issues[key];

  switch (field.kind) {
    case "text": {
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <Label field={field} value={text} />
          <input className={inputClass} value={text} onChange={(e) => onChange(path, e.target.value)} />
          {field.help && <p className="text-[11px] text-on-surface-variant mt-1">{field.help}</p>}
          <Issue message={message} />
        </div>
      );
    }
    case "textarea":
    case "code": {
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <Label field={field} value={text} />
          <textarea
            className={`${inputClass} ${field.kind === "code" ? "font-code" : ""}`}
            rows={field.kind === "code" ? 12 : 5}
            spellCheck={field.kind !== "code"}
            value={text}
            onChange={(e) => onChange(path, e.target.value)}
          />
          {field.help && <p className="text-[11px] text-on-surface-variant mt-1">{field.help}</p>}
          <Issue message={message} />
        </div>
      );
    }
    case "select":
      return (
        <div>
          <Label field={field} />
          <select className={inputClass} value={String(value ?? "")} onChange={(e) => onChange(path, e.target.value)}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Issue message={message} />
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(path, e.target.checked)} />
          {field.label}
        </label>
      );
    case "image":
      return <ImageInput field={field} path={path} value={value} issues={issues} onChange={onChange} />;
    case "list": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      const max = field.maxItems ?? Infinity;
      return (
        <div className="space-y-2">
          <Label field={field} />
          {items.map((item, i) => (
            <div key={i}>
              <div className="flex gap-1">
                <input className={inputClass} value={item} onChange={(e) => onChange([...path, i], e.target.value)} />
                <ItemButtons
                  onUp={() => onChange(path, moveItem(items, i, i - 1))}
                  onDown={() => onChange(path, moveItem(items, i, i + 1))}
                  onRemove={() => onChange(path, items.filter((_, j) => j !== i))}
                />
              </div>
              <Issue message={issues[pathKey([...path, i])]} />
            </div>
          ))}
          {items.length < max && (
            <button type="button" onClick={() => onChange(path, [...items, ""])} className="text-xs text-primary hover:underline">
              + Adicionar item
            </button>
          )}
          <Issue message={message} />
        </div>
      );
    }
    case "objectList": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const max = field.maxItems ?? Infinity;
      return (
        <div className="space-y-2">
          <Label field={field} />
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-outline-variant p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-code text-on-surface-variant">#{i + 1}</span>
                <ItemButtons
                  onUp={() => onChange(path, moveItem(items, i, i - 1))}
                  onDown={() => onChange(path, moveItem(items, i, i + 1))}
                  onRemove={() => onChange(path, items.filter((_, j) => j !== i))}
                />
              </div>
              {(field.fields ?? []).map((sub) => (
                <FieldInput key={sub.name} field={sub} path={[...path, i, sub.name]} value={item?.[sub.name]} issues={issues} onChange={onChange} />
              ))}
            </div>
          ))}
          {items.length < max && (
            <button
              type="button"
              onClick={() => onChange(path, [...items, emptyValueFor({ ...field, kind: "group" })])}
              className="text-xs text-primary hover:underline"
            >
              + Adicionar
            </button>
          )}
          <Issue message={message} />
        </div>
      );
    }
    case "group": {
      const present = value !== undefined && value !== null;
      return (
        <div className="rounded-lg border border-outline-variant p-3 space-y-2">
          {field.optional ? (
            <label className="flex items-center gap-2 text-xs text-on-surface-variant font-label">
              <input
                type="checkbox"
                checked={present}
                onChange={(e) => onChange(path, e.target.checked ? emptyValueFor(field) : undefined)}
              />
              {field.label}
            </label>
          ) : (
            <Label field={field} />
          )}
          {present &&
            (field.fields ?? []).map((sub) => (
              <FieldInput
                key={sub.name}
                field={sub}
                path={[...path, sub.name]}
                value={(value as Record<string, unknown>)[sub.name]}
                issues={issues}
                onChange={onChange}
              />
            ))}
          <Issue message={message} />
        </div>
      );
    }
  }
}

function ItemButtons({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const b = "px-2 text-xs text-on-surface-variant hover:text-on-surface";
  return (
    <div className="flex shrink-0">
      <button type="button" onClick={onUp} className={b} title="Subir">↑</button>
      <button type="button" onClick={onDown} className={b} title="Descer">↓</button>
      <button type="button" onClick={onRemove} className={`${b} hover:text-error`} title="Remover">✕</button>
    </div>
  );
}

function ImageInput({ field, path, value, issues, onChange }: FieldInputProps) {
  const image = (value as { url?: string; alt?: string } | undefined) ?? {};
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadFile(file);
      onChange([...path, "url"], url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label field={field} />
      {image.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getUploadUrl(image.url)} alt="" className="w-full max-h-32 object-contain rounded border border-outline-variant bg-surface-container-lowest" />
      )}
      <div className="flex gap-2 items-center">
        <label className="text-xs bg-surface-container-high px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-container-highest whitespace-nowrap">
          {uploading ? "Enviando..." : "Enviar imagem"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
        </label>
        <input
          className={inputClass}
          placeholder="ou cole uma URL"
          value={image.url ?? ""}
          onChange={(e) => onChange([...path, "url"], e.target.value)}
        />
      </div>
      <Issue message={issues[pathKey([...path, "url"])] ?? error} />
      <input
        className={inputClass}
        placeholder="Texto alternativo"
        value={image.alt ?? ""}
        onChange={(e) => onChange([...path, "alt"], e.target.value)}
      />
      <Issue message={issues[pathKey([...path, "alt"])]} />
    </div>
  );
}
```

- [ ] **Step 6: Implement `SlideForm`**

Create `apps/cms/components/presentations/slide-form.tsx`:

```tsx
"use client";

import { SLIDE_TEMPLATES, type SlideTemplateKey } from "@repo/slides";
import { FieldInput } from "./field-input";
import { setAt, type Path } from "./form-state";

export type SlideFormProps = {
  template: SlideTemplateKey;
  value: Record<string, unknown>;
  /** From issuesByPath(parseSlideContent(...).issues); "" holds root-level issues. */
  issues: Record<string, string>;
  onChange: (next: Record<string, unknown>) => void;
};

/** The template's form, generated from the registry's field descriptors. */
export function SlideForm({ template, value, issues, onChange }: SlideFormProps) {
  const fields = SLIDE_TEMPLATES[template].fields;
  const handleChange = (path: Path, next: unknown) => onChange(setAt(value, path, next));

  return (
    <div className="space-y-4">
      {issues[""] && <p className="text-xs text-error">{issues[""]}</p>}
      {fields.map((field) => (
        <FieldInput key={field.name} field={field} path={[field.name]} value={value[field.name]} issues={issues} onChange={handleChange} />
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Type-check**

Run: `dcr cms pnpm --filter cms exec tsc --noEmit`
Expected: no errors. (The form is exercised in the browser in Task 17.)

- [ ] **Step 8: Commit**

```bash
git add apps/cms/components/presentations/form-state.ts apps/cms/components/presentations/form-state.test.ts apps/cms/components/presentations/field-input.tsx apps/cms/components/presentations/slide-form.tsx
git commit -m "$(cat <<'EOF'
feat(cms): generate slide forms from the template field descriptors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: CMS — editor page

**Files:**
- Create: `packages/graphql/src/client/errors.ts` (+ export from `packages/graphql/src/client/index.ts`)
- Create: `apps/cms/components/presentations/editor-drafts.ts`
- Create: `apps/cms/components/presentations/presentation-header.tsx`
- Create: `apps/cms/components/presentations/slide-list.tsx`
- Create: `apps/cms/components/presentations/template-gallery.tsx`
- Create: `apps/cms/app/dashboard/presentations/[id]/page.tsx`
- Test: `apps/cms/components/presentations/editor-drafts.test.ts`

**Interfaces:**
- Consumes: `GET_PRESENTATION`, `UPDATE_PRESENTATION`, `CREATE_SLIDE`, `UPDATE_SLIDE`, `DELETE_SLIDE`, `REORDER_SLIDES` (Task 10); `SlideForm`, `issuesByPath` (Task 16); `publicPresentationUrl` (Task 15); `SLIDE_TEMPLATES`, `SLIDE_TEMPLATE_KEYS`, `parseSlideContent`, `switchTemplate`, `isValidSlug`, `isSlideTemplateKey` (`@repo/slides`); `SlideRenderer` (`@repo/ui`).
- Produces: `graphQLErrorCode(error: unknown): string | undefined` and `graphQLErrorMessage(error: unknown): string` in `@repo/graphql`; `type SlideDraft = { id: string; template: string; content: Record<string, unknown>; notes: string; hidden: boolean }`; `mergeDrafts(server: Slide[], local: SlideDraft[], pending: Set<string>): SlideDraft[]`; `moveId(ids: string[], from: number, to: number): string[]`.

Behaviour summary (spec §7.2): autosave ~800 ms per slide (`template`, `content`, `notes` sent together); invalid content is never sent; on window focus the editor refetches and shows the banner "Esta apresentação foi alterada pela API — recarregar" when `updatedAt` differs from the last value this tab saw after its own write. Local edits are never overwritten silently; last write wins per slide. `createSlide`'s `position` is the **0-based** index the new slide takes.

- [ ] **Step 1: Write the failing draft-merge tests**

Create `apps/cms/components/presentations/editor-drafts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeDrafts, moveId, type SlideDraft } from "./editor-drafts";

const server = (id: string, title: string) => ({
  id, order: 0, template: "bullets", content: { title, items: ["a"] }, notes: "", hidden: false,
});
const draft = (id: string, title: string): SlideDraft => ({
  id, template: "bullets", content: { title, items: ["a"] }, notes: "", hidden: false,
});

describe("mergeDrafts", () => {
  it("takes server order and content for slides without pending edits", () => {
    const merged = mergeDrafts([server("b", "B2"), server("a", "A2")], [draft("a", "A1"), draft("b", "B1")], new Set());
    expect(merged.map((d) => [d.id, d.content.title])).toEqual([["b", "B2"], ["a", "A2"]]);
  });

  it("keeps the local draft of a slide with a pending save", () => {
    const merged = mergeDrafts([server("a", "server")], [draft("a", "local")], new Set(["a"]));
    expect(merged[0].content.title).toBe("local");
  });

  it("adds new server slides and drops deleted ones", () => {
    const merged = mergeDrafts([server("c", "C")], [draft("a", "A")], new Set());
    expect(merged.map((d) => d.id)).toEqual(["c"]);
  });

  it("turns a null note into an empty string", () => {
    expect(mergeDrafts([{ ...server("a", "A"), notes: null }], [], new Set())[0].notes).toBe("");
  });
});

describe("moveId", () => {
  it("moves an id to a new position", () => {
    expect(moveId(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("ignores out-of-range targets", () => {
    expect(moveId(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dcr cms pnpm --filter cms test` — Expected: FAIL (`./editor-drafts` missing).

- [ ] **Step 3: Implement `editor-drafts.ts` and the error helpers**

Create `apps/cms/components/presentations/editor-drafts.ts`:

```ts
import type { Slide } from "@repo/types";

export type SlideDraft = {
  id: string;
  template: string;
  content: Record<string, unknown>;
  notes: string;
  hidden: boolean;
};

export function toDraft(slide: Slide): SlideDraft {
  return { id: slide.id, template: slide.template, content: slide.content, notes: slide.notes ?? "", hidden: slide.hidden };
}

/**
 * Server structure (order, added and removed slides) with local content kept
 * for slides that still have an unsaved edit.
 */
export function mergeDrafts(server: Slide[], local: SlideDraft[], pending: Set<string>): SlideDraft[] {
  const byId = new Map(local.map((d) => [d.id, d]));
  return [...server]
    .sort((a, b) => a.order - b.order)
    .map((slide) => {
      const mine = byId.get(slide.id);
      return mine && pending.has(slide.id) ? mine : toDraft(slide);
    });
}

export function moveId(ids: string[], from: number, to: number): string[] {
  if (to < 0 || to >= ids.length || from === to) return ids;
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
```

(`mergeDrafts` sorts by `order` because the server already returns slides ordered but the cache may hold a pre-reorder copy; the test data uses `order: 0` for all, which `Array.prototype.sort` keeps stable.)

Create `packages/graphql/src/client/errors.ts`:

```ts
import { CombinedGraphQLErrors } from "@apollo/client";

/** `extensions.code` of the first GraphQL error (e.g. "SLUG_TAKEN"), if any. */
export function graphQLErrorCode(error: unknown): string | undefined {
  if (CombinedGraphQLErrors.is(error)) {
    const code = error.errors[0]?.extensions?.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function graphQLErrorMessage(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) return error.errors[0]?.message ?? error.message;
  return error instanceof Error ? error.message : String(error);
}
```

Append to `packages/graphql/src/client/index.ts`:

```ts
export * from "./errors";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dcr cms pnpm --filter cms test` — Expected: PASS.

- [ ] **Step 5: Header, slide list and template gallery**

Create `apps/cms/components/presentations/presentation-header.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isValidSlug } from "@repo/slides";
import type { Presentation, PresentationVisibility } from "@repo/types";
import { publicPresentationUrl } from "../../lib/landing-url";
import { inputClass } from "./field-input";

export type SaveStatus = "saved" | "saving" | "error" | "invalid";
const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Salvo",
  saving: "Salvando…",
  error: "Erro ao salvar",
  invalid: "Corrija os campos destacados",
};

export function PresentationHeader({ presentation, status, onSave, metaError }: {
  presentation: Presentation;
  status: SaveStatus;
  metaError: string;
  onSave: (input: { title?: string; slug?: string; visibility?: PresentationVisibility }) => void;
}) {
  const [title, setTitle] = useState(presentation.title);
  const [slug, setSlug] = useState(presentation.slug);
  const [copied, setCopied] = useState(false);

  useEffect(() => setTitle(presentation.title), [presentation.title]);
  useEffect(() => setSlug(presentation.slug), [presentation.slug]);

  const slugInvalid = !isValidSlug(slug);
  const link = "text-sm py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/presentations" className="text-on-surface-variant hover:text-on-surface">← Apresentações</Link>
        <span className="text-outline-variant">/</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== presentation.title && onSave({ title: title.trim() })}
          className="flex-1 bg-transparent font-headline text-2xl font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        />
        <span className={`text-xs ${status === "saved" ? "text-on-surface-variant" : status === "saving" ? "text-secondary" : "text-error"}`}>
          {STATUS_TEXT[status]}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <label className="block text-xs text-on-surface-variant mb-1 font-label">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => !slugInvalid && slug !== presentation.slug && onSave({ slug })}
            className={`${inputClass} font-code`}
          />
        </div>
        <div className="w-44">
          <label className="block text-xs text-on-surface-variant mb-1 font-label">Visibilidade</label>
          <select
            value={presentation.visibility}
            onChange={(e) => onSave({ visibility: e.target.value as PresentationVisibility })}
            className={inputClass}
          >
            <option value="PUBLIC">Público</option>
            <option value="PRIVATE">Privado</option>
            <option value="MEMBERS" disabled>Membros (em breve)</option>
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <a href={`/apresentar/${presentation.id}`} target="_blank" rel="noreferrer" className="text-sm py-2 px-3 rounded-lg bg-primary text-on-primary font-bold">Apresentar</a>
          <a href={`/apresentar/${presentation.id}/print`} target="_blank" rel="noreferrer" className={link}>PDF</a>
          {presentation.visibility === "PUBLIC" && (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(publicPresentationUrl(presentation.slug));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={link}
            >
              {copied ? "Link copiado!" : "Copiar link público"}
            </button>
          )}
        </div>
      </div>
      {slug !== presentation.slug && (
        <p className="text-xs text-secondary">
          {slugInvalid
            ? "Use letras minúsculas, números e hífens (ex.: minha-live-12)."
            : "Trocar o slug quebra os links já compartilhados."}
        </p>
      )}
      {metaError && <p className="text-xs text-error">{metaError}</p>}
    </div>
  );
}
```

Create `apps/cms/components/presentations/slide-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SlideRenderer } from "@repo/ui";
import { getUploadUrl } from "@repo/graphql";
import type { SlideDraft } from "./editor-drafts";

export function SlideList({ slides, selectedId, onSelect, onMove, onDuplicate, onToggleHidden, onDelete, onAdd }: {
  slides: SlideDraft[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onToggleHidden: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const b = "px-1 text-[11px] text-on-surface-variant hover:text-on-surface";

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          draggable
          onDragStart={() => setDragFrom(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i);
            setDragFrom(null);
          }}
          className={`rounded-lg border-2 p-1 cursor-pointer ${slide.id === selectedId ? "border-primary" : "border-transparent hover:border-outline-variant"} ${slide.hidden ? "opacity-40" : ""}`}
          onClick={() => onSelect(slide.id)}
        >
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-code text-on-surface-variant w-5 text-right">{i + 1}</span>
            <div className="flex-1 pointer-events-none">
              <SlideRenderer template={slide.template} content={slide.content} context={{ resolveUrl: (u) => getUploadUrl(u) }} />
            </div>
          </div>
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <button className={b} title="Subir" onClick={() => onMove(i, i - 1)}>↑</button>
            <button className={b} title="Descer" onClick={() => onMove(i, i + 1)}>↓</button>
            <button className={b} title="Duplicar" onClick={() => onDuplicate(i)}>⧉</button>
            <button className={b} title={slide.hidden ? "Mostrar" : "Ocultar"} onClick={() => onToggleHidden(i)}>{slide.hidden ? "◌" : "●"}</button>
            <button className={`${b} hover:text-error`} title="Excluir" onClick={() => onDelete(i)}>✕</button>
          </div>
        </div>
      ))}
      <button onClick={onAdd} className="rounded-lg border-2 border-dashed border-outline-variant py-3 text-sm text-on-surface-variant hover:border-primary hover:text-primary">
        + Slide
      </button>
    </div>
  );
}
```

Create `apps/cms/components/presentations/template-gallery.tsx`:

```tsx
"use client";

import { SLIDE_TEMPLATE_KEYS, SLIDE_TEMPLATES, type SlideTemplateKey } from "@repo/slides";
import { SlideRenderer } from "@repo/ui";

export function TemplateGallery({ onPick, onClose }: { onPick: (key: SlideTemplateKey) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-surface-container rounded-xl border border-outline-variant p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-headline text-lg font-bold text-on-surface mb-4">Escolha o modelo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {SLIDE_TEMPLATE_KEYS.map((key) => (
            <button key={key} onClick={() => onPick(key)} className="text-left rounded-lg border border-outline-variant hover:border-primary p-2 space-y-2">
              <div className="pointer-events-none">
                <SlideRenderer template={key} content={SLIDE_TEMPLATES[key].example} />
              </div>
              <p className="text-sm font-bold text-on-surface">{SLIDE_TEMPLATES[key].label}</p>
              <p className="text-xs text-on-surface-variant">{SLIDE_TEMPLATES[key].description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

(Examples that reference images under `/uploads/` will show a broken image in the gallery thumbnail when that file does not exist locally; that is acceptable.)

- [ ] **Step 6: The editor page**

Create `apps/cms/app/dashboard/presentations/[id]/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  CREATE_SLIDE,
  DELETE_SLIDE,
  GET_PRESENTATION,
  REORDER_SLIDES,
  UPDATE_PRESENTATION,
  UPDATE_SLIDE,
  getUploadUrl,
  graphQLErrorCode,
  graphQLErrorMessage,
} from "@repo/graphql";
import type { Presentation, PresentationVisibility } from "@repo/types";
import {
  SLIDE_TEMPLATE_KEYS,
  SLIDE_TEMPLATES,
  isSlideTemplateKey,
  parseSlideContent,
  switchTemplate,
  type SlideTemplateKey,
} from "@repo/slides";
import { SlideRenderer } from "@repo/ui";
import { PresentationHeader, type SaveStatus } from "../../../../components/presentations/presentation-header";
import { SlideList } from "../../../../components/presentations/slide-list";
import { TemplateGallery } from "../../../../components/presentations/template-gallery";
import { SlideForm } from "../../../../components/presentations/slide-form";
import { inputClass } from "../../../../components/presentations/field-input";
import { issuesByPath } from "../../../../components/presentations/form-state";
import { mergeDrafts, moveId, toDraft, type SlideDraft } from "../../../../components/presentations/editor-drafts";

const AUTOSAVE_MS = 800;

export default function PresentationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, refetch } = useQuery<{ presentation: Presentation | null }>(GET_PRESENTATION, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const [updatePresentation] = useMutation(UPDATE_PRESENTATION);
  const [updateSlide] = useMutation(UPDATE_SLIDE);
  const [createSlide] = useMutation<{ createSlide: { id: string } }>(CREATE_SLIDE);
  const [deleteSlide] = useMutation(DELETE_SLIDE);
  const [reorderSlides] = useMutation(REORDER_SLIDES);

  const presentation = data?.presentation ?? null;
  const [drafts, setDrafts] = useState<SlideDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [metaError, setMetaError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [externalChange, setExternalChange] = useState(false);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Set<string>());
  const knownUpdatedAt = useRef<string | null>(null);
  const initialised = useRef(false);

  // First load: take the server state as-is.
  useEffect(() => {
    if (!presentation || initialised.current) return;
    initialised.current = true;
    knownUpdatedAt.current = presentation.updatedAt;
    const initial = [...presentation.slides].sort((a, b) => a.order - b.order).map(toDraft);
    setDrafts(initial);
    setSelectedId(initial[0]?.id ?? null);
  }, [presentation]);

  /** Refetch after one of our own writes and adopt the result as "known". */
  const syncAfterOwnWrite = useCallback(async () => {
    const result = await refetch();
    const fresh = result.data?.presentation;
    if (!fresh) return;
    knownUpdatedAt.current = fresh.updatedAt;
    setDrafts((local) => mergeDrafts(fresh.slides, local, pending.current));
  }, [refetch]);

  // Writes from outside this tab (the API, another tab) show a banner instead
  // of replacing what is on screen.
  useEffect(() => {
    const onFocus = async () => {
      const result = await refetch();
      const fresh = result.data?.presentation;
      if (fresh && knownUpdatedAt.current && fresh.updatedAt !== knownUpdatedAt.current) setExternalChange(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  const reloadFromServer = () => {
    if (!presentation) return;
    knownUpdatedAt.current = presentation.updatedAt;
    pending.current.clear();
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setDrafts([...presentation.slides].sort((a, b) => a.order - b.order).map(toDraft));
    setExternalChange(false);
  };

  const scheduleSave = (draft: SlideDraft) => {
    const existing = timers.current.get(draft.id);
    if (existing) clearTimeout(existing);
    const parsed = parseSlideContent(draft.template, draft.content);
    if (!parsed.ok) {
      pending.current.add(draft.id);
      setStatus("invalid");
      return;
    }
    pending.current.add(draft.id);
    setStatus("saving");
    timers.current.set(
      draft.id,
      setTimeout(async () => {
        timers.current.delete(draft.id);
        try {
          await updateSlide({
            variables: { id: draft.id, input: { template: draft.template, content: draft.content, notes: draft.notes } },
          });
          pending.current.delete(draft.id);
          await syncAfterOwnWrite();
          setStatus(pending.current.size === 0 ? "saved" : "saving");
        } catch (err) {
          console.error("Failed to save slide", err);
          setStatus("error");
        }
      }, AUTOSAVE_MS),
    );
  };

  const editDraft = (id: string, change: Partial<SlideDraft>) => {
    setDrafts((current) =>
      current.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...change };
        scheduleSave(next);
        return next;
      }),
    );
  };

  const runStructural = async (action: () => Promise<unknown>) => {
    setStatus("saving");
    try {
      await action();
      await syncAfterOwnWrite();
      setStatus(pending.current.size === 0 ? "saved" : "saving");
    } catch (err) {
      console.error(err);
      setStatus("error");
      alert(graphQLErrorMessage(err));
    }
  };

  const handleMove = (from: number, to: number) => {
    const ids = moveId(drafts.map((d) => d.id), from, to);
    if (ids === drafts.map((d) => d.id) || to < 0 || to >= drafts.length) return;
    setDrafts((current) => ids.map((slideId) => current.find((d) => d.id === slideId)!));
    void runStructural(() => reorderSlides({ variables: { presentationId: id, ids } }));
  };

  const handleAdd = async (template: SlideTemplateKey) => {
    setGalleryOpen(false);
    const selectedIndex = drafts.findIndex((d) => d.id === selectedId);
    await runStructural(async () => {
      const { data: created } = await createSlide({
        variables: {
          presentationId: id,
          input: { template, content: SLIDE_TEMPLATES[template].defaults },
          position: selectedIndex + 1,
        },
      });
      if (created?.createSlide) setSelectedId(created.createSlide.id);
    });
  };

  const handleDuplicate = (index: number) => {
    const source = drafts[index];
    void runStructural(async () => {
      const { data: created } = await createSlide({
        variables: {
          presentationId: id,
          input: { template: source.template, content: source.content, notes: source.notes, hidden: source.hidden },
          position: index + 1,
        },
      });
      if (created?.createSlide) setSelectedId(created.createSlide.id);
    });
  };

  const handleToggleHidden = (index: number) => {
    const slide = drafts[index];
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, hidden: !d.hidden } : d)));
    void runStructural(() => updateSlide({ variables: { id: slide.id, input: { hidden: !slide.hidden } } }));
  };

  const handleDelete = (index: number) => {
    const slide = drafts[index];
    if (!confirm(`Excluir o slide ${index + 1}?`)) return;
    pending.current.delete(slide.id);
    const fallback = drafts[index + 1] ?? drafts[index - 1];
    setSelectedId(fallback?.id ?? null);
    void runStructural(() => deleteSlide({ variables: { id: slide.id } }));
  };

  const handleMeta = async (input: { title?: string; slug?: string; visibility?: PresentationVisibility }) => {
    setMetaError("");
    try {
      await updatePresentation({ variables: { id, input } });
      await syncAfterOwnWrite();
    } catch (err) {
      const code = graphQLErrorCode(err);
      setMetaError(
        code === "SLUG_TAKEN" ? "Este slug já está em uso."
        : code === "INVALID_SLUG" ? "Slug inválido."
        : graphQLErrorMessage(err),
      );
    }
  };

  const selected = drafts.find((d) => d.id === selectedId) ?? null;
  const selectedIndex = drafts.findIndex((d) => d.id === selectedId);
  const issues = useMemo(() => {
    if (!selected) return {};
    const parsed = parseSlideContent(selected.template, selected.content);
    return parsed.ok ? {} : issuesByPath(parsed.issues);
  }, [selected]);

  if (loading && !presentation) {
    return <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />;
  }
  if (!presentation) {
    return <p className="text-on-surface-variant">Apresentação não encontrada.</p>;
  }

  return (
    <div className="space-y-4">
      {externalChange && (
        <div className="flex items-center justify-between rounded-lg border border-secondary bg-secondary/10 px-4 py-2 text-sm text-secondary">
          Esta apresentação foi alterada pela API — recarregar
          <button onClick={reloadFromServer} className="font-bold underline">Recarregar</button>
        </div>
      )}

      <PresentationHeader presentation={presentation} status={status} metaError={metaError} onSave={handleMeta} />

      <div className="grid grid-cols-[200px_1fr_380px] gap-6 h-[calc(100vh-15rem)]">
        <SlideList
          slides={drafts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={handleMove}
          onDuplicate={handleDuplicate}
          onToggleHidden={handleToggleHidden}
          onDelete={handleDelete}
          onAdd={() => setGalleryOpen(true)}
        />

        <div className="min-w-0">
          {selected ? (
            <SlideRenderer
              template={selected.template}
              content={selected.content}
              slideNumber={selectedIndex + 1}
              context={{ resolveUrl: (u) => getUploadUrl(u) }}
            />
          ) : (
            <p className="text-on-surface-variant text-sm">Nenhum slide selecionado.</p>
          )}
        </div>

        <div className="overflow-y-auto space-y-6 pr-1">
          {selected && isSlideTemplateKey(selected.template) && (
            <>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-label">Modelo</label>
                <select
                  className={inputClass}
                  value={selected.template}
                  onChange={(e) => {
                    const to = e.target.value as SlideTemplateKey;
                    editDraft(selected.id, { template: to, content: switchTemplate(selected.content, to) });
                  }}
                >
                  {SLIDE_TEMPLATE_KEYS.map((key) => (
                    <option key={key} value={key}>{SLIDE_TEMPLATES[key].label}</option>
                  ))}
                </select>
              </div>
              <SlideForm
                template={selected.template}
                value={selected.content}
                issues={issues}
                onChange={(content) => editDraft(selected.id, { content })}
              />
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-label">Anotações do apresentador</label>
                <textarea
                  rows={6}
                  className={inputClass}
                  value={selected.notes}
                  onChange={(e) => editDraft(selected.id, { notes: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {galleryOpen && <TemplateGallery onPick={(key) => void handleAdd(key)} onClose={() => setGalleryOpen(false)} />}
    </div>
  );
}
```

Note: in `handleMove` the identity check `ids === drafts.map(...)` is always false; the real guard is `moveId` returning the same array for out-of-range moves — replace that line with:

```tsx
    if (to < 0 || to >= drafts.length || from === to) return;
    const ids = moveId(drafts.map((d) => d.id), from, to);
```

(placing the guard **before** computing `ids`). Write the function in that corrected form directly.

- [ ] **Step 7: Verify in the browser**

With the dev stack up, open `http://localhost:4051/dashboard/presentations`, create "Editor" and land on the editor. Check, in order:
1. Typing in the cover title updates the preview on every keystroke; the status goes "Salvando…" → "Salvo" ~1 s after you stop.
2. Clearing the cover title shows the field error under it and the status "Corrija os campos destacados"; reload the page — the old title is still there (nothing invalid was sent).
3. "+ Slide" → Código inserts a code slide after the selected one; drag it to position 1 and back; ↑/↓ work; Ocultar dims it; Excluir removes it after confirmation.
4. Switch a Tópicos slide to Código: the title is kept, the code fields come from defaults.
5. Upload a PNG in a Texto + imagem slide: the preview shows it.
6. In a terminal create an API key (Task 14) and run `updatePresentation` with a new title via curl; focus the editor tab → the banner appears; "Recarregar" adopts the new title.
7. Slug: type `Minha Live` → hint about the format; type an existing slug → "Este slug já está em uso."

Run `dcr cms pnpm --filter cms exec tsc --noEmit` — no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/graphql/src/client apps/cms/components/presentations apps/cms/app/dashboard/presentations
git commit -m "$(cat <<'EOF'
feat(cms): edit presentations with a live slide preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: CMS — `/apresentar` player, presenter view and print

**Files:**
- Create: `apps/cms/app/apresentar/layout.tsx`
- Create: `apps/cms/components/presentations/use-deck.ts`
- Create: `apps/cms/app/apresentar/[id]/page.tsx`
- Create: `apps/cms/app/apresentar/[id]/apresentador/page.tsx`
- Create: `apps/cms/app/apresentar/[id]/print/page.tsx`

**Interfaces:**
- Consumes: `ME`, `GET_PRESENTATION`, `GET_SOCIAL_LINKS`, `getUploadUrl` (`@repo/graphql`); `PresentationPlayer`, `PresenterView`, `PrintDeck`, `PlayerSlide`, `SlideContext` (`@repo/ui`).
- Produces: `useDeck(id: string): { presentation: Presentation | null; slides: PlayerSlide[]; context: SlideContext; loading: boolean }` (CMS-local). Routes `/apresentar/[id]`, `/apresentar/[id]/apresentador`, `/apresentar/[id]/print` used by Tasks 15 and 17.

- [ ] **Step 1: Layout with the login check and no sidebar**

Create `apps/cms/app/apresentar/layout.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@repo/graphql/react";
import { ME } from "@repo/graphql";
import type { User } from "@repo/types";

// Same login check as the dashboard layout, without the sidebar: these pages
// are the slides themselves.
export default function PresentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { error, loading } = useQuery<{ me: User }>(ME);

  useEffect(() => {
    if (error) router.replace("/login");
  }, [error, router]);

  if (loading || error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-container-lowest">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Shared deck loader**

Create `apps/cms/components/presentations/use-deck.ts`:

```ts
"use client";

import { useMemo } from "react";
import { useQuery } from "@repo/graphql/react";
import { GET_PRESENTATION, GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import type { PlayerSlide, SlideContext } from "@repo/ui";

export function useDeck(id: string) {
  const { data, loading } = useQuery<{ presentation: Presentation | null }>(GET_PRESENTATION, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const { data: social } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);

  const presentation = data?.presentation ?? null;
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

  return { presentation, slides, context, loading };
}
```

- [ ] **Step 3: The three pages**

Create `apps/cms/app/apresentar/[id]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { PresentationPlayer } from "@repo/ui";
import { useDeck } from "../../../components/presentations/use-deck";

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return (
    <PresentationPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      presenterHref={`/apresentar/${presentation.id}/apresentador`}
    />
  );
}
```

Create `apps/cms/app/apresentar/[id]/apresentador/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { PresenterView } from "@repo/ui";
import { useDeck } from "../../../../components/presentations/use-deck";

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return <PresenterView presentationId={presentation.id} title={presentation.title} slides={slides} context={context} />;
}
```

Create `apps/cms/app/apresentar/[id]/print/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { PrintDeck } from "@repo/ui";
import { useDeck } from "../../../../components/presentations/use-deck";

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  // Wait for the social links too: printing must not start before every slide
  // has its final content.
  if (loading || !presentation) return null;
  return <PrintDeck slides={slides} context={context} />;
}
```

- [ ] **Step 4: Verify in the browser**

1. `http://localhost:4051/apresentar/<id>` while logged in: the deck fills the window; ←/→/space/Home/End navigate; the URL hash follows (`#3`); reloading keeps slide 3; `F` toggles fullscreen; clicking the right half advances; a hidden slide is skipped.
2. Press `P`: a popup opens `/apresentar/<id>/apresentador#3` with current, next, notes and the timer; navigating in either window moves the other.
3. `http://localhost:4051/apresentar/<id>/print`: the print dialog opens after the slides render; "Salvar como PDF" produces one 16:9 page per visible slide, navy background included, code highlighted.
4. Log out and open `/apresentar/<id>` → redirected to `/login`.

`dcr cms pnpm --filter cms exec tsc --noEmit` — no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/cms/app/apresentar apps/cms/components/presentations/use-deck.ts
git commit -m "$(cat <<'EOF'
feat(cms): present, print and open the presenter view of a deck

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Landing — `/apresentacoes/[slug]` and print

**Files:**
- Create: `packages/graphql/src/client/document-text.ts` (+ export from `packages/graphql/src/client/index.ts`)
- Create: `apps/landing/lib/fetch-presentation.ts`
- Create: `apps/landing/components/public-deck.tsx`
- Create: `apps/landing/app/apresentacoes/[slug]/page.tsx`
- Create: `apps/landing/app/apresentacoes/[slug]/print/page.tsx`
- Modify: `docker-compose.yml` and `docker-compose.dev.yml` (landing `API_INTERNAL_URL`; dev volume `./apps/landing/lib`)

**Interfaces:**
- Consumes: `GET_PRESENTATION_BY_SLUG`, `GET_SOCIAL_LINKS`, `getUploadUrl` (`@repo/graphql`); `Presentation`, `SocialLink` (`@repo/types`); `PresentationPlayer`, `PrintDeck`, `PlayerSlide` (`@repo/ui`).
- Produces: `documentText(doc: DocumentNode): string` in `@repo/graphql` (wraps `graphql`'s `print`, so the landing needs no direct `graphql` dependency); `fetchPresentationBySlug(slug: string): Promise<Presentation | null>` (React-`cache`d per request).

Why a server-side fetch with `API_INTERNAL_URL`: a private deck must answer HTTP 404, which needs `notFound()` on the server; and inside the landing container `NEXT_PUBLIC_API_URL` (`http://localhost:4050` in dev) points at the container itself. Both compose files set `API_INTERNAL_URL=http://backend:4050` (compose service name; not a secret).

How Nest reports the 401: `UnauthorizedException` thrown in a resolver reaches the client as HTTP 200 with `errors[0].extensions.code === "UNAUTHENTICATED"` (Apollo's mapping) and `extensions.originalError.statusCode === 401`. `isUnauthorized` accepts either.

- [ ] **Step 1: `documentText` helper**

Create `packages/graphql/src/client/document-text.ts`:

```ts
import { print, type DocumentNode } from "graphql";

/** Query text of a gql document, for plain `fetch` calls (server components). */
export function documentText(doc: DocumentNode): string {
  return print(doc);
}
```

Append to `packages/graphql/src/client/index.ts`:

```ts
export * from "./document-text";
```

- [ ] **Step 2: Compose changes**

In `docker-compose.yml`, `landing.environment`, add:

```yaml
      # Server-side fetches (public decks) go straight to the backend over the
      # compose network; NEXT_PUBLIC_API_URL is the browser-facing address.
      - API_INTERNAL_URL=http://backend:4050
```

In `docker-compose.dev.yml`, `landing.environment`, add `- API_INTERNAL_URL=http://backend:4050`; in `landing.volumes` add `- ./apps/landing/lib:/app/apps/landing/lib`. Recreate: `docker compose -f docker-compose.dev.yml up -d landing`.

- [ ] **Step 3: Server fetch**

Create `apps/landing/lib/fetch-presentation.ts`:

```ts
import { cache } from "react";
import { GET_PRESENTATION_BY_SLUG, documentText } from "@repo/graphql";
import type { Presentation } from "@repo/types";

type GraphQLErrorLike = {
  message: string;
  extensions?: { code?: string; originalError?: { statusCode?: number } };
};

function isUnauthorized(error: GraphQLErrorLike): boolean {
  return (
    error.extensions?.code === "UNAUTHENTICATED" ||
    error.extensions?.originalError?.statusCode === 401
  );
}

function graphqlEndpoint(): string {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
  const path = process.env.NEXT_PUBLIC_GRAPHQL_PATH ?? "/graphql";
  return `${base}${path}`;
}

/**
 * The public deck, or null when it does not exist or is not public (the API
 * answers 401 for private, members-only and trashed decks). Cached per request
 * so generateMetadata and the page share one fetch.
 */
export const fetchPresentationBySlug = cache(async (slug: string): Promise<Presentation | null> => {
  const res = await fetch(graphqlEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: documentText(GET_PRESENTATION_BY_SLUG), variables: { slug } }),
    cache: "no-store",
  });
  if (!res.ok && res.status !== 401) {
    throw new Error(`Presentation fetch failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { presentationBySlug: Presentation | null } | null;
    errors?: GraphQLErrorLike[];
  };
  if (json.errors?.length) {
    if (json.errors.some(isUnauthorized)) return null;
    throw new Error(json.errors[0].message);
  }
  return json.data?.presentationBySlug ?? null;
});
```

- [ ] **Step 4: Client deck wrapper and the pages**

Create `apps/landing/components/public-deck.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "@repo/graphql/react";
import { GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import { PresentationPlayer, PrintDeck, type PlayerSlide, type SlideContext } from "@repo/ui";

function usePublicDeck(presentation: Presentation) {
  const { data, loading } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);
  const slides = useMemo<PlayerSlide[]>(
    () =>
      [...presentation.slides]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, template: s.template, content: s.content, notes: null, hidden: s.hidden })),
    [presentation],
  );
  const context = useMemo<SlideContext>(
    () => ({
      socialLinks: [...(data?.socialLinks ?? [])].sort((a, b) => a.order - b.order),
      resolveUrl: (url) => getUploadUrl(url),
    }),
    [data],
  );
  return { slides, context, loading };
}

/** Public player: no presenter view, notes never present (the API strips them). */
export function PublicDeck({ presentation }: { presentation: Presentation }) {
  const { slides, context } = usePublicDeck(presentation);
  return <PresentationPlayer presentationId={presentation.id} slides={slides} context={context} />;
}

export function PublicPrint({ presentation }: { presentation: Presentation }) {
  const { slides, context, loading } = usePublicDeck(presentation);
  if (loading) return null;
  return <PrintDeck slides={slides} context={context} />;
}
```

Create `apps/landing/app/apresentacoes/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPresentationBySlug } from "../../../lib/fetch-presentation";
import { PublicDeck } from "../../../components/public-deck";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) return { title: "Apresentação não encontrada | Engenharia Inversa" };
  return {
    title: `${presentation.title} | Engenharia Inversa`,
    description: presentation.description ?? undefined,
  };
}

export default async function PresentationPage({ params }: Props) {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) notFound();
  return <PublicDeck presentation={presentation} />;
}
```

Create `apps/landing/app/apresentacoes/[slug]/print/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { fetchPresentationBySlug } from "../../../../lib/fetch-presentation";
import { PublicPrint } from "../../../../components/public-deck";

export const dynamic = "force-dynamic";

export default async function PresentationPrintPage({ params }: { params: { slug: string } }) {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) notFound();
  return <PublicPrint presentation={presentation} />;
}
```

- [ ] **Step 5: Verify**

Create two decks in the CMS: `publica` (Público) and `privada` (Privado). Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4052/apresentacoes/publica
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4052/apresentacoes/privada
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4052/apresentacoes/nao-existe
```

Expected: `200`, `404`, `404`. In the browser `http://localhost:4052/apresentacoes/publica` plays the deck (keys, hash, fullscreen; `P` does nothing); the page source has no speaker notes; `/apresentacoes/publica/print` opens the print dialog. Move `publica` to the trash → `404`. Run `dcr landing pnpm --filter landing exec tsc --noEmit` — no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/graphql/src/client apps/landing/lib apps/landing/components/public-deck.tsx apps/landing/app/apresentacoes docker-compose.yml docker-compose.dev.yml
git commit -m "$(cat <<'EOF'
feat(landing): serve public presentations at /apresentacoes/[slug]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: CI test job and final verification

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the root `test` pipeline from Task 1 (`turbo.json` task `test`); backend test harness from Task 3 (reads `DATABASE_URL`, creates and migrates its own `ei_test` database from it).
- Produces: a `test` job; `deploy` runs only after it passes.

Notes: the self-hosted runner is Linux with Docker, so `services:` containers work. Production Postgres may run on the same host, so the CI database publishes on **55432**, not 5432.

- [ ] **Step 1: Add the job**

In `.github/workflows/deploy.yml`, insert under `jobs:` before `deploy:`:

```yaml
  test:
    runs-on: self-hosted
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: ei_ci
        ports:
          # Not 5432: production Postgres may share this host.
          - 55432:5432
        options: >-
          --health-cmd "pg_isready -U ci -d ei_ci"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Set up pnpm 9.0.0
        run: corepack enable && corepack prepare pnpm@9.0.0 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build compiled packages
        run: pnpm turbo run build --filter=@repo/database --filter=@repo/slides

      - name: Run tests
        env:
          DATABASE_URL: postgresql://ci:ci@localhost:55432/ei_ci
          JWT_SECRET: ci-only-secret
        run: pnpm turbo run test
```

and add `needs: test` to the existing `deploy` job:

```yaml
  deploy:
    needs: test
    runs-on: self-hosted
```

- [ ] **Step 2: Validate the workflow locally**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color .github/workflows/deploy.yml`
Expected: no output (exit 0).

Run the same test command the job runs, against the dev database container, to prove the pipeline works end to end: `dcx backend sh -c "pnpm turbo run test"`.
Expected: every package's `test` passes (`@repo/slides`, `@repo/ui`, `cms`, `backend`).

- [ ] **Step 3: Final manual checklist (spec §10)**

With `docker compose -f docker-compose.dev.yml up --build`, logged in at `http://localhost:4051`:

- [ ] Library: tabs Todas / Públicas / Privadas / Lixeira filter correctly; trash → restore → purge (typing the title).
- [ ] Editor: autosave status cycle; field error blocks saving; drag reorder persists after reload; template switch keeps the title; external-change banner after a `curl` with an API key.
- [ ] API with a key: `curl -s http://localhost:4050/graphql -H "Authorization: Bearer ei_…" -H 'content-type: application/json' -d '{"query":"{ slideTemplates { key } }"}'` lists 11 keys; a `createPresentation` with one slide per template appears in the library and renders without "Slide inválido".
- [ ] Player `http://localhost:4051/apresentar/<id>`: keys, hash, fullscreen, hidden slide skipped.
- [ ] Presenter view (`P`) stays in sync both ways; timer starts, pauses and resets.
- [ ] `/apresentar/<id>/print` → PDF with one 16:9 page per visible slide, navy background.
- [ ] Public `http://localhost:4052/apresentacoes/<slug>`: 200 when Público, 404 when Privado or in the trash; no notes in the HTML (`curl -s http://localhost:4052/apresentacoes/<slug> | grep -c "<notes text>"` → `0`).
- [ ] Revoke the key in Configurações → Chaves de API; the same `curl` now returns `"Chave revogada"`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
ci: run the test suite before deploying

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
