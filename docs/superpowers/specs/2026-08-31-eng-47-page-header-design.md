# ENG-47 — A shared page header for the CMS

Ticket: https://linear.app/engenharia-inversa/issue/ENG-47
Parent: ENG-8 · Status at writing: Backlog

## Problem

The ticket calls it "o navbar do CMS". There is no navbar. `dashboard/layout.tsx`
renders a sidebar and a `<main>`, and every screen draws its own heading inline —
**12 duplicated heading blocks across the 11 dashboard screens**, with no shared
component. (`/login`, `/setup` and `/` have their own headings too, but they sit
outside the dashboard layout and are not in scope.)

They are inconsistent. Some carry a subtitle, some do not. The content
sub-screens prefix a `← Conteúdo /` breadcrumb. Some put a Salvar button on the
right, some put nothing. Title and subtitle sit at nearly the same visual weight,
which is the complaint the ticket actually records: it is hard to tell which
screen you are on.

## Decisions

Extract a component rather than restyle 14 copies. Restyling in place would mean
making the same edit a dozen times and leaving the next screen free to drift
again. The ticket's own goal — a consistent hierarchy — is a component boundary.

**The subtitle stays optional.** Most screens have none today, and inventing copy
for eight of them is a content decision, not a styling one. The component accepts
a subtitle; only the screens that already have one pass it. The hierarchy work
(weight, size, spacing) and the right-aligned actions apply everywhere regardless.

## Design

A new component, `apps/cms/components/page-header.tsx`:

| Prop | Type | Purpose |
|---|---|---|
| `title` | `string` | the screen's name |
| `subtitle` | `string?` | one line of context, when a screen has one |
| `breadcrumb` | `{ label, href }?` | the `← Conteúdo` link on sub-screens |
| `actions` | `ReactNode?` | right-aligned buttons, e.g. Salvar |

Hierarchy: the title keeps `font-headline text-2xl font-bold text-on-surface`;
the subtitle drops to `text-sm text-on-surface-variant` with deliberate spacing
below the title rather than sitting flush against it. Actions align right on the
same row as the title and wrap below it on narrow widths instead of squeezing it.

The ~11 dashboard screens are converted to use it. No data, query or route
changes — this is presentation only.

## Out of scope

- Writing subtitles for screens that lack one.
- The sidebar and shell scrolling (ENG-46).
- Mobile layout (ENG-48).

## Verification

- Every dashboard screen renders through `PageHeader`; no inline `<h1>` blocks
  remain under `apps/cms/app/dashboard`.
- Screens with a subtitle show a clear weight and spacing difference from the
  title; screens without one render the title alone with no leftover gap.
- Breadcrumbs on the content sub-screens still navigate back.
- Save buttons stay right-aligned and functional on the screens that have them.
- `turbo run build lint` passes.
