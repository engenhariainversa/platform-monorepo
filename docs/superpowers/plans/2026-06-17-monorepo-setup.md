# Monorepo Workspace Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a fully configured, type-safe pnpm workspaces + Turborepo monorepo with NestJS backend, shared Prisma database package, shared UI design system package, and two Next.js (App Router) applications.

**Architecture:** A monolithic repository featuring shared packages for configuration, database connections, and visual styling to prevent code duplication. Turborepo handles task orchestration and build caching, ensuring lightning-fast incremental builds and parallel testing across workspaces.

**Tech Stack:** pnpm workspaces, Turborepo, Next.js (14+ App Router), NestJS (GraphQL Code-First, `@nestjs/graphql`, `@nestjs/apollo`), Prisma ORM, TailwindCSS, TypeScript.

---

### Task 1: Monorepo Root Initialization

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: Create the root package.json**

Write the following content to `package.json` in the workspace root:

```json
{
  "name": "engenhariainversa-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "clean": "turbo run clean",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\""
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

Write the following content to `pnpm-workspace.yaml` in the workspace root:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

Write the following content to `turbo.json` in the workspace root:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "stream",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create .gitignore**

Write the following content to `.gitignore` in the workspace root:

```
node_modules
.next
dist
.turbo
build
.env
*.db
*.db-journal
```

- [ ] **Step 5: Run pnpm install and verify setup**

Run command: `pnpm install`
Expected Output: Success, creates `pnpm-lock.yaml` and installs Turborepo + Prettier in root node_modules.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore
git commit -m "chore: initialize root monorepo configuration with pnpm and turborepo"
```

---

### Task 2: Shared Configs (@repo/tsconfig & @repo/eslint-config)

**Files:**

- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nextjs.json`
- Create: `packages/tsconfig/nestjs.json`
- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/base.js`

- [ ] **Step 1: Create packages/tsconfig/package.json**

Write to `packages/tsconfig/package.json`:

```json
{
  "name": "@repo/tsconfig",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./base.json": "./base.json",
    "./nextjs.json": "./nextjs.json",
    "./nestjs.json": "./nestjs.json"
  }
}
```

- [ ] **Step 2: Create packages/tsconfig/base.json**

Write to `packages/tsconfig/base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 3: Create packages/tsconfig/nextjs.json**

Write to `packages/tsconfig/nextjs.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 4: Create packages/tsconfig/nestjs.json**

Write to `packages/tsconfig/nestjs.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2021",
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

- [ ] **Step 5: Create packages/eslint-config/package.json**

Write to `packages/eslint-config/package.json`:

```json
{
  "name": "@repo/eslint-config",
  "version": "0.0.0",
  "private": true,
  "main": "base.js",
  "dependencies": {
    "eslint-config-next": "14.2.3"
  }
}
```

- [ ] **Step 6: Create packages/eslint-config/base.js**

Write to `packages/eslint-config/base.js`:

```javascript
module.exports = {
  extends: ["next/core-web-vitals"],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
};
```

- [ ] **Step 7: Run pnpm install to link tsconfig package**

Run: `pnpm install`
Expected output: SUCCESS, workspace packages correctly identified.

- [ ] **Step 8: Commit**

```bash
git add packages/tsconfig packages/eslint-config
git commit -m "chore: setup shared tsconfig and eslint-config packages"
```

---

### Task 3: Setup @repo/database (Central Prisma Package)

**Files:**

- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/index.ts`

- [ ] **Step 1: Create packages/database/package.json**

Write to `packages/database/package.json`:

