# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Git and GitHub

- **Write commit messages and pull request titles/bodies in English**, always — even
  when the conversation is in Portuguese.

## Local development

- **Check the Docker daemon before any `docker` or `docker compose` command** —
  `docker info > /dev/null 2>&1`. If it is down, say so and stop; do not improvise a
  host-only setup around it.
- **Bring the dev environment up with the dev compose file**, as documented under
  "Rodando com Docker (Dev com Hot-Reload)" in the README:

  ```bash
  docker compose -f docker-compose.dev.yml up --build
  ```

  It carries the Postgres credentials, the `NEXT_PUBLIC_*` variables and the port
  mappings the apps need, mounts the source as volumes for hot-reload, and its backend
  service runs `db:migrate:deploy` and `db:seed` on start. Backend `:4050`,
  CMS `:4051`, landing `:4052`.
- Plain `docker compose up` is the **production** stack — it does not expose Postgres to
  the host and refuses to start without `POSTGRES_*` in `.env`. Do not reach for it to
  run things locally.
- Running the apps on the host with `pnpm dev` is the harder path: it needs
  `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GRAPHQL_PATH` exported, and Prisma commands run
  from `packages/database`, which does not read the root `.env` — so `DATABASE_URL` has
  to be loaded first. The dev compose file avoids all of it.
