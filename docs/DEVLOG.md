# Development Log

## Current Status

**Phase**: AuthModule (Complete)
**Last Updated**: 2025-12-10

## Completed

### Project Infrastructure
- [x] NestJS project scaffolded with pnpm
- [x] Docker Compose for dev containers (PostgreSQL, Redis, MinIO)
- [x] Docker Compose for test containers (separate ports)
- [x] Environment configuration with Joi validation
- [x] Multi-environment support (.env, .env.test, .env.production.example)
- [x] E2E test infrastructure with real containers
- [x] Health check endpoint with database ping
- [x] Health check e2e test passing
- [x] E2E tests start with clean containers (DB, Redis, MinIO)

### AuthModule
- [x] User entity with password hashing
- [x] Session entity for refresh token storage
- [x] JWT access tokens (15min) + refresh tokens (7d) in HTTP-only cookies
- [x] Registration, login, logout, token refresh, get current user endpoints
- [x] 17 E2E tests passing

### Key Files Created
```
src/
├── app.module.ts              # Main module with ConfigModule, MikroORM, Terminus
├── config/
│   ├── configuration.ts       # Typed config factory
│   └── env.validation.ts      # Joi validation schema
├── health/
│   └── health.controller.ts   # Health check endpoint
├── auth/
│   ├── auth.module.ts         # Auth module
│   ├── auth.controller.ts     # Auth endpoints
│   ├── auth.service.ts        # Auth business logic
│   ├── jwt.strategy.ts        # Passport JWT strategy
│   ├── dto/
│   │   ├── register.dto.ts
│   │   └── login.dto.ts
│   └── entities/
│       ├── user.entity.ts
│       └── session.entity.ts
└── mikro-orm.config.ts        # MikroORM CLI config

test/
├── jest-e2e.json              # E2E test config
├── setup.ts                   # Clears env vars and loads .env.test
├── health.e2e-spec.ts         # Health check e2e test
└── auth.e2e-spec.ts           # Auth e2e tests (17 tests)

docs/
├── api/openapi.yaml           # OpenAPI specification
└── auth-sequences.md          # Auth flow sequence diagrams

docker-compose.yml             # Dev containers
docker-compose.test.yml        # Test containers (tmpfs for ephemeral data)
```

### Ports Configuration
Dev and test containers use the same ports (5432, 6379, 9000) since they are not run simultaneously.

## Next Steps

1. **RBACModule** - Roles, permissions
   - Create Role entity
   - Create Permission entity
   - Implement guards (AuthGuard, RolesGuard, PermissionsGuard)

2. **ContentModule** - Polymorphic content
   - Create base Content entity
   - Create Blog entity (start with one type)
   - Content versioning

3. **WorkflowModule** - Approval state machine

4. **MediaModule** - File uploads to S3/MinIO

## Notes

- E2E tests use real containers, not mocks (per CLAUDE.md guidelines)
- ConfigModule handles dotenv internally, no separate dotenv package needed
- **E2E tests always start with clean state**: `pnpm test:e2e` automatically recreates test containers (using `--force-recreate` and `-v` to remove volumes) before running tests
- Refresh tokens stored in HTTP-only cookies with `Secure`, `SameSite=Strict`, `Path=/auth` flags
- Password hashing uses bcryptjs with cost factor 12
