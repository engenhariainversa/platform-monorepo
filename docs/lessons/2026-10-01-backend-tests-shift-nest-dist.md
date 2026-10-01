# Testes em `src/` que importam `../test` mudam o layout do `dist` do Nest

## Sintoma

Sem erro de build: `nest build` termina, mas gera `dist/src/main.js` e `dist/test/...` em
vez de `dist/main.js`, e o container de produção (`node apps/backend/dist/main.js`)
quebraria ao subir com `Cannot find module '/app/apps/backend/dist/main.js'`.

## Causa

O `tsconfig.json` do backend inclui `src/**/*`, o que agora pega `src/**/*.test.ts`. Esses
testes importam `../test/helpers`, que fica fora de `src/`. Sem `rootDir` explícito, o
`tsc` usa a raiz comum de todos os arquivos (`apps/backend`), e o `dist` ganha um nível
`src/`.

## Correção

`apps/backend/tsconfig.build.json` (que `nest build` e `nest start` usam por padrão quando
existe) exclui os testes:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.test.ts"]
}
```

## Evidência

`pnpm --filter backend exec tsc -p tsconfig.build.json --outDir /tmp/nb && ls /tmp/nb`
lista `main.js` na raiz; a imagem `--target backend` contém `apps/backend/dist/main.js`.
