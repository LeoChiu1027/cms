---
description: Review all E2E tests for completeness, ensuring response and database validations are correctly implemented
---

# E2E Test Review Workflow

This workflow helps identify missing or incomplete validations in E2E tests.

## Pre-requisites

Ensure you understand the custom DB matchers in `test/matchers/db.matcher.ts`:
- `toExistInDb(em)` - verify entity exists
- `toNotExistInDb(em)` - verify entity deleted
- `toMatchInDb(em, expected)` - verify entity with specific fields

---

## Step 1: Inventory All E2E Tests

// turbo
```bash
find test -name "*.e2e-spec.ts" -type f
```

List all E2E test files and note which modules they cover.

---

## Step 2: For Each Test File, Review Against OpenAPI Spec

For each `*.e2e-spec.ts` file, check that it covers all endpoints defined in the corresponding OpenAPI spec:

// turbo
```bash
ls -la docs/api/paths/
```

Cross-reference each endpoint in the OpenAPI spec with test cases in the E2E file.

---

## Step 3: Validation Checklist Per HTTP Method

Apply this checklist to EACH test case:

### GET Endpoints
- [ ] **Response status**: Correct status code (200, 404, etc.)
- [ ] **Response structure**: `expect.objectContaining()` for expected fields
- [ ] **Response data**: Verify returned data matches seeded/created data
- [ ] **Pagination** (if applicable): `meta` object with `total`, `page`, `limit`
- [ ] **Filtering** (if applicable): Test query params filter correctly

### POST Endpoints (Create)
- [ ] **Response status**: 201 Created
- [ ] **Response body**: Contains created resource with `id`
- [ ] **DB validation**: `toExistInDb(em)` or `toMatchInDb(em, {...})`
- [ ] **Related entities**: Verify associations created correctly
- [ ] **Validation errors**: 400 for invalid input with error messages

### PUT/PATCH Endpoints (Update)
- [ ] **Response status**: 200 OK
- [ ] **Response body**: Updated resource reflects changes
- [ ] **DB validation**: `toMatchInDb(em, {...})` with updated fields
- [ ] **updatedAt**: Verify timestamp changed
- [ ] **Validation errors**: 400 for invalid input
- [ ] **Not found**: 404 for non-existent resource

### DELETE Endpoints
- [ ] **Response status**: 200 or 204
- [ ] **DB validation**: `toNotExistInDb(em)` for hard delete
- [ ] **Soft delete**: `toMatchInDb(em, { deletedAt: expect.any(Date) })`
- [ ] **Cascade effects**: Related entities handled correctly
- [ ] **Not found**: 404 for non-existent resource

### All Endpoints
- [ ] **Authentication**: 401 Unauthorized without token
- [ ] **Authorization**: 403 Forbidden without permission
- [ ] **RBAC verification**: Test with different roles if applicable

---

## Step 4: Review Pattern Template

When reviewing a test file, produce a report in this format:

```markdown
## Review: [filename].e2e-spec.ts

### Endpoints Covered
| Endpoint | Method | Test Cases | Status |
|----------|--------|------------|--------|
| /api/resource | GET | ✅ 3 tests | Complete |
| /api/resource | POST | ⚠️ 2 tests | Missing DB validation |

### Missing Tests
1. [ ] `DELETE /api/resource/:id` - No tests found
2. [ ] `GET /api/resource/:id` - Missing 404 case

### Missing Validations
1. [ ] `POST /api/resource` - Line 45: No `toExistInDb` or `toMatchInDb`
2. [ ] `PUT /api/resource/:id` - Line 78: No `updatedAt` check

### Recommendations
- Add DB validation after POST at line 45
- Add 404 test case for GET by ID
```

---

## Step 5: Common Patterns to Check

Look for these RED FLAGS in test code:

### Missing DB Validation (BAD)
```typescript
// Only checks response, not database
const response = await request(app.getHttpServer())
  .post('/api/resource')
  .send(dto);
expect(response.status).toBe(201);
// Missing: toExistInDb or toMatchInDb
```

### Correct Pattern (GOOD)
```typescript
const response = await request(app.getHttpServer())
  .post('/api/resource')
  .send(dto);
expect(response.status).toBe(201);

// Verify database state
await expect({ entity: Resource, id: response.body.id }).toMatchInDb(em, {
  name: dto.name,
  createdAt: expect.any(Date),
});
```

---

## Step 6: Error Case Coverage

Ensure each endpoint tests these error scenarios:

1. **400 Bad Request**: Invalid input (wrong type, missing required fields)
2. **401 Unauthorized**: No auth token or invalid token
3. **403 Forbidden**: Insufficient permissions
4. **404 Not Found**: Resource doesn't exist
5. **409 Conflict**: Duplicate unique constraint (if applicable)
6. **500 Internal Server Error**: Edge case handling (optional)

---

## Step 7: Generate Summary Report

After reviewing all files, create a summary:

```markdown
# E2E Test Review Summary

## Coverage Status
| Test File | Endpoints | DB Validations | Error Cases | Status |
|-----------|-----------|----------------|-------------|--------|
| auth.e2e-spec.ts | 5/5 | 4/5 | 8/10 | ⚠️ |
| products.e2e-spec.ts | 3/4 | 3/3 | 5/8 | ⚠️ |

## Priority Fixes
1. **High**: [file] - Missing POST validations
2. **Medium**: [file] - Missing 404 error cases
3. **Low**: [file] - Missing 401 test

## Action Items
- [ ] Fix item 1
- [ ] Fix item 2
```

---

## Step 8: Apply Fixes

For each identified issue, implement the fix:

1. Add missing `toExistInDb`/`toMatchInDb`/`toNotExistInDb` calls
2. Add missing error case tests
3. Add missing auth/RBAC tests
4. Run tests to verify

// turbo
```bash
npm run test:e2e
```
