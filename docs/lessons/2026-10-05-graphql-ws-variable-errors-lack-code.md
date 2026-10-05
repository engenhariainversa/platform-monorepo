# graphql-ws: variável inválida chega sem `extensions.code` pelo socket

## Sintoma
No teste de integração das reações, `errorCode(await wsRequest(anon, REACT, { slug, kind: "PARTY" }))`
falha com `AssertionError: expected undefined to be defined`. Pela HTTP a mesma operação traz
`extensions.code: "BAD_USER_INPUT"`.

## Causa
Quem põe `BAD_USER_INPUT` em erro de coerção de variável (`Variable "$kind" got invalid value "PARTY"…`)
é o pipeline HTTP do Apollo. Pelo `graphql-ws`, o `execute` do `graphql` devolve `{ errors }` (sem
`data`, porque a execução nem começa) direto para o `onNext`, e `formatSocketResult` só mapeava
`HttpException`. Ver também `2026-10-05-graphql-ws-errors-lack-extension-codes.md`.

Na mesma investigação: o cliente `wsClient` (lazy) abre um socket novo a cada operação, então o
rate limit por socket "zera" entre dois `wsRequest`. Para testar limites por socket use `openSocket`.

## Correção
`formatSocketResult` (`apps/backend/src/live/socket-auth.service.ts`) marca com `BAD_USER_INPUT` os
erros sem código de um resultado sem `data` cuja mensagem começa com `Variable "$`.

## Evidência
`docker compose -f docker-compose.dev.yml exec -T backend pnpm --filter backend exec vitest run src/live`
Antes: `Tests  1 failed | 61 passed (62)`. Depois: `Test Files  8 passed (8)` / `Tests  62 passed (62)`.
