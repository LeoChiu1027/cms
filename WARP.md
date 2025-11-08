# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

NestJS TypeScript application following clean architecture principles and modular design patterns. Uses pnpm, TypeScript (ES2023), ESLint, Prettier, and Jest testing.

## Use Context7
Use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

## Architecture and Code Structure

### Core Architecture Principles

This project follows a **modular NestJS architecture** with strict separation of concerns:

- **One module per main domain/route** - Each business domain gets its own module
- **Controller-Service pattern** - Controllers handle HTTP concerns, services contain business logic
- **Dependency Injection** - All dependencies are injected through NestJS's built-in DI container
- **Composition over inheritance** - Favor composition and interfaces over class inheritance

### Module Structure Pattern

When adding new features, follow this modular structure:
```
src/
├── feature-name/
│   ├── feature-name.module.ts      # Module definition and imports
│   ├── feature-name.controller.ts  # HTTP endpoints and request handling
│   ├── feature-name.service.ts     # Business logic and data operations
│   ├── dto/                        # Data Transfer Objects
│   │   ├── create-feature.dto.ts
│   │   └── update-feature.dto.ts
│   └── entities/                   # Data models (for future ORM integration)
│       └── feature.entity.ts
```


## Documentation

- **API Docs**: See `OPENAPI.md` for OpenAPI 3.0 YAML workflow
- **Database**: See `DBML.md` for database schema documentation

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

### Avoiding Circular Dependencies (NestJS)
- Do not use barrel files (index.ts) for providers/modules within the same directory.
- Keep module dependencies one-way; extract shared pieces to a Shared/Core module.
- Prefer composition and events/observers over direct service-to-service calls when cycles appear.
- If unavoidable, use forwardRef() on both sides: in @Module({ imports: [forwardRef(() => X)] }) and with @Inject(forwardRef(() => XService)).
- Alternative: resolve lazily via ModuleRef in lifecycle hooks (e.g., onModuleInit) instead of constructor injection.
- Avoid REQUEST-scoped providers in circular graphs; instantiation order is indeterminate.
- Split responsibilities to remove bidirectional knowledge; introduce interfaces/ports to invert dependencies.
- Watch for implicit cycles introduced by re-exporting modules/providers.

### Feature Development Workflow (TDD)

**Phase 1: Design First**
1. Create DBML schema (`docs/db/database.dbml`)
2. Create OpenAPI spec (`docs/api/` - validate with `pnpm run docs:validate`)
3. Create UML sequence diagram (Mermaid syntax in `docs/`)

**Phase 2: Test-Driven Development**
1. Write E2E tests first (`test/*.e2e-spec.ts`)
   - Full HTTP testing with in-memory SQLite
   - Test all success/error paths (200, 201, 400, 401, 404, 500)
   - Follow `test/auth.e2e-spec.ts` patterns

2. Write unit tests (service → controller)
   - `*.service.spec.ts`: Test business logic with mocked dependencies
   - `*.controller.spec.ts`: Test HTTP layer calls services correctly
   - Use Arrange-Act-Assert pattern

3. Run tests → RED (all fail)
4. Implement code → GREEN (all pass)
5. Refactor → Keep tests GREEN
6. Format & lint: `pnpm run format && pnpm run lint`
7. Update diagrams if implementation differs

**Testing Standards:**
- `*.spec.ts` = unit tests (co-located), `*.e2e-spec.ts` = integration tests
- Descriptive names: `should return 200 with valid data`
- Merge related assertions into comprehensive tests
- >80% coverage target
- Do NOT mock external dependencies in e2e tests
- **Field validation**: Test within existing test cases; do NOT create separate test cases unless validation logic is complex/independent

## Notion Sync

**Auto-sync after changes**: When updating `docs/db/database.dbml`, automatically sync to the "Database Schema (DBML)" Notion page without asking for permission.

**Manual sync required**: For sequence diagrams and other documentation, always ask permission before syncing.

**Mapping (with Notion Page IDs for faster syncing):**
- `docs/db/database.dbml` → "Database Schema (DBML)" page (ID: `299117d8-2753-81b7-b545-e80ab5c11ffc`)
- `docs/PASSWORD_SYNC_SEQUENCE_DIAGRAMS.md` → "Password Sync Sequence Diagrams" page (ID: `299117d8-2753-8182-a718-f17ad8dd2288`)
