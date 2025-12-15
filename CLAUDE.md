# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CMS (Content Management System) with RBAC (Role-Based Access Control) and approval workflows, supporting polymorphic content types (products, blogs, pages, categories).

## Tech Stack

- **Backend**: NestJS with MikroORM
- **Database**: PostgreSQL
- **Cache/Session**: Redis
- **Storage**: S3/MinIO

## Architecture

### Module Structure

The NestJS application follows a modular architecture:

- **CoreModule** (Global): Guards (Auth, Roles, Permissions), Filters, Interceptors
- **SharedModule** (Global): AuditService, CacheService, PaginationService
- **AuthModule**: Authentication with JWT strategy
- **RBACModule**: Role and permission management
- **ContentModule**: Polymorphic content handling (products, blogs, categories)
- **WorkflowModule**: Approval workflow state machine
- **MediaModule**: File upload and storage

### Content Model (Polymorphic Pattern)

Base `contents` table with 1:1 relations to type-specific tables (`products`, `blogs`, `categories`). Content versioning via `content_versions` table with JSONB snapshots.

### Approval Workflow States

Draft → PendingReview → InReview → Approved/Rejected/ChangesRequested → Published/Scheduled → Archived

## Database Schema

Schema files are in `docs/db/` as separate DBML files:
- `enums.dbml` - Shared enums
- `auth.dbml` - users, sessions
- `rbac.dbml` - roles, permissions, mappings
- `content.dbml` - contents, products, blogs, categories, tags, versions
- `workflow.dbml` - workflows, approvals, assignments
- `media.dbml` - media assets
- `system.dbml` - audit_logs, settings

## Module Structure Pattern

When adding new features, follow this structure:
```
src/
├── feature-name/
│   ├── feature-name.module.ts      # Module definition and imports
│   ├── feature-name.controller.ts  # HTTP endpoints and request handling
│   ├── feature-name.service.ts     # Business logic and data operations
│   ├── dto/                        # Data Transfer Objects
│   │   ├── create-feature.dto.ts
│   │   └── update-feature.dto.ts
│   └── entities/                   # MikroORM entities
│       └── feature.entity.ts
```

## Development Rules and Guidelines

### TypeScript Standards
- Always declare explicit types for variables and function parameters/returns
- Use PascalCase for classes, camelCase for variables/functions, kebab-case for files
- Start function names with verbs (e.g., `getUserById`, `validateInput`)
- Use boolean prefixes: `isLoading`, `hasPermission`, `canAccess`
- Functions should be short (< 20 instructions) with single responsibility
- Prefer early returns over nested conditionals

### NestJS Patterns
- Use DTOs with class-validator for all API inputs
- Implement proper error handling with custom exceptions
- Follow SOLID principles in service design
- Use guards for authentication/authorization logic
- Implement interceptors for cross-cutting concerns like logging

### Avoiding Circular Dependencies
- Do not use barrel files (index.ts) for providers/modules within the same directory
- Keep module dependencies one-way; extract shared pieces to SharedModule/CoreModule
- Prefer composition and events/observers over direct service-to-service calls when cycles appear
- If unavoidable, use `forwardRef()` on both sides
- Alternative: resolve lazily via `ModuleRef` in lifecycle hooks (e.g., `onModuleInit`)
- Split responsibilities to remove bidirectional knowledge; introduce interfaces/ports to invert dependencies

## Feature Development Workflow (TDD)

### Phase 1: Design First
1. Create/update DBML schema in `docs/db/` if database changes needed
2. Create OpenAPI spec in `docs/api/paths/`
   - Add endpoint definition to appropriate YAML file
   - Validate and bundle the spec
3. Create UML sequence diagram (Mermaid syntax in `docs/`)
4. **STOP and wait for user review** before proceeding to Phase 2

### Phase 2: Test-Driven Development
1. Write E2E tests first (`test/*.e2e-spec.ts`)
   - Test all success/error paths (200, 201, 400, 401, 404, 500)
2. Write unit tests (service → controller)
   - `*.service.spec.ts`: Test business logic with mocked dependencies
   - `*.controller.spec.ts`: Test HTTP layer calls services correctly
   - Use Arrange-Act-Assert pattern
3. Run tests → RED (all fail)
4. Implement code → GREEN (all pass)
5. Refactor → Keep tests GREEN
6. Format & lint
7. Update diagrams if implementation differs

### Testing Standards
- `*.spec.ts` = unit tests (co-located), `*.e2e-spec.ts` = integration tests
- Descriptive names: `should return 200 with valid data`
- Merge related assertions into comprehensive tests
- >80% coverage target
- Do NOT mock external dependencies in e2e tests

### E2E Testing with Database Validation

For POST, PUT, and DELETE endpoints, always validate that database state changes correctly—not just API responses.

**Custom Matchers** (`test/matchers/db.matcher.ts`):
- `toExistInDb(em)` - verify entity exists in database
- `toNotExistInDb(em)` - verify entity was deleted from database
- `toMatchInDb(em, expected)` - verify entity exists with specific field values

**Usage Examples**:
```typescript
import './matchers/db.matcher';

// Verify entity was created with correct fields (POST)
await expect({ entity: User, id: userId }).toMatchInDb(em, {
  email: 'test@example.com',
  firstName: 'John',
  isActive: true,
});

// Verify related entity was created (POST)
await expect({
  entity: Session,
  where: { user: { id: userId } },
}).toExistInDb(em);

// Verify entity was deleted (DELETE or logout)
await expect({
  entity: Session,
  where: { user: { id: userId } },
}).toNotExistInDb(em);

// Use Jest asymmetric matchers for flexible assertions
await expect({ entity: User, id: userId }).toMatchInDb(em, {
  lastLoginAt: expect.any(Date),
});
```

**E2E Test Checklist for Mutating Endpoints**:
1. **POST**: Verify entity created in DB with correct fields, verify related entities created
2. **PUT/PATCH**: Verify entity updated in DB, verify `updatedAt` changed
3. **DELETE**: Verify entity removed from DB (or soft-deleted with `deletedAt`)
