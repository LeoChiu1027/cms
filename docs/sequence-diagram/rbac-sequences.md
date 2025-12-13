# RBAC Module Sequence Diagrams

## 1. Create Role Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RC as RolesController
    participant PG as PermissionsGuard
    participant RS as RolesService
    participant DB as Database

    C->>RC: POST /roles {name, slug, description}
    RC->>PG: Check permission (roles:create)
    PG->>DB: Get user permissions (via roles)

    alt No permission
        PG-->>C: 403 Forbidden
    end

    PG-->>RC: Authorized
    RC->>RC: Validate DTO (class-validator)

    alt Validation fails
        RC-->>C: 400 Bad Request (validation errors)
    end

    RC->>RS: createRole(createRoleDto)
    RS->>DB: Check if name/slug exists

    alt Name/Slug exists
        RS-->>RC: throw ConflictException
        RC-->>C: 409 Conflict (role already exists)
    end

    RS->>DB: Insert role
    RS-->>RC: Role
    RC-->>C: 201 Created {role}
```

## 2. Assign Permissions to Role Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RC as RolesController
    participant PG as PermissionsGuard
    participant RS as RolesService
    participant DB as Database

    C->>RC: POST /roles/{roleId}/permissions {permissionIds: [...]}
    RC->>PG: Check permission (roles:update)

    alt No permission
        PG-->>C: 403 Forbidden
    end

    PG-->>RC: Authorized
    RC->>RS: assignPermissions(roleId, permissionIds)
    RS->>DB: Find role by ID

    alt Role not found
        RS-->>RC: throw NotFoundException
        RC-->>C: 404 Not Found
    end

    RS->>DB: Find permissions by IDs

    alt Some permissions not found
        RS-->>RC: throw BadRequestException
        RC-->>C: 400 Bad Request (invalid permission IDs)
    end

    RS->>DB: Insert role_permissions (ignore duplicates)
    RS->>DB: Load role with permissions
    RS-->>RC: RoleWithPermissions
    RC-->>C: 200 OK {role with permissions}
```

## 3. Assign Roles to User Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant UC as UsersController
    participant PG as PermissionsGuard
    participant RS as RolesService
    participant DB as Database

    C->>UC: POST /users/{userId}/roles {roleIds: [...]}
    UC->>PG: Check permission (users:manage-roles)

    alt No permission
        PG-->>C: 403 Forbidden
    end

    PG-->>UC: Authorized
    UC->>RS: assignRolesToUser(userId, roleIds, assignedBy)
    RS->>DB: Find user by ID

    alt User not found
        RS-->>UC: throw NotFoundException
        UC-->>C: 404 Not Found
    end

    RS->>DB: Find roles by IDs

    alt Some roles not found
        RS-->>UC: throw BadRequestException
        UC-->>C: 400 Bad Request (invalid role IDs)
    end

    RS->>DB: Insert user_roles (with assigned_by, ignore duplicates)
    RS->>DB: Load user roles
    RS-->>UC: Roles[]
    UC-->>C: 200 OK {data: roles}
```

## 4. Permission Check Flow (PermissionsGuard)

```mermaid
sequenceDiagram
    participant C as Client
    participant Ctrl as Controller
    participant JG as JwtAuthGuard
    participant PG as PermissionsGuard
    participant RS as RolesService
    participant DB as Database

    C->>Ctrl: Request with Authorization: Bearer <token>
    Ctrl->>JG: Authenticate user
    JG->>JG: Verify JWT, extract user
    JG-->>Ctrl: Request with user context

    Ctrl->>PG: Check @RequirePermissions(['content:create'])
    PG->>PG: Get required permissions from metadata
    PG->>RS: getUserPermissions(userId)
    RS->>DB: SELECT DISTINCT p.* FROM permissions p<br/>JOIN role_permissions rp ON rp.permission_id = p.id<br/>JOIN user_roles ur ON ur.role_id = rp.role_id<br/>WHERE ur.user_id = ?
    RS-->>PG: Permission[]

    PG->>PG: Check if user has ALL required permissions

    alt Missing permissions
        PG-->>C: 403 Forbidden (insufficient permissions)
    end

    PG-->>Ctrl: Authorized
    Ctrl->>Ctrl: Execute handler
    Ctrl-->>C: Response
```

## 5. Get User Effective Permissions Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant UC as UsersController
    participant JG as JwtAuthGuard
    participant RS as RolesService
    participant DB as Database

    C->>UC: GET /users/{userId}/permissions
    UC->>JG: Authenticate user
    JG-->>UC: Authorized

    UC->>RS: getUserPermissions(userId)
    RS->>DB: Find user by ID

    alt User not found
        RS-->>UC: throw NotFoundException
        UC-->>C: 404 Not Found
    end

    RS->>DB: SELECT DISTINCT p.* FROM permissions p<br/>JOIN role_permissions rp ON rp.permission_id = p.id<br/>JOIN user_roles ur ON ur.role_id = rp.role_id<br/>WHERE ur.user_id = ?
    RS-->>UC: Permission[] (deduplicated)
    UC-->>C: 200 OK {data: permissions}
```

