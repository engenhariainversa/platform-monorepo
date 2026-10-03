# Presentations API (for external agents)

Everything goes through the backend API's GraphQL endpoint (not the CMS): `POST https://<api-host>/graphql`
(dev: `http://localhost:4050/graphql`), JSON body `{ "query": "...", "variables": { ... } }`.

## 1. Get a key

In the CMS: **Configurações → Chaves de API → Gerar chave**. Pick a name ("Live #12 —
Claude") and an expiry (1 h, 24 h or 7 days). Copy the `ei_…` token — it is shown once.
Send it on every request:

```
Authorization: Bearer ei_…
```

A key can create, read, update, publish and trash presentations and upload images. It
cannot permanently delete (`purgePresentation` accepts a user JWT only), manage keys,
users or landing content. Expired or revoked keys get `UNAUTHENTICATED` with the message
`Chave expirada` / `Chave revogada`.

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
- `updateSlide` ignores `notes: null` (it does not clear them). To clear a slide's notes
  send `"notes": ""`.
- Metadata and publishing: `updatePresentation(id, input: { title, slug, description, visibility })`
  with `visibility: PUBLIC | PRIVATE` (`MEMBERS` is accepted but behaves as `PRIVATE`).
- Read back: `presentation(id)` or `presentations(trash: false)`. Authenticated reads
  return `notes` and hidden slides; anonymous reads (`presentationBySlug` of a public
  deck) get `notes: null` and no hidden slides.
- Trash: `deletePresentation(id)`; undo with `restorePresentation(id)`. Editing a
  trashed deck fails with `Apresentação na lixeira`.

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
| `UNAUTHENTICATED` | Missing, expired (`Chave expirada`) or revoked (`Chave revogada`) key; also an API key sent to a JWT-only operation such as `purgePresentation`. |
| `FORBIDDEN` | The key's owner lacks the `presentations` permission. |