```json
{
  "name": "@repo/database",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "db:generate": "prisma generate",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0"
  },
  "devDependencies": {
    "prisma": "^5.14.0",
    "typescript": "^5.4.5",
    "@repo/tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: Create packages/database/tsconfig.json**

Write to `packages/database/tsconfig.json`:

```json
{
  "extends": "@repo/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create schema.prisma**

Write to `packages/database/prisma/schema.prisma` (using SQLite for portability/local setup, can be easily migrated to PostgreSQL):

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model CmsPage {
  id        String   @id @default(uuid())
  slug      String   @unique
  title     String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 4: Create packages/database/src/index.ts**

Write to `packages/database/src/index.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Run db generation and build**

Run: `pnpm --filter @repo/database db:generate`
Run: `pnpm --filter @repo/database build`
Expected output: Database models generated under `@prisma/client` and built into packages/database/dist.

- [ ] **Step 6: Commit**

```bash
git add packages/database
git commit -m "feat: add @repo/database package with Prisma schema and sqlite config"
```

---

### Task 4: Setup NestJS Backend (apps/backend)

**Files:**

- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/src/main.ts`
- Create: `apps/backend/src/app.module.ts`
- Create: `apps/backend/src/app.resolver.ts`

- [ ] **Step 1: Create apps/backend/package.json**

Write to `apps/backend/package.json`:

```json
{
  "name": "backend",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start"
  },
  "dependencies": {
    "@nestjs/apollo": "^12.1.0",
    "@nestjs/common": "^10.3.8",
    "@nestjs/core": "^10.3.8",
    "@nestjs/graphql": "^12.1.1",
    "@repo/database": "workspace:*",
    "apollo-server-express": "^3.13.0",
    "graphql": "^16.8.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.2",
    "@nestjs/schematics": "^10.1.1",
    "@repo/tsconfig": "workspace:*",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create apps/backend/tsconfig.json**

Write to `apps/backend/tsconfig.json`:

```json
{
  "extends": "@repo/tsconfig/nestjs.json",
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create NestJS Entry point (apps/backend/src/main.ts)**

Write to `apps/backend/src/main.ts`:

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(4000);
  console.log(
    `🚀 NestJS Backend GraphQL API running at http://localhost:4000/graphql`,
  );
}
bootstrap();
```

- [ ] **Step 4: Create App Module (apps/backend/src/app.module.ts)**

Write to `apps/backend/src/app.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { join } from "path";
import { AppResolver } from "./app.resolver";

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      playground: true,
    }),
  ],
  providers: [AppResolver],
})
export class AppModule {}
```

- [ ] **Step 5: Create App Resolver (apps/backend/src/app.resolver.ts)**

Write to `apps/backend/src/app.resolver.ts` with basic queries linked to the database client:

```typescript
import {
  Resolver,
  Query,
  Mutation,
  Args,
  Field,
  ObjectType,
  ID,
} from "@nestjs/graphql";
import { prisma } from "@repo/database";

@ObjectType()
class CmsPageType {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  title!: string;

  @Field()
  content!: string;
}

@Resolver()
export class AppResolver {
  @Query(() => String)
  hello(): string {
    return "Welcome to Engenhariainversa NestJS CMS Backend!";
  }

  @Query(() => [CmsPageType])
  async pages(): Promise<CmsPageType[]> {
    return prisma.cmsPage.findMany();
  }

  @Mutation(() => CmsPageType)
  async createPage(
    @Args("slug") slug: string,
    @Args("title") title: string,
    @Args("content") content: string,
  ): Promise<CmsPageType> {
    return prisma.cmsPage.create({
      data: { slug, title, content },
    });
  }
}
```

- [ ] **Step 6: Build NestJS application and generate initial schema**

Run: `pnpm install`
Run: `pnpm --filter backend build`
Expected output: Success compiling NestJS into `dist/`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend
git commit -m "feat: scaffold NestJS backend with code-first GraphQL and @repo/database link"
```

---

### Task 5: Shared UI Package Setup (@repo/ui)

**Files:**

- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/tailwind.config.ts`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components/button.tsx`

- [ ] **Step 1: Create packages/ui/package.json**

Write to `packages/ui/package.json`:

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tailwind.config": "./tailwind.config.ts",
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "@types/react": "^18.3.3",
    "@repo/tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: Create packages/ui/tsconfig.json**

Write to `packages/ui/tsconfig.json`:

```json
{
  "extends": "@repo/tsconfig/base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": false,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create Tailwind Preset (packages/ui/tailwind.config.ts)**

Write to `packages/ui/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3b82f6",
          dark: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Create shared Button component (packages/ui/src/components/button.tsx)**

Write to `packages/ui/src/components/button.tsx`:

```typescript
import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          "px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
          variant === 'primary' && "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
          variant === 'secondary' && "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
          variant === 'outline' && "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-blue-500",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

- [ ] **Step 5: Create index entry point exporting shared components (packages/ui/src/index.ts)**

Write to `packages/ui/src/index.ts`:

```typescript
export * from "./components/button";
```

- [ ] **Step 6: Build packages/ui and link**

Run: `pnpm install`
Run: `pnpm --filter @repo/ui build`
Expected output: Successfully compiles TypeScript file components.

- [ ] **Step 7: Commit**

```bash
git add packages/ui
git commit -m "feat: add @repo/ui package with Tailwind config and shared Button component"
```

---

### Task 6: Setup Next.js Landing Page (apps/landing)

**Files:**

- Create: `apps/landing/package.json`
- Create: `apps/landing/tsconfig.json`
- Create: `apps/landing/tailwind.config.ts`
- Create: `apps/landing/postcss.config.js`
- Create: `apps/landing/app/globals.css`
- Create: `apps/landing/app/layout.tsx`
- Create: `apps/landing/app/page.tsx`

- [ ] **Step 1: Create apps/landing/package.json**

Write to `apps/landing/package.json`:

```json
{
  "name": "landing",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@repo/ui": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.3",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.19",
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*"
  }
}
```

- [ ] **Step 2: Create apps/landing/tsconfig.json**

Write to `apps/landing/tsconfig.json`:

```json
{
  "extends": "@repo/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["app/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

- [ ] **Step 3: Create apps/landing/postcss.config.js**

Write to `apps/landing/postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create apps/landing/tailwind.config.ts**

Write to `apps/landing/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";
import sharedConfig from "@repo/ui/tailwind.config";

const config: Config = {
  ...sharedConfig,
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
```

- [ ] **Step 5: Create CSS layout styles (apps/landing/app/globals.css)**

Write to `apps/landing/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create App Layout (apps/landing/app/layout.tsx)**

Write to `apps/landing/app/layout.tsx`:

```typescript
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Engenhariainversa - Landing Page',
  description: 'Welcome to our Next.js Landing Page',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create Landing Page content (apps/landing/app/page.tsx)**

Write to `apps/landing/app/page.tsx` importing the shared `@repo/ui` Button component:

```typescript
import { Button } from '@repo/ui';

export default function Page() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
          Engenhariainversa Landing Page
        </h1>
        <p className="text-lg text-slate-600">
          This page is built in Next.js and uses visual components imported from our shared Monorepo UI system.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary">Explore Features</Button>
          <Button variant="outline">Learn More</Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Build apps/landing to verify Next.js configuration**

Run: `pnpm install`
Run: `pnpm --filter landing build`
Expected output: Success compiling pages and bundles with Webpack/Turbopack.

- [ ] **Step 9: Commit**

```bash
git add apps/landing
git commit -m "feat: scaffold Next.js landing page with shared @repo/ui"
```

---

### Task 7: Setup Next.js CMS App (apps/cms)

**Files:**

- Create: `apps/cms/package.json`
- Create: `apps/cms/tsconfig.json`
- Create: `apps/cms/tailwind.config.ts`
- Create: `apps/cms/postcss.config.js`
- Create: `apps/cms/app/globals.css`
- Create: `apps/cms/app/layout.tsx`
- Create: `apps/cms/app/page.tsx`

- [ ] **Step 1: Create apps/cms/package.json**

Write to `apps/cms/package.json`:

```json
{
  "name": "cms",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@repo/ui": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.3",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.19",
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*"
  }
}
```

- [ ] **Step 2: Create apps/cms/tsconfig.json**

Write to `apps/cms/tsconfig.json`:

```json
{
  "extends": "@repo/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["app/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

- [ ] **Step 3: Create apps/cms/postcss.config.js**

Write to `apps/cms/postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create apps/cms/tailwind.config.ts**

Write to `apps/cms/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";
import sharedConfig from "@repo/ui/tailwind.config";

const config: Config = {
  ...sharedConfig,
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
```

- [ ] **Step 5: Create CSS layout styles (apps/cms/app/globals.css)**

Write to `apps/cms/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create App Layout (apps/cms/app/layout.tsx)**

Write to `apps/cms/app/layout.tsx`:

```typescript
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Engenhariainversa - CMS System',
  description: 'Manage your CMS data and pages',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create CMS app homepage (apps/cms/app/page.tsx)**

Write to `apps/cms/app/page.tsx` importing the shared `@repo/ui` Button component:

```typescript
import { Button } from '@repo/ui';

export default function Page() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-white">
          Engenhariainversa CMS
        </h1>
        <p className="text-lg text-slate-400">
          This is the CMS administration dashboard. Create pages, edit fields, and manage custom content pipelines.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary">Create New Page</Button>
          <Button variant="secondary">View Dashboard</Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Build apps/cms to verify Next.js setup**

Run: `pnpm install`
Run: `pnpm --filter cms build`
Expected output: Success compiling pages and bundles with Webpack/Turbopack.

- [ ] **Step 9: Commit**

```bash
git add apps/cms
git commit -m "feat: scaffold Next.js CMS dashboard with shared @repo/ui"
```

---

### Task 8: End-to-End Monorepo Validation

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Run comprehensive parallel building and caching tests**

Run: `pnpm build`
Expected output: Turborepo coordinates and builds all 3 apps and 3 packages successfully.

- [ ] **Step 2: Run a dry format validation check**

Run: `pnpm format`
Expected output: All code formatted smoothly using Prettier configuration.

- [ ] **Step 3: Commit final configuration integration**

```bash
git commit --allow-empty -m "chore: completed setup and verified all monorepo build layers"
```