## 6. List Roles with Pagination Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RC as RolesController
    participant JG as JwtAuthGuard
    participant RS as RolesService
    participant DB as Database

    C->>RC: GET /roles?page=1&limit=20&isSystem=false
    RC->>JG: Authenticate user
    JG-->>RC: Authorized

    RC->>RS: listRoles({page, limit, isSystem})
    RS->>DB: SELECT * FROM roles WHERE is_system = ?<br/>ORDER BY created_at DESC<br/>LIMIT ? OFFSET ?
    RS->>DB: SELECT COUNT(*) FROM roles WHERE is_system = ?
    RS-->>RC: {data: Role[], meta: {page, limit, total, totalPages}}
    RC-->>C: 200 OK {data, meta}
```

## 7. Delete Role Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RC as RolesController
    participant PG as PermissionsGuard
    participant RS as RolesService
    participant DB as Database

    C->>RC: DELETE /roles/{roleId}
    RC->>PG: Check permission (roles:delete)

    alt No permission
        PG-->>C: 403 Forbidden
    end

    PG-->>RC: Authorized
    RC->>RS: deleteRole(roleId)
    RS->>DB: Find role by ID

    alt Role not found
        RS-->>RC: throw NotFoundException
        RC-->>C: 404 Not Found
    end

    alt Role is system role
        RS-->>RC: throw ForbiddenException
        RC-->>C: 403 Forbidden (cannot delete system role)
    end

    RS->>DB: DELETE FROM role_permissions WHERE role_id = ?
    RS->>DB: DELETE FROM user_roles WHERE role_id = ?
    RS->>DB: DELETE FROM roles WHERE id = ?
    RS-->>RC: void
    RC-->>C: 204 No Content
```

## Guard Architecture

### Guards Execution Order

```mermaid
flowchart LR
    A[Request] --> B[JwtAuthGuard]
    B --> C{Authenticated?}
    C -->|No| D[401 Unauthorized]
    C -->|Yes| E[RolesGuard]
    E --> F{Has Role?}
    F -->|No| G[403 Forbidden]
    F -->|Yes| H[PermissionsGuard]
    H --> I{Has Permission?}
    I -->|No| J[403 Forbidden]
    I -->|Yes| K[Controller Handler]
```

### Decorators

```typescript
// Role-based check
@Roles('admin', 'editor')
@UseGuards(JwtAuthGuard, RolesGuard)
async createContent() {}

// Permission-based check (more granular)
@RequirePermissions('content:create')
@UseGuards(JwtAuthGuard, PermissionsGuard)
async createContent() {}

// Combined (requires both role AND permissions)
@Roles('editor')
@RequirePermissions('content:create', 'content:publish')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
async publishContent() {}
```

## Default System Roles

| Role | Slug | Permissions |
|------|------|-------------|
| Super Admin | `super-admin` | All permissions (bypass checks) |
| Admin | `admin` | roles:*, permissions:*, users:manage-roles, content:* |
| Editor | `editor` | content:create, content:read, content:update |
| Reviewer | `reviewer` | content:read, workflow:review, workflow:approve |
| Viewer | `viewer` | content:read |

## Permission Naming Convention

Permissions follow the format: `resource:action`

| Resource | Actions |
|----------|---------|
| `roles` | create, read, update, delete |
| `permissions` | create, read, delete |
| `users` | read, update, delete, manage-roles |
| `content` | create, read, update, delete, publish |
| `workflow` | submit, review, approve, reject |
| `media` | upload, read, delete |

## Security Considerations

1. **System Roles Protection**: Roles with `is_system=true` cannot be deleted or have their slug modified
2. **Super Admin Bypass**: Users with `super-admin` role bypass all permission checks
3. **Permission Caching**: User permissions can be cached in Redis with TTL to reduce DB queries
4. **Audit Trail**: All role/permission changes should be logged via AuditService
5. **Self-Assignment Prevention**: Users cannot assign roles to themselves

---

## Future Enhancement: Workflow Integration

The RBAC module is designed to optionally integrate with the polymorphic workflow system in the future. When enabled, role/permission changes could require approval before taking effect.

See `docs/api/paths/workflows.yaml` and `docs/schema/workflow.dbml` for the workflow system design that supports:
- `content` (currently active)
- `role` (future)
- `permission` (future)
- `user_role` (future)
