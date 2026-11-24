# Share cards (Open Graph) behind Cloudflare

What `/apresentacoes/<slug>` sends to link previews (WhatsApp, X, LinkedIn), and how it
is cached. Code: `apps/landing/lib/presentation-meta.ts`, `apps/landing/lib/og-image.tsx`.

| URL | When | Cache-Control |
|---|---|---|
| `/apresentacoes/<slug>/og.png?v=<updatedAt ms>` | public deck, current `v` only | `public, max-age=0, s-maxage=300` |
| same, any other `v`, or a deck that is not public | | `404`, `no-store` |
| `/og/apresentacao-privada.png` | private, members-only, trashed or missing deck | `public, max-age=86400, s-maxage=86400` |
| `/og/link-de-apresentador.png` | presenter link page (`/apresentacoes/controle`) | same |

- `updatedAt` moves on every edit, slide change, visibility change and trip to the trash,
  so a deck that turns private gets a new image URL and its old one answers 404. The
  Cloudflare copy of the old URL lives at most the 5 minutes of `s-maxage`. No
  `stale-while-revalidate`: it would keep serving the title after the change.
- The deck page of a private, members-only, trashed or missing slug is the same **200**
  with the fixed "Apresentação privada" card and `noindex`: previews of a 404 are
  unreliable, and one response for all four cases says nothing about which it is.
- The presenter token travels in the URL fragment, which never reaches the server or a
  scraper, so that card can never name the deck.
- Caches inside the chat apps (WhatsApp, X) are outside our reach: a link shared while
  the deck was public keeps its card there.

## Cloudflare requirements

The defaults work: `.png` is cached, the cache key includes the query string, and the
origin's `Cache-Control` is respected. Do not add a Cache Rule that ignores the query
string or overrides the edge TTL for `/apresentacoes/*`; it would serve a private deck's
old card for that TTL.
