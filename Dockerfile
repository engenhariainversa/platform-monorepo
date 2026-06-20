# ============================================================
# Base — shared Node 20 + pnpm layer for all services
# ============================================================
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# ============================================================
# Dependencies — install ALL workspace deps (pruned later)
# ============================================================
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/cms/package.json ./apps/cms/package.json
COPY apps/landing/package.json ./apps/landing/package.json
RUN pnpm install --frozen-lockfile

# ============================================================
# Source — full monorepo source on top of deps
# ============================================================
FROM deps AS source
COPY . .

# ============================================================
# Backend (NestJS — port 4050)
# ============================================================
FROM source AS backend-build
RUN pnpm --filter backend build

FROM base AS backend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=backend-build /app/apps/backend/dist ./apps/backend/dist
COPY apps/backend/package.json ./apps/backend/package.json
COPY package.json pnpm-workspace.yaml ./
ENV PORT=4050
EXPOSE 4050
CMD ["node", "apps/backend/dist/main.js"]

# ============================================================
# CMS (Next.js — port 4051)
# ============================================================
FROM source AS cms-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @repo/ui build 2>/dev/null || true
RUN pnpm --filter cms build

FROM base AS cms
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4051
COPY --from=cms-build /app/apps/cms/.next ./apps/cms/.next
COPY --from=cms-build /app/apps/cms/public ./apps/cms/public
COPY --from=cms-build /app/apps/cms/package.json ./apps/cms/package.json
COPY --from=cms-build /app/apps/cms/next.config.* ./apps/cms/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/cms/node_modules ./apps/cms/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./
EXPOSE 4051
WORKDIR /app/apps/cms
CMD ["npx", "next", "start", "--port", "4051"]

# ============================================================
# Landing (Next.js — port 4052)
# ============================================================
FROM source AS landing-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @repo/ui build 2>/dev/null || true
RUN pnpm --filter landing build

FROM base AS landing
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4052
COPY --from=landing-build /app/apps/landing/.next ./apps/landing/.next
COPY --from=landing-build /app/apps/landing/public ./apps/landing/public
COPY --from=landing-build /app/apps/landing/package.json ./apps/landing/package.json
COPY --from=landing-build /app/apps/landing/next.config.* ./apps/landing/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/landing/node_modules ./apps/landing/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./
EXPOSE 4052
WORKDIR /app/apps/landing
CMD ["npx", "next", "start", "--port", "4052"]
