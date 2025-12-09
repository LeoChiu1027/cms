# CMS

A Content Management System with RBAC and approval workflows.

## Tech Stack

- **Backend**: NestJS with MikroORM
- **Database**: PostgreSQL
- **Cache/Session**: Redis
- **Storage**: S3/MinIO

## Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose

## Project Setup

```bash
pnpm install
```

## Environment Configuration

The app uses different environment files based on `NODE_ENV`:

| Environment | File | Description |
|-------------|------|-------------|
| development | `.env` | Default, uses ports 5432, 6379, 9000 |
| test | `.env.test` | Uses ports 5433, 6380, 9002 |
| production | `.env.production` | Copy from `.env.production.example` |

## Development

```bash
# Start dev containers (PostgreSQL, Redis, MinIO)
pnpm docker:dev

# Start dev server (watch mode)
pnpm start:dev

# Stop dev containers
pnpm docker:dev:down
```

## Testing

### E2E Tests

E2E tests run against real PostgreSQL, Redis, and MinIO containers.

```bash
# 1. Start test containers
pnpm docker:test

# 2. Run e2e tests
pnpm test:e2e

# 3. Stop test containers when done
pnpm docker:test:down
```

### Unit Tests

```bash
# Run unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov
```

## Production

```bash
# Build
pnpm build

# Run
pnpm start:prod
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm start:dev` | Start dev server with hot reload |
| `pnpm start:prod` | Start production server |
| `pnpm build` | Build the application |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run e2e tests |
| `pnpm docker:dev` | Start dev containers |
| `pnpm docker:dev:down` | Stop dev containers |
| `pnpm docker:test` | Start test containers |
| `pnpm docker:test:down` | Stop test containers |
| `pnpm lint` | Lint and fix code |
| `pnpm format` | Format code with Prettier |
