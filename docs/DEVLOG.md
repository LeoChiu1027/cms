# Development Log

## Current Status

**Phase**: ContentModule - Blogs (Complete)
**Last Updated**: 2025-12-19

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

### RBACModule
- [x] Role entity with slug, description, isSystem flag
- [x] Permission entity with resource/action model (e.g., `content:create`)
- [x] RolePermission junction entity (many-to-many)
- [x] UserRole junction entity (many-to-many)
- [x] RolesGuard - validate user has required roles
- [x] PermissionsGuard - validate user has required permissions
- [x] @Roles() and @Permissions() decorators
- [x] Roles CRUD endpoints (POST, GET, PATCH, DELETE /roles)
- [x] Permissions CRUD endpoints (POST, GET, DELETE /permissions)
- [x] Role-Permission assignment (POST, GET, DELETE /roles/:roleId/permissions)
- [x] User-Role assignment (POST, GET, DELETE /users/:userId/roles)
- [x] Effective user permissions endpoint (GET /users/:userId/permissions)
- [x] Pagination and filtering support
- [x] 45 E2E tests passing
- [x] 74 unit tests passing (6 test suites)

### ContentModule - Phase 1: Design
- [x] OpenAPI spec updated with hybrid approach (type-specific + unified endpoints)
- [x] Sequence diagrams for content flows
- [x] `typeData` pattern for clean polymorphic responses (no null type fields)

### ContentModule - Phase 2: Tags Feature
- [x] Tag entity with name, slug, createdAt
- [x] ContentType enum (product, blog, page, category)
- [x] ContentStatus enum (draft, pending_review, in_review, etc.)
- [x] Tags CRUD endpoints (POST, GET, DELETE /tags)
- [x] Search/pagination support
- [x] 21 E2E tests passing
- [x] 17 unit tests passing (2 test suites)

### ContentModule - Phase 3: Blog Content Type
- [x] Content entity (base polymorphic with slug, status, locale, version)
- [x] Blog entity (1:1 with Content - title, body, excerpt, isFeatured, SEO fields)
- [x] ContentTag junction entity (many-to-many content <-> tags)
- [x] ContentVersion entity (JSONB snapshots for version history)
- [x] Hybrid controller pattern:
  - BlogsController (`/blogs`) for type-specific CRUD
  - ContentController (`/contents`) for cross-type queries and versioning
- [x] Versioning: manual trigger + auto on publish + backup on restore
- [x] Soft delete support (deletedAt)
- [x] Tag management on blogs (add/get/remove)
- [x] 30 E2E tests passing (blogs)
- [x] Total: 113 E2E tests, 91 unit tests

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
├── rbac/
│   ├── rbac.module.ts         # RBAC module definition
│   ├── rbac.service.ts        # Role/permission business logic
│   ├── roles.controller.ts    # Roles CRUD endpoints
│   ├── permissions.controller.ts  # Permissions CRUD endpoints
│   ├── user-roles.controller.ts   # User-role assignments
│   ├── guards/
│   │   ├── roles.guard.ts     # Role-based authorization guard
│   │   └── permissions.guard.ts   # Permission-based authorization guard
│   ├── decorators/
│   │   ├── roles.decorator.ts     # @Roles() decorator
│   │   └── permissions.decorator.ts   # @Permissions() decorator
│   ├── dto/
│   │   ├── create-role.dto.ts
│   │   ├── update-role.dto.ts
│   │   ├── create-permission.dto.ts
│   │   ├── assign-roles.dto.ts
│   │   └── assign-permissions.dto.ts
│   └── entities/
│       ├── role.entity.ts
│       ├── permission.entity.ts
│       ├── role-permission.entity.ts  # Junction table
│       └── user-role.entity.ts        # Junction table
├── content/
│   ├── content.module.ts      # Content module definition
│   ├── tags.service.ts        # Tags CRUD logic
│   ├── tags.controller.ts     # Tags endpoints (/tags)
│   ├── blogs.service.ts       # Blogs CRUD + versioning logic
│   ├── blogs.controller.ts    # Blogs endpoints (/blogs)
│   ├── content.service.ts     # Cross-type queries + version management
│   ├── content.controller.ts  # Unified endpoints (/contents)
│   ├── enums/
│   │   ├── content-type.enum.ts   # product, blog, page, category
│   │   └── content-status.enum.ts # draft, pending_review, etc.
│   ├── entities/
│   │   ├── tag.entity.ts          # Tag entity
│   │   ├── content.entity.ts      # Base polymorphic content
│   │   ├── blog.entity.ts         # Blog-specific fields (1:1 with content)
│   │   ├── content-tag.entity.ts  # Junction table
│   │   └── content-version.entity.ts # Version history (JSONB snapshots)
│   └── dto/
│       ├── create-tag.dto.ts
│       ├── create-blog.dto.ts
│       ├── update-blog.dto.ts
│       └── create-version.dto.ts
└── mikro-orm.config.ts        # MikroORM CLI config

test/
├── jest-e2e.json              # E2E test config
├── setup.ts                   # Clears env vars and loads .env.test
├── matchers/db.matcher.ts     # Custom Jest matchers for DB validation
├── health.e2e-spec.ts         # Health check e2e test
├── auth.e2e-spec.ts           # Auth e2e tests (17 tests)
├── rbac.e2e-spec.ts           # RBAC e2e tests (45 tests)
├── tags.e2e-spec.ts           # Tags e2e tests (21 tests)
└── blogs.e2e-spec.ts          # Blogs e2e tests (30 tests)

docs/
├── api/openapi.yaml           # OpenAPI specification (includes Tags, Blogs, Contents)
├── schema/content.dbml        # Content schema definition
└── sequence-diagram/
    └── content-sequences.md   # Content flow sequence diagrams

docker-compose.yml             # Dev containers
docker-compose.test.yml        # Test containers (tmpfs for ephemeral data)
```

### Ports Configuration
Dev and test containers use the same ports (5432, 6379, 9000) since they are not run simultaneously.

## Next Steps

1. **ContentModule - Additional Content Types**
   - ProductsController (`/products`) - same pattern as blogs
   - CategoriesController (`/categories`) - hierarchical with parent_id

2. **WorkflowModule** - Approval state machine
   - Workflow entity (state machine definition)
   - Approval transitions (draft → pending_review → approved → published)
   - Reviewer assignments

3. **MediaModule** - File uploads to S3/MinIO
   - Media entity
   - Upload endpoints
   - Image resizing/thumbnails

## Notes

- E2E tests use real containers, not mocks (per CLAUDE.md guidelines)
- ConfigModule handles dotenv internally, no separate dotenv package needed
- **E2E tests always start with clean state**: `pnpm test:e2e` automatically recreates test containers (using `--force-recreate` and `-v` to remove volumes) before running tests
- Refresh tokens stored in HTTP-only cookies with `Secure`, `SameSite=Strict`, `Path=/auth` flags
- Password hashing uses bcryptjs with cost factor 12
