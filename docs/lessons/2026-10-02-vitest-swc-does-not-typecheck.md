# Vitest com SWC nao checa tipos: erros de TS passam com testes verdes

## Sintoma
`tsc --noEmit` falha com `error TS2300: Duplicate identifier 'apiKeys'.` (em `api-keys.resolver.ts`) enquanto todos os testes do Vitest passam. `nest build` quebraria na imagem de producao.

## Causa
Vitest transpila com SWC, que apaga tipos sem verificar. Um campo injetado `private readonly apiKeys` colidia com o metodo `apiKeys()` da query, algo que so o compilador TypeScript detecta.

## Correcao
Renomear o campo injetado para `apiKeysService`. Antes de commitar codigo de backend, rodar tambem `pnpm --filter backend exec tsc --noEmit -p tsconfig.json` (nao so os testes).

## Evidencia
Antes: duas linhas TS2300 em `src/api-keys/api-keys.resolver.ts`. Depois: `tsc --noEmit` sai com 0 e o teste do resolver passa (4/4).
