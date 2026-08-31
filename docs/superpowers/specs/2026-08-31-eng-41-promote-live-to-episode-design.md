# ENG-41 — Promote a live into a recent episode

Ticket: https://linear.app/engenharia-inversa/issue/ENG-41
Parent: ENG-8 · Status at writing: Backlog

## Problem

Turning a finished live into a "Recent episode" means retyping content that
already exists: the title, the thumbnail that is already uploaded to the server,
and the destination link. The CMS has no shortcut for it.

## Decisions

The list stays **fixed at 4**. The cap is enforced in the CMS — `handleCreate`
guards with `if (episodes.length >= 4) return;` and the Adicionar button uses the
same condition to disable itself — and again in `ContentService.createEpisode`,
which throws `"Máximo de 4 episódios permitidos"`. Nothing in the database
records a list size, so making it configurable would need a new column and a
settings screen. Out of scope; revisit as its own ticket.

Promotion **recycles a row instead of creating and deleting one**. With the list
full, the oldest episode row is overwritten in place and moved to the top. The
row count never changes, nothing is destroyed, and the question of what to do
with the evicted episode disappears. This replaced an earlier design that
created a new episode and deleted the last one.

The live's `description` is **not** copied. `Episode` has no description column,
and the landing card renders only image, duration, module and title — the text
would have nowhere to land. Adding the column would mean shipping a field
nothing displays.

## Design

### Backend

One mutation, `promoteLiveToEpisode(liveId: String!): EpisodeType!`, guarded
with `@Resource("episodes", "create")`, running in a single
`prisma.$transaction` so a partial promotion cannot leave the list reordered
without the new content in place.

Behaviour depends on how full the list is:

- **Fewer than 4 episodes** — there is room, so a new row is created at
  `order 0` and the existing rows shift down by one.
- **Exactly 4 episodes** — the row with the highest `order` is recycled: its
  fields are overwritten, it moves to `order 0`, and the other three shift down.

Field mapping, in both branches:

| Episode field | Source | Note |
|---|---|---|
| `title` | `Live.title` | |
| `imageUrl` | `Live.thumbnailUrl` | already hosted; no re-upload |
| `videoUrl` | `Live.buttonUrl` | the live's link becomes the card's destination |
| `module` | — | cleared to `""`; no equivalent on `Live` |
| `duration` | — | cleared to `""`; no equivalent on `Live` |
| `order` | — | `0` |

`Live.label` is deliberately not mapped onto `module`: it holds copy like
`"PRÓXIMA ETAPA DO PIPELINE"`, not a module reference like `"MOD-02 • EP 02"`,
so it would be wrong more often than right.

Errors: an unknown `liveId` fails the mutation. A live with no `thumbnailUrl`
still promotes — `imageUrl` is nullable and the landing already falls back to
bundled placeholder artwork.

### CMS

Each row in Conteúdo › Lives gets a "Transformar em episódio recente" action.
It asks for confirmation first, naming the episode that will be recycled, so
overwriting a row is never a surprise — the same courtesy the existing "Remover
episódio" button extends.

On success the CMS navigates to `/dashboard/content/episodes?edit=<id>` with
that episode's form already open, because `module` and `duration` are blank and
have to be filled in. The deep link follows the `?new=1` pattern the dashboard
quick action already uses, including its Suspense boundary — `useSearchParams`
needs one to keep the route prerenderable.

### Landing

The duration badge is omitted when `duration` is blank. Without this, a freshly
promoted episode shows an empty black rectangle over its thumbnail until someone
fills the field in.

## Out of scope

- A configurable list size (needs a column and a settings screen).
- A description on `Episode` (nothing renders it).
- Analytics parameters on the promoted episode — ENG-40 and ENG-45 own that.

## Verification

- Promote with 0–3 episodes present: a row is added, count grows, existing rows
  shift down, nothing is overwritten.
- Promote with 4 present: count stays 4, the previously-last row now holds the
  live's title, image and link at `order 0`, and no row is deleted — confirmed
  by comparing episode ids before and after.
- `module` and `duration` come back blank and the CMS opens that episode's form.
- The landing renders the promoted card with no duration badge, and the card
  links to the live's URL.
- `turbo run build lint` passes.
