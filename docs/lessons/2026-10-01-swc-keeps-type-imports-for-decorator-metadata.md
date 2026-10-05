# SWC (Vitest) mantém imports de tipo usados em parâmetros decorados

## Sintoma

`pnpm --filter backend test` falha ao carregar a suíte:

```
Error: Cannot find package 'express' imported from '/app/apps/backend/src/upload/upload.controller.ts'
 ❯ src/upload/upload.controller.ts:16:1
     16| import { Response } from "express";
```

## Causa

Os testes do backend compilam com SWC (`unplugin-swc`) por causa de
`emitDecoratorMetadata`. Num parâmetro decorado (`@Res() res: Response`), o metadata
referencia `Response` como valor. O `tsc` sabe que `Response` é só tipo e omite o import;
o SWC compila arquivo a arquivo, não sabe, e mantém `import ... from "express"`. O
backend só tem `@types/express`, não `express`, como dependência direta, então o import
não resolve.

## Correção

Importar tipos usados em parâmetros decorados com `import type`:

```ts
import type { Response } from "express";
```

O SWC então descarta o import e o metadata cai em `Object` (ou no global).

## Evidência

`docker compose -f docker-compose.dev.yml exec backend pnpm --filter backend test` →
`Test Files 1 passed (1)`, `Tests 3 passed (3)`.
