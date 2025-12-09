# Development Log

## Current Status

**Phase**: Project Setup (Complete)
**Last Updated**: 2025-12-09

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

### Key Files Created
```
src/
├── app.module.ts              # Main module with ConfigModule, MikroORM, Terminus
├── config/
│   ├── configuration.ts       # Typed config factory
│   └── env.validation.ts      # Joi validation schema
├── health/
│   └── health.controller.ts   # Health check endpoint
└── mikro-orm.config.ts        # MikroORM CLI config

test/
├── jest-e2e.json              # E2E test config
├── setup.ts                   # Clears env vars and loads .env.test
└── health.e2e-spec.ts         # Health check e2e test

docker-compose.yml             # Dev containers
docker-compose.test.yml        # Test containers (tmpfs for ephemeral data)
```

### Ports Configuration
Dev and test containers use the same ports (5432, 6379, 9000) since they are not run simultaneously.

## Next Steps

1. **AuthModule** - Users, sessions, JWT authentication
   - Create User entity
   - Create Session entity
   - Implement JWT strategy
   - Add auth e2e tests

2. **RBACModule** - Roles, permissions
   - Create Role entity
   - Create Permission entity
   - Implement guards (AuthGuard, RolesGuard, PermissionsGuard)

3. **ContentModule** - Polymorphic content
   - Create base Content entity
   - Create Blog entity (start with one type)
   - Content versioning

4. **WorkflowModule** - Approval state machine

5. **MediaModule** - File uploads to S3/MinIO

## Notes

- MikroORM configured with `discovery: { warnWhenNoEntities: false }` until entities are added
- E2E tests use real containers, not mocks (per CLAUDE.md guidelines)
- ConfigModule handles dotenv internally, no separate dotenv package needed
- **E2E tests always start with clean state**: `pnpm test:e2e` automatically recreates test containers (using `--force-recreate` and `-v` to remove volumes) before running tests
