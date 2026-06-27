# 🤖 Engenharia Inversa — Platform Monorepo

A primeira escola de mobile focada em engenharia real e processos transparentes. Projeto **Build in Public**.

---

## 📐 Arquitetura

```
engenhariainversa/
├── apps/
│   ├── backend/      # NestJS + GraphQL API        → :4050
│   ├── cms/          # Next.js — painel admin       → :4051
│   └── landing/      # Next.js — site público       → :4052
├── packages/
│   ├── database/     # Prisma + PostgreSQL
│   ├── ui/           # Design system + componentes compartilhados
│   ├── tsconfig/     # Configs TypeScript compartilhados
│   └── eslint-config/# Configs ESLint compartilhados
├── Dockerfile        # Multi-stage (backend, cms, landing)
├── docker-compose.yml
└── turbo.json
```

## 🛠 Pré-requisitos

| Ferramenta | Versão mínima |
|-----------|---------------|
| [Node.js](https://nodejs.org/) | `v20+` |
| [pnpm](https://pnpm.io/) | `v9+` |
| [Docker](https://www.docker.com/) | `v24+` |
| [Docker Compose](https://docs.docker.com/compose/) | `v2+` |

---

## 🚀 Rodando Localmente

### 1. Clone o repositório

```bash
git clone https://github.com/engenhariainversa/platform-monorepo.git
cd platform-monorepo
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

O arquivo `.env` já vem configurado para dev local com os valores padrão do Docker Compose.

### 4. Suba o banco de dados

```bash
docker compose up db -d
```

Aguarde o healthcheck confirmar que o Postgres está pronto.

### 5. Configure o Prisma

```bash
# Gera o client do Prisma
pnpm --filter @repo/database db:generate

# Aplica todas as migrations pendentes
pnpm --filter @repo/database db:migrate:deploy

# Popula roles do sistema (ADMIN, MANAGER, AUTHENTICATED) e recursos públicos
pnpm --filter @repo/database db:seed
```

### 6. Rode o projeto

```bash
# Todos os apps simultaneamente (via Turborepo)
pnpm dev
```

Ou rode apps individuais:

```bash
# Apenas o backend
pnpm --filter backend dev

# Apenas o CMS
pnpm --filter cms dev

# Apenas a landing page
pnpm --filter landing dev
```

---

## 🐳 Rodando com Docker (Dev com Hot-Reload)

Sobe todo o ambiente de desenvolvimento com hot-reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Os arquivos de código fonte são montados como volumes, então qualquer alteração local reflete automaticamente nos containers.

Ou suba serviços individuais:

```bash
# Apenas DB + Backend
docker compose -f docker-compose.dev.yml up db backend

# Apenas DB + Landing
docker compose -f docker-compose.dev.yml up db landing
```

---

## 🐳 Rodando com Docker (Produção)

Sobe todos os serviços com build otimizado de produção:

```bash
docker compose up --build
```

Ou serviços individuais:

```bash
docker compose up --build landing
```

### Portas

| Serviço | Porta | URL |
|---------|-------|-----|
| PostgreSQL | `5432` | — |
| Backend | `4050` | http://localhost:4050 |
| CMS | `4051` | http://localhost:4051 |
| Landing | `4052` | http://localhost:4052 |

---

## 📦 Packages Compartilhados

### `@repo/ui`

Design system com Tailwind + componentes React. Também re-exporta ícones do `lucide-react`.

```tsx
import { Button } from "@repo/ui";
import { Menu, ArrowRight } from "@repo/ui";
```

### `@repo/database`

Client Prisma compartilhado entre apps.

```tsx
import { prisma } from "@repo/database";
```

### `@repo/tsconfig`

Configurações TypeScript base estendidas por cada app.

---

## 🧰 Scripts Úteis

```bash
# Rodar todos os apps em dev
pnpm dev

# Build de tudo
pnpm build

# Lint
pnpm lint

# Formatar código
pnpm format

# Limpar builds
pnpm clean
```

---

## 🗄 Banco de Dados

O projeto usa **PostgreSQL 16** com **Prisma ORM** e migrations versionadas.

```bash
# Gerar o Prisma client
pnpm --filter @repo/database db:generate

# Aplicar migrations pendentes (usado em dev e prod)
pnpm --filter @repo/database db:migrate:deploy

# Criar uma nova migration a partir de mudanças no schema.prisma (somente dev)
pnpm --filter @repo/database db:migrate:dev --name <nome_descritivo>

# Ver status das migrations
pnpm --filter @repo/database db:migrate:status

# Popular roles do sistema + recursos públicos (idempotente)
pnpm --filter @repo/database db:seed
```

> **⚠️ Banco já existente?** Se você já criou tabelas com `db:push` antes, é necessário fazer baseline da migration inicial uma única vez:
> ```bash
> pnpm --filter @repo/database db:migrate:resolve --applied 20260626000000_init
> ```

### Credenciais Dev (Docker Compose)

| Campo | Valor |
|-------|-------|
| Host | `localhost` |
| Port | `5432` |
| User | `engenharia` |
| Password | `inversa_dev_2024` |
| Database | `engenhariainversa` |
| URL | `postgresql://engenharia:inversa_dev_2024@localhost:5432/engenhariainversa` |

---

## 📁 Estrutura de Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `NODE_ENV` | Ambiente de execução | `development` / `production` |
| `PORT` | Porta do serviço | `4050` |

---

## 🤝 Contribuindo

1. Crie uma branch a partir de `main`
2. Faça suas alterações
3. Abra um Pull Request

---

<p align="center">
  <strong>Build in Public 🚀</strong><br/>
  <em>Do código ao deploy, sem segredos.</em>
</p>
