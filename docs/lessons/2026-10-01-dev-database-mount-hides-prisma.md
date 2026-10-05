# Mount do `packages/database` inteiro esconde o `prisma` no backend de dev

## Sintoma

`docker compose -f docker-compose.dev.yml up db backend` deixa o backend `unhealthy`; o log mostra:

```
> @repo/database@0.0.0 build /app/packages/database
> prisma generate && tsc
sh: prisma: not found
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @repo/database@0.0.0 build: `prisma generate && tsc`
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

## Causa

O serviço `backend` montava `./packages/database:/app/packages/database`. O volume cobre a
pasta inteira do pacote, inclusive o `node_modules` (com o binário `prisma`) e o `dist`
criados na imagem. No host não existe `packages/database/node_modules` (não há toolchain
Node no host), então dentro do container o pacote fica sem dependências.

## Correção

Montar só as pastas de fonte, como o CLAUDE.md pede para os outros pacotes:

```yaml
      - ./packages/database/src:/app/packages/database/src
      - ./packages/database/prisma:/app/packages/database/prisma
```

`prisma/` continua montado para que `db:migrate:dev` grave as migrations novas no host.

## Evidência

Depois da troca, `docker compose -f docker-compose.dev.yml up -d db backend` → backend
`healthy`, log termina em `Nest application successfully started`.
