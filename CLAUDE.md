# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Git and GitHub

- **Write commit messages and pull request titles/bodies in English**, always — even
  when the conversation is in Portuguese.

## Repository layout

pnpm workspaces + Turborepo. Apps live in `apps/`, shared code in `packages/`.

| Path | What | Port |
|---|---|---|
| `apps/backend` | NestJS, GraphQL code-first, Prisma | 4050 |
| `apps/cms` | Next.js admin panel | 4051 |
| `apps/landing` | Next.js public site | 4052 |
| `packages/database` | `@repo/database`: Prisma schema, migrations, client (compiled to `dist/`) | |
| `packages/graphql` | `@repo/graphql`: Apollo client, queries, types (consumed as source) | |
| `packages/types` | `@repo/types` (source) | |
| `packages/ui` | `@repo/ui`: Tailwind components (source) | |
| `packages/tsconfig` | `base.json`, `nextjs.json`, `nestjs.json` | |
| `packages/eslint-config` | `base.js` | |

## Workspace conventions

- **Naming**: packages are `@repo/<name>`, apps have plain names (`backend`, `cms`,
  `landing`). Internal dependencies are always `"@repo/x": "workspace:*"` so pnpm links
  the folder and Turborepo orders builds correctly.
- **Run scripts per package with `pnpm --filter <name> <script>`** from the repo root.
  Do not `cd apps/x && pnpm ...` in scripts, Dockerfiles or CI.
- **tsconfig**: apps extend `@repo/tsconfig/nextjs.json` or `nestjs.json`; packages
  extend `base.json`. An app's own `tsconfig.json` only declares `paths` and `include`.
- **Source packages** (`ui`, `graphql`, `types`) export `./src/index.ts` and are listed
  in each Next app's `transpilePackages`. No build step; hot reload crosses packages.
- **`@repo/database` is compiled** (`build` = `prisma generate && tsc`, `main` points to
  `dist/`). NestJS consumes plain CommonJS and the Prisma client must be generated before
  anything imports it, hence `build.dependsOn: ["^build"]` in `turbo.json`.
- **Ports are fixed per app** (4050/4051/4052) in `package.json`, `PORT` and both compose
  files. A new app takes the next port in the range.

## Database (Prisma)

- **Never `prisma db push`.** The `db:push` script is disabled on purpose: it bypasses
  migration history and desyncs production. Every schema change becomes a migration:

  ```bash
  docker compose -f docker-compose.dev.yml exec backend \
    pnpm --filter @repo/database db:migrate:dev --name <descriptive_name>
  ```

- Production runs `db:migrate:deploy` and `db:seed` when the backend container starts.
  The deploy workflow then runs `db:migrate:check` and fails on schema drift.
- Prisma commands run from `packages/database`, which does not read the root `.env`.
  Run them inside the dev container (above) or export `DATABASE_URL` first.

## Local development

- **Check the Docker daemon before any `docker` or `docker compose` command** —
  `docker info > /dev/null 2>&1`. If it is down, say so and stop; do not improvise a
  host-only setup around it.
- **Bring the dev environment up with the dev compose file**, as documented under
  "Rodando com Docker (Dev com Hot-Reload)" in the README:

  ```bash
  docker compose -f docker-compose.dev.yml up --build
  docker compose -f docker-compose.dev.yml up db backend      # API only
  ```

  It carries the Postgres credentials, the `NEXT_PUBLIC_*` variables and the port
  mappings the apps need, mounts the source folders as volumes for hot reload, and its
  backend service runs `db:migrate:deploy` and `db:seed` on start.
- Plain `docker compose up` is the **production** stack — it does not expose Postgres to
  the host and refuses to start without `POSTGRES_*`, `JWT_SECRET` and `NEXT_PUBLIC_*`
  in `.env`. Do not reach for it to run things locally.
- Running the apps on the host with `pnpm dev` is the harder path: it needs
  `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GRAPHQL_PATH` exported and the Prisma caveat
  above. The dev compose file avoids all of it.
- Adding a dependency: run `pnpm --filter <name> add <pkg>` inside the dev container so
  `pnpm-lock.yaml` is updated with the same pnpm version the images use.

## Docker

- **One `Dockerfile`, one target per app** (`backend`, `cms`, `landing`). Stages `base`,
  `deps`, `source` and `database-build` are shared; the compose file picks the target.
- The `deps` stage copies only `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the root
  `package.json`, `packages/` and each app's `package.json`. **Every new app needs its
  `COPY apps/<app>/package.json` line there** (and in `Dockerfile.dev`), otherwise
  `pnpm install --frozen-lockfile` fails.
- `NEXT_PUBLIC_*` values are baked into the Next bundle at build time. They enter as
  `ARG`s in the build stages and as `build.args` in `docker-compose.yml`. Changing them
  in production requires a rebuild, not a restart.
- `openssl` is installed in the alpine base because the Prisma engine needs it.
- Dev images (`Dockerfile.dev`) mount **only source folders** (`apps/<app>/app`,
  `components`, `packages/*/src`) as volumes. Never mount the repo root over `/app`: it
  would hide the `node_modules` and `dist` built into the image.
- Uploads live in the named volume `uploads`; `UPLOADS_DIR` must match the mount path or
  files land in the container's writable layer and vanish on redeploy.

## Adding an app or package

Package: `package.json` named `@repo/<name>` with `workspace:*` deps, `tsconfig.json`
extending the shared one, add to consumers' `transpilePackages` if it is a source
package, `pnpm install` in the dev container, add its `src` to the dev volumes if it
should hot reload.

App: pick the next port, `package.json` + `tsconfig.json` + `next.config.js` with
`transpilePackages`, `COPY` line in `Dockerfile` (`deps` stage) and `Dockerfile.dev`,
`<app>-build` and `<app>` stages, a service in **both** compose files, and a
`CORS_ORIGINS` entry on the backend if it calls the API. If it is public, add it to the
proxy network and an nginx conf.

## Deploy

Push to `main` triggers `.github/workflows/deploy.yml` on the self-hosted runner. It
writes `/opt/engenhariainversa/.env` from repository secrets (`chmod 600`), runs
`docker compose --env-file ... up --build -d --remove-orphans`, waits for the backend
health check, runs the migration drift check and prunes images.

Required secrets: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
(host `db`), `JWT_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GRAPHQL_PATH`. Keep the
list in `.env.example` in sync when adding one.
