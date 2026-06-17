# Design Document: Integrated Monorepo Setup

## 1. Executive Summary

This document defines the architectural and structural design for the `engenhariainversa` monorepo. The goal is to build an integrated, highly-reusable, and type-safe ecosystem consisting of:

1. A Next.js landing page app.
2. A Next.js CMS administration app.
3. A NestJS GraphQL backend to handle CMS rules and data.
4. Shared workspaces for the database (Prisma), design system (TailwindCSS & Shadcn/ui), and configurations.

---

## 2. Technical Stack & Workspace Structure

The project uses **pnpm workspaces** as the package manager and **Turborepo** as the build/task runner.

```
/ (Root)
├── apps/
│   ├── landing/          # Next.js (App Router, TailwindCSS)
│   ├── cms/              # Next.js (App Router, TailwindCSS, Shadcn/ui)
│   └── backend/          # NestJS (Prisma ORM, GraphQL Code-First API)
├── packages/
│   ├── database/         # Prisma Schema, Client Generator, and DB Migrations
│   ├── ui/               # Shared TailwindCSS + Shadcn/ui UI components
│   ├── tsconfig/         # Shared TypeScript configuration files
│   └── eslint-config/    # Shared ESLint configuration files
├── package.json          # Root dependencies & Turborepo config
├── pnpm-workspace.yaml   # Workspace folder definitions
└── turbo.json            # Turborepo task pipeline definitions
```

---

## 3. Component Architecture & Data Flow

```
   ┌──────────────────────────────────────────────┐
   │                  Database                    │
   │               (PostgreSQL/SQLite)            │
   └──────────────────────┬───────────────────────┘
                          │
            ┌─────────────▼─────────────┐
            │      @repo/database       │ (Prisma Client & Schema)
            └─────────────┬─────────────┘
                          │
            ┌─────────────▼─────────────┐
            │       apps/backend        │ (NestJS GraphQL Code-First)
            └──────┬─────────────┬──────┘
                   │             │
        (GraphQL Schema)         (GraphQL Schema)
                   │             │
    ┌──────────────▼───┐     ┌───▼──────────────┐
    │   apps/landing   │     │     apps/cms     │ (Next.js apps)
    └──────────┬───────┘     └───────┬──────────┘
               │                     │
               └──────────┬──────────┘
                          │ (Imports)
            ┌─────────────▼─────────────┐
            │         @repo/ui          │ (Shared Tailwind & Shadcn)
            └───────────────────────────┘
```

### 3.1 @repo/database (Centralized Schema)

- **Goal:** Centralize Prisma migrations, schema definitions, and client instantiation.
- **Outputs:**
  - Custom instance of `PrismaClient` exported as a shared dependency.
  - Shared Types derived directly from schema entities.
- **Usage:** `apps/backend` imports the client directly, avoiding duplicated prisma setups.

### 3.2 apps/backend (NestJS GraphQL Server)

- **Goal:** Serve as the source of truth for schema definitions and rule enforcement.
- **Mechanism:** **GraphQL Code-First** with `@nestjs/graphql` and `@nestjs/apollo`.
- **Output:** Auto-generates `schema.gql` in a shared accessible directory (or app root) upon startup.

### 3.3 @repo/ui (Shared Component System)

- **Goal:** House common buttons, inputs, modals, cards, and layouts.
- **Framework:** TailwindCSS + Radix/lucide icons (Shadcn/ui foundations).
- **Setup:** Leverages tailwind presets so that both Next.js applications compile and bundle only the Tailwind styles they actually use.

### 3.4 apps/landing & apps/cms (Next.js Applications)

- **Goal:** Render public pages (landing) and system-facing administration controls (cms).
- **Router:** Next.js modern **App Router**.
- **Type Safety:** Use `@graphql-codegen/client-preset` to read component-level `.gql`/`.graphql` files and output type-safe Query/Mutation inputs and outputs.

---

## 4. Configuration Sharing

To maintain consistent styling, code formatting, and compiler flags across the monorepo, configuration is centralized:

- **TypeScript:** Centralized configs under `packages/tsconfig` (e.g., `base.json`, `nextjs.json`, `nestjs.json`).
- **ESLint:** Shared rules in `packages/eslint-config`.
- **TailwindCSS:** A shared configuration preset inside `packages/ui` that both apps import to guarantee consistent colors, spacing, and roundness.

---

## 5. Testing & Validation Strategy

- **Unit/Integration Testing:**
  - **NestJS:** Jest tests using DB mocking or a local transaction-isolated test DB.
  - **Next.js:** Vitest or React Testing Library for frontend component checks.
- **End-to-End Testing:** Configured for Playwright/Cypress if needed in future phases.
- **Turborepo Integration:** Test commands are wired into the Turborepo pipeline so testing is run in parallel and cached globally.

---

## 6. Implementation Stages (Phases)

The monorepo setup will follow these sequential phases:

1. **Phase 1: Root Initialization** — Establish workspace directories, root configurations, and Turborepo.
2. **Phase 2: Shared Configs & Packages** — Scaffold `@repo/tsconfig`, `@repo/eslint-config`, and `@repo/database` (with default schema).
3. **Phase 3: NestJS Backend Scaffold** — Set up NestJS GraphQL app with Prisma client integration.
4. **Phase 4: Shared UI Component Library** — Set up `@repo/ui` with Tailwind and basic component tokens.
5. **Phase 5: Next.js Landing Page Scaffold** — Construct Next.js landing page integration using shared `@repo/ui` and GraphQL client.
6. **Phase 6: Next.js CMS Scaffold** — Construct Next.js CMS page integration using Tailwind, Shadcn/ui, and GraphQL query configurations.
7. **Phase 7: End-to-End Validation** — Ensure build, typecheck, and lint scripts pass successfully across all workspaces.
