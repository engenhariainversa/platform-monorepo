# graphql-ws: erros de guard chegam sem `extensions.code` pelo socket

## Sintoma
No teste de integração do websocket, `errorCode(await wsRequest(client(), "{ me { id } }"))` devolve
`undefined` em vez de `"UNAUTHENTICATED"` (`AssertionError: expected undefined to be 'UNAUTHENTICATED'`),
embora a mesma operação por HTTP traga o código.

## Causa
O `@nestjs/apollo` converte `HttpException` (ex.: `UnauthorizedException` dos guards) em
`extensions.code` dentro do `formatError` do Apollo Server (`autoTransformHttpErrors`). Esse
`formatError` só roda no pipeline HTTP do Apollo. Pelo `graphql-ws`, o Nest chama `useServer` com o
`execute` do `graphql` direto, e o resultado sai sem passar pelo Apollo.

## Correção
`formatSocketResult` em `apps/backend/src/live/socket-auth.service.ts` aplica o mesmo mapeamento
(400 BAD_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 422 BAD_USER_INPUT, demais
INTERNAL_SERVER_ERROR + `status`), ligado em `subscriptions["graphql-ws"].onNext` no `app.module.ts`.

Relacionado, no mesmo teste: um cliente `graphql-ws` com `lazy: true` fecha o socket ao fim de cada
operação e reconecta na seguinte, então a revalidação acontece no `onConnect` (fecha com 4403) e não
nos guards. Para testar "a credencial é validada de novo a cada operação" no mesmo socket, use
`openSocket` (eager) de `apps/backend/test/ws.ts`.

## Evidência
`docker compose -f docker-compose.dev.yml exec -T backend pnpm --filter backend exec vitest run src/live`
Antes: `Tests  2 failed | 13 passed (15)`. Depois: `Test Files  3 passed (3)` / `Tests  15 passed (15)`.
