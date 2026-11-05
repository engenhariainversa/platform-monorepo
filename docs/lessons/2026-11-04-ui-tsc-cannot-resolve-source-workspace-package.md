# tsc em @repo/ui não resolve um pacote workspace só com `exports` de código-fonte

## Sintoma
`pnpm --filter @repo/ui exec tsc --noEmit` falha com
`error TS2307: Cannot find module '@repo/types' or its corresponding type declarations.`
seguido de `There are types at '.../node_modules/@repo/types/src/index.ts', but this result could not be resolved under your current 'moduleResolution' setting.`

## Causa
`@repo/types` expõe apenas `"exports": { ".": "./src/index.ts" }`. O `base.json` usa `moduleResolution: node`, que ignora `exports`. Os pacotes `types` e `graphql` já usam `bundler`; `ui` herdava o `node`.

## Correção
`packages/ui/tsconfig.json`: `"module": "esnext"` e `"moduleResolution": "bundler"`. Como `tsconfig.json` de pacote não é montado nos containers de dev, é preciso `docker compose -f docker-compose.dev.yml build cms landing` e `up -d --no-deps cms landing` para o container enxergar a mudança.

## Evidência
`docker compose -f docker-compose.dev.yml run --rm --no-deps cms sh -c "cd /app && pnpm --filter @repo/ui exec tsc --noEmit"` sai com código 0.
